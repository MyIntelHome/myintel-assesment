import { afterEach, beforeEach, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { LibsqlDatabase, createProductionDatabase } from "../../production/database";
import { applyMigrations, readMigrations } from "../../production/migrations";
import { exportSnapshot, restoreSnapshot, createSnapshot,legacyApplicationTables,previousApplicationTables,paymentApplicationTables,billingApplicationTables,type Snapshot } from "../../production/snapshot";
import { handleApi, type Env } from "../../worker/api";

let source: Client, target: Client, db: LibsqlDatabase;
beforeEach(async () => {
  source = createClient({ url: ":memory:" }); target = createClient({ url: ":memory:" });
  await applyMigrations(source, await readMigrations());
  await applyMigrations(target, await readMigrations());
  db = new LibsqlDatabase(source);
});
afterEach(() => { source.close(); target.close(); });
it('rolls back professional credit writes and nested batches within a real libSQL write transaction',async()=>{
 await expect(db.writeTransaction(async tx=>{await tx.batch([tx.prepare("INSERT INTO professional_billing(user_id) VALUES (?)").bind('synthetic-billing')]);throw Error('simulated save failure')})).rejects.toThrow('simulated save failure');
 expect(await db.prepare('SELECT * FROM professional_billing').all()).toEqual({results:[]});
 await db.writeTransaction(async tx=>{await tx.batch([tx.prepare("INSERT INTO professional_billing(user_id) VALUES (?)").bind('synthetic-billing')]);});
 expect((await db.prepare('SELECT * FROM professional_billing').all()).results).toHaveLength(1);
});
it('restores a previous v2 backup into an empty expanded database but never overwrites new lead records',async()=>{
 const full=await exportSnapshot(source);expect(full.version).toBe(5);expect(full.tables).toHaveLength(25);expect(full.tables.map(t=>t.name)).toContain('professional_credits');
 const old=createSnapshot(full.tables.filter(t=>(legacyApplicationTables as readonly string[]).includes(t.name)));expect(old.version).toBe(2);await restoreSnapshot(target,old);
 await target.execute("INSERT INTO funnel_counts VALUES ('2026-10-06','check_started','',1)");await expect(restoreSnapshot(target,old)).rejects.toThrow('empty destination');
});
it('restores v3 backups only into empty billing tables',async()=>{
 const full=await exportSnapshot(source),old=createSnapshot(full.tables.filter(t=>previousApplicationTables.includes(t.name)));
 expect(old.version).toBe(3);await restoreSnapshot(target,old);
 await target.execute("INSERT INTO professional_billing(user_id) VALUES ('synthetic')");await expect(restoreSnapshot(target,old)).rejects.toThrow('empty destination');
});

async function seedPayment(client:Client) {
 await client.execute("INSERT INTO payment_attempts (id,request_id,quote_version,attempt,amount_cents,mode,state,session_id,payment_intent_id,amount_refunded_cents,expires_at,created_at,updated_at) VALUES ('attempt-preserved','request',2,1,1900,'test','paid','cs_preserved','pi_preserved',100,2000000000,'created','updated')");
}
async function paymentBackup(client:Client) {
 const tables=[];
 for(const name of paymentApplicationTables){
  const result=await client.execute(`SELECT * FROM "${name}" ORDER BY 1`);
  tables.push({name,columns:result.columns,rows:result.rows.map(row=>result.columns.map(column=>row[column] as string|number|null))});
 }
 return createSnapshot(tables,'2026-10-07T12:00:00.000Z');
}
it('preserves the verified historical payment migration checksum',async()=>{
 const sql=await readFile(new URL('../../drizzle/0007_payment_attempts.sql',import.meta.url),'utf8');
 expect(createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex')).toBe('d82013fce568898d93c6b1cd92486cda76bf7be18cbb14ff5a28afafe361f139');
});
it('adds billing to the older payment preview without rewriting its ledger or journal and backs up all 25 tables',async()=>{
 const old=createClient({url:':memory:'});
 try{
  const migrations=await readMigrations();
  await applyMigrations(old,migrations.slice(0,8));await seedPayment(old);
  const journal=(await old.execute('SELECT * FROM myintel_migrations ORDER BY name')).rows;
  const ledger=(await old.execute('SELECT * FROM payment_attempts')).rows;
  const before=await exportSnapshot(old);expect(before.version).toBe(3);expect(before.tables).toHaveLength(17);
  expect(await applyMigrations(old,migrations)).toEqual(['0007_plan_capture.sql','0008_professional_billing.sql','0009_unified_preview_lineage.sql']);
  expect((await old.execute('SELECT * FROM payment_attempts')).rows).toEqual(ledger);
  expect((await old.execute('SELECT * FROM myintel_migrations ORDER BY name')).rows.filter(row=>journal.some(entry=>entry.name===row.name))).toEqual(journal);
  const backup=await exportSnapshot(old);expect(backup.version).toBe(5);expect(backup.tables).toHaveLength(25);
  expect(backup.tables.filter(table=>paymentApplicationTables.includes(table.name))).toEqual(before.tables);
  await restoreSnapshot(target,backup);expect((await exportSnapshot(target)).tables).toEqual(backup.tables);
  expect(await applyMigrations(old,migrations)).toEqual([]);
 }finally{old.close()}
});
it('preserves a verified plan-only or billing lineage while adding the missing payment migration',async()=>{
 const migrations=await readMigrations();
 for(const billing of [false,true]){
  const old=createClient({url:':memory:'});try{
   const lineage=migrations.filter(m=>m.name!=='0007_payment_attempts.sql'&&m.name!=='0009_unified_preview_lineage.sql'&&(billing||m.name!=='0008_professional_billing.sql'));
   await applyMigrations(old,lineage);
   const before=await exportSnapshot(old);expect(before.version).toBe(billing?4:3);expect(before.tables).toHaveLength(billing?24:20);
   const journal=(await old.execute('SELECT * FROM myintel_migrations ORDER BY name')).rows;
   expect(await applyMigrations(old,migrations)).toEqual(billing?['0007_payment_attempts.sql','0009_unified_preview_lineage.sql']:['0007_payment_attempts.sql','0008_professional_billing.sql','0009_unified_preview_lineage.sql']);
   expect((await old.execute('SELECT * FROM myintel_migrations ORDER BY name')).rows.filter(row=>journal.some(entry=>entry.name===row.name))).toEqual(journal);
  }finally{old.close()}
 }
});
it('exports the pre-upgrade base schema and refuses a partially missing application inventory',async()=>{
 const old=createClient({url:':memory:'});try{
  await applyMigrations(old,(await readMigrations()).slice(0,7));
  const backup=await exportSnapshot(old);expect(backup.version).toBe(2);expect(backup.tables).toHaveLength(16);
  await old.execute('DROP TABLE home_photos');
  await expect(exportSnapshot(old)).rejects.toThrow('inventory mismatch');
 }finally{old.close()}
});
it('appends only the metadata marker to a previously unified database without changing its schema',async()=>{
 const old=createClient({url:':memory:'});try{
  const migrations=await readMigrations();await applyMigrations(old,migrations.slice(0,-1));
  const schema=(await old.execute("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name")).rows;
  const journal=(await old.execute('SELECT * FROM myintel_migrations ORDER BY name')).rows;
  expect(await applyMigrations(old,migrations)).toEqual(['0009_unified_preview_lineage.sql']);
  expect((await old.execute("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name")).rows).toEqual(schema);
  expect((await old.execute('SELECT * FROM myintel_migrations ORDER BY name')).rows.slice(0,-1)).toEqual(journal);
 }finally{old.close()}
});
it('restores the original 17-table payment v3 checksum and retains its paid and refunded ledger data',async()=>{
 await seedPayment(source);const backup=await paymentBackup(source);
 const {checksum,...payload}=backup;expect(checksum).toBe(createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
 const counts=await restoreSnapshot(target,backup);expect(counts.payment_attempts).toBe(1);
 expect((await paymentBackup(target)).tables).toEqual(backup.tables);
 await expect(restoreSnapshot(target,backup)).rejects.toThrow('empty destination');
});
it('restores historical 24-table billing v4 backups while requiring the payment ledger to be empty',async()=>{
 const full=await exportSnapshot(source),old=createSnapshot(full.tables.filter(t=>billingApplicationTables.includes(t.name)));
 expect(old.version).toBe(4);await restoreSnapshot(target,old);
 await seedPayment(target);await expect(restoreSnapshot(target,old)).rejects.toThrow('empty destination');
});
it('rejects missing base migration entries and unknown journal names without applying pending migrations',async()=>{
 const old=createClient({url:':memory:'});try{
  const migrations=await readMigrations();await applyMigrations(old,migrations.slice(0,8));
  await old.execute("DELETE FROM myintel_migrations WHERE name='0002_stormy_carnage.sql'");
  await expect(applyMigrations(old,migrations)).rejects.toThrow('recognized release prefix');
  expect((await old.execute("SELECT name FROM sqlite_master WHERE name='professional_billing'")).rows).toEqual([]);
  await old.execute("INSERT INTO myintel_migrations VALUES ('unknown.sql','unchanged','original')");
  await expect(applyMigrations(old,migrations)).rejects.toThrow('unknown');
 }finally{old.close()}
});

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
