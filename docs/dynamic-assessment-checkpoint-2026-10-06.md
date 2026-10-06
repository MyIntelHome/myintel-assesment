# Dynamic assessment release checkpoint — October 6, 2026

## Implemented

The existing Vercel application now has versioned, deterministic context routing. This is MyIntel question routing, not a validated ADL scale, HOME FAST administration, AI diagnosis, or a new clinical risk score.

- Whole-home counts for bedrooms, full/half baths, levels and occupants are distinct from the actual spaces selected for a check. Defaults are unknown, not guessed. Places have stable IDs, levels, names and usual sleeping/toilet/bathing links. Contradictory counts, levels and missing nighttime-route links stay visible as clarification gaps.
- Personal activities and household tasks open specific difficulty, assistance, location and support-gap questions. Confirmed locations are reused. Daily movement demands, mobility, falls/balance, nighttime journeys, food routine/access/eating changes, social contact, outside participation and reaching help remain separate reported context.
- The reader controls Next, Back, explicit unknown/skip and pause/review. Returning to home or daily-life details does not require repeating introductory screens. Current question IDs and room question codes survive interruption and changing follow-ups.
- Conditional environmental questions open only when relevant context, a room concern or uncertainty warrants them. A confirmed level entrance omits steps/ramp checks. Actual room observations are never filled from context answers. Legacy answered items remain reportable.
- Corrected or skipped answers stop influencing current conclusions. Previous context answers remain in a bounded history; excluded rooms retain their answers and identity for restoration. Existing signed clinical versions remain immutable.
- Professional intake offers the same reported context alongside the clinical space list. A Before leaving queue separates checks needing the home/resident from documentation. Exact-item navigation, quick notes and persistent return reminders support interrupted visits. Reminders never rate an item as assessed; optional reminders are also included.
- Checklist decisions, examined checks, unable-to-assess and not-applicable counts are distinct. Current context/scope review, finding dispositions/actions and explicit limitations are required for new sign-off. The server recomputes readiness and report content rather than accepting visitor-supplied coverage or completion flags. Pure report projections are shared between server and client.

## Verification

Final local validation: 321 tests across 39 files, TypeScript check and the production Next.js build. Tests include branching changes, unknowns, stale detail removal, inventory inconsistencies, exclusion/restoration, full customer context entry, professional return/navigation/removal confirmation, immutable report snapshots and server rejection of forged sign-off or missing review. Existing account, access isolation, storage, consented handoff and payment tests remain included.

Local browser checks used synthetic device-only information: selected a two-level bedroom/bathroom home, linked usual activity locations, followed bathing difficulty to support needs without repeating location, paused/reviewed, edited and reloaded. Desktop and narrow-screen layout checks found and corrected stretched checkboxes; checked page widths had no horizontal overflow. This is engineering verification, not senior usability testing or a real clinical visit.

GitHub base: 063330f3b268c5f652b33aa1792aa6f43cc25aeb, including the newer MyIntel website return link. Upgrade branch: feature/dynamic-assessment-2026-10-06. Other payment work and pull requests are not included in this branch.

## Hosting and data compatibility

Existing project: austin-8620s-projects/myintel-assesment. Existing public domain: https://homecheck.myintelhome.com. The connected main branch uses the production Next.js build, verified public authentication, Turso database and private Supabase photo storage. No domain, provider, credential, storage permission, payment activation or SQL schema change is part of this release.

The archive schema gains optional JSON fields (`homeProfile.dynamic`, `visit`, stable question IDs); existing archives and signed report versions remain readable without a data migration. New sign-offs require the current reviewed context. An older browser trying to submit a newly signed report without it receives a failed save and must refresh/review; it cannot bypass the server gate. Existing signed history is preserved.

Pre-release rollback reference: main commit 063330f and Vercel deployment 2vRYJeXjGtqrvNmabEwu39dr8gp2. Prefer a forward fix. Before reverting to an older application, pause account writes and preserve a private archive/database backup: old serializers do not understand the new optional context and may remove it on subsequent saves. A code rollback alone is not a data restore. Local backups must remain private and out of Git. This release does not claim a deployed database restore or photo-object restore was performed.

Live deployment success must be confirmed against the new GitHub merge commit and public domain; local build success alone is not proof of release.

## Human follow-up

OT review of the new prompts, recommendation routing and professional visit workflow; representative senior sessions measuring time, comprehension and interruptions; privacy/vendor/retention arrangements and actual provider capacity remain human requirements. None are claimed completed. No validated accuracy improvement, safety certification or 10–15-minute completion guarantee is advertised. Operational requests continue to require staff review. Payments remain as configured before this release.
