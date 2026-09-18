# Verified legacy import checkpoint

The guarded import completed on September 18 at 03:31 UTC (September 17 in Denver) into the existing Turso `myintel-production` database. No paid upgrade or new hosting project was created. The temporary database token uses the dashboard's one-day expiry; it was kept in process memory and was not written into Git or configuration. It was not individually revoked: the dashboard offers only invalidation of all database tokens, which would disrupt the application credential.

The source export checksum matched `fd04c17207a16a1bcdd7a0f90c22edabd4b19b2a6dfd2f302dfeb95c5326344e`. The imported archive retained all six cases, revision 260 and exact payload checksum `8bf3d981d92be4406a94c72bd94f27480f6643c0070bc2bc68ac5039e8ad3cc9`. The deliberate owner mapping targets confirmed Supabase user `877609d6-f23e-466c-9ae0-6a2c3b996816`. Test-professional approval and audit data remain excluded.

Preflight read all sixteen application tables. Only the untouched starter archive was present. The guarded import backed it up, validated its empty shape, removed that shell and restored the reviewed archive. All other application tables were empty. The remote post-import snapshot matched all prepared tables exactly. A separate local in-memory restore rehearsal also matched exactly; this does not constitute a second remote restore rehearsal.

The live pilot account dashboard displayed the recovered family home checks and the staff operations entry. This confirms authenticated archive retrieval through the deployed backend. It does not certify complete professional, recovery, photo or consent journeys.

Before and after snapshots are under ignored `backups/`, named `2026-09-18T03-31-20-163Z-{pre,post}.sqlite-backup.json.dpapi`. Each was encrypted using Windows DPAPI CurrentUser, decrypted for byte-for-byte verification, and its temporary plaintext file removed. Recovery requires the same Windows user/profile; an independent encrypted backup location and retention policy still need to be arranged. The original private Sites export remains intact. The local credential receiver was stopped after successful verification.

Code checkpoint `deb4a5c` passed typecheck, all 273 tests and the production build. Callback fix `0979a55` was verified Ready in Vercel and its account page survived reload. Changes remain on `pilot/recover-and-auth-2026-09-12`; production has not been cut over.

Remaining launch gates: full live recovery and customer/professional/staff journeys, remote photo permissions and failure recovery, remote restore/switchback rehearsal, and human provider capacity, clinical content, privacy/vendor, usability and response-ownership decisions. Payments remain disabled.

The requested shorter assessment is queued in [next-assessment-improvements.md](next-assessment-improvements.md). A prior worktree-fork request returned a pending client ID but no runnable task appeared; do not claim a separate task is running or create duplicates without resolving that state.
