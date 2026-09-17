# Public accounts and private storage: implementation checkpoint

## September 17 status

The recovered UI is reused by `web-production`, a server-rendered Next application with real API routes. `pnpm run build:production` builds it separately from the existing Sites Worker build. `vercel.json` selects that server build and its `web-production/.next` output. The isolated pilot branch is deployed and Ready at its stable Vercel branch alias; the existing production deployment and domain have not been changed.

The selected adapters use Supabase Auth and a private Supabase Storage bucket, plus the libSQL database adapter. Supabase project `yyueldzkxdcykljbdquz` and Turso database `myintel-production` are provisioned in East US (Ohio). Seven journalled migrations were applied to the Turso database, and a second run after database-token rotation reported zero pending migrations. Nine branch-only Vercel variables now connect the pilot branch to these services. Database, Supabase server and session credentials are stored as Vercel Secrets. `MYINTEL_ADMIN_EMAIL` is also set to `austin@myintelhome.com` in Production Config, but the remaining production credentials have not been changed. A Supabase user now exists for that address and a corrected confirmation email has been sent, but confirmation, first sign-in and recovery still require live verification. The Vercel production deployment remains unchanged.

## Required server configuration

Store these only as protected server environment values for the appropriate deployment. Never prefix them with NEXT_PUBLIC or place their values in a commit:

- `APP_ORIGIN`: exact canonical HTTPS application origin, no trailing slash. The currently verified production destination is `https://myintel-assesment.vercel.app`. A staging deployment needs its own explicit origin and isolated backend.
- `MYINTEL_DATABASE_URL` and `MYINTEL_DATABASE_AUTH_TOKEN`: provisioned libSQL database and scoped credential.
- `MYINTEL_SUPABASE_URL`, `MYINTEL_SUPABASE_PUBLISHABLE_KEY`, and `MYINTEL_SUPABASE_SERVICE_KEY`: selected Supabase project. The service key is server-only and can access private storage; do not expose it in the client.
- `MYINTEL_PHOTO_BUCKET`: a private bucket with no public read policy or direct anonymous/authenticated object access. All application photo reads go through the existing owner/staff checks. Changing a bucket to public is refused by the adapter, but prevention at the provider remains essential because a public bucket exposes objects outside this API.
- `MYINTEL_SESSION_KEY`: a securely generated random 32-byte key encoded as base64, held outside the database. Rotation invalidates existing MyIntel sessions; clear active sessions as part of a planned rotation and require sign-in again.
- `MYINTEL_ADMIN_EMAIL`: only the explicitly designated staff owner's verified email. An unverified account cannot become staff.

No payment credentials are forwarded by the production adapter. Checkout remains disabled.

## Auth provider setup and email delivery

Enable email/password authentication with email confirmation required. Set the provider Site URL and allowed confirmation redirect to the exact selected origin. Use a reviewed sender and SMTP configuration; verify delivery only to an explicitly authorized test recipient. Do not claim account recovery works until inbox delivery and the complete reset flow have been tested on the actual stack.

The app accepts both token-hash confirmation links and Supabase's default browser-fragment session links. For a default link, the confirmation page moves the provider tokens into page memory and removes the fragment from browser history immediately; the server still verifies the provider identity before creating a MyIntel session. Custom token-hash templates are preferred because the confirmation page consumes them only after an explicit POST, so a GET-only email scanner does not consume the token. The deployed signup and recovery calls pass the full `/auth/confirm` callback as `redirectTo`; the saved templates therefore use `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup` and `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`. This lets the same templates target the allowlisted pilot origin during staging and the production origin after cutover. Referrer policy is no-referrer. Do not log confirmation query strings, tokens, request bodies, fragments, or cookies in external analytics.

See the official [email template documentation](https://supabase.com/docs/guides/auth/auth-email-templates) and [recovery API](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail). Provider email limits, abuse controls, availability, region and data terms still require account-specific verification. The local email/action limiter supplements provider controls; it is not a complete distributed-abuse defence.

## Session protections and tested limits

The browser receives an opaque Secure/HttpOnly/SameSite cookie. Its hash is stored in the database; provider tokens are encrypted using AES-256-GCM. Every identity resolution verifies the provider user remotely. Supplied identity headers are ignored, and mutating requests require the configured Origin. Recovery sessions cannot read account data or invoke normal account APIs. Password reset revokes MyIntel sessions and blocks stale sign-ins that began before reset. Logout removes the local session even during a provider outage. Local failures never return a successful save.

Automated tests use real local libSQL databases and controlled auth/storage responses. They cover isolation, failed saves, migration rollback, encrypted/opaque sessions, reset/signout races, recovery scope, provider refresh, revoked tokens, public-bucket refusal and storage outages. These are not live Supabase/Turso/Vercel end-to-end tests or human usability sessions.

## Remaining launch gates

1. Resolve vendor/privacy/retention decisions. Supabase project `yyueldzkxdcykljbdquz` is healthy in East US (Ohio); email confirmation is enabled, the production and stable pilot-branch callbacks are allowlisted, and private bucket `home-photos` limits uploads to 3 MB JPEGs. Resend has verified `myintelhome.com`, and Supabase custom SMTP is enabled with `accounts@myintelhome.com` and a restricted Resend sending key. A corrected confirmation message was accepted for delivery to the authorized administrator, but inbox completion and the complete recovery journey remain live gates.
2. Rehearse remote backup/restore. The production schema is current and the replacement database credential was verified after rotation. See `production-data-migration.md`.
3. Preserve the existing Sites account through an explicit verified identity mapping. The exact export is secured locally: one assessment archive containing six saved cases, one test-only professional approval and its audit event; there are no request, provider, payment, handoff or photo metadata rows. The archive payload is revision 260 with SHA-256 `8bf3d981d92be4406a94c72bd94f27480f6643c0070bc2bc68ac5039e8ad3cc9`. Import remains pending until `austin@myintelhome.com` has a verified Supabase user ID. No record has been copied to Turso.
4. Rehearse the implemented named-professional consent, revocation, handoff audit and operational follow-up with authorized remote test accounts. Staff claims or provider links alone do not grant access to customer reports/photos.
5. Test the complete customer, approved-professional and staff journeys on the remote stack, including approved test-email delivery and recovery, expired sessions, failed saves, photo access and restored data.
6. Record human sign-off for actual provider capacity, clinical content, privacy/retention/vendor agreements, senior/family usability and response ownership.
7. Verify the server build on a Vercel deployment and define a compatible rollback release before production cutover. The file-based build configuration now selects `web-production`; do not enable the static export or switch public hosting.
