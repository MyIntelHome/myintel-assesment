# Pilot readiness checkpoint

Latest recovery: see [September 12 source and hosting verification](recovery-2026-09-12.md). The saved source has been recovered, actual GitHub/Vercel access verified, the authentication boundary refactored, and a libSQL database adapter with migration/restore rehearsal added. All 236 tests pass. Public authentication and backend provisioning are still launch blockers; the readiness guard remains. Recover the latest continuation work from the isolated Sites source branch `pilot/recover-and-auth-2026-09-12`, not its unchanged `main` branch.

## Authorization and destination

Austin authorized work toward a small pilot and public launch to the existing GitHub/Vercel domain once ready. Do not switch public hosting silently. The separate owner-private Sites preview is not the public deployment. Do not publish private test information or assume permission to email customers or professionals.

## Verified state

- Client/professional separation was privately published and had 210 passing tests.
- Production application services currently depend on Sites identity headers, a Cloudflare Worker, D1 records and R2 photos.
- Existing vercel.json only ran next build with static export. It cannot deploy these services. A deliberate failing readiness guard now prevents an accidental broken release from this branch; replace only after a working, tested Vercel implementation exists.
- This checkpoint adds active/new/proposal/closed queue filters, oldest-first sorting and submission age. Accepted/paid requests remain active until closed. These are internal tools, not customer response-time promises or notifications.
- GitHub and Vercel are now confirmed installed. Their account tools remain absent from this session's callable tools, and neither CLI is available. No external account access or production domain has been verified. Do not ask Austin to reinstall; refresh the tool environment and perform read-only verification when tools become available.
- No overnight automation was created: its instructions require a successful harmless read on every required connector before scheduling. Austin reports reset at 9:40 p.m. Mountain time (America/Denver); requested continuation may be scheduled just after that reset once access checks succeed. Last user-reported allowance was 49%; current remaining usage is not visible.
- Staff coordination is now implemented: claim a request, display its coordinator, and release your own claim back to the unassigned queue. Server-side staff checks, atomic ownership, idempotent retries and audit events protect assignments. Coordination does not book a professional or share client records. Existing records migrate with no coordinator assigned.

## Resume in this order

1. Verify GitHub and Vercel connections through read-only calls. Inspect MyIntelHome/myintel-assesment and its actual connected Vercel project, branch, domain and environment variable NAMES only. Do not print secrets.
2. Work on an isolated branch of the actual public repository. Reconcile preview source with upstream changes; do not force-push or overwrite other work.
3. Implement production public authentication and account recovery with a supported provider, verified server sessions, professional approval and authorization parity. Never trust the Sites header names directly on publicly reachable Vercel APIs.
4. Choose production database/private photo storage supported by that hosting and the planned data obligations. Port Worker endpoints or establish a supported authenticated backend. Migrate with backups, record-preservation checks and rollback.
5. Finish request ownership, consented professional handoff, response policy and notifications. Provider approval is not referral assignment. Customers' home reports/photos are currently visible to MyIntel staff only, not directly to professionals.
6. Validate customer and professional flows end-to-end on the actual production stack, including wrong-role access, account recovery, shared-device signout, failed saves, photo permissions and backup restore.
7. Resolve human launch gates: actual providers/capacity, clinician content review, privacy/vendor/contract review, real senior/family usability sessions and operational ownership. Do not mark these complete because software tests pass.
8. Use a staged pilot release on the confirmed domain only after gates pass; otherwise report the specific blocker. Payments remain disabled until merchant model, refunds and live integration are ready.

## Automatic continuation

After required connectors work, obtain the actual reset time and timezone from Austin (do not infer quota reset from midnight). Schedule a bounded continuation attempt, not a promise of unlimited unattended work. Use this durable checkpoint and actual repository state; stop on missing authority, unavailable credentials or unresolved human launch gates. Never claim a scheduled task will detect or bypass usage limits.
