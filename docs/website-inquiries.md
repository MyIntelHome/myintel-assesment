# Website contact and care company inquiries

Status: implemented on a preview branch. Do not enable production settings or migrate production for this release until Austin approves. Existing production lead flags are unchanged.

## Behavior

`POST /api/website-inquiry` is the only public cross-origin intake route. No account or cookies are needed. JSON contains `type`, a UUID `idempotencyKey`, `name`, `email`, `phone`, `message`, `contactConsent: true`, and an empty honeypot `website`.

- `contact`: add `relationship` (`myself`, `parent_or_relative`, `someone_else`) and optional five-digit `postalCode`. Email or phone is required.
- `care_company`: add `companyName`, `role`, and optional `clientCount` (`1-10`, `11-50`, `51-200`, `200+`). Email is required.

Limits: name/role 100 characters, company 150, email 254, phone 30 characters with 10 to 15 digits, message 3,000, streamed body 16,000 bytes. Unknown fields, invalid types and missing permission are rejected. The honeypot returns a generic success without saving or sending.

The public response is only `{ok:true}` or `{ok:false}`. It never returns contact details, record identifiers, staff addresses or credentials. A success confirms storage, not inbox delivery.

Migration `0008_website_inquiries.sql` adds three tables, with no changes to existing rows: inquiries, coordination events and short-lived rate counters. Snapshot format 4 includes these tables. Formats 2 and 3 remain restorable into an empty, fully migrated destination. No migration runs during a build or request.

Operations shows **Website contact** and **Care company** in the website inquiry queue alongside existing help requests and saved plans. Staff can claim, return and close inquiries, with an audit entry. Contact permission and its recorded time remain visible. Account sessions and staff authorization protect all admin endpoints.

The lead and one `staff-website:<UUID>` outbox item commit atomically. An unchanged retry uses the same UUID. A conflicting payload cannot rewrite that record. Notifications use the existing `deliverMail` lease, Resend idempotency key, 23-hour retry window and manual staff retry control. There is no customer reply. All submitted fields and an authenticated Operations destination are in the staff notification. Submitted text is escaped in HTML.

## Hosting configuration

Configure the **new HomeCheck preview branch only**, using an isolated preview database with the additive migration applied after verifying its migration journal. Never point a test preview at the production database.

| Variable | Preview value or purpose |
| --- | --- |
| `APP_ORIGIN` | Exact HomeCheck preview origin, also used in Operations email links |
| `MYINTEL_LEAD_PREVIEW` | `true` for the approved test preview |
| `MYINTEL_EMAIL_PREVIEW` | `true` for the approved staff email test |
| `MYINTEL_PREVIEW_EMAIL_ALLOWLIST` | Must include `austin@myintelhome.com`, and no unapproved recipients |
| `MYINTEL_STAFF_NOTIFICATION_EMAIL` | `austin@myintelhome.com` |
| `MYINTEL_WEBSITE_PREVIEW_ORIGINS` | Comma-separated, exact website Vercel preview origins |
| `MYINTEL_DATABASE_URL`, `MYINTEL_DATABASE_AUTH_TOKEN` | Isolated preview database and valid scoped token |
| `MYINTEL_SESSION_KEY` | Existing server session secret, also salts short-lived rate keys |
| `RESEND_API_KEY`, `MYINTEL_EMAIL_FROM` | Existing approved sending configuration |
| `MYINTEL_SUPABASE_URL`, `MYINTEL_SUPABASE_PUBLISHABLE_KEY`, `MYINTEL_SUPABASE_SERVICE_KEY`, `MYINTEL_PHOTO_BUCKET` | Existing production adapter prerequisites, scoped to preview |

Only `https://www.myintelhome.com`, `https://myintelhome.com`, and exact configured HTTPS `my-intel-website-*.vercel.app` origins can call intake. No shared Vercel wildcard is accepted. Add the stable website branch alias plus the exact deployment URL used in testing. Do not enable credentialed CORS. Exported OPTIONS handles preflight without account access, including when capture is disabled.

Rate limiting allows ten POST attempts per IP per 15-minute window in the database, shared across instances. Raw IPs are not stored. The salted window key expires from the rate table after at most 45 minutes on subsequent traffic. This adapter relies on Vercel's overwritten `X-Forwarded-For` header; another proxy must supply a trusted value. Missing IPs share a limited bucket. CORS is a browser restriction, so validation, the honeypot and rate limiting still apply to direct callers.

## Release test and approval gate

1. Apply only pending migrations to the isolated preview after backup/journal checks. Set the preview variables and redeploy.
2. Set the website's Preview `NEXT_PUBLIC_WEBSITE_INQUIRY_URL` to `https://<HomeCheck-preview>/api/website-inquiry` and redeploy the website.
3. Open the website preview at desktop and 375px. Submit one explicitly synthetic contact and one synthetic care company inquiry. Use no real client details.
4. Sign in as staff. Confirm both labeled records, submitted fields and permission timestamps in Operations. Confirm actual staff inbox arrival, not merely Resend acceptance. No customer auto-reply should exist.
5. Retry each identical payload with its original UUID. Confirm exactly one lead, submission event and staff notification per type. Also verify denied origins and the disabled-capture phone fallback.
6. Obtain Austin's approval before production migration/deployment and setting the website endpoint to `https://homecheck.myintelhome.com/api/website-inquiry`. This change adds no new production feature flag. Keep existing capture/delivery and payment/shop flags unchanged.

