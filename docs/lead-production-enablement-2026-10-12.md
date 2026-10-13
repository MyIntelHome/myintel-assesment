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


## Preview configuration verified after owner approval

Reused the existing Supabase professional-billing preview server and publishable configuration on this branch only, without modifying previous branch scopes. Database target is myintel-payment-preview-0928, with an approved one-day read/write token and a separate session key. Its journal already contains the matching 0007_plan_capture.sql checksum; no preview migration was rerun. Production records were not used for the tests.

The verified-domain sender is MyIntel HomeCheck <plans@myintelhome.com>. Preview recipient allowlist and staff destination are both austin@myintelhome.com. RESEND_API_KEY and all required account/database settings are saved on feature/lead-production-2026-10-12 only. No payment credentials were copied. Preview capture and delivery flags are true. SHOP_URL is unset.

Canonical preview: https://myintel-assesment-git-feature-lead-2f177e-austin-8620s-projects.vercel.app. Source be3f5c0 was redeployed with the final settings as myintel-assesment-n9rlxy20l-austin-8620s-projects.vercel.app, status Ready. The anonymous account bootstrap recovered successfully after redeployment; the sign-in form is open for Austin. Vercel protects unauthenticated external preview requests, so a shell request cannot establish preview delivery readiness.

Supabase saved signup and magic-link templates were read back with their existing links plus {{ .Token }}. Recovery matched its pre-change private backup exactly. Existing SMTP smtp.resend.com on port 465 was not changed. Site URL stays https://homecheck.myintelhome.com. Two exact preview callback URLs were appended, retaining all ten existing allowlist entries.

Fresh production /api/lead-config remains {"enabled":false,"deliveryEnabled":false,"shopUrl":""}. No mail has been sent by this lead batch yet. Three hosted email tests and owner inbox confirmation remain pending before production activation. Privacy wording and retention are still review-only.

## Hosted preview email tests

October 12, 2026, America/Denver: Austin signed in as austin@myintelhome.com. Created a separate synthetic home check with one entrance, no room answers and optional health/context answers left unknown. Existing assessments were not used for email testing.

Customer plan: saved with both contact and sharing unchecked. Application reported provider acceptance. Resend email 01a133ce-bc57-79c8-a701-b1573135bfa4 was delivered at 11:49 p.m. Its rendered body contains only Hello Austin, saved-plan notice, HTTPS sign-in link, help invitation and (720) 989-1123. No answers or room details were present.

Staff saved-plan notification: separate receipt saved with contact checked and sharing unchecked, without a customer email request. Resend 01a133d0-09c4-7a46-8b9d-e6a71a3c5ade was delivered at 11:50 p.m. Content contains name, verified email, optional phone/ZIP placeholders, contact preference, item type and Operations link, without results.

Staff help request: synthetic TEST ONLY Austin lead delivery, ZIP 80020, email contact consent, no sharing consent. Request fe5e672c-4d3c-49e5-a78a-4862df453dd7 saved successfully. Resend 01a133d0-a0e7-768b-8ce9-7845b51159bc was delivered at 11:51 p.m., with contact/request metadata only.

Operations shows the first receipt with no permission to contact and results private; second receipt contact allowed and results private. Outbox shows accepted for all three jobs. Anonymous plan-emailed and results-viewed counts appeared. Preview is Austin-only. Provider delivery is not the owner's inbox confirmation, which remains pending.

Production sender routing is prepared: MYINTEL_EMAIL_FROM=MyIntel HomeCheck <plans@myintelhome.com>, MYINTEL_STAFF_NOTIFICATION_EMAIL=austin@myintelhome.com, approved sending-only RESEND_API_KEY. Production flags remain off. Payments and SHOP_URL remain disabled. Privacy draft remains unpublished.
