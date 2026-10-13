# Production lead capture enablement

## Authorized scope and current status

The owner authorizes production capture, delivery and anonymous funnel counts after preview email receipt is confirmed. Customer email must contain only a first-name greeting, a saved-plan notice, authenticated view link and help phone (720) 989-1123. Staff notification destination is configurable and initially austin@myintelhome.com. All existing separate consent rules remain. Payments and shop remain disabled. Privacy text remains draft until separately approved.

Isolated branch feature/lead-production-2026-10-12 is based on public GitHub main fc58320. Professional billing changes are not included. Production capture and delivery flags remain off; DNS remains unchanged. Signup and magic-link templates now include an OTP code while preserving their existing links; recovery remains unchanged.

## Verified preparation

The approved Resend key MyIntel HomeCheck lead delivery has sending-only access restricted to myintelhome.com. It is saved as RESEND_API_KEY in Vercel Production, without enabling delivery. Its value is not stored in Git or printed in logs. Preview configuration remains in progress.

Verified production target: libsql://myintel-production-myintelhome.aws-us-east-2.turso.io, matched between Vercel and Turso. A full 245760-byte SQLite backup was encrypted with Windows CurrentUser DPAPI outside Git; round-trip SHA256 3531884362D3BB461451D8A175AE1CA03ABE03B1C9FB98B9707636AD7457F35A. SQLite integrity was ok. All seven historical migration checksums matched after canonical newline normalization. A local restore/migration rehearsal preserved 19 existing tables and added exactly the four lead tables.

The browser SQL console cannot maintain an explicit transaction across statements, so no schema mutation was attempted there. The owner approved a one-day read/write token scoped only to myintel-production. It was encrypted locally using a DPAPI-protected RSA key and used only in the migration helper's process environment. It did not replace or invalidate the app's existing token.

0007_plan_capture.sql applied atomically to production with checksum 7fad9c1d3b190232200f64ba1d595c055eb6e7fa445dadf4179e3af986801ecd. Every existing table's record hash matched within the same transaction and integrity was ok. No billing tables were migrated. A fresh public /api/lead-config check after migration returned enabled=false, deliveryEnabled=false, shopUrl="". No customer or staff email has been sent by this batch yet.

Local verification: all 351 tests across 43 files and the production build/type checks passed for the isolated lead-release source. The billing branch has additional tests and changes; it is intentionally not included in this release.

## Configuration

Preview: MYINTEL_LEAD_PREVIEW=true, MYINTEL_EMAIL_PREVIEW=true only after sender setup, MYINTEL_PREVIEW_EMAIL_ALLOWLIST=austin@myintelhome.com. A missing preview allowlist permits no delivery.

Production, after preview receipt confirmation: MYINTEL_LEAD_CAPTURE=true and MYINTEL_EMAIL_DELIVERY=true. Preview flags cannot enable production. Both production flags default false. Existing account/database/photo configuration remains required. Set MYINTEL_STAFF_NOTIFICATION_EMAIL=austin@myintelhome.com, MYINTEL_EMAIL_FROM to a verified myintelhome.com sender, RESEND_API_KEY to a sending-only server secret, and APP_ORIGIN to the existing canonical domain. Do not expose secrets in Git or browser bundles.

Customer plan messages are rebuilt from the saved receipt's first name and server-configured origin at delivery time, including older pending jobs. No saved answers are passed to Resend. Disabled jobs never replay automatically. Existing outbox leasing, failure preservation and idempotency behavior remain.

## DNS read-only evidence

October 12 Resend dashboard: myintelhome.com verified; DKIM TXT resend._domainkey and CNAME records rsend -> rsend.forge.rmta.net and send -> send.forge.rmta.net verified. No records changed. Public root MX remains smtp.google.com, priority 1. HomeCheck CNAME remains present. Verify the exact current website targets before any later DNS edit. Existing verified sender does not require invented replacement DNS values.

## Remaining release sequence

1. Confirm current production database identity and journal through Vercel/Turso. Make a private encrypted backup with verified completeness and a restore rehearsal; keep it outside Git. Apply only missing 0007_plan_capture.sql after verifying existing migration lineage. Do not migrate public billing tables as part of this work.
2. Configure an isolated lead preview from existing test backend, not production data. Verify its migration journal. Do not copy payment keys or enable billing.
3. Inspect existing Supabase templates and SMTP. Keep password signup and recovery links intact. Add an OTP code to compatible signup/magic-link templates only after confirming the shared project behavior; explain incompatible options before changes.
4. Test the real customer plan email, saved-plan contact notification and help-request notification with only Austin allowlisted. Test no-contact/no-sharing and failure/retry paths. Provider accepted status alone is not inbox proof.
5. Obtain Austin's actual inbox confirmation. Then merge the reviewed source, deploy to the existing domain, set production flags, and verify /api/lead-config, account isolation and both staff triggers. Keep SHOP_URL blank and payments off.
6. Record exact deployment, migration, backup reference, configuration scope, DNS changes and verification time. Roll back flags and deployment without dropping tables or replaying jobs. Reconcile any new writes before restoring a database.

## Shop compatibility

The existing helper appends /collections/<needCode> to the full SHOP_URL base. https://www.myintelhome.com/shop therefore generates exactly https://www.myintelhome.com/shop/collections/<needCode>. No conflict. SHOP_URL remains blank.

## Privacy draft

See privacy-lead-capture-draft-2026-10-12.md. Proposed periods are 12 months since last activity for plans and 24 months after closure for help requests, with earlier deletion on request. These are proposed, not implemented or published promises.

