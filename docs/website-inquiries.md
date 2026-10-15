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

Both draft PRs have successful Vercel deployments. Website PR: https://github.com/MyIntelHome/MyIntel-Website/pull/3. HomeCheck PR: https://github.com/MyIntelHome/myintel-assesment/pull/8. Both preview URLs currently require Vercel sign-in. No preview credentials, migrations or environment variables were changed during this implementation, so hosted records and real staff inbox delivery remain unverified.

## Rollback

Remove the website endpoint setting and redeploy to show the call fallback, or revert the website form commit. Revert the HomeCheck commit to remove the public endpoint and new Operations queue. Existing HomeCheck lead capture can continue with its original flags. Do not turn off existing production capture/delivery merely to roll back website forms. Keep the additive tables, migration journal and any captured inquiries for staff review. Do not drop or alter production tables. Clear only the new preview-origin allowlist when the preview is retired. Preserve an encrypted complete snapshot before any future data change.
