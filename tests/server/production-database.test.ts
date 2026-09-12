import { afterEach, beforeEach, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { createHash } from "node:crypto";
import { LibsqlDatabase, createProductionDatabase } from "../../production/database";
import { applyMigrations, readMigrations } from "../../production/migrations";
import { exportSnapshot, restoreSnapshot, type Snapshot } from "../../production/snapshot";
import { handleApi, type Env } from "../../worker/api";

let source: Client, target: Client, db: LibsqlDatabase;
beforeEach(async () => {
  source = createClient({ url: ":memory:" }); target = createClient({ url: ":memory:" });
  await applyMigrations(source, await readMigrations());
  await applyMigrations(target, await readMigrations());
  db = new LibsqlDatabase(source);
});
afterEach(() => { source.close(); target.close(); });

it("refuses missing credentials, local database fallbacks and disabled TLS in production", () => {
  for (const url of [undefined, ":memory:", "file:resident.db", "http://database.test", "libsql://database.test?tls=0", "libsql://user:password@database.test"]) {
    expect(() => createProductionDatabase({ url, authToken: "example-test-token" })).toThrow();
  }
  expect(() => createProductionDatabase({ url: "libsql://database.test" })).toThrow();
});

it("preserves conditional-write changes() semantics and audit idempotency in a real libSQL batch", async () => {
  const batch = () => db.batch([
    db.prepare("INSERT INTO request_coordinators VALUES (?,?,?,?) ON CONFLICT DO NOTHING").bind("request", "staff", "Staff", "now"),
    db.prepare("INSERT INTO request_events VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING").bind("event", "request", "staff", "coordinator_assigned", "now"),
  ]);
  expect((await batch()).map(r => r.meta.changes)).toEqual([1, 1]);
  expect((await batch()).map(r => r.meta.changes)).toEqual([0, 0]);
  const result = await db.batch([
    db.prepare("DELETE FROM request_coordinators WHERE staff_id=?").bind("other"),
    db.prepare("INSERT INTO request_events SELECT ?,?,?,?,? WHERE changes()=1").bind("wrong-event", "request", "other", "released", "now"),
  ]);
  expect(result.map(r => r.meta.changes)).toEqual([0, 0]);
  expect(await db.prepare("SELECT * FROM request_events WHERE id=?").bind("wrong-event").first()).toBeNull();
});

it("rolls back all statements when a batch fails", async () => {
  await expect(db.batch([
    db.prepare("INSERT INTO request_coordinators VALUES (?,?,?,?)").bind("request", "staff", "Staff", "now"),
    db.prepare("INSERT INTO no_such_table VALUES (?)").bind("invalid"),
  ])).rejects.toThrow();
  expect(await db.prepare("SELECT * FROM request_coordinators").all()).toEqual({ results: [] });
});

it("rejects mixed-database batches and invalid bound values", async () => {
  await expect(db.batch([new LibsqlDatabase(target).prepare("SELECT 1")])).rejects.toThrow("belong");
  expect(() => db.prepare("SELECT ?").bind(undefined)).toThrow();
  expect(() => db.prepare("SELECT ?").bind(NaN)).toThrow();
});

it("keeps migration history idempotent and detects altered or missing applied migrations", async () => {
  const migrations = await readMigrations();
  expect(await applyMigrations(source, migrations)).toEqual([]);
  await expect(applyMigrations(source, [{ ...migrations[0]!, sql: migrations[0]!.sql + "\n-- changed" }, ...migrations.slice(1)])).rejects.toThrow("history differs");
  await expect(applyMigrations(source, migrations.slice(0, -1))).rejects.toThrow("unknown");
});

it("rolls back pending migrations and their journal together", async () => {
  const migrations = await readMigrations();
  await expect(applyMigrations(source, [...migrations,
    { name: "0004_test.sql", sql: "CREATE TABLE test_migration (id TEXT);" },
    { name: "0005_broken.sql", sql: "INSERT INTO missing_table VALUES ('x');" },
  ])).rejects.toThrow();
  expect((await source.execute("SELECT name FROM sqlite_master WHERE name='test_migration'")).rows).toEqual([]);
  expect(await applyMigrations(source, migrations)).toEqual([]);
});

it("refuses to adopt an existing unjournaled database", async () => {
  const existing = createClient({ url: ":memory:" });
  try {
    await existing.execute("CREATE TABLE resident_data (id TEXT)");
    await expect(applyMigrations(existing, await readMigrations())).rejects.toThrow("no verified migration journal");
  } finally { existing.close(); }
});

async function seed() {
  await db.prepare("INSERT INTO case_archives VALUES (?,?,?,?)").bind("original-sites-user", JSON.stringify({ cases: [{ id: "assessment", reportVersions: [{ id: "signed-v1", text: "Preserved report" }] }] }), 7, "now").run();
  await db.prepare("INSERT INTO home_handoffs VALUES (?,?,?)").bind("request", '{"summary":"Consented snapshot"}', "consent-time").run();
  await db.prepare("INSERT INTO home_photos VALUES (?,?,?,?,?,?,?)").bind("photo", "request", "Room", "wide", "private/original-object", 1, "now").run();
  await db.prepare("INSERT INTO request_coordinators VALUES (?,?,?,?)").bind("request", "staff", "Staff", "now").run();
  await db.prepare("INSERT INTO request_events VALUES (?,?,?,?,?)").bind("event", "request", "staff", "coordinator_assigned", "now").run();
}

it("rehearses backup and exact restore of revisions, signed history, consent, photo references and staff ownership", async () => {
  await seed();
  const backup = await exportSnapshot(source);
  const counts = await restoreSnapshot(target, backup);
  expect(counts.case_archives).toBe(1); expect(counts.home_photos).toBe(1);
  expect((await exportSnapshot(target)).tables).toEqual(backup.tables);
  expect((await exportSnapshot(source)).tables).toEqual(backup.tables);
  await expect(restoreSnapshot(target, backup)).rejects.toThrow("empty destination");
});

it("detects backup corruption before writing", async () => {
  await seed(); const backup = await exportSnapshot(source);
  backup.tables[0]!.rows[0]![1] = "corrupted";
  await expect(restoreSnapshot(target, backup)).rejects.toThrow("checksum mismatch");
  expect((await target.execute("SELECT * FROM case_archives")).rows).toEqual([]);
});

it("rolls back a restore that fails after some records were inserted", async () => {
  await seed(); const backup = await exportSnapshot(source);
  const photos = backup.tables.find(t => t.name === "home_photos")!;
  photos.rows.push([...photos.rows[0]!]);
  const { checksum: _, ...payload } = backup;
  const duplicate: Snapshot = { ...payload, checksum: createHash("sha256").update(JSON.stringify(payload)).digest("hex") };
  await expect(restoreSnapshot(target, duplicate)).rejects.toThrow();
  expect((await target.execute("SELECT * FROM case_archives")).rows).toEqual([]);
  expect((await target.execute("SELECT * FROM home_handoffs")).rows).toEqual([]);
});

it("runs account isolation and request retries against the production database adapter", async () => {
  const env: Env = { DB: db, ASSETS: { fetch: async () => new Response("") } };
  const call = (path: string, user: string, method = "GET", body?: unknown) => handleApi(new Request("https://app.test" + path, {
    method, headers: { origin: "https://app.test", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
  }), env, async () => ({ id: user, email: user + "@example.test", emailVerified: true }));
  const id = crypto.randomUUID();
  const data = { idempotencyKey: id, service: "home_modifications", name: "Example Resident", postalCode: "80202", contactMethod: "email", relationship: "self", consent: true };
  expect((await call("/api/requests", "alice", "POST", data)).status).toBe(201);
  expect((await call("/api/requests", "alice", "POST", data)).status).toBe(200);
  expect((await call("/api/requests", "bob", "POST", data)).status).toBe(409);
  expect((await (await call("/api/requests", "bob")).json()).requests).toEqual([]);
  expect((await (await call("/api/requests", "alice")).json()).requests).toHaveLength(1);
});
