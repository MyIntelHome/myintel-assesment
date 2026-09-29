# Payment and pricing options for the Colorado pilot

Research checked September 26, 2026. This is a proposed commercial design, not approved pricing, a published customer policy, a legal determination, or proof of Stripe activation. The owner requested payment implementation; merchant identity, actual service capacity, prices, and refund terms still need concrete decisions.

## Recommended first version

Keep the self-guided home check and request for help free. Staff should confirm the actual provider, service scope, availability and all-in USD price before issuing an individual proposal. Accept the proposal separately from payment. Charge once through Stripe-hosted Checkout only for that accepted version. Avoid subscriptions, automatic matching, a referral commission, financing and deposits during the first small pilot. This recommendation is based on the small known supply of professionals and the existing proposal workflow, rather than evidence of market demand.

The payment implementation can be completed and exercised in a Stripe sandbox without moving real money. Stripe requires business verification and service activation for live use. The owner supplies business and account information directly to Stripe, including customer-facing business/support details; do not put bank or identity documents in this repository. [Stripe account setup](https://docs.stripe.com/get-started/account/set-up), [sandbox testing](https://docs.stripe.com/testing).

## Choose who sells the service

| Model | Appropriate use | Recommendation |
| --- | --- | --- |
| MyIntel sells its own service through its Stripe account | MyIntel commits to delivery, handles customer support and refunds, and has arrangements with whoever performs the work | Simplest implementation, but only activate for services MyIntel has actually agreed to sell and take responsibility for. |
| Independent professional sells directly | The OT or other professional contracts with and bills the customer itself | Keep MyIntel inquiry/handoff free initially; the provider uses its own billing. Clearly identify that seller and do not collect its money through a generic MyIntel charge. |
| MyIntel operates a payment platform with Stripe Connect | MyIntel needs provider onboarding, platform fees and integrated provider payments | Defer until the seller model and professional agreements are settled. Connect is a separate onboarding and money-movement project. |

Stripe says the merchant of record must be clear across the website, payment flow, terms and receipt. In Connect, direct charges make the connected account the merchant; indirect charges without `on_behalf_of` make the platform the merchant. Changing a label does not change the integration's allocation of responsibilities. [Stripe merchant-of-record documentation](https://docs.stripe.com/connect/merchant-of-record).

## What “free setup” means

Stripe's standard US pricing lists no setup or monthly fee and **2.9% + $0.30 per successful domestic-card transaction**. International cards, currency conversion, disputes and optional products can add costs. Processing fees from the original transaction are not returned on refund. Recheck the actual account's pricing before activating live payments. [Stripe US pricing](https://stripe.com/pricing).

Connect has different models. When Stripe sets and bills connected-account processing prices directly, its listed model adds no platform account/payout fees. When the platform handles pricing, the listed Connect fees include **$2 per monthly active account** and **0.25% + $0.25 per payout**, in addition to payment processing. These models are not interchangeable promises of cost-free marketplace payments. [Stripe Connect pricing](https://stripe.com/connect/pricing).

## Price reference points

These are providers' publicly listed prices, not MyIntel quotes, a statistically representative market range, or evidence that any provider is available to partner with MyIntel. Service credentials, geography, scope and delivery differ.

| Provider and location | Published offer | Useful comparison |
| --- | --- | --- |
| [WelcomeYears](https://welcomeyears.com/products/home-assessment-online), Denver/Boulder for in-person service | Home assessment page displays **$499**, online/in-person selector, CAPS review and digital report | Closest local aging-in-place reference. Confirm selected variant price directly before using it commercially. |
| [Concierge OT & Wellness](https://www.conciergeottampa.com/), Tampa Bay | Home safety assessment **$350**; 30-minute virtual wellness consultation **$49**, credited toward an in-home evaluation booked within 30 days | Distinguishes an inexpensive consultation from an OT assessment; neither is equivalent to an automated self-check. |
| [Solutions for Aging in Place](https://www.ageinplacetulsa.com/service-page/expanded-home-safety-assessment), Tulsa | Two-hour home safety assessment **$250** | A lower published in-home reference outside Colorado; do not infer identical clinical scope. |

An illustrative discussion menu could be **$0 self-check**, **$49 planning call**, and an individually quoted **$299–$399 in-home assessment**. These are unapproved examples for owner/provider discussion. Do not publish them, preload them as live products, or describe an assessment as OT-led until the provider, scope and availability are confirmed. Equipment and installation should receive separate written quotes.

At the domestic-card rate above, a $49 sale costs about $1.72 in processing and leaves $47.28 before service costs. A $349 sale costs about $10.42 and leaves $338.58. For illustration only, if that visit requires $200 provider pay, $40 travel, $30 coordination and a $20 reserve, the remainder is $48.58 before taxes and other overhead. Replace every cost assumption with actual pilot measurements; the margin becomes poor quickly if travel or reporting takes longer.

## Decisions before taking a customer's money

The owner should approve one concrete offer containing:

1. Seller's business identity and support contact, named service/provider, geographic area, deliverables, and exclusions.
2. Total price and currency, whether any tax applies, and when payment becomes due. Do not assume healthcare coverage, tax exemption, or insurance reimbursement.
3. A cancellation window, rescheduling rules, no-show treatment, partial-work handling, and who approves refunds.
4. A policy for provider cancellation or inability to deliver. A reasonable initial proposal is a full refund if MyIntel cannot deliver and a full refund for cancellation before work begins; this is a recommendation requiring owner approval, not the current contract.
5. How customers request a refund and how staff record, reconcile and follow up on it. Avoid a guaranteed bank-arrival date.

Stripe supports full/partial refunds through its Dashboard or API. A refund can remain pending if the available balance is insufficient or can fail; creating one is not proof that the customer received it. Return funds to the original payment method and maintain enough balance to honor agreed refunds. [Stripe refund lifecycle](https://docs.stripe.com/refunds).

## Implementation and activation checklist

- Use the accepted server-side proposal amount/version; never accept a client-provided charge amount. Store only opaque request/payment references in Stripe metadata, with no health answers or photos.
- Use hosted Checkout for card entry. Persist a checkout attempt, prevent duplicate charges, and provide expired-session recovery. [Stripe-hosted Checkout lifecycle](https://docs.stripe.com/payments/checkout/how-checkout-works?payment-ui=stripe-hosted).
- Treat authenticated Stripe webhook reconciliation, not a success-page visit, as payment authority. Validate session, mode, currency and amount; replay/out-of-order delivery must not corrupt state.
- Exercise successful payment, decline, cancellation, duplicate click, expired session, missing/delayed webhook, refund and cross-account isolation using test keys and Stripe test data. Stripe's test transactions move no money; do not test live mode using real cards. [Stripe testing guidance](https://docs.stripe.com/testing).
- Confirm the correct Stripe account, live activation, payout setup, server-only live key, production webhook signing secret, final policy wording and a genuine fulfillable offer before switching the production payment flag on. Sandbox success does not prove a live merchant is ready.
- Keep a rapid disable switch for new checkout creation while preserving reconciliation of previously created payments and refunds. No automatic professional payouts are proposed for this phase.

This document does not change runtime flags, provider availability, customer terms, or current deployment state.
