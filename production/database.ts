import type { Client, InStatement, InValue, ResultSet } from "@libsql/client";
import { createClient } from "@libsql/client/web";
import type { Database, Statement } from "../worker/api";

export function createProductionDatabase(settings: { url?: string; authToken?: string }): LibsqlDatabase {
  if (!settings.url || !settings.authToken?.trim()) throw new Error("Production database is not configured");
  const url = new URL(settings.url);
  if (url.protocol !== "libsql:" || !url.hostname || url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== "/")) {
    throw new Error("Production database requires a secure libSQL service URL");
  }
  return new LibsqlDatabase(createClient({ url: settings.url, authToken: settings.authToken, intMode: "number" }));
}

function argument(value: unknown): InValue {
  if (value === null || typeof value === "string" || typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Uint8Array) return value;
  throw new TypeError("Unsupported database parameter");
}

class LibsqlStatement implements Statement {
  constructor(readonly owner: LibsqlDatabase, readonly sql: string, readonly args: InValue[] = []) {}
  bind(...values: unknown[]): Statement {
    return new LibsqlStatement(this.owner, this.sql, values.map(argument));
  }
  query(): InStatement { return { sql: this.sql, args: this.args }; }
  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const result = await this.owner.client.execute(this.query());
    return (result.rows[0] as T | undefined) ?? null;
  }
  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    return { results: (await this.owner.client.execute(this.query())).rows as T[] };
  }
  async run(): Promise<{ meta: { changes: number } }> {
    return metadata(await this.owner.client.execute(this.query()));
  }
}

function metadata(result: ResultSet) { return { meta: { changes: result.rowsAffected } }; }

/** D1-compatible API over libSQL; no local files are used by the hosted client. */
export class LibsqlDatabase implements Database {
  constructor(readonly client: Client) {}
  prepare(sql: string): Statement { return new LibsqlStatement(this, sql); }
  async batch(statements: Statement[]): Promise<{ meta: { changes: number } }[]> {
    if (!statements.length) return [];
    const queries = statements.map(statement => {
      if (!(statement instanceof LibsqlStatement) || statement.owner !== this) {
        throw new TypeError("Batch statements must belong to this database");
      }
      return statement.query();
    });
    // One write transaction is essential: the API uses SQLite changes() to
    // couple access/coordination audit events to successful conditional writes.
    return (await this.client.batch(queries, "write")).map(metadata);
  }
}
