# MyIntel Assessment Platform

Clinical home safety assessment for occupational therapists. Rebuild of the v1
prototype as a case-based platform.

**This build stores no client names, dates of birth, or addresses.** Read
[`docs/operating-model.md`](docs/operating-model.md) before adding any field
that could hold an identifier.

## Getting started

```bash
npm install
npm run dev
```

Verify everything before committing:

```bash
npm run verify
```

## Layout

```
src/domain/     Pure domain logic. No I/O, no framework. Exhaustively tested.
src/seed/       Clinical content: assessment templates and the recommendation library.
src/app/        Next.js App Router.
tests/          Vitest. Includes the standing acceptance suite.
docs/           Operating model and design records.
```

## Rules that must not regress

These are enforced by tests in `tests/`, not by convention:

1. Every assessment item defaults to **Unknown**. There is no default positive
   or negative value anywhere in the system.
2. **Completeness and risk are separate measures.** An item being assessed says
   nothing about whether it is safe.
3. Status is never conveyed by colour alone.
4. The seed content is **vendor-neutral**. Named products belong in the gated
   catalog, not the default library.
5. No identifier is ever persisted, logged, or transmitted.

## Stage progress

- [x] **Stage 0** — Foundations. Project, CI, seeded clinical content, operating model.
- [ ] Stage 1 — Tenancy, sign-in, case record, autosave, identifier guards.
- [ ] Stage 2 — Assessment core, completeness and risk engines, findings.
- [ ] Stage 3 — Mobile, offline, accessibility.
- [ ] Stage 4 — AI drafting behind an approval gate.
- [ ] Stage 5 — Action plan, report, sign-off.
- [ ] Stage 6 — Hardening.