Local verification: both production builds and type checks passed. The backend suite passed 375 tests, including 23 inquiry tests using a real SQLite database and a mocked email provider. Browser layout checks cover 1440, 1024, 768, 375 and 320px. A local browser integration also submitted both forms through the actual intake handler, checked the two Operations records, and retried both original payloads. Exactly two staff notifications reached the fake provider, with no customer replies. Success-message focus passed. This is not proof of real inbox delivery.

Both draft PRs have successful Vercel deployments. Website PR: https://github.com/MyIntelHome/MyIntel-Website/pull/3. HomeCheck PR: https://github.com/MyIntelHome/myintel-assesment/pull/8. Both preview URLs require Vercel sign-in. Hosted records and real staff inbox delivery remain unverified.

## October 15 preview configuration checkpoint

Vercel access now works for both projects, including protected page reads. Preview redeployments reached READY: HomeCheck `dpl_EHnYK58y2R4AE844Cr9A2idCs3p4`, website `dpl_5BV8yuk2EnXxpuGfnz3LQdAPhVpT`. Their targets are preview, not production.

On `feature/website-inquiries`, configured the exact APP_ORIGIN and website preview-origin allowlist, capture/email preview flags, Austin-only recipient allowlist, staff/admin address, verified sender, photo bucket and a new independent session secret. Reused only the existing public Supabase URL and publishable configuration. Production settings and other preview branches were not edited. The website's `feature/website-inquiry-forms` now has its public endpoint set to the HomeCheck branch preview.

Four values remain missing from the new HomeCheck branch:

- `MYINTEL_DATABASE_URL`, for the isolated test database only.
- `MYINTEL_DATABASE_AUTH_TOKEN`, a currently valid token for that test database.
- `MYINTEL_SUPABASE_SERVICE_KEY`, the approved server account/storage key.
- `RESEND_API_KEY`, the approved sending key.

The corresponding older-branch values are write-only Vercel Secrets and cannot be copied through the read API. Add these directly in Vercel, scoped to Preview and `feature/website-inquiries`, without pasting secrets into chat. The old test database token was documented as temporary; verify or renew it. Then redeploy, verify the isolated database journal, apply only pending migrations, and run the hosted test sequence above. No database migration or real staff email has run in this checkpoint. The protected lead-config check returned `enabled:true`, `deliveryEnabled:false`, and an empty shop URL, as expected with missing delivery credentials.

## Rollback

Remove the website endpoint setting and redeploy to show the call fallback, or revert the website form commit. Revert the HomeCheck commit to remove the public endpoint and new Operations queue. Existing HomeCheck lead capture can continue with its original flags. Do not turn off existing production capture/delivery merely to roll back website forms. Keep the additive tables, migration journal and any captured inquiries for staff review. Do not drop or alter production tables. Clear only the new preview-origin allowlist when the preview is retired. Preserve an encrypted complete snapshot before any future data change.


## October 16 hosted verification checkpoint

This checkpoint supersedes the earlier missing-credentials status. Production is unchanged; keep both PRs draft and do not merge or launch.

- Browser control was verified in a local Codex session before operating dashboards. All four missing values are saved as Vercel Secrets only for HomeCheck Preview / `feature/website-inquiries`. No secret values are recorded here.
- The target is `myintel-payment-preview-0928`, never the production database. A database export passed SQLite integrity checks and all 11 existing migration checksums matched saved source, including the payment/billing lineage. Encrypted before/after copies were retained locally.
- Applied only `0008_website_inquiries.sql` (SHA-256 `17d9a0c21f8fc4f28f1856bbada0380f833bf66ecbbc64b14c8e01770de4ed06`). Turso Studio does not retain an explicit transaction across statements, so the three tables and index were added separately and verified before recording the journal entry. All 11 previous entries are preserved; the journal now has 12. Existing unrelated table counts were unchanged.
- HomeCheck deployment `dpl_3MnL6r1m8BCynDQiB34hcThvLSxx`, commit `bbb18f578644b615bfe82cc124abb410688d3f58`, reached READY with the new credentials. Capture and delivery report enabled; shop URL remains empty.
- Through Austin-approved temporary Vercel preview access, one clearly synthetic contact and one synthetic care-company payload returned HTTP 200 / `{ok:true}`. Each original payload and UUID was then retried unchanged, also returning 200. Post-test database inspection found exactly one inquiry, one submitted audit event, and one accepted staff notification per type, with no customer auto-replies.
- Actual Gmail INBOX receipt was verified at `austin@myintelhome.com`: one “MyIntel: Website contact” and one “MyIntel: Care company”, both at 2026-10-16 23:46:19 UTC (5:46:19 PM Denver). A later inbox search still found exactly those two test messages.
- Authenticated exact-origin preflight returned 204; an unapproved origin returned application JSON 403. Credential-free preflight was redirected by Vercel authentication (302). The unmodified hosted website form therefore showed its call fallback and preserved the entered values. Temporary access cookies do not authenticate the form's `credentials:omit` cross-origin request. Never embed a protection token in NEXT_PUBLIC configuration, relax production protection, or claim a browser success from the authenticated API checks.
- Remaining: successful protected browser-to-form submission using a supported origin-scoped test-authentication mechanism; desktop/375px hosted success verification; staff sign-in and visible confirmation of both Operations labels/fields/consent times. The first preview password sign-in returned a generic verification failure; Austin was asked to retry directly in the browser. Backend/API and inbox evidence do not prove the Operations UI or browser success.

The release approval gate remains in place. Do not merge, migrate production, change the production endpoint, or launch until the remaining hosted browser/staff checks pass and Austin approves.
