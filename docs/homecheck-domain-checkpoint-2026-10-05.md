# Homecheck domain and favicon

- Public app: https://homecheck.myintelhome.com on the existing Vercel `myintel-assesment` project, Production environment.
- Squarespace: added only the `homecheck` CNAME pointing to `fbf22b9137730538.vercel-dns-017.com`, TTL 4 hours. Existing root website, www and email records were preserved.
- Vercel confirms Valid Configuration; public HTTPS requests succeed with normal certificate verification.
- Production APP_ORIGIN and Supabase Site URL now use `https://homecheck.myintelhome.com`. Supabase additionally allows this exact root and `/auth/confirm` redirect. Existing redirects were preserved for older confirmation links.
- The prior `myintel-assesment.vercel.app` address redirects with HTTP 307 to homecheck. Preview branch origins and credentials remain unchanged.
- Public release PR #2 merged as `024aefbdc600ed41e63295c5f79c0990fed06f46`, Vercel deployment `4v1iGNPEXMgnqYLNTDpqRRLbdcKG` Ready. Only visual changes and favicon were cherry-picked from the payment branch onto current main; no payment migration or payment activation was released.
- Page title: `MyIntel | Home Check`. `/favicon.svg` embeds the supplied fingerprint-house symbol on a warm rounded background; Apple icon uses the existing symbol PNG.
- Isolated public-release validation: 286 tests across 33 files plus production build pass. Public homepage, favicon, account and login return HTTP 200. Anonymous account response shows `paymentsEnabled:false`.

The hostname change creates a separate browser origin: existing sessions and device-local drafts do not move automatically. Account assessments remain in the existing production backend; signing in again is expected. No signup or recovery email was sent during these URL checks, so actual email delivery and a fresh signed-in session on homecheck are not claimed as tested in this batch.

Rollback: restore Production APP_ORIGIN and Supabase Site URL to `https://myintel-assesment.vercel.app`, remove the legacy-domain redirect, redeploy the prior production source, and then disconnect the homecheck domain if needed. Keep database and private storage unchanged. Reverting only the domain assignment without the canonical-origin setting will cause the API origin guard to reject requests.
