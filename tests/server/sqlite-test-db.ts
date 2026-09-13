import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { Database, Statement } from "../../worker/api";

export const MYINTEL_MIGRATION = new URL("../../drizzle/0000_broad_green_goblin.sql", import.meta.url);

export class SqliteStatement implements Statement {
  private values: unknown[] = [];

  constructor(
    private readonly sqlite: DatabaseSync,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]): Statement {
    this.values = values;
    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return (this.sqlite.prepare(this.sql).get(...this.values as SQLInputValue[]) as T | undefined) ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    return { results: this.sqlite.prepare(this.sql).all(...this.values as SQLInputValue[]) as T[] };
  }

  async run(): Promise<{ meta: { changes: number } }> {
    const result = this.sqlite.prepare(this.sql).run(...this.values as SQLInputValue[]);
    return { meta: { changes: Number(result.changes) } };
  }
}

/** A synchronous node:sqlite database exposed through the Worker's D1-shaped interface. */
export class SqliteTestDatabase implements Database {
  readonly sqlite = new DatabaseSync(":memory:");

  constructor(migrationPath = MYINTEL_MIGRATION) {
    this.sqlite.exec(
      readFileSync(migrationPath, "utf8").replaceAll("--> statement-breakpoint", ""),
    );
    this.sqlite.exec(readFileSync(new URL("../../drizzle/0002_stormy_carnage.sql",import.meta.url),"utf8"));
    this.sqlite.exec(readFileSync(new URL("../../drizzle/0003_nebulous_viper.sql",import.meta.url),"utf8"));
    this.sqlite.exec(readFileSync(new URL("../../drizzle/0006_known_argent.sql",import.meta.url),"utf8"));
  }

  prepare(sql: string): Statement {
    return new SqliteStatement(this.sqlite, sql);
  }

  async batch(statements: Statement[]): Promise<{ meta: { changes: number } }[]> {
    this.sqlite.exec("BEGIN");
    try {
      const results: { meta: { changes: number } }[] = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  close() {
    this.sqlite.close();
  }
}
