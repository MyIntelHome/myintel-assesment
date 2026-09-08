# MyIntel Assessment Platform

A guided home check for families, a clinician assessment workspace, and account-backed professional service requests. This private review retains the Next.js assessment front end and adds a Cloudflare Worker API with a D1 database.

## Development and verification

Use the committed pnpm lockfile. Run `pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm test`, and `pnpm run build`. The build emits static front-end assets and a Worker in `dist`. Drizzle schema migrations are committed under `drizzle`.

`pnpm dev` runs the Next.js front end. It does not emulate the hosted account API: use the explicit device-draft fallback for local interface review. API integration tests use isolated SQLite databases; they never contact a live payment service. Hosted identity is supplied by the Sites dispatcher, never by client-submitted roles. Do not expose this Worker outside that trusted dispatcher without replacing its authentication adapter.

## Implemented

- One question at a time, explicit Next/Back, optional hints, skipped-question disclosure, saved room/question position, and ungated family results.
- Separate clinician ratings and family observations, clinical sign-off blockers, linked actions, preserved report versions and amendments.
- Account-owned assessment archives with revision checks, serialized saving, retry feedback, and conflict protection. Guest drafts remain explicitly device-local.
- My assessments, account navigation, optional import of device drafts from the same site/browser, and account-required professional inquiries.
- Confirmed inquiry receipts, a client request center, and an owner-only operations queue.
- Manually reviewed professional records; proposals require a matching service, scope and price. Clients must accept the current quote version.
- Disabled-by-default Stripe Checkout integration with server-side pricing and signed, amount/session/version-checked webhook handling.

## Review boundaries

The private preview uses ChatGPT sign-in and example information. Consumer email/password or other public sign-in is not implemented. The Vercel production app has not been changed by this preview.

Payments are not activated. Both Stripe secrets and a trusted app origin are required. Before activation, validate test-mode Checkout, webhook reachability through the deployment access policy, expired-session recovery, cancellation/refund terms and the merchant model. A private access gate may prevent Stripe reaching the webhook; do not enable payments until the chosen hosting path supports verified delivery. Redirects never mark a request paid.

Professionals are not prepopulated. MyIntel must verify credentials, service area and listing consent before adding anyone. Requests appear in the operations queue; email/SMS alerts, automatic matching, availability and confirmed booking are not connected. Assessment records are not automatically shared with providers or MyIntel staff.

See `docs/operating-model.md` and `docs/release-verification-2026-09-08.md` for current data handling, tested behavior and release limits. This implementation does not establish clinical validation, HIPAA compliance, organization tenancy, monitoring, or a complete installable/offline PWA.
