# Operating model — current local assessment build

Status: implementation description, not a legal determination. Updated September 7, 2026.

## What actually happens

Cases, family observations, clinician free text, assessor details and report snapshots are stored in localStorage in the current browser profile. The archive is myintel.cases.v1. Existing myintel.case.v3 records are migrated on first use and retained as legacy data. No server synchronization, analytics carrying case contents or outbound AI is implemented in this branch.

Contact details are no longer required to view results. The old myintel.family.contact.v1 key is removed on startup. Legacy contact fields are omitted from the new archive. Existing report exports or emails outside the app are not deleted by this migration.

The family result and clinician case still share local observations through an explicit audience choice on the same device. This is not an authenticated clinical handoff or a shared-device access boundary.

## Free text and identity

Client names, dates of birth and addresses are not requested as intake fields. However, free-text notes and case references can contain identifiers. They are NOT automatically scrubbed. The initials/year reference pattern is a warning, not a comprehensive de-identification control or a guarantee that identifiers cannot be saved.

The optional client name used for report export is held in component memory and added to that export. It is not saved in the report snapshot. Printed/downloaded documents can contain the name, and the clinician controls their delivery and retention.

Do not describe this implementation as enforcing “no identifiers ever stored” or operating without a BAA as an established fact. HHS provides Safe Harbor and Expert Determination methods; legal applicability depends on actual data, parties and use. Review the complete intended operating model with qualified counsel before a clinical launch or cloud storage expansion.

https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html

## Reports and local preservation

A new finalization records a copy of the clinical case data, the derived report findings and wording, the attestation, template versions and signature time. It does not include family contact details. An amendment retains existing versions. A legacy timestamp without a historical snapshot is reopened as a draft for review; historical content is never fabricated.

These are local software version controls, not identity verification, a server audit trail or cryptographic protection against device access. Assessor credentials are self-entered. No clinician account authentication is implemented.

Starting another case preserves earlier cases in the local archive. Save failures and detected changes from another tab pause or warn rather than silently overwriting work. localStorage is not a synchronized database or a cloud backup, and the app cannot recover work after browser-profile deletion. Multi-tab detection is best-effort; do not edit the same case in multiple tabs.

## Sharing and requests for help

Email buttons open a summary in the user's own email client. Opening the draft is not sending it. No appointment, delivery or MyIntel receipt is confirmed. A full findings text download and browser print export are available for manual attachment. The app never claims an attachment was added automatically.

A household that sends its findings to MyIntel creates a separate information-handling activity outside this local application. Establish the applicable privacy notice, retention, consent and response process before scaling it. Consumer versus clinical labeling by itself is not a legal conclusion about HIPAA or other obligations.

## Required before shared service operations

Select the identity/privacy model; implement authenticated access, tenant isolation and appropriate retention; arrange applicable agreements and subcontractor controls; add trustworthy request delivery and assignment; establish clinical content review and provider verification. Add emergency-response commitments only when a defined service and responsible responder exist.

No backend, payment provider, database, AI endpoint or monitoring integration is configured by these local workflow changes.
