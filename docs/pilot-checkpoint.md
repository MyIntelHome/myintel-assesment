# Pilot readiness checkpoint

Latest recovery: see [September 12 source and hosting verification](recovery-2026-09-12.md). The saved source has been recovered and reconciled, actual GitHub/Vercel access verified, and the public account/recovery, database, private-storage and consented professional-handoff code implemented and locally tested. Supabase return addresses and the private photo bucket are configured; see [production account setup](production-account-setup.md). The production database, protected provider credentials, migration and complete live launch checks remain blockers, so the Vercel readiness guard remains. Recover the latest continuation work from the isolated Sites source branch `pilot/recover-and-auth-2026-09-12`, not its unchanged `main` branch.

## Authorization and destination

Austin authorized work toward a small pilot and public launch to the existing GitHub/Vercel domain once ready. Do not switch public hosting silently. The separate owner-private Sites preview is not the public deployment. Do not publish private test information or assume permission to email customers or professionals.

## Verified state

- Client/professional separation was privately published and had 210 passing tests.
- Production application services currently depend on Sites identity headers, a Cloudflare Worker, D1 records and R2 photos.
- Existing vercel.json only ran next build with static export. It cannot deploy these services. A deliberate failing readiness guard now prevents an accidental broken release from this branch; replace only after a working, tested Vercel implementation exists.
- This checkpoint adds active/new/proposal/closed queue filters, oldest-first sorting and submission age. Accepted/paid requests remain active until closed. These are internal tools, not customer response-time promises or notifications.
- GitHub administrator/write access and the existing Vercel browser session were verified. The only configured production domain is myintel-assesment.vercel.app. See recovery-2026-09-12.md for the actual project settings and source reconciliation; public deployment is still unchanged.
- A single bounded continuation is scheduled for September 12 at 9:45 p.m. America/Denver. It must recheck connections, stop for missing credentials or human decisions, and pause after one attempt. It does not monitor quota.
- Staff coordination is now implemented: claim a request, display its coordinator, and release your own claim back to the unassigned queue. Server-side staff checks, atomic ownership, idempotent retries and audit events protect assignments. Coordination does not book a professional or share client records. Existing records migrate with no coordinator assigned.
- Staff can link an approved professional account to a reviewed listing. Customers then separately choose whether to share contact/request details, the saved home-check snapshot and the exact attached photo IDs with that named professional. Revocation, approval loss, listing relink, proposal change and request closure all end access. Clinical archives are excluded. Staff follow-up plans are owner-scoped, revision-checked and audited.

## Resume in this order

1. Verify GitHub and Vercel connections through read-only calls. Inspect MyIntelHome/myintel-assesment and its actual connected Vercel project, branch, domain and environment variable NAMES only. Do not print secrets.
2. Work on an isolated branch of the actual public repository. Reconcile preview source with upstream changes; do not force-push or overwrite other work.
3. Securely connect the implemented public authentication and account-recovery adapter to the existing Vercel project, then test approved emails and verified sessions. Never trust the Sites header names directly on publicly reachable Vercel APIs.
4. Sign into and provision the production libSQL database, securely connect the existing private photo bucket, and migrate with backups, record-preservation checks and rollback.
5. Exercise the implemented request ownership, consented professional handoff and operational follow-up on the remote stack. Define the human response policy; notifications remain disabled.
6. Validate customer and professional flows end-to-end on the actual production stack, including wrong-role access, account recovery, shared-device signout, failed saves, photo permissions and backup restore.
7. Resolve human launch gates: actual providers/capacity, clinician content review, privacy/vendor/contract review, real senior/family usability sessions and operational ownership. Do not mark these complete because software tests pass.
8. Use a staged pilot release on the confirmed domain only after gates pass; otherwise report the specific blocker. Payments remain disabled until merchant model, refunds and live integration are ready.

## Automatic continuation

After required connectors work, obtain the actual reset time and timezone from Austin (do not infer quota reset from midnight). Schedule a bounded continuation attempt, not a promise of unlimited unattended work. Use this durable checkpoint and actual repository state; stop on missing authority, unavailable credentials or unresolved human launch gates. Never claim a scheduled task will detect or bypass usage limits.
