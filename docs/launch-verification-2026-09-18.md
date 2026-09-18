# Launch verification — September 18, 2026

Status: production cutover is not ready. Existing authorization permits launch once the gates below pass; it does not substitute for test evidence or human review.

## Reverified

- GitHub read access succeeded. Pilot branch is `eeb528a62815ea009c84986ef55360dfc0faa4b3`; main is `ef0c6ca3dcc13349fe78a2b040663ab6968cc3bd`; platform is `442c7777b7e50fcb12052db6d06e05b148c4b1e3`.
- Vercel still lists only `myintel-assesment.vercel.app`, with Valid Configuration and Production assignment. No domain change was made.
- The Vercel UI lists the nine required MyIntel configuration names in Production and branch-scoped Preview. Secret values were not retrieved or compared. Presence alone is not proof that production credentials work.
- The previous MyIntel session expired. Staff queue requests returned “Sign in to continue.” After reload, the operations view showed “MyIntel staff access required” and no staff data. A fresh sign-in is required for further authenticated tests.
- Anonymous requests to preview account, cases, staff requests, professional referrals and recovery routes returned Vercel SSO redirects. This confirms preview protection, not application-level 401/403 behavior. Do not disable preview protection to make a test pass.
- The earlier 273-test and production-build checkpoint remains the last code verification; this update changes documentation only.

## Remaining evidence

1. Fresh administrator sign-in; recovered assessments; staff queue and server role checks.
2. Complete recovery email journey to the authorized account. The user must enter and submit their own new password. Then verify sign-in with it and that old sessions no longer authorize requests. Do not request passwords in chat.
3. Two distinct authorized customer accounts and an explicitly identified test professional for owner isolation, approved/revoked professional access, request ownership, consent, photos and follow-up. Never represent test approvals as real provider capacity.
4. Failed-save and retry behavior on the deployed stack, including unchanged stored revision on rejection and preservation of the local draft.
5. Private-photo upload, retrieval, wrong-owner denial, consent withdrawal and storage failure handling using synthetic images only.
6. Restore into a separate empty remote target and verify a compatible server deployment for rollback. The current static production deployment cannot serve newly created account records. Current DPAPI backups require this Windows user/profile; independent protected backup and retention arrangements remain open.
7. Human confirmation of real provider capacity, request-queue owner and schedule, clinical/privacy/vendor review and representative usability sessions. No completion is inferred from software tests.

## Cutover sequence once gates pass

Record a fresh source and destination checkpoint; reconcile any new Sites writes before migration is declared final. Recheck upstream branches without force-pushing. Use the existing Vercel project and domain, build with Production settings and verify the canonical APP_ORIGIN before changing the public alias. Confirm Supabase origin/callback allowlist and email templates for that exact production origin. Keep payments disabled.

After cutover verify signup, account navigation, saved assessments, recovery, role isolation and consented photo access on the actual public domain. Record deployment ID, commit and checks. If a gate fails, retain the protected pilot and document the failure instead of declaring launch complete.
