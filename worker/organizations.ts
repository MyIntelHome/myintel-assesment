import { z } from "zod";
import type { Database, Statement } from "./api";
import type { AccountUser } from "../src/domain/services";
import type { OrganizationDetail, OrganizationSummary } from "../src/domain/organizations";
import { ORGANIZATION_SHARING_VERSION } from "../src/domain/organizations";
import { savedCaseSchema } from "../src/lib/case-validation";
import { isClinicalRecord } from "../src/domain/access";
import { professionalFindingScores } from "../src/domain/professional-finding-scores";

class OrganizationError extends Error { constructor(public status: number, message: string) { super(message); } }
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const revision = z.number().int().positive();
const id = z.string().uuid();
const snapshotSchema = z.object({
  signed: z.boolean(), reportCount: z.number().int().nonnegative(), areaCount: z.number().int().nonnegative(),
  findings: z.number().int().nonnegative(), critical: z.number().int().nonnegative(),
  concernPercent: z.number().int().min(0).max(100).nullable(), incomplete: z.boolean(),
  followUpDate: z.iso.date().nullable(), sourceUpdatedAt: z.string().nullable(),
});
interface OrganizationRow { id: string; name: string; owner_id: string; revision: number; updated_at: string; role: "owner" | "member"; }
interface InvitationRow { id: string; organization_id: string; email: string; status: string; expires_at: string; accepted_by: string | null; organization_name: string; }
async function readBody(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new OrganizationError(415, "Send JSON data.");
  const reader = request.body?.getReader();
  let text = "", size = 0;
  if (reader) {
    const decoder = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) { text += decoder.decode(); break; }
      size += value.length;
      if (size > 16000) { await reader.cancel(); throw new OrganizationError(413, "This request is too large."); }
      text += decoder.decode(value, { stream: true });
    }
  }
  try { return JSON.parse(text); } catch { throw new OrganizationError(400, "The submitted data could not be read."); }
}
async function approved(db: Database, userId: string) {
  const access = await db.prepare("SELECT status FROM professional_access WHERE user_id=?").bind(userId).first<{ status: string }>();
  return access?.status === "approved";
}
async function membership(db: Database, organizationId: string, userId: string) {
  const row = await db.prepare("SELECT o.*,m.role FROM organizations o JOIN organization_members m ON m.organization_id=o.id AND m.status='active' WHERE o.id=? AND m.user_id=?").bind(organizationId, userId).first<OrganizationRow>();
  if (!row) throw new OrganizationError(404, "This organization is unavailable to this account.");
  return row;
}
function organizationDTO(row: OrganizationRow): OrganizationSummary {
  return { id: row.id, name: row.name, role: row.role, revision: row.revision, updatedAt: row.updated_at };
}
function invitationDTO(row: InvitationRow) {
  return { id: row.id, organizationId: row.organization_id, organizationName: row.organization_name, email: row.email, expiresAt: row.expires_at };
}

/** The first guarded write claims a fresh nonce. All following writes depend on that claim in the same transaction. */
async function mutate(db: Database, user: AccountUser, org: OrganizationRow, expected: number, ownerOnly: boolean,
  type: string, subject: string, work: (guard: string, nonce: string, now: string) => Statement[], extraSQL = "", extraArgs: unknown[] = []) {
  if (ownerOnly && org.role !== "owner") throw new OrganizationError(403, "Only the organization owner can manage the team.");
  const nonce = crypto.randomUUID(), now = new Date().toISOString();
  const guard = "EXISTS (SELECT 1 FROM organizations WHERE id=? AND last_mutation_id=?)";
  const results = await db.batch([
    db.prepare(`UPDATE organizations SET revision=revision+1,last_mutation_id=?,updated_at=? WHERE id=? AND revision=? AND EXISTS (SELECT 1 FROM organization_members WHERE organization_id=organizations.id AND user_id=? AND status='active' ${ownerOnly ? "AND role='owner'" : ""}) ${extraSQL}`)
      .bind(nonce, now, org.id, expected, user.id, ...extraArgs),
    ...work(guard, nonce, now),
    db.prepare(`INSERT INTO organization_events(id,organization_id,actor_id,type,subject_id,created_at) SELECT ?,?,?,?,?,? WHERE ${guard}`)
      .bind(nonce, org.id, user.id, type, subject, now, org.id, nonce),
  ]);
  if (results[0]?.meta.changes !== 1) throw new OrganizationError(409, "The organization or source assessment changed. Refresh before trying again.");
}

