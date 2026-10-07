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

### Test connection verified October 7

The user opened the account's test environment. The separately connected Stripe link named Sandbox (`link_6ac696b5f454819183a39525d4ab37cd`) now confirms the same account with livemode=false. Its catalog was empty before these test prices were created:

| Offer | Test price |
|---|---|
| $19 single | price_1UO0X9F2xaGiK3vT2y16rRNe |
| $49 monthly | price_1UO0XFF2xaGiK3vT1YZpYkoa |
| $10 subscriber extra | price_1UO0XKF2xaGiK3vT3z56PycZ |

These use the same product IDs as the live catalog in separate test-mode namespaces. No test customer, subscription or charge was created during this catalog setup. The user approved and created the restricted test key homecheck_professional_preview. It and the three test price IDs are saved as Vercel server secrets only for feature/professional-billing-2026-10-07. The test webhook we_1UO12nF2xaGiK3vTiUIZb8Qu uses API 2026-08-26.dahlia and the events below; it remains disabled until the backend is ready. Its signing secret and branch APP_ORIGIN are saved. Billing, checkout and live-mode flags remain false. Backend dashboard sign-in, credentials, backup, migration and hosted verification remain pending.

## Activation and rollback

All billing flags default off. This implementation has not activated billing or checkout on the public domain.

1. Confirm and privately back up an isolated preview database. Apply the unified journaled migration manifest through 0009_unified_preview_lineage.sql. Both historical 0007 payment-attempt and plan-capture lineages retain their original names and checksums; only missing migrations are applied atomically. The 0009 file is a journal marker with no schema change. The four new tables are professional_billing, professional_credits, professional_allocations and professional_checkouts. Builds and requests never migrate.
2. Configure that preview's existing account/photo settings, approved professional test identities, and server-only restricted Stripe test key. Never copy credentials into Git or browser code.
3. Configure the three matching test prices and a signed webhook at /api/professional/billing/webhook. Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, customer.subscription.created/updated/deleted, invoice.paid, invoice.payment_failed, charge.refunded and charge.dispute.created. Ignored unpaid/expired events grant no access.
4. Enable MYINTEL_PROFESSIONAL_BILLING=true only after migration; enable MYINTEL_PROFESSIONAL_CHECKOUT=true only after matching keys, prices and webhook secret are present. Keep MYINTEL_PROFESSIONAL_STRIPE_LIVE=false on test environments.
5. Test the real demo through signing, blocked second case, one-time purchase, subscription and renewal, expired/cancelled checkout, failed payment, cancellation, refund/dispute hold and existing-report access. Local provider mocks do not prove real Stripe fulfillment.
6. Before public charging, approve refund/cancellation/credit terms, review tax obligations and configure the Stripe customer portal. Automatic Stripe Tax has not been enabled; registrations and product tax treatment remain unverified. Verify a private production backup and compatible migration before enabling billing there.

The exporter detects recognized historical inventories before migration and rejects incomplete inventories. Fully migrated backups use version 5 and include all 25 application tables, including payment_attempts and excluding authentication-session tables. Versions 2, both historical version 3 inventories, and version 4 backups restore only into a fully migrated empty destination. Restore checks the entire destination before writing any record. Rollback means billing/checkout flags off and redeploying the prior application; preserve ledger records and reconcile writes, rather than dropping tables or replaying credits. Pausing the app does not cancel Stripe subscriptions or their recurring charges; reconcile subscription cancellation separately before billing rollback.

## Evidence

October 7 local verification: all 391 tests across 45 files pass after migration compatibility work. Type checking and the production build also passed for this batch. A subsequent pre-migration exporter fix passed all 22 database tests and type checking; it adds one test to the 391-test baseline. No remote billing migration, hosted Stripe fulfillment test or public billing activation has been performed. Test-mode connector access is now verified; the earlier live-only connection blocker is resolved.

Server tests cover owner isolation, professional revocation, a single demo reservation, blank initialization, completion idempotency, failed-save rollback, hidden family records, existing reports, payment replay, subscription renewal/expiry, mismatched price/currency/customer, unpaid checkout, failed subscription recovery and refunds/disputes. Professional UI and full regression checks are recorded in the final checkpoint. Hosted payment and usability checks remain pending.
