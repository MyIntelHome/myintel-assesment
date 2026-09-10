# Queued next: customer and clinical account separation

After the customer home-check flow is approved, implement separate customer and clinical-business sign-in, layouts and dashboards. Do not expose clinical self-assessment as a customer action.

Use server-verified clinical membership and organization roles, not a self-selected browser role or the existing MyIntel staff flag. Enforce clinical access at API and route boundaries. Add tests preventing customers from starting, opening or modifying clinical records, including direct URLs and crafted API requests. Preserve existing records through migration and provide an explicit staff review path.

Customer dashboard: everyday home checks, practical next steps, shared requests and chosen professionals. Clinical dashboard: assigned cases, assessment/report workflow and business administration. Do not portray customer answers as clinician findings or signed reports. This phase is queued, not implemented in the current home-check edit.
