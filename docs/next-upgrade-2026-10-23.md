# Next.js update and Supabase restoration, October 23, 2026

## Source and dependencies

Recovered current GitHub main 16a45be3af8aebfeedc538d0560ab8c75f7c1dcc into isolated maintenance/next-latest-2026-10-23. Website inquiry work is preserved. Updated Next.js from locked 15.5.24 to latest stable 16.4.3, confirmed against the official npm latest tag; React and React DOM to 19.3.1 and their types to 19.3.0. No canary dependencies. Kept the existing pnpm 10 lockfile workflow.

Next.js 16 requires the automatic JSX runtime; retained its generated tsconfig change to react-jsx and added generated development route types. Existing async route params already satisfy Next.js 16. Both builds use its default Turbopack successfully. No business, identity, consent, billing, database schema or email changes.

## Local validation

375 tests across 44 files passed. Typecheck passed, including after the generated configuration change. Production build and Sites/static build passed on Next.js 16.4.3. Vercel project prj_O4uOIP0pyINZs8F2CJzsqGVFiQud in team_9uZyif7oR89uDPDXVvd02vAX is the existing myintel-assesment project, Node 24.x, homecheck.myintelhome.com. vercel.json selects the Next.js production backend and web-production/.next output. Dashboard project metadata still calls the framework vite; no hosting settings were changed because the repository already explicitly overrides it and existing production is healthy.

## Supabase

Owner authorized resuming existing project yyueldzkxdcykljbdquz. Dashboard confirmed paused on Free plan, with data/backups/storage retained. Resume was submitted and accepted. Current dashboard reports Restoration in progress; services stay offline while Supabase restores. Do not call this completed until readiness is verified. No paid subscription, credentials, policies, SMTP or project configuration changed. This does not prevent future Free-plan inactivity pauses.

## Release and rollback

Preview/CI and production verification pending. Merge only the expected tested head after checks. Restore the prior dependency lock and tsconfig via a revert, or use the previous Vercel production deployment, if a regression occurs. No database rollback is required for this dependency-only update. Do not change production backend credentials or use the expired one-day preview migration token.
