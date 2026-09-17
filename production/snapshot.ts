import { createHash } from "node:crypto";
import type { Client } from "@libsql/client";
import { z } from "zod";

export const applicationTables = [
  "case_archives", "home_handoffs", "home_photos", "payment_events",
  "professional_access", "professional_access_events", "provider_account_events",
  "provider_accounts", "providers", "request_coordinators", "request_events",
  "request_followup_events", "request_followups", "request_professional_events",
  "request_professional_grants", "service_requests",
] as const;

const snapshotSchema = z.object({
  version: z.literal(2), createdAt: z.string().datetime(),
  tables: z.array(z.object({
    name: z.string(), columns: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number().finite(), z.null()]))),
  }).strict()),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type Snapshot = z.infer<typeof snapshotSchema>;
export type SnapshotTable = Snapshot["tables"][number];

function hash(value: Omit<Snapshot, "checksum">) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function createSnapshot(tables: SnapshotTable[], createdAt = new Date().toISOString()): Snapshot {
  if (tables.map(table => table.name).join(",") !== applicationTables.join(",")) {
    throw new Error("Backup table inventory mismatch");
  }
  const payload = { version: 2 as const, createdAt, tables };
  return snapshotSchema.parse({ ...payload, checksum: hash(payload) });
}

/** Sensitive backup data. The caller must store it privately, outside Git. */
export async function exportSnapshot(client: Client): Promise<Snapshot> {
  const tx = await client.transaction("read");
  try {
    const tables: Snapshot["tables"] = [];
    for (const name of applicationTables) {
      const result = await tx.execute(`SELECT * FROM "${name}" ORDER BY 1`);
      tables.push({ name, columns: result.columns, rows: result.rows.map(row => result.columns.map(column => {
        const value = row[column];
        if (value === null || typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) return value;
        throw new Error("Unsupported backup value; do not coerce record data");
      })) });
    }
    await tx.commit();
    return createSnapshot(tables);
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

/** Restore only to a migrated, empty target. Never clear or overwrite records. */
export async function restoreSnapshot(client: Client, input: unknown): Promise<Record<string, number>> {
  const { checksum, ...payload } = snapshotSchema.parse(input);
  if (hash(payload) !== checksum) throw new Error("Backup checksum mismatch");
  if (payload.tables.map(t => t.name).join(",") !== applicationTables.join(",")) throw new Error("Backup table inventory mismatch");
  const tx = await client.transaction("write");
  try {
    // Check the entire destination before writing any record.
    for (const table of payload.tables) {
      const columns = (await tx.execute(`PRAGMA table_info("${table.name}")`)).rows.map(row => String(row.name));
      if (columns.join(",") !== table.columns.join(",")) throw new Error("Backup schema differs from destination");
      const count = await tx.execute(`SELECT COUNT(*) AS total FROM "${table.name}"`);
      if (count.rows[0]?.total !== 0) throw new Error("Restore requires an empty destination");
      if (table.rows.some(row => row.length !== columns.length)) throw new Error("Backup row shape mismatch");
    }
    const counts: Record<string, number> = {};
    for (const table of payload.tables) {
      const sql = `INSERT INTO "${table.name}" (${table.columns.map(c => `"${c}"`).join(",")}) VALUES (${table.columns.map(() => "?").join(",")})`;
      for (const row of table.rows) await tx.execute({ sql, args: row });
      const restored = await tx.execute(`SELECT * FROM "${table.name}" ORDER BY 1`);
      const rows = restored.rows.map(row => table.columns.map(c => row[c]));
      if (JSON.stringify(rows) !== JSON.stringify(table.rows)) throw new Error("Restored records differ from backup");
      counts[table.name] = rows.length;
    }
    await tx.commit();
    return counts;
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}