async function detail(db: Database, user: AccountUser, org: OrganizationRow): Promise<OrganizationDetail> {
  const canViewSummaries = await approved(db, user.id);
  const members = (await db.prepare("SELECT m.user_id AS userId,m.display_name AS name,m.email,m.role,COALESCE(p.status,'not_requested') AS professionalStatus FROM organization_members m LEFT JOIN professional_access p ON p.user_id=m.user_id WHERE m.organization_id=? AND m.status='active' ORDER BY m.role DESC,m.display_name").bind(org.id).all()).results;
  const invitations = org.role === "owner" ? (await db.prepare("SELECT i.*,o.name AS organization_name FROM organization_invitations i JOIN organizations o ON o.id=i.organization_id WHERE i.organization_id=? AND i.status='pending' AND i.expires_at>? ORDER BY i.created_at DESC").bind(org.id, new Date().toISOString()).all<InvitationRow>()).results.map(invitationDTO) : [];
  const rows = canViewSummaries ? (await db.prepare("SELECT s.id,s.case_owner_id,s.payload,s.shared_at,m.display_name FROM organization_case_summaries s JOIN organization_members m ON m.organization_id=s.organization_id AND m.user_id=s.case_owner_id AND m.status='active' JOIN professional_access p ON p.user_id=s.case_owner_id AND p.status='approved' WHERE s.organization_id=? AND s.withdrawn_at IS NULL AND EXISTS (SELECT 1 FROM professional_access WHERE user_id=? AND status='approved') ORDER BY s.shared_at DESC").bind(org.id, user.id).all<{ id: string; case_owner_id: string; payload: string; shared_at: string; display_name: string }>()).results : [];
  const summaries = rows.map(row => ({ ...snapshotSchema.parse(JSON.parse(row.payload)), id: row.id, reference: "HC-" + row.id.slice(0, 8).toUpperCase(), assessorId: row.case_owner_id, assessorName: row.display_name, own: row.case_owner_id === user.id, sharedAt: row.shared_at }));
  const events = (await db.prepare("SELECT e.id,COALESCE(m.display_name,'Former member') AS actorName,e.type,e.created_at AS createdAt FROM organization_events e LEFT JOIN organization_members m ON m.organization_id=e.organization_id AND m.user_id=e.actor_id WHERE e.organization_id=? ORDER BY e.created_at DESC,e.rowid DESC LIMIT 30").bind(org.id).all()).results;
  return { organization: organizationDTO(org), canViewSummaries, members: members as OrganizationDetail["members"], invitations, summaries, events: events as OrganizationDetail["events"] };
}

async function summaryCandidate(db: Database, user: AccountUser, caseId: string) {
  if (!await approved(db, user.id)) throw new OrganizationError(403, "Approved professional access is required to share assessment summaries.");
  const archive = await db.prepare("SELECT payload,revision,updated_at FROM case_archives WHERE user_id=?").bind(user.id).first<{ payload: string; revision: number; updated_at: string }>();
  const raw = archive ? JSON.parse(archive.payload).cases?.find((c: { id: string }) => c.id === caseId) : null;
  const parsed = savedCaseSchema.safeParse(raw);
  if (!archive || !raw || !parsed.success || !isClinicalRecord(parsed.data) || parsed.data.deletedAt) throw new OrganizationError(404, "No saved clinical assessment belonging to this account was found.");
  const c = parsed.data;
  const scores = professionalFindingScores({ spaces: c.spaces ?? [], responses: c.responses ?? {} });
  const followUpDate = (c.plan ?? []).filter(p => !["completed", "declined"].includes(p.status)).map(p => p.followUpDate).filter(d => z.iso.date().safeParse(d).success).sort()[0] ?? null;
  const payload = snapshotSchema.parse({ signed: !!c.signoff?.signedAt && !!c.reportVersions?.length, reportCount: c.reportVersions?.length ?? 0, areaCount: c.spaces?.length ?? 0, findings: scores.overall.findings, critical: scores.overall.critical, concernPercent: scores.overall.percent, incomplete: scores.overall.incomplete, followUpDate, sourceUpdatedAt: archive.updated_at });
  return { payload, sourceRevision: archive.revision };
}

