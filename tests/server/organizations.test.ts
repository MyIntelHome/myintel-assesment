import { beforeEach, afterEach, expect, it } from "vitest";
import { handleApi, type Env } from "../../worker/api";
import { SqliteTestDatabase } from "./sqlite-test-db";
import { normalise } from "../../src/lib/case-store";
let db: SqliteTestDatabase, env: Env;
const origin = "https://app.test";
beforeEach(() => {
  db = new SqliteTestDatabase();
  env = { DB: db, ASSETS: { fetch: async () => new Response("") }, APP_ORIGIN: origin, ORGANIZATIONS: true };
  for (const user of ["owner", "member", "outside"]) db.sqlite.prepare("INSERT INTO professional_access VALUES (?,?,?,?,?,?,'approved',1,'','now')").run(user, `${user}@example.test`, user, 'Example practice', 'TEST', 'CO');
});
afterEach(() => db.close());
async function call(path: string, user: string | null = "owner", method = "GET", data?: unknown, headers: Record<string, string> = {}) {
  const r = await handleApi(new Request(origin + path, { method, headers: { "content-type": "application/json", origin, ...headers }, body: data ? JSON.stringify(data) : undefined }), env,
    async () => user ? { id: user, email: `${user}@example.test`, emailVerified: true, name: user } : null);
  return { status: r.status, data: await r.json() };
}
async function create(owner = "owner", name = "Example practice") {
  const organizationId = crypto.randomUUID();
  const r = await call("/api/organizations", owner, "POST", { id: organizationId, name });
  expect(r.status, r.data.error).toBe(201); return organizationId;
}
const detail = (organizationId: string, user = "owner") => call(`/api/organizations/${organizationId}`, user);
async function invite(organizationId: string, recipient = "member") {
  const r = await call(`/api/organizations/${organizationId}/invitations`, "owner", "POST", { revision: (await detail(organizationId)).data.organization.revision, email: `${recipient}@example.test` });
  expect(r.status, r.data.error).toBe(201); return r.data.invitation.id as string;
}
async function join(organizationId: string, user = "member") {
  const invitationId = await invite(organizationId, user);
  const r = await call("/api/organizations/accept", user, "POST", { invitationId });
  expect(r.status, r.data.error).toBe(200); return invitationId;
}
async function seedCase(user = "owner", caseId = "clinical-case") {
  const c = normalise({ id: caseId, audience: "clinician", reference: "PRIVATE-REFERENCE", spaces: [{ id: "door", type: "entry", label: "PRIVATE-ROOM" }], responses: { door: { e1: { status: "critical" } } }, documentation: { clientSummary: "PRIVATE-NARRATIVE" } });
  const r = await call('/api/cases?audience=clinician', user, 'PUT', { ownerId: user, revision: 0, archive: { activeId: caseId, cases: [c] } });
  expect(r.status, r.data.error).toBe(200); return c;
}
async function share(organizationId: string, user = "owner", caseId = "clinical-case") {
  const preview = await call(`/api/organizations/${organizationId}/summary-preview?caseId=${caseId}`, user);
  expect(preview.status, preview.data.error).toBe(200);
  return call(`/api/organizations/${organizationId}/summaries`, user, "POST", { revision: (await detail(organizationId, user)).data.organization.revision, caseId, sourceRevision: preview.data.sourceRevision, consent: true });
}
it('defaults off and ignores forged identity or admin headers', async () => {
  env.ORGANIZATIONS = false;
  expect((await call('/api/organization-config', null)).data.enabled).toBe(false);
  expect((await call('/api/organizations')).status).toBe(503);
  env.ORGANIZATIONS = true;
  expect((await call('/api/organizations', null, 'GET', undefined, { 'oai-authenticated-user-id': 'owner', 'oai-authenticated-user-email': 'owner@example.test' })).status).toBe(401);
});
it('creates an organization idempotently and does not treat a practice-name match as membership', async () => {
  const organizationId = await create();
  expect((await call('/api/organizations', 'owner', 'POST', { id: organizationId, name: 'Example practice' })).status).toBe(200);
  expect((await call('/api/organizations', 'outside')).data.organizations).toEqual([]);
  expect((await detail(organizationId, 'outside')).status).toBe(404);
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM organization_events').get()!.n).toBe(1);
});
it('binds invitation acceptance to the verified email and records no email send', async () => {
  const organizationId = await create(), invitationId = await invite(organizationId);
  expect((await call('/api/organizations', 'member')).data.invitations[0].id).toBe(invitationId);
  expect((await call('/api/organizations/accept', 'outside', 'POST', { invitationId })).status).toBe(404);
  const accepted = await call('/api/organizations/accept', 'member', 'POST', { invitationId });expect(accepted.status).toBe(200);
  expect((await detail(organizationId, 'member')).data.organization.role).toBe('member');
  expect((await call('/api/organizations/accept', 'member', 'POST', { invitationId })).status).toBe(200);
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM organization_members').get()!.n).toBe(2);
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM lead_mail').get()!.n).toBe(0);
});
it('rejects expired and withdrawn invitations and allows a fresh invitation after expiry', async () => {
  const organizationId = await create(), invitationId = await invite(organizationId);
  db.sqlite.prepare("UPDATE organization_invitations SET expires_at='2000-01-01T00:00:00Z' WHERE id=?").run(invitationId);
  expect((await call('/api/organizations/accept', 'member', 'POST', { invitationId })).status).toBe(409);
  const next = await invite(organizationId);
  const r = await call(`/api/organizations/${organizationId}/invitations/${next}/revoke`, 'owner', 'POST', { revision: (await detail(organizationId)).data.organization.revision });expect(r.status).toBe(200);
  expect((await call('/api/organizations/accept', 'member', 'POST', { invitationId: next })).status).toBe(409);
});
it('prevents member administration, owner removal and stale mutations without stray audit writes', async () => {
  const organizationId = await create();await join(organizationId);
  const rev = (await detail(organizationId)).data.organization.revision;
  const events = db.sqlite.prepare('SELECT COUNT(*) AS n FROM organization_events').get()!.n;
  expect((await call(`/api/organizations/${organizationId}/invitations`, 'member', 'POST', { revision: rev, email: 'new@example.test' })).status).toBe(403);
  expect((await call(`/api/organizations/${organizationId}/members/owner/remove`, 'owner', 'POST', { revision: rev })).status).toBe(409);
  expect((await call(`/api/organizations/${organizationId}/invitations`, 'owner', 'POST', { revision: 1, email: 'new@example.test' })).status).toBe(409);
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM organization_events').get()!.n).toBe(events);
});
it('requires explicit sharing consent and shares only a server-derived summary with approved members', async () => {
  const organizationId = await create();await join(organizationId);await seedCase();
  const base = { revision: (await detail(organizationId)).data.organization.revision, caseId: 'clinical-case', sourceRevision: 1 };
  expect((await call(`/api/organizations/${organizationId}/summaries`, 'owner', 'POST', { ...base, consent: false })).status).toBe(400);
  expect((await call(`/api/organizations/${organizationId}/summaries`, 'owner', 'POST', { ...base, consent: true, payload: { findings: 0 } })).status).toBe(400);
  expect((await share(organizationId)).status).toBe(200);
  const r = await detail(organizationId, 'member');expect(r.data.summaries[0]).toMatchObject({ critical: 1, concernPercent: 100, incomplete: true, own: false });
  expect(JSON.stringify(r.data)).not.toMatch(/PRIVATE-NARRATIVE|PRIVATE-REFERENCE|PRIVATE-ROOM|clinical-case/);
  expect((await call('/api/cases?audience=clinician', 'member')).data.archive).toBeNull();
  expect(db.sqlite.prepare('SELECT consent_version FROM organization_case_summaries').get()!.consent_version).toBe('organization-summary-2026-10-27');
});
it('does not let another assessor share an owner case or use a stale case preview', async () => {
  const organizationId = await create();await join(organizationId);await seedCase();
  expect((await call(`/api/organizations/${organizationId}/summary-preview?caseId=clinical-case`, 'member')).status).toBe(404);
  const revision = (await detail(organizationId)).data.organization.revision;
  expect((await call(`/api/organizations/${organizationId}/summaries`, 'owner', 'POST', { revision, caseId: 'clinical-case', sourceRevision: 0, consent: true })).status).toBe(409);
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM organization_case_summaries').get()!.n).toBe(0);
});
it('keeps a shared snapshot unchanged until explicitly refreshed and withdraws it without touching private records', async () => {
  const organizationId = await create();await join(organizationId);await seedCase();await share(organizationId);
  const first = (await detail(organizationId)).data.summaries[0];
  const archive = db.sqlite.prepare('SELECT payload FROM case_archives WHERE user_id=?').get('owner')!.payload as string;
  const changed = JSON.parse(archive);changed.cases[0].responses.door.e1.status='pass';
  db.sqlite.prepare('UPDATE case_archives SET payload=?,revision=2 WHERE user_id=?').run(JSON.stringify(changed),'owner');
  expect((await detail(organizationId)).data.summaries[0].critical).toBe(1);
  await share(organizationId);expect((await detail(organizationId)).data.summaries[0]).toMatchObject({ id:first.id,critical:0 });
  expect(db.sqlite.prepare("SELECT subject_id FROM organization_events WHERE type='summary_shared'").all().map(row=>row.subject_id)).toEqual([first.id,first.id]);
  const rev=(await detail(organizationId)).data.organization.revision;
  expect((await call(`/api/organizations/${organizationId}/summaries/${first.id}/withdraw`,'owner','POST',{revision:rev})).status).toBe(200);
  expect((await detail(organizationId,'member')).data.summaries).toEqual([]);
  expect(db.sqlite.prepare('SELECT payload FROM case_archives WHERE user_id=?').get('owner')!.payload).toBe(JSON.stringify(changed));
});
it('revokes membership immediately, withdraws their summaries, and does not let an old invite restore access',async()=>{
  const organizationId=await create(),invitationId=await join(organizationId);await seedCase('member');await share(organizationId,'member');
  const revision=(await detail(organizationId)).data.organization.revision;
  expect((await call(`/api/organizations/${organizationId}/members/member/remove`,'owner','POST',{revision})).status).toBe(200);
  expect((await detail(organizationId,'member')).status).toBe(404);
  expect((await detail(organizationId)).data.summaries).toEqual([]);
  expect((await call('/api/organizations/accept','member','POST',{invitationId})).status).toBe(404);
});
it('does not grant clinical summary access from team ownership or membership alone',async()=>{
  const organizationId=await create();await join(organizationId);await seedCase();await share(organizationId);
  db.sqlite.prepare("UPDATE professional_access SET status='revoked' WHERE user_id='member'").run();
  expect((await detail(organizationId,'member')).data).toMatchObject({canViewSummaries:false,summaries:[]});
  expect((await call(`/api/organizations/${organizationId}/summary-preview?caseId=clinical-case`,'member')).status).toBe(403);
  db.sqlite.prepare("UPDATE professional_access SET status='revoked' WHERE user_id='owner'").run();
  expect((await detail(organizationId)).data).toMatchObject({canViewSummaries:false,summaries:[]});
});
it('rolls back organization revisions and audit history when a summary write fails',async()=>{
  const organizationId=await create();await seedCase();const revision=(await detail(organizationId)).data.organization.revision;
  db.sqlite.exec("CREATE TRIGGER fail_summary BEFORE INSERT ON organization_case_summaries BEGIN SELECT RAISE(ABORT,'synthetic failure'); END");
  expect((await share(organizationId)).status).toBe(503);
  expect((await detail(organizationId)).data.organization.revision).toBe(revision);
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM organization_events').get()!.n).toBe(1);
});
it('enforces app origin on organization writes',async()=>{
  expect((await call('/api/organizations','owner','POST',{id:crypto.randomUUID(),name:'Practice'},{origin:'https://outside.test'})).status).toBe(403);
});
