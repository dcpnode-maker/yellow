# Order 385 — Business-day read permission prerequisite

**Status:** ACTIVE-D1114
**Phase:** 5 — Financials operator delivery prerequisite
**Branch:** `phase-5/business-day-read-permission`
**Base:** exact independently approved Phase-5 domain tip `f681b3cc03325b9bf6fb4e5c92bbcc3b22011129`
**Risk tier:** 3 — tenant/property financial visibility authority

Create only the missing least-privilege permission required by Order384's read-only
operator close workbench. The exact code is `financials.business-days:read`. The
migration adds the catalogue entry but grants it to no role. Review-seed provisioning
adds it only to the ordinary review/operator role through the existing
`REVIEW_PERMISSIONS` mechanism; the specialized post-seal approver does not receive it.

## Exact scope

- `migrations/0066_business_day_read_permission.sql`;
- `scripts/seed-review.ts`, only the exact `REVIEW_PERMISSIONS` addition;
- focused permission migration and review-seed tests;
- exact migration/schema/catalogue test expectations made stale only by migration0066;
- `tests/schema/expected.sql` only if a fresh official PostgreSQL16.15 normalized dump
  proves a canonical difference;
- this order, its independent review, `DECISIONS.log`, `handoff/LEDGER.md`.

No service, HTTP, UI, app, local runtime/database/image, `.yellow`, command authority,
role creation, approver grant, unrelated permission, table/RLS/function/event/data,
dependency, deploy, merge or push is admitted.

## Executable proof

1. Intentional red proves the permission absent at the exact approved base.
2. Fresh PostgreSQL16.15 applies migrations 1–66 and proves exactly one code and exact
   description, replay idempotence, no changed existing permission, and no role grant
   from the migration.
3. Review seed and rerun give the ordinary review/operator role exactly one grant while
   the specialized post-seal approver has zero; all unrelated role grants are unchanged.
4. Exact frontier becomes migrations66 while catalogue remains
   `116 tables / 106 RLS tables / 106 policies / 15 FORCE-RLS tables / 2 views`.
5. Focused, migration, seed, acceptance, schema, standing, static and fresh referee
   11/11 gates pass.
6. A fresh independent non-implementing Tier-3 reviewer personally executes the
   authority and hostility proof before approval.

## Definition of done

- [ ] Intentional red precedes migration/source edits.
- [ ] Exact permission and ordinary review-role provisioning implemented.
- [ ] Every required gate is green on official PostgreSQL16.15.
- [ ] Fresh independent Tier-3 approval recorded before Order384 resumes.

