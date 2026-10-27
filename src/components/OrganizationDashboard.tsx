"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { CaseState } from "@/lib/case-store";
import type { AccountUser } from "@/domain/services";
import type { OrganizationDetail, OrganizationInvitation, OrganizationSummary, SharedCaseSummary } from "@/domain/organizations";
import { ORGANIZATION_SHARING_TEXT } from "@/domain/organizations";
import { createUuid } from "@/lib/ids";

type CaseOption = Pick<CaseState, "id" | "reference" | "audience" | "deletedAt">;
type SummaryPayload = Pick<SharedCaseSummary, "signed" | "reportCount" | "areaCount" | "findings" | "critical" | "concernPercent" | "incomplete" | "followUpDate" | "sourceUpdatedAt">;
type Preview = { payload: SummaryPayload; sourceRevision: number; caseId: string };
class RequestError extends Error { constructor(public status: number, message: string) { super(message); } }
async function request<T>(path: string, method = "GET", payload?: unknown): Promise<T> {
  const r = await fetch(path, { method, cache: "no-store", ...(payload ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : {}) });
  let data;
  try { data = await r.json(); } catch { throw new RequestError(r.status, "We could not read the organization response. Refresh and try again."); }
  if (!r.ok) throw new RequestError(r.status, data.error ?? "The organization action could not be completed.");
  return data as T;
}
const date = (value: string | null) => value ? new Date(value.length === 10 ? value + "T12:00:00" : value).toLocaleDateString() : "No date shared";
const score = (s: SummaryPayload) => s.concernPercent === null ? "Not assessed" : s.concernPercent === 0 && s.findings > 0 ? "<1%" : `${s.concernPercent}%`;
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
const eventLabels: Record<string, string> = { organization_created: "Created the organization", invitation_created: "Created an invitation", invitation_accepted: "Joined the team", invitation_revoked: "Withdrew an invitation", member_removed: "Removed a team member", summary_shared: "Shared or refreshed a case summary", summary_withdrawn: "Withdrew a case summary" };

