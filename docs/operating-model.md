# MyIntel private review operating model

Updated September 8, 2026. This describes implementation, not a legal determination.

September 12 development update: the shared API now defaults to anonymous and only the Sites Worker selects its trusted-header adapter. A libSQL production database compatibility adapter and local migration/restore rehearsal are available but are not connected to public hosting. See `recovery-2026-09-12.md` and `production-data-migration.md`. The deployed private preview has not been updated by this work.

## Identity and records

The hosted preview identifies visitors using the Sites dispatcher's trusted authenticated-user ID and email headers. A missing identity cannot read/write account assessments or service requests. Every assessment operation is owner-scoped. The verified site owner's configured email grants operations access on the server; a browser role flag does not grant access.

Account assessment archives, service requests, reviewed providers and request/payment events are stored in D1. Assessment archives are private to their owner through the app API. The MyIntel operations API exposes service requests and provider records, not clinical assessment archives. Infrastructure administration still requires appropriate controls.

Guest checks use this browser's localStorage. Existing device drafts on the same origin can be explicitly copied into an account; signing in does not silently import them. Original drafts remain. Vercel-origin browser storage cannot be read by the separate Sites preview. No cross-site migration is claimed.

Account saves are serialized with revision checks. Concurrent writes or changed accounts pause saving and preserve the current draft for download. Network failures show an unsaved state and permit retries. This is not offline synchronization. Do not clear or close unsaved work.

## Data minimization and reports

Use example information in the private review. Free-text notes and references are not automatically de-identified. Client identity for optional export is held in component memory and not added to the saved report snapshot. Exported documents may contain it and require appropriate handling.

Family answers and clinical ratings remain separate. Finalization preserves a snapshot of report data and wording, template versions, attestation and time. Existing historical snapshots cannot be removed or changed through the account-save API. Amendments retain history. These controls are not independently verified clinician identity, cryptographic signing, a certified clinical instrument or a comprehensive access-audit system.

No outbound AI or partner monitoring is connected.

## Professional requests

Submitting an inquiry requires sign-in, a service choice, contact name, US ZIP code, contact preference, relationship and contact consent. A phone number is required for callbacks. Email comes from authenticated identity. Home-check sharing is optional and unchecked by default. With explicit consent, the server attaches a snapshot of the account owner's saved family report, home layout and daily-life answers to the inquiry. Later assessment edits do not change that snapshot. Clinical archives are not attached.

After that request is saved, the owner may share up to six guided room photos. The browser resizes supported images and re-encodes them as JPEG to remove original metadata. Each photo requires a separate sharing confirmation. The server limits file size, format and dimensions, verifies ownership and stores bytes in private R2 storage. Only the owner and configured MyIntel staff can retrieve images through authenticated routes. Owners can remove photos. MyIntel coordinates professional review; the app does not automatically forward reports or images to a professional. A full retention/deletion policy and operational access review remain public-launch work.

The server records a receipt and deduplicates retries using the request ID. Clients can see their own requests; configured MyIntel staff can review requests in operations. No automatic emails/SMS are sent. Staff must check the queue and arrange follow-up.

Provider listings are entered only after manual MyIntel review of credentials, service area and listing permission. There are no seeded professionals or claims of automatic credential verification. A proposal requires a reviewed professional for that service, scope and USD price. Acceptance binds the current quote version. Scheduling is not confirmed merely by an inquiry, proposal or acceptance.

## Payment foundation

Payments are disabled until runtime configuration and operational testing are complete. Checkout takes the amount from the accepted server-side proposal. Card data is handled by Stripe's hosted page. Only a valid signed webhook whose session, amount, currency and quote version match can mark payment received. Return URLs alone have no payment authority.

Before enabling: establish the merchant/service model and terms, verify Stripe test-mode success/failure and webhook delivery on the chosen hosting policy, implement and exercise expired Checkout recovery, and validate refund/cancellation handling. The owner-private preview is not a live payment launch.

## Public launch requirements

Select and implement family-facing authentication suitable for the public app; confirm real-device and assistive-technology usability with seniors/families/OTs; review clinical content and the actual healthcare data flow; arrange applicable privacy, retention, contractual and security controls; onboard real professionals and define response ownership.

Professional access requires a staff-reviewed application with credential details and an auditable decision. Verification is manual, not an automated licensing-registry check. Approval grants only the account's own clinical workspace, not a network listing. Clinical reads and writes enforce current approval on the server. Client saves preserve inaccessible clinical records, including earlier signed versions.

Shared organization memberships, delegated family access, automatic credential verification, automated provider matching, appointment availability, request alerts, payment refunds, device monitoring and cross-site data migration remain outside this implemented preview.
