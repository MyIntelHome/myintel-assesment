# Payment setup checkpoint — September 28, 2026

MyIntel's self-guided home check stays free. A customer can request help for free, review a named professional, service scope and staff-entered USD price, accept that exact proposal, and then use a one-time Stripe-hosted Checkout. There is no subscription or automatic provider split. See [payment and pricing options](payment-commercial-options.md). Prices in that document are research examples, not approved customer prices.

## Implemented on the isolated payment branch

- Checkout starts only for the authenticated request owner after acceptance. The price, currency and proposal version come from the saved server record. A database reservation precedes the Stripe call, so a staff completion or competing checkout cannot silently replace a pending charge. A lost response retries the same attempt and Stripe idempotency key; uncertain old attempts require staff reconciliation.
- An open Stripe session is retrieved and reused. Only a Stripe-confirmed expired session permits a fresh attempt. A successful return URL alone never marks a request paid. Signed webhook or authenticated Stripe retrieval checks session ID, proposal, amount, mode and payment intent before reconciliation.
- Test and live modes are explicit. A test payment is clearly labeled, does not mark the real service paid and cannot become a live purchase later. Use separate synthetic requests for test payments. A live mode additionally requires `MYINTEL_LIVE_PAYMENTS_APPROVED=true`.
- Stripe-signed refunds update a separate cumulative refund amount and audit events. They do not silently cancel or complete the service. Refund initiation and customer support remain a staff process in Stripe.
- `MYINTEL_PAYMENT_CHECKOUT_ENABLED=false` pauses new Checkout while signed payment and refund webhooks continue. Keep webhook credentials configured until open payments and refunds are reconciled.
- Migration `0007_payment_attempts` is additive. Application snapshots include payment attempts in version 3; verified version 2 snapshots can restore into a fully empty, newly migrated target.

## Current activation state

The Myintelhome 1 Stripe dashboard is now connected. A test-mode event destination named `MyIntel payment preview` (`we_1UKsqjF2xaGiK3vT4LlpSiCq`) targets `https://myintel-assesment-git-feature-paym-c17e9c-austin-8620s-projects.vercel.app/api/stripe/webhook`. It listens for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, and `charge.refunded`. The isolated Vercel feature branch has server-only test key and webhook signing secret variables, `MYINTEL_PAYMENT_MODE=test`, and `MYINTEL_PAYMENT_CHECKOUT_ENABLED=false`. The values are not in Git. A new deployment is needed for those environment changes to take effect.

The feature preview still lacks its account/database environment variables and displays account reconnection. The new database migration has not been applied to the connected Turso database. No real or test Stripe charge has been made. The existing public site continues to serve the earlier release, with payments disabled. Keep the branch isolated until a recovery copy, migration, preview backend configuration and remote payment tests are complete. A dedicated Supabase server key was not created because automatic approval review rejected that project-wide elevated access pending explicit authorization.

## Remaining activation steps

1. Confirm MyIntel is the seller and support/refund contact for the specific services it will charge for. If an independent OT sells and bills directly, leave that service outside MyIntel Checkout. Approve the proposal language, cancellation/refund terms and actual staff-entered prices before a real charge.
2. Take a private pre-migration recovery snapshot. Run the checked-in migration runner against the intended Turso database using its database-scoped credential and explicit `MYINTEL_MIGRATION_TARGET` check. Verify eight journal entries and that the new ledger is initially empty. Keep the additive schema on rollback; restore to a separately verified target if recovery is required.
3. Complete the isolated preview backend settings, redeploy, then verify its account and webhook routes. The test-mode webhook destination and Stripe/Vercel test variables described above already exist; preserve their branch-only scope. Never put secrets in Git or browser settings.
4. Exercise a complete test proposal, Checkout, failed/cancelled payment, expired link, duplicate webhook, pause switch and full/partial refund. Verify customer and staff views and ledger against Stripe's dashboard. Reconcile any uncertain attempt before trying it again.
5. For real charges, verify the Stripe merchant account and approved seller/terms. Configure separate live key and webhook secret, set `MYINTEL_PAYMENT_MODE=live`, then deliberately set `MYINTEL_LIVE_PAYMENTS_APPROVED=true`. Perform one supervised low-value real transaction and refund, verify settlement and support flow, and keep an explicit checkout pause procedure. Test requests do not turn into live purchases; create a fresh real proposal.

No automatic emails, provider payouts, tax calculation, refund initiation, subscription billing or clinical review are implied by this implementation. Human privacy, service-capacity and professional-availability work from the pilot checkpoint also remains open.
