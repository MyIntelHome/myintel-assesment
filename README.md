# MyIntel Assessment Platform

Family home self-check and clinician assessment workspace. The active rebuild is on the platform branch; main contains the older Vite application.

## Development

Use the committed pnpm lockfile. Run pnpm install --frozen-lockfile, pnpm run dev, pnpm run verify and pnpm run build. CI checks main, platform, improve/* branches and pull requests.

## Implemented

- Separate family observations and clinician ratings; every clinical item defaults to unknown.
- Coverage and risk are separate measures. Incomplete family checks disclose unanswered questions.
- Local multiple-case preservation with exact family room/phase resumption and save indicators.
- Finalization snapshots, report version selection and draft amendments preserving earlier versions.
- Empty-assessment, partial-scope, critical-finding and exclusion-reason validation.
- Finding-to-action drafts, template categories and stale action-link review.
- Ungated family results, full findings text download and honestly labeled email summaries.

## Current limitations

This version stores cases in this browser profile, with no cloud backup or team access. Export important reports before clearing browser data. The role selector is not authentication. Assessor credentials are self-entered. Local report versions protect against ordinary editing through the app, not device tampering.

Family results require no contact details. Help and sharing buttons open the visitor's email application; MyIntel receives nothing unless they send the email. There is no automated delivery confirmation, CRM queue, booking, billing, product catalog, AI transmission, manifest or service worker.

Free text is not automatically de-identified. Avoid client identifiers in notes and references. Read docs/operating-model.md before adding storage, AI or integrations; this build does not establish HIPAA compliance or determine whether a BAA is required.

## Next release gates

Desktop browser walkthroughs and automated regression checks are recorded in docs/release-verification-2026-09-07.md. Validate on real mobile devices and assistive technology, and with families and OTs. Select the privacy/identity model before shared records; implement confirmed help-request delivery and assigned follow-through. Do not advertise those capabilities before they work.
