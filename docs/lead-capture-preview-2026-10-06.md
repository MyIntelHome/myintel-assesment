# Lead capture and plan delivery, October 6, 2026

## Status and decision

Implemented on `feature/plan-capture-2026-10-06`, based on verified GitHub main `8a1d085b553096fdb5bfb2b41fb49b845efb877e`. This batch is preview-only. It has not been merged or released on the public HomeCheck domain.

The requested summary emails conflict with the existing unfinished privacy/vendor review. The owner chose to build the requested summaries on preview, with public delivery disabled until review is complete. Both the feature and outgoing delivery require `VERCEL_ENV=preview`; production cannot enable them by supplying the feature flag. No production credentials, database schema, domains, payments or access roles have been changed.

## Customer experience and consent

- A prominent results block offers “Email me my plan” and “Save my results without email”. First name and email are required; ZIP and phone are optional.
- A verified account can save immediately. Guests verify by email code using Supabase, then save. Provider tokens remain encrypted server-side; the browser receives the existing opaque HttpOnly session cookie.
- Saving this selected device draft is explicit. Only that draft is copied into the verified account; the original device records and other account cases remain intact. A revision conflict preserves the device draft and form. Signed reports and the professional archive retain their existing protections.
- Email permission, permission to contact and permission to share results are stored separately. Contact and sharing boxes start unchecked. Email content is sent only to the verified account address, never a form-supplied recipient.
- Every saved plan creates a staff receipt with contact fields and consent choices. Staff APIs return result text only when sharing permission was selected. Contact permission alone does not reveal results. Plan receipts contain immutable snapshots of the saved family check, not clinical reports.
- Saving without email creates no customer email job. Contact permission alone creates a separate staff notification. No professional receives a plan automatically.
- Existing draft-email, copy, download and print actions remain available below results.

Help requests show service and contact questions first. Email verification comes last, before any server save. The existing request schema, contact consent, optional family snapshot and later named-professional/photo sharing rules remain in force. A guest who chooses to share a device home check explicitly saves only that check after verification. An existing-session account switch is rejected. Code verification retains the form; the person reviews their choices and presses “Send my request”.

## Operations and mail

Staff notifications contain only name, verified email, optional phone, contact preference, ZIP, request type and a link to the specific Operations item. They contain no assessment, mobility, diet or clinical answers. Default staff mailbox: `info@myintelhome.com`, configurable server-side.

Saved-plan follow-up supports claim, release and close with history and conditional writes. Staff cannot claim plans without contact permission. The existing verified Austin administrator is unchanged. Corey has **not** been given staff access; any additional staff identity requires a separate explicit access decision.

Mail jobs commit with the receipt/request before a send is attempted. Failures do not erase the receipt. Resend receives a stable idempotency key, and a database lease prevents concurrent sends. Accepted means provider acceptance, not inbox delivery. Customer retry uses the same receipt; staff can retry pending notifications from Operations. Automatic retries stop at 23 hours, before the provider's 24-hour idempotency expiry; uncertain older messages require manual provider review. Disabled messages never replay automatically after enabling delivery. Accepted message bodies are cleared from the outbox. No unattended retry scheduler or SMS service has been added.

## Recommendations and measurement

Every generated next-step recommendation has a stable semantic `needCode` and explicit category. Codes are mapped to the actual question topics, including `grab_bar_toilet`, `toilet_transfer_review` and `motion_lighting_bedroom`. They describe needs to discuss, not product prescriptions.

`SHOP_URL` is blank by default. A valid HTTPS base enables `/collections/<needCode>` links only on home modification and technology cards. Daily-life, support-plan, routine and healthcare advice never receive shop links. The exact commission disclosure appears only where a product link is present. No shop navigation or general shop page has been added.

First-party aggregate analytics store daily event counts only: check started, daily-life section exited, each room exited, results viewed, plan email accepted and help request submitted. Client payloads accept only enumerated event names and, for results, a coarse timing group. No answers, names, emails, room labels, case IDs, URLs or raw timestamps go into the analytics database. Check/room deduplication markers and start time stay on the device. Counts are anonymous events, not unique people, and cannot distinguish malicious/synthetic activity. Optional or unanswered questions can remain when a chapter is exited.

