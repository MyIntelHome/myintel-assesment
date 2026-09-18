# Production data adapter and recovery runbook

## Implemented scope

`production/database.ts` adapts the existing D1-shaped API to the official libSQL client. The production factory accepts only a configured secure service URL and token. It cannot fall back to a local file or memory database. Individual queries remain parameterized. Batches use one write transaction, preserving SQLite `changes()` behavior needed for atomic coordination and professional-access audit events.

This keeps the existing SQLite schema and avoids an untested SQL dialect conversion. Turso database `myintel-production` is provisioned in AWS East US (Ohio) with deletion protection. Its database-scoped credential is stored as a Vercel Secret. Vendor/data obligations and remote application testing remain required. See the [official client transaction reference](https://docs.turso.tech/sdk/ts/reference#batch-transactions).

## Schema migration

The seven checked-in Drizzle migrations are applied in order by `production/migrations.ts`. A checksum journal detects altered, missing, or unknown migrations. All pending migrations and journal entries are committed in one transaction; a failure rolls back the batch. A pre-existing database without this journal is rejected rather than silently adopted.

Use Node 24 and the locked dependencies. Set `MYINTEL_DATABASE_URL` and `MYINTEL_DATABASE_AUTH_TOKEN` securely for the selected empty target, then set `MYINTEL_MIGRATION_TARGET` to the same URL as an explicit target check. Run `pnpm run db:migrate:production` from the checkout. The command prints only a migration count or a generic failure, never credentials or rows. Do not run it as a deployment build step or on each request. Clear the target confirmation after use.

The runner parses the current, simple table/index DDL; it is not an arbitrary SQL-dump importer. Future trigger/procedure migrations require updating and testing that parser first. Unknown migration history blocks older code, so use restoration/switchback instead of destructive down-migrations.

A network failure during commit can leave the client uncertain whether the server committed. Inspect the target journal and row counts before retrying. Do not infer rollback from a missing success response. A retry of a confirmed migration is idempotent; a restore retry refuses an occupied destination.

On September 13 all seven migrations were applied to the empty production target. On September 15 all database tokens were invalidated, a replacement token was stored as a Vercel Secret, and the migration runner authenticated with that replacement token and reported `0 migration(s) applied`. This verifies current schema history and token access; it is not a backup/restore rehearsal or legacy-record import.

## Backup and restore rehearsal

`exportSnapshot(client)` takes a consistent read transaction across all sixteen application tables and returns a versioned snapshot with a SHA-256 checksum. `restoreSnapshot(client, snapshot)` checks that checksum, the complete table inventory, column order, and destination emptiness before inserting. It compares every restored row with the backup, then commits all records together. Any failure rolls back. Existing data is never cleared or overwritten.

Snapshots contain private information. Keep them in encrypted, access-controlled storage outside Git; the local `backups/` directory and `*.sqlite-backup.json` names are ignored as a precaution. A checksum detects accidental changes; it is not authentication, encryption, or proof against a maliciously rewritten backup. These functions currently operate through a libSQL client; they do not export hosted Sites D1 themselves.

The tests rehearse a source-to-empty-target restore using real local libSQL databases. They preserve original account IDs, revision numbers, signed-report JSON, consent snapshots, photo object references, and staff/event rows; test damaged backups and a mid-import failure; and prove that restoring twice cannot overwrite records.

## Required before moving real data

1. Verify the exact Vercel project and production domain again. Provision the approved database and private photo store in the owner's account, with applicable agreements and a backup retention policy.
2. Pause source writes for the final migration. The exact authorized D1 export is secured locally and records one archive revision, payload hash, row counts and ownership. It contains no photo metadata, so no R2 byte transfer is required for this export. Re-export after any further source write before cutover.
3. Apply the schema to a new target. A reviewed D1-to-snapshot conversion and import are still required. Do not label the current libSQL snapshot functions as a completed D1 migration.
4. Verify a deliberate mapping between Sites account IDs and the public authentication provider's verified account IDs. Never infer that mapping from a visitor header or automatically merge records by an unverified email. Recheck every related owner, staff, provider-access, and event reference.
5. Transfer photo bytes into private storage, preserve their object references, and check hashes and owner/staff permissions through the actual public backend. The database snapshot contains photo metadata only, not image bytes.
6. Rehearse restoration into a second empty target and run complete customer, professional, and staff flows on the real remote stack. Exercise concurrent saves, access revocation, consent withdrawal, expired sessions, password recovery, photo failures, and audit history.
7. Before cutover, record the current Vercel deployment, backend configuration, and exact source snapshot. The current static deployment is not a usable fallback for newly created account records. Keep the source private backend intact and define an app-compatible rollback deployment first.

## Exact legacy archive import

`pnpm run db:import:legacy` is the reviewed one-time importer for the recovered Sites export. It accepts only the reviewed export shape: one archive containing six cases, one known test-professional row and its audit event, with all request, provider, payment, handoff and photo tables empty. It imports only the archive. The two test-professional rows remain quarantined in the private source export so they cannot grant pilot access or be mistaken for provider capacity.

Before running it, create and verify the `austin@myintelhome.com` Supabase account and record its provider user ID as the deliberate target mapping. Set the production database credentials and all of these one-time operator values outside Git:

- `MYINTEL_IMPORT_TARGET`: must exactly match `MYINTEL_DATABASE_URL`.
- `MYINTEL_LEGACY_EXPORT_PATH`: absolute path to the private export. Its reviewed file SHA-256 is `fd04c17207a16a1bcdd7a0f90c22edabd4b19b2a6dfd2f302dfeb95c5326344e`.
- `MYINTEL_LEGACY_SOURCE_USER_ID` and `MYINTEL_TARGET_USER_ID`: the explicit old Sites owner to verified Supabase user mapping. The target must be a UUID.
- `MYINTEL_LEGACY_EXPORT_SHA256` and `MYINTEL_LEGACY_PAYLOAD_SHA256`: expected values for the exact file and archive payload. The reviewed payload SHA-256 is `8bf3d981d92be4406a94c72bd94f27480f6643c0070bc2bc68ac5039e8ad3cc9`.
- `MYINTEL_PREIMPORT_BACKUP_PATH` and `MYINTEL_POSTIMPORT_BACKUP_PATH`: new absolute paths in encrypted, access-controlled storage. The command refuses to overwrite either file.

The command exports the target before writing. If the first verified-account visit created the standard untouched starter archive, the command validates every blank field and confirms every other application table is empty before removing that shell. Any answer, different owner, extra archive or other application row blocks the import. It then restores through the transaction-checked snapshot path, verifies exactly one mapped archive and its payload hash, and writes the post-import snapshot. It reports no record content or account IDs. A failure after a remote commit can still leave an uncertain outcome; inspect target counts and both private snapshots before any retry. The restore path refuses any remaining occupied target, so it cannot silently duplicate or replace user data.

## Rollback

Keep the previous backend and immutable pre-cutover backups until the retention decision is made. Stop new writes before rollback. If the new backend accepted writes, export and reconcile them before switching; returning to a pre-cutover snapshot would otherwise lose those records. Restore into a fresh target, verify counts/hashes/permissions, then switch only to the tested compatible deployment and target. Do not drop tables, reuse an occupied restore target, or overwrite the original source to make a failed migration appear successful.

Remote schema migration and exact D1 export are complete. The strict archive converter/importer is implemented and locally rehearsed, but the live import, verified identity mapping, remote backup/restore rehearsal, remote photo-path testing, and production switchback remain launch gates. The export contains one assessment archive with six saved cases, one test-only professional approval and one audit event. It has no request, provider, payment, handoff or photo metadata rows. The archive is revision 260; its 9,099-byte payload has SHA-256 `8bf3d981d92be4406a94c72bd94f27480f6643c0070bc2bc68ac5039e8ad3cc9`.

Active public sessions, rate-limit buckets and reset revocation state are intentionally excluded from application snapshots. Restored targets require new sign-in; never copy old encrypted sessions into a restored environment. Keep the session encryption key separate from database backups.
