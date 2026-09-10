# Everyday-space home check

The setup now asks which spaces are regularly used or which avoided spaces the person wants help using again. Property bedroom/bathroom totals no longer generate the new checklist. Users start with one space of each chosen kind and can add more individually. Existing rooms can be set aside and restored without deleting saved answers. Set-aside spaces do not count toward results or consented shared reports.

Optional support questions cover reaching help, DIY versus professional support, and interest in technology. Guidance appears beside each question. Report action cards explain the triggering answer or preference and route to the corresponding help-request service. Technology opt-out suppresses technology suggestions. Full-text export and consented report snapshots include the same practical next steps.

Verification: all 195 tests and type checking passed. New regression tests cover occupied-space generation, empty selections, restoration, excluded answers, uncertainty, technology opt-out and profile compatibility. Browser QA verified a two-space/15-question check, a recorded bathroom concern, exclusion reducing coverage to seven questions, restoration recovering the concern, contextual action cards and transition to the sign-in-required help flow. The report layout was visually inspected.

The browser uses a device draft in the internal preview; authenticated handoff and photo behavior remain covered by server integration tests rather than a live browser upload. Physical-device, assistive-technology and senior/OT usability sessions remain outstanding. Clinical account separation is explicitly queued in next-phase-account-experiences.md, not represented as already implemented. Public Vercel is unchanged.
