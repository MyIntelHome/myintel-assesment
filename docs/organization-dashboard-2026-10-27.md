# Organization workspace, October 27, 2026

Status: implemented for review on `feature/organization-dashboard-2026-10-27`. This change builds on the OT workflow/report work in PR #10, commit `886cf6e`. It is not enabled on the public site. No production migration, account approval, credential provisioning, invitation email or payment change was performed.

## Owner-approved scope

The first version lets a practice owner manage a team and view summaries that assessors explicitly share. Full clinical records stay with their assessor. Shared clinical editing, supervisor approval, assigned caseloads, ownership transfer, organization billing and pooled assessment credits are outside this version.

The owner also approved a first-subscriber campaign focused on small Colorado OT practices and independent aging-in-place professionals. Materials are in [the subscriber plan](first-subscribers-2026-10-27.md). Outreach has not been sent.

## Implemented experience

- Professional navigation includes **Organization**, at `/?portal=professional&view=organization`. A signed-in owner/coordinator without professional approval can reach team metadata through this route, without opening clinical assessments.
- Create a practice workspace, select among memberships, invite by exact verified account email, accept an invitation, withdraw pending invitations and remove members. Owners administer their own team. Members cannot invite or remove people. The owner cannot remove themselves.
- Invitations expire after seven days. The generated link opens the organization workspace; acceptance still requires the matching verified account and a pending, unexpired invitation. Knowing an invitation ID, email domain or practice name grants no membership. No email is sent automatically.
- A workspace supports up to 25 active members; owners can create up to three workspaces in this pilot. These are technical pilot limits, not paid seat entitlements.
- Approved professionals see counts and filters for explicitly shared draft/signed assessments, critical findings and follow-up dates due. These are counts of shared snapshots only, never the practice's complete caseload.
- The assessor selects one of their own saved clinical assessments and previews a server-derived summary. An unchecked, separate authorization checkbox must be selected before sharing. Unsaved local cases cannot be shared.
- Shared fields: generated organization reference, assessor, draft/signed state, signed-version and area counts, findings, critical count, concern percentage, incomplete-observation indicator, earliest open follow-up date, source-save date and share date. No client name, personal case reference, room labels, answers, narratives, full report or photo is returned through the organization API.
- A summary is a dated snapshot. Changes to a private assessment remain private until a new preview and explicit share. Re-sharing updates the same organization reference. The assessor can withdraw a summary, and the owner can remove a shared summary. A recent activity list records team/sharing actions without their clinical content.

Concern percentages retain the findings formula from PR #10. They describe concern/critical checks among assessed checks, not a validated safety score, probability of a fall or assessment completion. Missing observations remain visible. Follow-up dates are recorded work plans, not bookings. Minimizing fields does not establish legal de-identification; consent and privacy responsibilities still apply.

## Access and consent

- Existing Supabase-verified sessions are used on Vercel. Visitor-supplied Sites identity headers and browser role flags grant no authority.
- Organization ownership and professional approval are independent. An unapproved owner or member can see team metadata but cannot view/share clinical summaries. Current professional approval is required to view summaries, and their author must remain an active, approved team member.
- Every organization operation checks active membership. Owner-only mutations additionally check the role. Private archives still use their existing account ownership and professional-approval checks; no organization endpoint returns another assessor's archive.
- Each share records the authorization version `organization-summary-2026-10-27` and time. The wording covers the organization's current and future approved professional members until withdrawal. It is separate from contact permission, family report sharing and request/photo handoff consent. It records the assessor's attestation of authorization, not independently verified client consent documentation.
- Removing a member ends their access and withdraws that member's shared snapshots. Professional-approval revocation hides their authored snapshots and blocks their clinical-summary access. A later reapproval can make retained snapshots visible again while membership remains active; use withdrawal when sharing must end permanently through the normal workflow.
- Withdrawing sharing stops future in-app retrieval, but cannot recall information already viewed or saved elsewhere. In-app access updates on refresh/focus and on subsequent API calls. Previously displayed information cannot be remotely erased from a person's memory or screenshots.

## Data and failed writes

`0010_organizations.sql` adds five tables:

| Table | Purpose |
| --- | --- |
| `organizations` | Name, owner, optimistic revision and mutation nonce |
| `organization_members` | Account-bound role, active/removed state and team contact metadata |
| `organization_invitations` | Intended email, expiry and acceptance/revocation state |
| `organization_case_summaries` | Owner/case linkage, limited snapshot, source revision and sharing authorization |
| `organization_events` | Actor, action, subject and time |

