# Pilot readiness checkpoint

Latest recovery: see [September 12 source and hosting verification](recovery-2026-09-12.md). The saved source has been recovered and reconciled, actual GitHub/Vercel access verified, and the public account/recovery, database, private-storage and consented professional-handoff code implemented and locally tested. Supabase and Turso are provisioned, the seven production migrations are current, and an isolated Vercel branch deployment is connected to branch-scoped credentials; see [production account setup](production-account-setup.md). The isolated pilot branch is published to GitHub. An exact legacy export is secured locally and its source endpoint has been removed. Import, verified identity mapping, remote journey tests and human launch requirements remain blockers. The existing public deployment is unchanged.

## Authorization and destination

Austin authorized work toward a small pilot and public launch to the existing GitHub/Vercel domain once ready. Do not switch public hosting silently. The separate owner-private Sites preview is not the public deployment. Do not publish private test information or assume permission to email customers or professionals.

## Verified state

- Client/professional separation was privately published and had 210 passing tests.
- Production application services currently depend on Sites identity headers, a Cloudflare Worker, D1 records and R2 photos.
- `vercel.json` selects the tested `web-production` server build and `web-production/.next` output on the isolated branch. The previous static-export guard no longer participates in Vercel builds. Branch deployment `HH7a5KaTiLmyF5MUuzXhRqt6iiHQ` is Ready at the stable pilot-branch alias; production has not been redeployed.
- This checkpoint adds active/new/proposal/closed queue filters, oldest-first sorting and submission age. Accepted/paid requests remain active until closed. These are internal tools, not customer response-time promises or notifications.
- GitHub administrator/write access and the existing Vercel browser session were reverified. Branch `pilot/recover-and-auth-2026-09-12` is published without changing `main`. The only configured production domain is myintel-assesment.vercel.app; public deployment is still unchanged.
- The stable pilot-branch callback is allowlisted in Supabase. Nine branch-only Vercel variables connect it to Turso, Supabase Auth, the private `home-photos` bucket and `austin@myintelhome.com` as the verified-email staff administrator. The public branch account page loads successfully. A real signup, confirmation and recovery journey still requires reviewed SMTP delivery.
- The exact Sites export contains six saved cases in one `case_archives` row, one test-only professional approval and its audit event. It contains no requests, providers, payments, handoffs or photo metadata. The archived payload is revision 260, 9,099 bytes, with SHA-256 `8bf3d981d92be4406a94c72bd94f27480f6643c0070bc2bc68ac5039e8ad3cc9`. A temporary owner-private, secret-gated export route was deployed only long enough to retrieve it, then removed with its secret; the clean private preview was redeployed successfully.
- A one-time importer now requires the exact export and payload hashes, a deliberate Sites-to-Supabase user mapping, an empty migrated target and new private before/after snapshots. It imports only the six-case archive; the test-professional approval and audit row remain quarantined. TypeScript and all 271 tests pass after this addition.
- Staff coordination is now implemented: claim a request, display its coordinator, and release your own claim back to the unassigned queue. Server-side staff checks, atomic ownership, idempotent retries and audit events protect assignments. Coordination does not book a professional or share client records. Existing records migrate with no coordinator assigned.
- Staff can link an approved professional account to a reviewed listing. Customers then separately choose whether to share contact/request details, the saved home-check snapshot and the exact attached photo IDs with that named professional. Revocation, approval loss, listing relink, proposal change and request closure all end access. Clinical archives are excluded. Staff follow-up plans are owner-scoped, revision-checked and audited.

## Resume in this order

1. Verify GitHub and Vercel connections through read-only calls. Inspect MyIntelHome/myintel-assesment and its actual connected Vercel project, branch, domain and environment variable NAMES only. Do not print secrets.
2. Work on an isolated branch of the actual public repository. Reconcile preview source with upstream changes; do not force-push or overwrite other work.
3. Finish reviewed SMTP configuration, then test approved emails and verified sessions on the connected pilot branch. Never trust the Sites header names directly on publicly reachable Vercel APIs.
4. Create and verify the `austin@myintelhome.com` Supabase account, record the deliberate identity mapping, then import the exact archive with pre/post counts, payload hash verification and rollback rehearsal. Keep the legacy professional approval classified as test data rather than provider capacity.
5. Exercise the implemented request ownership, consented professional handoff and operational follow-up on the remote stack. Define the human response policy; notifications remain disabled.
6. Validate customer and professional flows end-to-end on the actual production stack, including wrong-role access, account recovery, shared-device signout, failed saves, photo permissions and backup restore.
7. Resolve human launch gates: actual providers/capacity, clinician content review, privacy/vendor/contract review, real senior/family usability sessions and operational ownership. Do not mark these complete because software tests pass.
8. Use a staged pilot release on the confirmed domain only after gates pass; otherwise report the specific blocker. Payments remain disabled until merchant model, refunds and live integration are ready.

## Continuation

The September 12 bounded continuation is historical. No overnight automation is active. Continue from this checkpoint and actual repository state; do not claim quota monitoring or unlimited unattended work.
