# OT workflow and client-first report, October 27, 2026

Status: implemented on `feature/ot-workflow-report-2026-10-27`, based on GitHub main `dfe8087`. Review build only; not a production release. No production database migration, account changes, email sends, payment enablement or patient-data import is part of this change.

## Reference material and owner decisions

Read-only references supplied by the owner:

- `Potential Home Assessment Process.xlsx`, Sheet1, MyIntel and BlueBird Therapy columns. The useful workflow is interview and goals, guided home tour, functional task observation, recommendations, training and follow-up. Historical prices, coverage, physician-order and visit-frequency claims were not adopted.
- Historical OT home report supplied as a private PDF: client overview, resident perspective separate from assessor judgement, per-area observations, recommendations and follow-up. Patient identifiers, photos, access links and clinical details were not copied into the repository or demo.
- Separate AMPS sample narrative: illustrates connecting observed daily-task performance with professional interpretation. It is not permission to copy test content, scoring or norms.
- [Home for Life Design assessment overview](https://www.homeforlifedesign.com/home-safety-assessment): workflow reference only. No competitor scoring method or branding was reproduced.

The owner confirmed October 27:

- MyIntel directly offers fall detection, smart door locks and medication reminders.
- The other older workflow offerings are referral/coordination, including other technology setup, security, home modifications, ramps/stair lifts, bathroom remodeling and OT care. This confirms the service route, not a particular provider's availability or a price.
- Reports should lead with a client summary and action plan, with professional detail below.
- AMPS integration is desired if feasible. The owner is unsure whether the pilot OT is trained/calibrated or has authorized scoring access. Those facts remain unverified.

## Implemented workflow

1. Context: retain the existing intake, home layout, activity and participation questions. Add visit date, client narrative, agreed goals, ADL/IADL/task performance, relevant reported history, equipment, support and follow-up responsibilities. Names and identifying details remain outside stored case fields; the existing client-name field is export-only. Free text is not automatically de-identified.
2. Walkthrough: each stable room ID now has observations/task performance, separately labeled resident/supporter perspective and area follow-up. Switching or renaming rooms retains their notes. Removing a draft room clears its current notes; earlier signed snapshots retain their contents. Notes do not automatically set any item to pass, concern or critical.
3. Findings and actions: retain the existing clinical judgement, evidence source, priority, disposition, plan category, responsibility, dates, status and cost handling. MyIntel mode explains the owner-confirmed direct versus referral services; Standard OT stays vendor-neutral.
4. Before leaving: add nonblocking reminders for the client summary, goals, room observations and follow-up responsibilities. Existing unresolved checks, explicit exclusion reasons, return reminders and context-review controls remain. Narrative reminders do not imply clinical clearance or prevent an explicitly limited report by themselves.
5. Report: dashboard, client context/goals, prioritized actions and follow-up, area overview, professional area findings/notes, clinical context/external test results, then scope/limitations and attestation. No unavailable professional, booking or completed work is implied.

## Percentage definitions

October 27 owner feedback: percentages should describe the findings in each category, not assessment completion. Current unsigned reports and new version-3 signed reports use the following findings scores. Dashboard figures describe the recorded visit, not a validated safety score or probability of falling.

- Concern score = checks marked concern or critical / checks marked pass, concern or critical, rounded to a whole percentage. Higher means more concerns recorded. For example, 2 of 8 assessed checks is 25%. A nonzero proportion that rounds to zero is labeled “<1%.” No examined checks means “Not assessed,” never a zero score.
- Assessed optional checks contribute along with required checks. N/A, unable and unanswered checks do not dilute the score. Required unanswered checks, all explicit unable decisions and N/A decisions are shown separately as counts.
- The same formula applies independently to the whole recorded visit, each stable room ID, and each existing template category: access, lighting, surfaces, support, transfers, hazards, emergency and reach. Categories can have different denominators; their scores are not averaged to calculate the overall score.
- Missing required observations or unable-to-assess items make the relevant score provisional. Critical findings get a separate highlighted count and card border regardless of the overall percentage. No score establishes safety, and no clinical threshold/weight or validated risk band has been invented.
- Client summary and actions still precede the category/room detail. External test results retain their own units and are never blended into these percentages.

Historical version-2 signed reports retain their previous coverage/decisions dashboard and required-item denominators. The coverage helper remains for that renderer only; it is not the new findings score. Version-1 reports without a layout marker retain their historical renderer as well.

## Storage, access and report history

`CaseState.documentation` is an additive, bounded JSON field in the existing owner-private clinical archive. No new table or production migration is needed. Text fields have length limits, room entries are capped at 100, and external result entries at 20. Existing serialized saves, revision conflicts, failed-save alerts and retries apply to the whole archive.

Professional notes are classified as clinical content even if a payload claims it is a family record. The server still requires current professional approval and owner-scoped archive access. Staff operations and family sharing do not gain access to these notes. Existing consent and notification payloads are unchanged.

New signed reports freeze documentation and carry `reportLayoutVersion: 3`. Existing version-2 signed reports keep their original coverage dashboard, and reports without a marker keep the historical renderer. Selecting an old version never falls back to current notes. Server checks continue to reject changed signed snapshots. Corrections require an amendment. Future scoring or category changes must preserve the version-3 calculation/meaning for already signed reports.

Rollback: revert this code change without changing the database. The prior version cannot display new notes, so preserve the original archive payloads and do not allow older clients to rewrite newer records without evaluating loss of additive fields. Never bulk-delete documentation or report history as a rollback step.

## AMPS boundary and next decision

Implemented: a generic external-assessment record with instrument/version, performed date, original result/units, clinician interpretation, conditions/limitations and links to home findings. Incomplete entries or stale finding links block signing until completed, removed or reviewed. This connects clinical reasoning and actions without inventing a combined score.

OT entry path: Context, then “Assessments performed by the professional,” then “Add AMPS results.” The shortcut prefills the instrument name only. The OT supplies an actual authorized result and interpretation and can link relevant home findings. It does not supply proprietary tasks, item definitions, norms or scores. A suitably trained/authorized OT may conduct AMPS during the same home visit using its authorized method and scoring system; this is different from administering/scoring it inside HomeCheck. Publisher permission for an embedded workflow remains unconfirmed.

Not implemented: AMPS tasks/items, administration prompts, scoring, norms, copied reports, automatic imports, API integration or claims that HomeCheck is AMPS-authorized. No test was performed or interpreted by the app.

Official references checked October 27:

- [AMPS course and scoring access](https://www.centerforinnovativetherapysolutions.com/course/assessment-of-motor-and-process-skills-amps)
- [AMPS FAQs](https://citsamps.com/faqs/)
- [Publisher terms](https://www.centerforinnovativetherapysolutions.com/terms), particularly sections 9 and 12 on permission for materials and software.

Next: confirm the OT's training/calibration and authorized scoring access, then obtain the publisher's written integration/licensing terms. No public API or permission to embed the scoring system has been established. Until confirmed, a performed authorized assessment can only be documented by the professional in the generic result fields, subject to their own permissions and responsibilities.

### Prepared publisher inquiry, not sent

To: amps-director@centerforinnovativetherapysolutions.com

Subject: AMPS integration permission for HomeCheck

We are building HomeCheck, a home assessment and action-planning application for a small Colorado pilot. We would like trained, calibrated OTs to use their authorized AMPS results alongside separately documented home findings and recommendations.

Could you clarify what written permission or licensing is required to (1) store a clinician-entered result and interpretation in an owner-private report, (2) import or attach an authorized report, and (3) connect to your cloud scoring platform, if an approved integration is available? We would not reproduce test tasks, scoring algorithms or normative tables, alter AMPS scores, or describe a combined HomeCheck score as validated. Please also confirm rater requirements, branding/attribution rules, permitted report reproduction, privacy requirements and integration costs.

## Verification and review

- TypeScript check passed.
- Initial notes/report batch: 45 test files, 385 tests passed. The findings-score follow-up adds category/room denominator, optional critical-item, incomplete/empty scope, rounding and version-2 history tests. Final follow-up totals are recorded with its commit checkpoint.
- Local browser: edited client notes, area observations, reported perspective, follow-up and external-result links; reloaded and verified those edits in the generated report. This was a fictional local adapter, not an authenticated production E2E test.
- A fictional client demo is available separately from this repository's tracked files. It contains no real patient data or asserted clinical signature.
- Production Next.js build and static/Sites compatibility build passed. The production build required normal Windows filesystem access to create Next.js dependency junctions; no application-code workaround was needed.
- Desktop report screenshot reviewed; 390px iframe layout reviewed for card stacking and readable wrapping. This is responsive layout evidence, not a real-device or senior usability study. Print styles are implemented but a complete printed/PDF pagination review remains outstanding.

Human review still needed: pilot OT review of the workflow, terminology, clinical completeness and recommendations; timed walkthrough/usability testing in a real visit; authorized AMPS access/licensing if pursued; existing privacy/vendor requirements. Software checks do not establish these outcomes.