export async function organizationRoute(request: Request, db: Database, user: AccountUser, enabled: boolean): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/organizations")) return null;
  if (!enabled) return json({ error: "Organization workspaces are not enabled on this deployment.", enabled: false }, 503);
  try {
    const path = url.pathname.split("/").filter(Boolean), method = request.method;
    const now = new Date().toISOString();
    if (path.length === 2 && method === "GET") {
      const organizations = (await db.prepare("SELECT o.*,m.role FROM organizations o JOIN organization_members m ON m.organization_id=o.id AND m.status='active' WHERE m.user_id=? ORDER BY o.name").bind(user.id).all<OrganizationRow>()).results.map(organizationDTO);
      const invitations = (await db.prepare("SELECT i.*,o.name AS organization_name FROM organization_invitations i JOIN organizations o ON o.id=i.organization_id WHERE i.email=? AND i.status='pending' AND i.expires_at>? ORDER BY i.created_at DESC").bind(user.email.toLowerCase(), now).all<InvitationRow>()).results.map(invitationDTO);
      return json({ organizations, invitations });
    }
    if (path.length === 2 && method === "POST") {
      const v = z.object({ id, name: z.string().trim().min(2).max(100) }).strict().parse(await readBody(request));
      const existing = await db.prepare("SELECT * FROM organizations WHERE id=?").bind(v.id).first<OrganizationRow>();
      if (existing) {
        if (existing.owner_id !== user.id || existing.name !== v.name) throw new OrganizationError(409, "This organization request changed. Refresh before trying again.");
        return json({ organization: organizationDTO({ ...existing, role: "owner" }) });
      }
      const nonce = crypto.randomUUID();
      const result = await db.batch([
        db.prepare("INSERT INTO organizations(id,name,owner_id,revision,last_mutation_id,created_at,updated_at) SELECT ?,?,?,1,?,?,? WHERE (SELECT COUNT(*) FROM organizations WHERE owner_id=?)<3").bind(v.id, v.name, user.id, nonce, now, now, user.id),
        db.prepare("INSERT INTO organization_members(organization_id,user_id,role,status,display_name,email,joined_at) SELECT ?,?,'owner','active',?,?,? WHERE EXISTS (SELECT 1 FROM organizations WHERE id=? AND last_mutation_id=?)").bind(v.id, user.id, user.name, user.email.toLowerCase(), now, v.id, nonce),
        db.prepare("INSERT INTO organization_events(id,organization_id,actor_id,type,subject_id,created_at) SELECT ?,?,?,'organization_created',?,? WHERE EXISTS (SELECT 1 FROM organizations WHERE id=? AND last_mutation_id=?)").bind(nonce, v.id, user.id, v.id, now, v.id, nonce),
      ]);
      if (!result[0]?.meta.changes) throw new OrganizationError(409, "You can create up to three organizations in this pilot.");
      return json({ organization: organizationDTO(await membership(db, v.id, user.id)) }, 201);
    }
    if (path[2] === "accept" && path.length === 3 && method === "POST") {
      const v = z.object({ invitationId: id }).strict().parse(await readBody(request));
      const invitation = await db.prepare("SELECT i.*,o.name AS organization_name FROM organization_invitations i JOIN organizations o ON o.id=i.organization_id WHERE i.id=? AND i.email=?").bind(v.invitationId, user.email.toLowerCase()).first<InvitationRow>();
      if (!invitation) throw new OrganizationError(404, "No invitation for this signed-in email was found.");
      if (invitation.status === "accepted" && invitation.accepted_by === user.id) return json({ organization: organizationDTO(await membership(db, invitation.organization_id, user.id)) });
      if (invitation.status !== "pending" || invitation.expires_at <= now) throw new OrganizationError(409, "This invitation expired or was withdrawn. Ask the owner for a new invitation.");
      const org = await db.prepare("SELECT * FROM organizations WHERE id=?").bind(invitation.organization_id).first<OrganizationRow>();
      if (!org) throw new OrganizationError(404, "This organization is unavailable.");
      const nonce = crypto.randomUUID();
      const guard = "EXISTS (SELECT 1 FROM organizations WHERE id=? AND last_mutation_id=?)";
      const result = await db.batch([
        db.prepare("UPDATE organizations SET revision=revision+1,last_mutation_id=?,updated_at=? WHERE id=? AND revision=? AND (SELECT COUNT(*) FROM organization_members WHERE organization_id=? AND status='active')<25 AND EXISTS (SELECT 1 FROM organization_invitations WHERE id=? AND organization_id=organizations.id AND email=? AND status='pending' AND expires_at>?)").bind(nonce, now, org.id, org.revision, org.id, invitation.id, user.email.toLowerCase(), now),
        db.prepare(`INSERT INTO organization_members(organization_id,user_id,role,status,display_name,email,joined_at) SELECT ?,?,'member','active',?,?,? WHERE ${guard} ON CONFLICT(organization_id,user_id) DO UPDATE SET status='active',display_name=excluded.display_name,email=excluded.email,joined_at=excluded.joined_at,removed_at=NULL`)
          .bind(org.id, user.id, user.name, user.email.toLowerCase(), now, org.id, nonce),
        db.prepare(`UPDATE organization_invitations SET status='accepted',accepted_by=? WHERE id=? AND ${guard}`).bind(user.id, invitation.id, org.id, nonce),
        db.prepare(`INSERT INTO organization_events(id,organization_id,actor_id,type,subject_id,created_at) SELECT ?,?,?,'invitation_accepted',?,? WHERE ${guard}`).bind(nonce, org.id, user.id, invitation.id, now, org.id, nonce),
      ]);
      if (!result[0]?.meta.changes) throw new OrganizationError(409, "The invitation or team changed. Refresh before accepting again.");
      return json({ organization: organizationDTO(await membership(db, org.id, user.id)) });
    }
    const organizationId = id.parse(path[2]);
    const org = await membership(db, organizationId, user.id);
    if (path.length === 3 && method === "GET") return json(await detail(db, user, org));
    if (path[3] === "summary-preview" && path.length === 4 && method === "GET") {
      const caseId = z.string().min(1).max(200).parse(url.searchParams.get("caseId"));
      return json(await summaryCandidate(db, user, caseId));
    }
    if (path[3] === "invitations" && path.length === 4 && method === "POST") {
      const v = z.object({ revision, email: z.email().trim().max(254) }).strict().parse(await readBody(request));
      const email = v.email.toLowerCase(), invitationId = crypto.randomUUID(), expiry = new Date(Date.now() + 7 * 86400000).toISOString();
      await mutate(db, user, org, v.revision, true, "invitation_created", invitationId, (guard, nonce, time) => [
        db.prepare(`UPDATE organization_invitations SET status='revoked' WHERE organization_id=? AND status='pending' AND expires_at<=? AND ${guard}`).bind(org.id, time, org.id, nonce),
        db.prepare(`INSERT INTO organization_invitations(id,organization_id,email,status,expires_at,created_by,created_at) SELECT ?,?,?,'pending',?,?,? WHERE ${guard}`).bind(invitationId, org.id, email, expiry, user.id, time, org.id, nonce),
      ], "AND (SELECT COUNT(*) FROM organization_invitations WHERE organization_id=organizations.id AND status='pending' AND expires_at>?)<25 AND NOT EXISTS (SELECT 1 FROM organization_invitations WHERE organization_id=organizations.id AND email=? AND status='pending' AND expires_at>?) AND NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=organizations.id AND email=? AND status='active')", [now, email, now, email]);
      return json({ invitation: { id: invitationId, email, expiresAt: expiry }, invitationUrl: `${url.origin}/?portal=professional&view=organization&organizationInvitation=${invitationId}`, emailSent: false }, 201);
    }
    if (path[3] === "invitations" && path[5] === "revoke" && path.length === 6 && method === "POST") {
      const invitationId = id.parse(path[4]), v = z.object({ revision }).strict().parse(await readBody(request));
      await mutate(db, user, org, v.revision, true, "invitation_revoked", invitationId, (guard, nonce) => [
        db.prepare(`UPDATE organization_invitations SET status='revoked' WHERE id=? AND organization_id=? AND ${guard}`).bind(invitationId, org.id, org.id, nonce),
      ], "AND EXISTS (SELECT 1 FROM organization_invitations WHERE id=? AND organization_id=organizations.id AND status='pending')", [invitationId]);
      return json({ updated: true });
    }
    if (path[3] === "members" && path[5] === "remove" && path.length === 6 && method === "POST") {
      const userId = decodeURIComponent(path[4]!), v = z.object({ revision }).strict().parse(await readBody(request));
      await mutate(db, user, org, v.revision, true, "member_removed", userId, (guard, nonce, time) => [
        db.prepare(`UPDATE organization_members SET status='removed',removed_at=? WHERE organization_id=? AND user_id=? AND role<>'owner' AND ${guard}`).bind(time, org.id, userId, org.id, nonce),
        db.prepare(`UPDATE organization_case_summaries SET withdrawn_at=? WHERE organization_id=? AND case_owner_id=? AND withdrawn_at IS NULL AND ${guard}`).bind(time, org.id, userId, org.id, nonce),
      ], "AND EXISTS (SELECT 1 FROM organization_members WHERE organization_id=organizations.id AND user_id=? AND status='active' AND role<>'owner')", [userId]);
      return json({ updated: true });
    }
    if (path[3] === "summaries" && path.length === 4 && method === "POST") {
      const v = z.object({ revision, caseId: z.string().min(1).max(200), sourceRevision: z.number().int().nonnegative(), consent: z.literal(true) }).strict().parse(await readBody(request));
      const { payload, sourceRevision } = await summaryCandidate(db, user, v.caseId);
      if (sourceRevision !== v.sourceRevision) throw new OrganizationError(409, "Save your assessment and refresh before sharing its latest summary.");
      const existing = await db.prepare("SELECT id FROM organization_case_summaries WHERE organization_id=? AND case_owner_id=? AND case_id=?").bind(org.id, user.id, v.caseId).first<{ id: string }>();
      const summaryId = existing?.id ?? crypto.randomUUID();
      await mutate(db, user, org, v.revision, false, "summary_shared", summaryId, (guard, nonce, time) => [
        db.prepare(`INSERT INTO organization_case_summaries(id,organization_id,case_owner_id,case_id,source_revision,payload,consent_version,consent_at,shared_at,withdrawn_at) SELECT ?,?,?,?,?,?,?,?,?,NULL WHERE ${guard} ON CONFLICT(organization_id,case_owner_id,case_id) DO UPDATE SET source_revision=excluded.source_revision,payload=excluded.payload,consent_version=excluded.consent_version,consent_at=excluded.consent_at,shared_at=excluded.shared_at,withdrawn_at=NULL`)
          .bind(summaryId, org.id, user.id, v.caseId, v.sourceRevision, JSON.stringify(payload), ORGANIZATION_SHARING_VERSION, time, time, org.id, nonce),
      ], "AND EXISTS (SELECT 1 FROM professional_access WHERE user_id=? AND status='approved') AND EXISTS (SELECT 1 FROM case_archives WHERE user_id=? AND revision=?)", [user.id, user.id, v.sourceRevision]);
      return json({ shared: true });
    }
    if (path[3] === "summaries" && path[5] === "withdraw" && path.length === 6 && method === "POST") {
      const summaryId = id.parse(path[4]), v = z.object({ revision }).strict().parse(await readBody(request));
      await mutate(db, user, org, v.revision, false, "summary_withdrawn", summaryId, (guard, nonce, time) => [
        db.prepare(`UPDATE organization_case_summaries SET withdrawn_at=? WHERE id=? AND organization_id=? AND ${guard}`).bind(time, summaryId, org.id, org.id, nonce),
      ], "AND EXISTS (SELECT 1 FROM organization_case_summaries WHERE id=? AND organization_id=organizations.id AND withdrawn_at IS NULL AND (case_owner_id=? OR organizations.owner_id=?))", [summaryId, user.id, user.id]);
      return json({ updated: true });
    }
    return json({ error: "This organization action is unavailable." }, 404);
  } catch (error) {
    if (error instanceof OrganizationError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof URIError) return json({ error: "Check the organization details and try again." }, 400);
    return json({ error: "The organization service is temporarily unavailable. Your private assessments have not changed." }, 503);
  }
}
