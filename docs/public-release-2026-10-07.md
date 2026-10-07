# Public release, October 7, 2026

The user authorized publishing the new changes. This supersedes the earlier merge hold in the October 6 preview checkpoint for a limited release with the new backend features disabled.

PR #4 merged as f054adec2866bff90214d88ea9689ea382d1fe32. Vercel production deployment 9kSDmq3mxj3tLNpzKR9b3nC8SYTr was Ready and Current on the existing homecheck.myintelhome.com domain. The public home page returned 200. Guest help requests now show service and contact questions before sign-in. Recommendation need codes are included; shop links remain disabled.

The new plan-capture form, saved-plan queue, email-code endpoints and aggregate analytics remain preview-only. Public /api/lead-config returned enabled=false, deliveryEnabled=false and an empty shopUrl. Visitor-supplied Sites identity headers did not grant access: account, request and staff-plan probes returned 401. Existing account saving remains available through the existing account flow. No production migration, credential expansion or authentication-template edit was performed.

Public summary email delivery and payments remain disabled. Preview credentials, migration, Supabase code-template compatibility, sender configuration and hosted account/inbox verification remain unfinished. Privacy/vendor/retention review, OT review, senior timing and real professional availability remain human launch requirements. This release does not claim those reviews are complete.

A small follow-up corrects guest wording to describe production sign-in accurately; passwordless wording is shown only when email codes are enabled.

Rollback: redeploy the prior production deployment DJPQRjau8rr5G2qdePQ8RstHm7Rk. Preserve data and do not drop tables or replay mail jobs.
