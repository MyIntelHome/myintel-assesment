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

async function seedPayment(client: Client, id = "attempt-one", attempt = 1, state = "paid") {
  await client.execute({
    sql: "INSERT INTO payment_attempts (id,request_id,quote_version,attempt,amount_cents,mode,state,session_id,payment_intent_id,amount_refunded_cents,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    args: [id, "request", 2, attempt, 34900, "test", state, "cs_" + id, "pi_" + id, 1200, 1800000000, "created", "updated"],
  });
}

function oldSnapshot(backup: Snapshot): Snapshot {
  const payload = { version: 2 as const, createdAt: backup.createdAt, tables: backup.tables.filter(table => table.name !== "payment_attempts") };
  return { ...payload, checksum: createHash("sha256").update(JSON.stringify(payload)).digest("hex") };
}

it("backs up and restores the complete payment ledger in version 3", async () => {
  await seedPayment(source, "expired-attempt", 1, "expired");
  await seedPayment(source, "paid-attempt", 2);
  const backup = await exportSnapshot(source);
  expect(backup.version).toBe(3);
  expect((await restoreSnapshot(target, backup)).payment_attempts).toBe(2);
  expect((await exportSnapshot(target)).tables).toEqual(backup.tables);
});

it("restores a checksummed version 2 snapshot into an empty newly migrated target", async () => {
  await seed();
  const backup = oldSnapshot(await exportSnapshot(source));
  const counts = await restoreSnapshot(target, backup);
  expect(counts.case_archives).toBe(1);
  expect(counts.payment_attempts).toBe(0);
  expect((await exportSnapshot(target)).tables.filter(table => table.name !== "payment_attempts")).toEqual(backup.tables);
});

it("rejects tampering with a version 2 backup before any restore writes", async () => {
  await seed();
  const backup = oldSnapshot(await exportSnapshot(source));
  backup.tables[0]!.rows[0]![1] = "changed";
  await expect(restoreSnapshot(target, backup)).rejects.toThrow("checksum mismatch");
  expect((await target.execute("SELECT * FROM case_archives")).rows).toEqual([]);
});

it("refuses a version 2 restore when the new payment table contains data", async () => {
  await seed();
  await seedPayment(target);
  const backup = oldSnapshot(await exportSnapshot(source));
  await expect(restoreSnapshot(target, backup)).rejects.toThrow("empty destination");
  expect((await target.execute("SELECT * FROM payment_attempts")).rows).toHaveLength(1);
  expect((await target.execute("SELECT * FROM case_archives")).rows).toEqual([]);
});

it("rejects a version 3 backup omitting its payment ledger even with a recomputed checksum", async () => {
  const { checksum: _, ...oldPayload } = oldSnapshot(await exportSnapshot(source));
  const payload = { ...oldPayload, version: 3 };
  await expect(restoreSnapshot(target, { ...payload, checksum: createHash("sha256").update(JSON.stringify(payload)).digest("hex") })).rejects.toThrow("inventory mismatch");
});

it("enforces single active attempts and bounded payment amounts in the migrated database", async () => {
  await seedPayment(source);
  await expect(seedPayment(source, "second", 2, "open")).rejects.toThrow();
  await source.execute("UPDATE payment_attempts SET state='expired'");
  await seedPayment(source, "second", 2, "open");
  for (const update of ["attempt=0", "amount_cents=0", "amount_refunded_cents=-1", "amount_refunded_cents=34901", "mode='invalid'", "state='invalid'"]) {
    await expect(source.execute(`UPDATE payment_attempts SET ${update} WHERE id='second'`)).rejects.toThrow();
  }
  await expect(source.execute("UPDATE payment_attempts SET session_id='cs_attempt-one' WHERE id='second'")).rejects.toThrow();
  await expect(source.execute("UPDATE payment_attempts SET payment_intent_id='pi_attempt-one' WHERE id='second'")).rejects.toThrow();
  await expect(seedPayment(source, "duplicate-attempt", 1, "expired")).rejects.toThrow();
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