function RemoveMember({ name, busy, onRemove }: { name: string; busy: boolean; onRemove: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return confirm ? <div className="organization-confirm"><p>Remove {name}? Team access ends and their shared summaries are withdrawn. Their private assessments remain with them.</p><button className="app-secondary" disabled={busy} onClick={onRemove}>Confirm removal</button><button className="app-secondary" disabled={busy} onClick={() => setConfirm(false)}>Keep member</button></div>
    : <button className="app-secondary" disabled={busy} onClick={() => setConfirm(true)}>Remove from team</button>;
}

export function OrganizationDashboard({ user, cases = [], ready = true }: { user: AccountUser; cases?: readonly CaseOption[]; ready?: boolean }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [index, setIndex] = useState<{ organizations: OrganizationSummary[]; invitations: OrganizationInvitation[] }>({ organizations: [], invitations: [] });
  const [detail, setDetail] = useState<OrganizationDetail | null>(null);
  const [selected, setSelected] = useState("");
  const selection = useRef("");
  const generation = useRef(0), busyRef = useRef(false), createId = useRef<string | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [invitationUrl, setInvitationUrl] = useState("");
  const [showCreate, setShowCreate] = useState(false), [caseId, setCaseId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null), [consent, setConsent] = useState(false);
  const [filter, setFilter] = useState("all");

  const refresh = useCallback(async (preferred?: string) => {
    const current = ++generation.current;
    setLoading(true); setError(""); setDetail(null); setPreview(null); setConsent(false);
    try {
      const config = await request<{ enabled: boolean }>("/api/organization-config");
      if (current !== generation.current) return;
      setEnabled(config.enabled);
      if (!config.enabled) { setIndex({ organizations: [], invitations: [] }); return; }
      const next = await request<typeof index>("/api/organizations");
      const wanted = preferred ?? selection.current;
      const chosen = next.organizations.some(o => o.id === wanted) ? wanted : next.organizations[0]?.id ?? "";
      const loaded = chosen ? await request<OrganizationDetail>(`/api/organizations/${chosen}`) : null;
      if (current !== generation.current) return;
      setIndex(next); selection.current = chosen; setSelected(chosen); setDetail(loaded);
    } catch (e) {
      if (current === generation.current) { setError((e as Error).message); setIndex({ organizations: [], invitations: [] }); setDetail(null); }
    } finally { if (current === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const focus = () => { if (!busyRef.current) void refresh(); };
    window.addEventListener("focus", focus);
    return () => { generation.current++; window.removeEventListener("focus", focus); };
  }, [refresh, user.id]);

  async function run(label: string, operation: () => Promise<void>, reload = true) {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(label); setError(""); setNotice("");
    try { await operation(); if (reload) await refresh(); return true; }
    catch (e) {
      setError((e as Error).message);
      if (e instanceof RequestError && [401, 403, 404].includes(e.status)) { setDetail(null); setPreview(null); setConsent(false); }
      return false;
    } finally { busyRef.current = false; setBusy(""); }
  }
  async function create(event: FormEvent) {
    event.preventDefault(); createId.current ??= createUuid();
    const ok = await run("Creating organization", async () => {
      const r = await request<{ organization: OrganizationSummary }>("/api/organizations", "POST", { id: createId.current, name });
      selection.current = r.organization.id;
    });
    if (ok) { createId.current = null; setName(""); setShowCreate(false); setNotice("Organization created. Your private assessments have not been shared."); }
  }
  async function invite(event: FormEvent) {
    event.preventDefault(); if (!detail) return;
    const ok = await run("Creating invitation", async () => {
      const r = await request<{ invitationUrl: string }>(`/api/organizations/${selected}/invitations`, "POST", { revision: detail.organization.revision, email });
      setInvitationUrl(r.invitationUrl);
    });
    if (ok) { setEmail(""); setNotice("Invitation created. No email was sent. Share the invitation link with the intended person."); }
  }
  async function copyInvitation() {
    try { await navigator.clipboard.writeText(invitationUrl); setNotice("Invitation link copied. Share it with the intended person."); }
    catch { setError("Copy was not available. Select and copy the invitation link."); }
  }
  async function prepare(event: FormEvent) {
    event.preventDefault(); if (!caseId || !detail || !ready) return;
    await run("Preparing summary", async () => {
      setPreview(null); setConsent(false);
      const r = await request<{ payload: SummaryPayload; sourceRevision: number }>(`/api/organizations/${selected}/summary-preview?caseId=${encodeURIComponent(caseId)}`);
      setPreview({ ...r, caseId });
    }, false);
  }
  async function share() {
    if (!detail || !preview || !consent || !ready) return;
    const ok = await run("Sharing summary", async () => {
      await request(`/api/organizations/${selected}/summaries`, "POST", { revision: detail.organization.revision, caseId: preview.caseId, sourceRevision: preview.sourceRevision, consent });
    });
    if (ok) setNotice("Summary shared. Changes to the private assessment are not shared automatically.");
  }
  const org = detail?.organization;
  const today = todayKey();
  const summaries = detail?.summaries ?? [];
  const due = (s: SharedCaseSummary) => !!s.followUpDate && s.followUpDate <= today;
  const filtered = summaries.filter(s => filter === "all" || (filter === "signed" && s.signed) || (filter === "draft" && !s.signed) || (filter === "critical" && s.critical > 0) || (filter === "due" && due(s)))
    .slice().sort((a, b) => (a.followUpDate ?? "9999").localeCompare(b.followUpDate ?? "9999") || b.sharedAt.localeCompare(a.sharedAt));

  return <div className="organization-dashboard">
    <div className="organization-heading"><div><p className="eyebrow">YOUR TEAM, ONE CLEAR VIEW</p><h1>Organization workspace</h1><p>Bring the team together. Keep sharing intentional.</p></div><button className="app-secondary" disabled={loading || !!busy} onClick={() => void refresh()}>Refresh workspace</button></div>
    {error && <div className="app-alert" role="alert">{error}<p>Refresh before retrying. Private assessments remain in the assessor’s workspace.</p></div>}
    {notice && <p className="organization-notice" role="status">{notice}</p>}
    {busy && <p role="status">{busy}…</p>}
    {loading ? <p role="status">Opening your organization workspace…</p> : enabled === false ? <section className="account-card"><h2>Organization workspaces are in review</h2><p>This deployment has not enabled team management or summary sharing yet. Your existing professional workspace is available separately.</p></section> : enabled && <>
      {index.invitations.length > 0 && <section className="account-card organization-invitations"><h2>Invitations for {user.email}</h2><p>Joining a team does not grant professional approval or access to anyone’s full clinical record.</p>{index.invitations.map(invitation => <div className="organization-invitation" key={invitation.id}><div><strong>{invitation.organizationName}</strong><small>Expires {date(invitation.expiresAt)}</small></div><button className="app-primary" disabled={!!busy} onClick={() => void run("Joining team", async () => { const r = await request<{ organization: OrganizationSummary }>("/api/organizations/accept", "POST", { invitationId: invitation.id }); selection.current = r.organization.id; })}>Join {invitation.organizationName}</button></div>)}</section>}
      <div className="organization-toolbar">{index.organizations.length > 0 && <label>Organization<select value={selected} disabled={!!busy} onChange={e => { setInvitationUrl(""); setFilter("all"); setCaseId(""); void refresh(e.target.value); }}>{index.organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}<button className="app-secondary" disabled={!!busy} onClick={() => setShowCreate(v => !v)}>{showCreate ? "Close new organization" : "Create organization"}</button></div>
      {(showCreate || index.organizations.length === 0) && <form className="account-card organization-form" onSubmit={create}><h2>Start your practice workspace</h2><p>Use your business name. Creating a workspace does not share assessments or start a subscription.</p><label>Organization name<input required minLength={2} maxLength={100} autoComplete="organization" value={name} onChange={e => setName(e.target.value)} /></label><button className="app-primary" disabled={!!busy}>Create practice workspace</button></form>}
      {detail && org && <>
        <section className="organization-hero"><div><span className="organization-emblem" aria-hidden="true">{org.name.slice(0, 1).toUpperCase()}</span><div><p className="eyebrow">{org.role === "owner" ? "ORGANIZATION OWNER" : "TEAM MEMBER"}</p><h2>{org.name}</h2><p>{detail.members.length} active team {detail.members.length === 1 ? "member" : "members"}</p></div></div><span className="organization-private-label">Full clinical records stay private</span></section>
        {detail.canViewSummaries ? <>
          <div className="organization-metrics"><section><strong>{summaries.length}</strong><span>Shared case summaries</span></section><section><strong>{summaries.filter(s => s.signed).length}</strong><span>Signed assessments shared</span></section><section className={summaries.some(s => s.critical) ? "has-critical" : ""}><strong>{summaries.reduce((n, s) => n + s.critical, 0)}</strong><span>Critical findings recorded</span></section><section><strong>{summaries.filter(due).length}</strong><span>Follow-up dates due by today</span></section></div>
          <section className="organization-cases"><div className="organization-section-heading"><div><h2>Shared work at a glance</h2><p>Only summaries an assessor chose to share. These are snapshots, not live clinical records.</p></div><label>Show summaries<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All shared summaries</option><option value="draft">Draft assessments</option><option value="signed">Signed assessments</option><option value="critical">With critical findings</option><option value="due">Follow-up due</option></select></label></div>
            {!filtered.length ? <div className="empty-work"><h3>{summaries.length ? "No summaries match this view." : "No case summaries shared yet."}</h3><p>Private assessments do not appear here automatically. An approved professional can preview and share a summary below.</p></div> : <div className="organization-case-grid">{filtered.map(s => <article className={`organization-case ${s.critical ? "has-critical" : ""}`} key={s.id}><div className="organization-case-top"><h3>{s.reference}</h3><span className="organization-badge">{s.signed ? "Signed report" : "Draft assessment"}</span></div><p className="organization-assessor">Shared by {s.assessorName}</p><div className="organization-case-score"><strong>{score(s)}</strong><span>concern score</span></div><p>{s.findings} {s.findings === 1 ? "finding" : "findings"} · {s.areaCount} {s.areaCount === 1 ? "area" : "areas"} · {s.reportCount} signed report {s.reportCount === 1 ? "version" : "versions"}</p>{s.critical > 0 && <p className="organization-critical">{s.critical} critical {s.critical === 1 ? "finding" : "findings"} to review</p>}{s.incomplete && <p className="organization-warning">Provisional: observations remain incomplete.</p>}<p className={due(s) ? "organization-warning" : ""}>Follow-up: {date(s.followUpDate)}</p><small>Shared {date(s.sharedAt)} · Source saved {date(s.sourceUpdatedAt)}</small>{(s.own || org.role === "owner") && <button className="app-secondary" disabled={!!busy} onClick={() => void run("Withdrawing summary", async () => { await request(`/api/organizations/${selected}/summaries/${s.id}/withdraw`, "POST", { revision: org.revision }); })}>{s.own ? "Stop sharing this summary" : "Remove shared summary"}</button>}</article>)}</div>}
            <p className="account-note">Concern percentages describe recorded findings, not the likelihood of a fall. Higher means more concerns recorded. Missing observations remain a limitation. Follow-up dates are recorded work plans, not confirmed appointments.</p>
          </section>
          <section className="account-card organization-share"><p className="eyebrow">YOUR CHOICE TO SHARE</p><h2>Share a case summary</h2><p>Preview exactly what the team will receive. The organization reference is generated separately; your personal case reference, answers, narratives, reports and photos stay private.</p><form className="organization-form" onSubmit={prepare}><label>Your saved professional assessment<select required value={caseId} disabled={!!busy || !ready} onChange={e => { setCaseId(e.target.value); setPreview(null); setConsent(false); }}><option value="">Choose a saved assessment</option>{cases.filter(c => c.audience === "clinician" && !c.deletedAt).map(c => <option key={c.id} value={c.id}>{c.reference || "Clinical assessment " + c.id.slice(0, 8)}</option>)}</select></label><button className="app-secondary" disabled={!!busy || !ready || !caseId}>Preview summary</button></form>{!ready && <p role="status">Wait for your assessment changes to save before preparing a summary.</p>}
            {preview && <div className="organization-share-preview"><h3>Summary for {org.name}</h3><dl><div><dt>Assessment status</dt><dd>{preview.payload.signed ? "Signed" : "Draft"}</dd></div><div><dt>Concern score</dt><dd>{score(preview.payload)}</dd></div><div><dt>Findings / critical</dt><dd>{preview.payload.findings} / {preview.payload.critical}</dd></div><div><dt>Areas / signed versions</dt><dd>{preview.payload.areaCount} / {preview.payload.reportCount}</dd></div><div><dt>Follow-up date</dt><dd>{date(preview.payload.followUpDate)}</dd></div><div><dt>Observations</dt><dd>{preview.payload.incomplete ? "Incomplete" : "No required gaps recorded"}</dd></div></dl><label className="organization-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{ORGANIZATION_SHARING_TEXT}</label><button className="app-primary" disabled={!!busy || !consent || !ready} onClick={() => void share()}>Share this summary</button><p className="account-note">Sharing permission is stored separately from contact permission and other report-sharing choices. Future changes are private until you preview and share again.</p></div>}
          </section>
        </> : <section className="account-card"><h2>Team management is available</h2><p>Professional approval is required before you can view or share assessment summaries. Organization ownership and membership do not grant clinical access.</p><a className="app-secondary" href="/?portal=professional">Review professional access</a></section>}
        <section className="account-card organization-team"><div className="organization-section-heading"><div><p className="eyebrow">PEOPLE & ACCESS</p><h2>Your team</h2><p>Professional approval is reviewed separately by MyIntel.</p></div><span>{detail.members.length} / 25 pilot members</span></div>{detail.members.map(member => <div className="organization-member" key={org.id + member.userId}><span className="organization-avatar" aria-hidden="true">{member.name.slice(0, 1).toUpperCase()}</span><div><strong>{member.name}{member.userId === user.id ? " (you)" : ""}</strong><small>{member.email}</small><span className="organization-badge">{member.role === "owner" ? "Owner" : "Member"} · {member.professionalStatus === "approved" ? "Professional access approved" : "Professional access " + member.professionalStatus.replaceAll("_", " ")}</span></div>{org.role === "owner" && member.role !== "owner" && <RemoveMember name={member.name} busy={!!busy} onRemove={() => void run("Removing member", async () => { await request(`/api/organizations/${selected}/members/${encodeURIComponent(member.userId)}/remove`, "POST", { revision: org.revision }); })} />}</div>)}
          {org.role === "owner" && <><form className="organization-form" onSubmit={invite}><h3>Invite a team member</h3><p>They must sign in with this exact verified email and accept the invitation. No clinical record access is granted by the invitation.</p><label>Team member email<input type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label><button className="app-primary" disabled={!!busy}>Create invitation</button></form>{invitationUrl && <div className="organization-invitation-link"><label>Invitation link<input readOnly value={invitationUrl} /></label><button className="app-secondary" onClick={() => void copyInvitation()}>Copy invitation link</button><p>No email has been sent automatically.</p></div>}{detail.invitations.length > 0 && <div className="organization-pending"><h3>Pending invitations</h3>{detail.invitations.map(invitation => <div className="organization-invitation" key={invitation.id}><div><strong>{invitation.email}</strong><small>Expires {date(invitation.expiresAt)}</small></div><button className="app-secondary" disabled={!!busy} onClick={() => void run("Withdrawing invitation", async () => { await request(`/api/organizations/${selected}/invitations/${invitation.id}/revoke`, "POST", { revision: org.revision }); setInvitationUrl(""); })}>Withdraw invitation</button></div>)}</div>}</>}
        </section>
        <section className="account-card organization-activity"><h2>Recent team activity</h2><p>Last 30 recorded team actions. Clinical notes and report contents are not included.</p><ol>{detail.events.map(event => <li key={event.id}><div><strong>{event.actorName}</strong><span>{eventLabels[event.type] ?? "Updated organization"}</span></div><time dateTime={event.createdAt}>{date(event.createdAt)}</time></li>)}</ol></section>
        <p className="account-note">Organization billing is not enabled. Creating or joining this workspace does not start a subscription or create a seat charge.</p>
      </>}
    </>}
  </div>;
}