Clinical case payloads and immutable report versions remain in `case_archives`. No real client data is copied automatically.

Team changes claim a fresh nonce with the expected organization revision. All dependent writes and the audit event commit in one database batch, guarded by that nonce. Sharing additionally checks current approval and the source archive revision inside the guarded write. Stale previews and conflicting team changes return a conflict without stray writes. A database failure rolls the batch back. The UI clears protected content after failed refresh or denied access and keeps sharing unchecked after refresh.

## Enablement and rollback

The feature defaults off. `GET /api/organization-config` reports its state. Production reads `MYINTEL_ORGANIZATIONS=true`; no environment setting was changed during implementation. A default-off release does not query these tables through organization routes.

Before enabling on a real deployment:

1. Check its actual source and migration journal. Preserve a private backup using the compatible pre-change exporter. Verify a restore into an empty isolated database. Do not put backups or tokens in Git.
2. This branch's migration list appends `0010_organizations.sql` to current main's website/lead lineage. The unmerged professional-billing branch has a different historical `0007_payment_attempts.sql`, `0008_professional_billing.sql`, `0009_unified_preview_lineage.sql` sequence. Reconcile the final combined manifest against the target's recorded prefix before a combined release. Never reorder or edit already applied history, or run one branch's manifest blindly on another branch's database.
3. The complete organization exporter uses snapshot **version 6**, preserving current-main versions 2, 3 and 4. Version 5 is already used by the separate unmerged billing branch and is intentionally not redefined here. Combined billing/website/organization inventory support needs explicit integration before a combined release. Unrecognized inventories fail closed.
4. Apply the migration to an isolated preview first. The current migration runner makes pending changes and its journal atomic. Verify counts, constraints, two distinct account memberships, revocation, sharing, failed writes and backup/restore there before production.
5. Review the actual team-sharing/retention notice and appropriate account/organization agreements. No automatic deletion schedule, legal de-identification, vendor agreement or compliance certification is implemented or claimed. An owner does not gain access to full patient records.
6. Enable the feature only on the tested target, then verify the owner, approved assessor, unapproved coordinator and unrelated account flows with real authentication. Keep payment/shop configuration unchanged.

Rollback: turn the organization flag off and redeploy. Retain the five tables, consent events, private archives and snapshots. Do not drop tables or overwrite records as a rollback step. Old backup restore refuses a nonempty destination, including newer organization rows. Restores defer foreign-key checks until the complete restore transaction commits.

## Verification

Automated coverage includes default-off behavior, forged identity headers, cross-practice isolation, email-bound/expired/revoked invitations, role restrictions, removal, independent clinical approval, owner-private archives, separate sharing consent, server-derived scores, stale previews, immutable-until-refreshed snapshots, stable audit subjects, failed-write rollback, origin enforcement and prior/new backup restores. UI tests exercise unchecked sharing consent, metadata-only access and clearing a loaded summary after lost access. A real local libSQL adapter test verifies the atomic membership/audit guard and rollback behavior.

The local demo uses the actual organization component and API with an in-memory SQLite database, verified synthetic identities and entirely fictional cases. Browser checks cover filters, preview/share/reload, unapproved coordinator restrictions and a separate practice's empty workspace. This is not an authenticated remote or production E2E test and not a senior usability study. Final build/test totals are recorded below at the durable checkpoint.

### Durable local checkpoint

- 48 test files and **410 tests passed** on October 27.
- TypeScript, the production Next.js build and the static/Sites compatibility build passed.
- Browser confirmation: three shared snapshots survive a reload; the critical filter isolates the flagged case; a summary preview starts unchecked and a share refreshes the existing snapshot; an unapproved coordinator sees team metadata without findings; an unrelated practice has zero access to the first practice; a manually copied invitation link is offered with an explicit no-email-sent notice.
- The 390px iframe layout stacks metrics into two columns and summaries into readable cards. Desktop and narrow screenshots were reviewed. This is layout evidence, not a real mobile device study.
- Local fictional demo: `http://127.0.0.1:43186/`. It runs only on this computer, resets when its in-memory server restarts, and has no production credentials or real accounts. The ignored `.codex-tmp/organization-client.tsx` and `organization-server.ts` are local review helpers; they are not part of a deployed product or a claim of remote E2E coverage.
- Production enablement and authenticated remote organization tests remain a separate release step. The organization's production feature flag was not changed.
