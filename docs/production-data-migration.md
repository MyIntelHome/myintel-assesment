# Production data adapter and recovery runbook

## Implemented scope

`production/database.ts` adapts the existing D1-shaped API to the official libSQL client. The production factory accepts only a configured secure service URL and token. It cannot fall back to a local file or memory database. Individual queries remain parameterized. Batches use one write transaction, preserving SQLite `changes()` behavior needed for atomic coordination and professional-access audit events.

This is a tested compatibility option, not a provisioned production service or a change to hosting. It keeps the existing SQLite schema and avoids an untested SQL dialect conversion. A service account, region, vendor/data obligations, credentials, and remote testing remain required. The Vercel guard stays in place. See the [official client transaction reference](https://docs.turso.tech/sdk/ts/reference#batch-transactions).

## Schema migration

The six checked-in Drizzle migrations are applied in order by `production/migrations.ts`. A checksum journal detects altered, missing, or unknown migrations. All pending migrations and journal entries are committed in one transaction; a failure rolls back the batch. A pre-existing database without this journal is rejected rather than silently adopted.

Use Node 24 and the locked dependencies. Set `MYINTEL_DATABASE_URL` and `MYINTEL_DATABASE_AUTH_TOKEN` securely for the selected empty target, then set `MYINTEL_MIGRATION_TARGET` to the same URL as an explicit target check. Run `pnpm run db:migrate:production` from the checkout. The command prints only a migration count or a generic failure, never credentials or rows. Do not run it as a deployment build step or on each request. Clear the target confirmation after use.

The runner parses the current, simple table/index DDL; it is not an arbitrary SQL-dump importer. Future trigger/procedure migrations require updating and testing that parser first. Unknown migration history blocks older code, so use restoration/switchback instead of destructive down-migrations.

A network failure during commit can leave the client uncertain whether the server committed. Inspect the target journal and row counts before retrying. Do not infer rollback from a missing success response. A retry of a confirmed migration is idempotent; a restore retry refuses an occupied destination.

## Backup and restore rehearsal

`exportSnapshot(client)` takes a consistent read transaction across all ten application tables and returns a versioned snapshot with a SHA-256 checksum. `restoreSnapshot(client, snapshot)` checks that checksum, the complete table inventory, column order, and destination emptiness before inserting. It compares every restored row with the backup, then commits all records together. Any failure rolls back. Existing data is never cleared or overwritten.

Snapshots contain private information. Keep them in encrypted, access-controlled storage outside Git; the local `backups/` directory and `*.sqlite-backup.json` names are ignored as a precaution. A checksum detects accidental changes; it is not authentication, encryption, or proof against a maliciously rewritten backup. These functions currently operate through a libSQL client; they do not export hosted Sites D1 themselves.

The tests rehearse a source-to-empty-target restore using real local libSQL databases. They preserve original account IDs, revision numbers, signed-report JSON, consent snapshots, photo object references, and staff/event rows; test damaged backups and a mid-import failure; and prove that restoring twice cannot overwrite records.

## Required before moving real data

1. Verify the exact Vercel project and production domain again. Provision the approved database and private photo store in the owner's account, with applicable agreements and a backup retention policy.
2. Pause source writes for the final migration. Obtain a consistent authorized D1 export and separately back up private R2 bytes. Record row counts, assessment revision/history hashes, photo byte hashes, and ownership. Do not assume a frontend export contains the service records.
3. Apply the schema to a new target. A reviewed D1-to-snapshot conversion is still required. Do not label the current libSQL snapshot functions as a completed D1 migration.
4. Verify a deliberate mapping between Sites account IDs and the public authentication provider's verified account IDs. Never infer that mapping from a visitor header or automatically merge records by an unverified email. Recheck every related owner, staff, provider-access, and event reference.
5. Transfer photo bytes into private storage, preserve their object references, and check hashes and owner/staff permissions through the actual public backend. The database snapshot contains photo metadata only, not image bytes.
6. Rehearse restoration into a second empty target and run complete customer, professional, and staff flows on the real remote stack. Exercise concurrent saves, access revocation, consent withdrawal, expired sessions, password recovery, photo failures, and audit history.
7. Before cutover, record the current Vercel deployment, backend configuration, and exact source snapshot. The current static deployment is not a usable fallback for newly created account records. Keep the source private backend intact and define an app-compatible rollback deployment first.

## Rollback

Keep the previous backend and immutable pre-cutover backups until the retention decision is made. Stop new writes before rollback. If the new backend accepted writes, export and reconcile them before switching; returning to a pre-cutover snapshot would otherwise lose those records. Restore into a fresh target, verify counts/hashes/permissions, then switch only to the tested compatible deployment and target. Do not drop tables, reuse an occupied restore target, or overwrite the original source to make a failed migration appear successful.

Remote migration, D1 export/conversion, identity mapping, photo transfer, and production switchback remain unperformed launch gates.

Active public sessions, rate-limit buckets and reset revocation state are intentionally excluded from application snapshots. Restored targets require new sign-in; never copy old encrypted sessions into a restored environment. Keep the session encryption key separate from database backups.