Staff can read counts for the latest 30 UTC calendar dates in Operations. Aggregate rows older than 31 days are removed when another event arrives. Elapsed start-to-results groups are under 10, 10 to 15, 15 to 30, and over 30 minutes. Timing includes breaks. Results without a recorded start have no time group. This provides a distribution, **not** an average, a clinical validation or completed senior usability testing. Real supervised timing and OT review remain outstanding.

## Preview setup and verification remaining

Read-only Vercel inspection confirmed that account/database/storage settings are scoped to the old pilot and payment-preview branches. The new branch has no backend configuration. Approval was requested before extending the isolated payment-preview credentials and migrating its test database. No secrets were revealed or copied, and no database migration has run remotely.

Before authenticated hosted testing:

1. Confirm an isolated preview database and private storage target; do not point this branch at production data. Back it up privately.
2. Configure the existing backend settings on this branch: `APP_ORIGIN` must match the canonical HTTPS preview alias; database URL/token, Supabase URL/publishable key/server key, session key, photo bucket and Austin admin email. Do not copy Stripe keys.
3. Explicitly run the journaled `0007_plan_capture.sql` migration on that confirmed preview database. It adds saved plans, plan events, mail jobs and daily funnel counts. Builds and requests never run migrations.
4. Set `MYINTEL_LEAD_PREVIEW=true` on this branch. Leave `MYINTEL_EMAIL_PREVIEW=false` until sender and recipient setup is ready.
5. Supabase email OTP requires its email template to include `{{ .Token }}`. Keep existing password/recovery templates intact. If the preview shares a Supabase project with production, do not silently change global templates; use an approved compatible template or isolated auth project. Add the canonical preview origin to allowed redirects. Verification emails still use Supabase's configured SMTP delivery.
6. For approved synthetic email tests, configure a sending-only Resend key, a verified `MYINTEL_EMAIL_FROM`, `MYINTEL_STAFF_NOTIFICATION_EMAIL`, and `MYINTEL_PREVIEW_EMAIL_ALLOWLIST`. Only allowlisted recipients can receive summary/notification messages. Keep keys in Vercel server secrets, never Git or browser code. Then explicitly enable `MYINTEL_EMAIL_PREVIEW=true` on the preview branch only.
7. Test guest and existing-account saves, contact-only/sharing-only/no-consent combinations, both notification triggers, wrong-owner and professional denial, save conflicts and provider failures, code expiry/retry, and actual inbox arrival. Local mocked-provider success does not prove live delivery.
8. Optionally set `SHOP_URL` on preview and verify category links and disclosure, then clear it again until the shop is ready.

No public delivery or production cutover is authorized by this checkpoint. A later review must address privacy/vendor/retention arrangements, emailed health-related content, actual staff coverage and sender/delivery evidence. Human OT and senior-session requirements remain unchanged.

## Migration and rollback

The release uses eight journaled migrations. Application backup version 3 covers all 20 application tables, including the four new lead tables, and excludes session/provider credentials. Version 2 backups remain restorable into a fully migrated **empty** target; all new tables must also be empty. No existing table has been removed or rewritten.

Rollback means redeploying the previous application commit with lead/email flags off, preserving the new tables and their private backup. Do not drop lead tables or replay mail jobs. Restoring or switching databases requires reconciliation of writes made after the backup and separate private-photo validation. Snapshot files must remain outside Git.

## Evidence

The final local suite passed 347 tests across 43 files after input-size hardening and connection-error handling. TypeScript and the final production build passed. A local browser check confirmed that guest request questions appear before verification, plan-saving choices appear near the top of results, both optional consent boxes are unchecked, and phone-width fields fit without horizontal overflow. This visual preview used device-only synthetic data and no backend credentials; it does not prove hosted account saves or live email delivery. Final verification and the hosted preview deployment reference will be added after the remaining build and deployment checks.

Provider references: [Supabase email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
