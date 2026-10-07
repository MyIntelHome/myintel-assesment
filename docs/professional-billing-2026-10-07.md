# Professional assessment billing

The user approved one free professional assessment per approved account, then $19 per assessment or $49/month including five assessments each billing period. Additional subscriber assessments are explicit $10 purchases, not automatic overage charges. Customer home checks remain free and customer service proposals are separate.

## Behavior

Pricing appears before professional sign-in, in the workspace banner and in Plan & billing. A free draft reserves the demo allowance; its first successfully saved signed report completes that allowance. Another substantive clinical case cannot be saved without an available credit. Empty initialization placeholders do not reserve credits. Reservations and finalization occur in the same write transaction as the clinical archive save, so a failed save does not consume access. Existing signed reports and amendments are preserved without another charge. Unfinished pre-existing drafts require an allowance on their next substantive save. Imported old signed reports remain preserved. Bulk device import is disabled while billing is active; no silent pilot exemption or clinical approval is granted.

One-time purchased credits do not expire. Five subscription credits are granted once per verified paid billing-cycle invoice, expire at that invoice's period end and do not roll over. A reserved assessment can be finished after its subscription credit's period ends. Failed or canceled subscriptions do not grant new subscription allowance. The billing portal remains reachable to update payment details or cancel, even after a failed payment. No stored card data is handled by the app. A refunded or disputed charge places the customer's paid allowance on a conservative staff-review hold; completed reports stay accessible. Staff must reconcile the affected credits and subscription before clearing that hold. No automatic refunds are implemented.

## Stripe catalog confirmed through the connected plugin

Account: Myintelhome 1, acct_1P1FPzF2xaGiK3vT, live mode. These catalog entries were created, without creating customers, subscriptions, payment links or charges:

| Offer | Product | Live price |
|---|---|---|
| $19 single | myintel_homecheck_professional_single_v1 | price_1UNzoiF2xaGiK3vTKNo1P088 |
| $49 monthly | myintel_homecheck_professional_monthly_v1 | price_1UNzoYF2xaGiK3vTdhB8cr5z |
| $10 subscriber extra | myintel_homecheck_professional_extra_v1 | price_1UNzomF2xaGiK3vTNUOQTrVF |

Do not use live price IDs with test keys. Connect a separate sandbox and create matching test products/prices for hosted testing. Stripe SDK 22.6.0 uses API 2026-08-26.dahlia. Checkout uses server-selected prices, dynamically eligible payment methods and stable idempotency keys. Only a verified signed webhook plus canonical Stripe resource retrieval grants paid credits; the browser return URL never grants access. Checkout retries resume the same open subscription session. Unknown sessions for a known professional customer return a retryable error while local registration completes.

## Activation and rollback

All billing flags default off. This implementation has not activated billing or checkout on the public domain.

1. Confirm and privately back up an isolated preview database. Apply journaled migrations through 0008_professional_billing.sql. The four new tables are professional_billing, professional_credits, professional_allocations and professional_checkouts. Builds and requests never migrate.
2. Configure that preview's existing account/photo settings, approved professional test identities, and server-only restricted Stripe test key. Never copy credentials into Git or browser code.
3. Configure the three matching test prices and a signed webhook at /api/professional/billing/webhook. Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, customer.subscription.created/updated/deleted, invoice.paid, invoice.payment_failed, charge.refunded and charge.dispute.created. Ignored unpaid/expired events grant no access.
4. Enable MYINTEL_PROFESSIONAL_BILLING=true only after migration; enable MYINTEL_PROFESSIONAL_CHECKOUT=true only after matching keys, prices and webhook secret are present. Keep MYINTEL_PROFESSIONAL_STRIPE_LIVE=false on test environments.
5. Test the real demo through signing, blocked second case, one-time purchase, subscription and renewal, expired/cancelled checkout, failed payment, cancellation, refund/dispute hold and existing-report access. Local provider mocks do not prove real Stripe fulfillment.
6. Before public charging, approve refund/cancellation/credit terms, review tax obligations and configure the Stripe customer portal. Automatic Stripe Tax has not been enabled; registrations and product tax treatment remain unverified. Verify a private production backup and compatible migration before enabling billing there.

Backups use version 4 and include all 24 application tables, excluding authentication-session tables. Version 2 and 3 backups restore only into a fully migrated empty destination. Rollback means billing/checkout flags off and redeploying the prior application; preserve ledger records and reconcile writes, rather than dropping tables or replaying credits. Pausing the app does not cancel Stripe subscriptions or their recurring charges; reconcile subscription cancellation separately before billing rollback.

## Evidence

October 7 local verification: all 384 tests across 45 files pass. Type checking and the production build passed during this implementation batch. No remote billing migration, hosted Stripe fulfillment test or public billing activation has been performed. Refreshing the Stripe connector after reauthorization still exposes only the live account; sandbox access remains unresolved.

Server tests cover owner isolation, professional revocation, a single demo reservation, blank initialization, completion idempotency, failed-save rollback, hidden family records, existing reports, payment replay, subscription renewal/expiry, mismatched price/currency/customer, unpaid checkout, failed subscription recovery and refunds/disputes. Professional UI and full regression checks are recorded in the final checkpoint. Hosted payment and usability checks remain pending.
