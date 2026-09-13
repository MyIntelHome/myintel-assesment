# Public accounts and private storage: implementation checkpoint

## September 12 status

The recovered UI is reused by `web-production`, a server-rendered Next application with real API routes. `pnpm run build:production` builds it separately from the existing Sites Worker build. The Vercel project has not been reconfigured or redeployed. Its readiness guard still blocks release.

The selected adapters use Supabase Auth and a private Supabase Storage bucket, plus the previously tested libSQL database adapter (Turso-compatible). These services are not yet provisioned or connected. The owner's Supabase and Turso browser tabs currently require sign-in. No accounts, paid plans, agreements, provider passwords, or recovery emails were created by the agent.

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

The app accepts both token-hash confirmation links and Supabase's default browser-fragment session links. For a default link, the confirmation page moves the provider tokens into page memory and removes the fragment from browser history immediately; the server still verifies the provider identity before creating a MyIntel session. Custom token-hash templates are preferred because the confirmation page consumes them only after an explicit POST, so a GET-only email scanner does not consume the token. Configure the signup template link as `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup` and the recovery template as `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` once reviewed SMTP is enabled. Referrer policy is no-referrer. Do not log confirmation query strings, tokens, request bodies, fragments, or cookies in external analytics.

See the official [email template documentation](https://supabase.com/docs/guides/auth/auth-email-templates) and [recovery API](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail). Provider email limits, abuse controls, availability, region and data terms still require account-specific verification. The local email/action limiter supplements provider controls; it is not a complete distributed-abuse defence.

## Session protections and tested limits

The browser receives an opaque Secure/HttpOnly/SameSite cookie. Its hash is stored in the database; provider tokens are encrypted using AES-256-GCM. Every identity resolution verifies the provider user remotely. Supplied identity headers are ignored, and mutating requests require the configured Origin. Recovery sessions cannot read account data or invoke normal account APIs. Password reset revokes MyIntel sessions and blocks stale sign-ins that began before reset. Logout removes the local session even during a provider outage. Local failures never return a successful save.

Automated tests use real local libSQL databases and controlled auth/storage responses. They cover isolation, failed saves, migration rollback, encrypted/opaque sessions, reset/signout races, recovery scope, provider refresh, revoked tokens, public-bucket refusal and storage outages. These are not live Supabase/Turso/Vercel end-to-end tests or human usability sessions.

## Remaining launch gates

1. Owner signs into the remaining service account and resolves terms/region/vendor decisions. Supabase project `yyueldzkxdcykljbdquz` is healthy in East US (Ohio); email confirmation is enabled, its Site URL and exact callback now use `https://myintel-assesment.vercel.app`, and private bucket `home-photos` limits uploads to 3 MB JPEGs. Custom SMTP remains unconfigured.
2. Apply all six journalled migrations to the explicitly confirmed empty target; rehearse backup/restore. See `production-data-migration.md`.
3. Preserve existing Sites accounts through an explicit verified identity mapping and migrate D1 records and R2 bytes with hashes, access checks and rollback. No real migration has occurred.
4. Rehearse the implemented named-professional consent, revocation, handoff audit and operational follow-up with authorized remote test accounts. Staff claims or provider links alone do not grant access to customer reports/photos.
5. Test the complete customer, approved-professional and staff journeys on the remote stack, including approved test-email delivery and recovery, expired sessions, failed saves, photo access and restored data.
6. Record human sign-off for actual provider capacity, clinical content, privacy/retention/vendor agreements, senior/family usability and response ownership.
7. Only then replace the readiness guard and configure the existing Vercel project for the server application. Verify a staging deployment and a compatible rollback release before production cutover. Do not enable the static export or switch public hosting.
