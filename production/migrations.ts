import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type Client } from "@libsql/client";

export const migrationFiles = [
  "0000_broad_green_goblin.sql", "0001_nebulous_karma.sql",
  "0002_stormy_carnage.sql", "0003_nebulous_viper.sql",
] as const;
export interface Migration { name: string; sql: string }

export async function readMigrations(): Promise<Migration[]> {
  return Promise.all(migrationFiles.map(async name => ({
    name, sql: await readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8"),
  })));
}

/** All pending migrations and their journal commit or roll back together. */
export async function applyMigrations(client: Client, migrations: Migration[]): Promise<string[]> {
  if (new Set(migrations.map(m => m.name)).size !== migrations.length) throw new Error("Duplicate migration names");
  const tx = await client.transaction("write");
  try {
    const tables = (await tx.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).rows.map(r => String(r.name));
    if (tables.length && !tables.includes("myintel_migrations")) {
      throw new Error("Existing database has no verified migration journal; restore into an empty target instead");
    }
    await tx.execute("CREATE TABLE IF NOT EXISTS myintel_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)");
    const previous = (await tx.execute("SELECT name, checksum FROM myintel_migrations ORDER BY name")).rows;
    if (previous.length > migrations.length) throw new Error("Database contains unknown migrations");
    for (let i = 0; i < previous.length; i++) {
      const migration = migrations[i]!;
      if (previous[i]!.name !== migration.name || previous[i]!.checksum !== checksum(migration.sql)) {
        throw new Error("Applied migration history differs from this release");
      }
    }
    const applied: string[] = [];
    for (const migration of migrations.slice(previous.length)) {
      // The checked-in migrations contain table/index DDL, without triggers or
      // semicolons inside string literals. Do not use this for arbitrary SQL dumps.
      const statements = migration.sql.replaceAll("--> statement-breakpoint", "").split(";").map(s => s.trim()).filter(Boolean);
      for (const sql of statements) await tx.execute(sql);
      await tx.execute({ sql: "INSERT INTO myintel_migrations (name, checksum, applied_at) VALUES (?, ?, ?)", args: [migration.name, checksum(migration.sql), new Date().toISOString()] });
      applied.push(migration.name);
    }
    await tx.commit();
    return applied;
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally { tx.close(); }
}

function checksum(sql: string) {
  return createHash("sha256").update(sql.replaceAll("\r\n", "\n")).digest("hex");
}

// Explicit operator command only. Never run migrations during request handling
// or a deployment build. An incorrect/missing target must not create a local DB.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.env.MYINTEL_DATABASE_URL;
  const authToken = process.env.MYINTEL_DATABASE_AUTH_TOKEN;
  if (!url || !authToken || !url.startsWith("libsql://") || process.env.MYINTEL_MIGRATION_TARGET !== url) {
    console.error("Migration blocked: set the database credentials and explicitly confirm MYINTEL_MIGRATION_TARGET matches the database URL.");
    process.exitCode = 1;
  } else {
    const client = createClient({ url, authToken });
    try {
      const applied = await applyMigrations(client, await readMigrations());
      console.log(`Migration complete: ${applied.length} migration(s) applied.`);
    } catch {
      console.error("Migration completion was not confirmed. Inspect the target and migration journal before retrying; a lost response may leave the commit outcome uncertain.");
      process.exitCode = 1;
    } finally { client.close(); }
  }
}
