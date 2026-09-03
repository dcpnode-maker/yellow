# Order 394 — Close-workbench entry behavior-proof repair

**Status:** ACTIVE-D1136
**Phase:** 5 — Financials operator delivery proof repair
**Branch:** `phase-5/operator-business-day-close-workbench`
**Base:** exact withheld Order393 review tip `471c3f8`
**Risk tier:** 3 — financial-read stale-response safety

Repair only D1135's non-mutation-sensitive browser proof. Preserve Order393 product
semantics unless a minimal test seam is indispensable. Add deterministic executable
behavior that controls the discovery promise and proves stale discovery cannot start
the dated workbench, render results or canonicalize the URL.

## Exact scope

- new or existing focused `tests/operator-business-day-close-workbench*.test.ts` only;
- `src/http/operator/operator.js` only if an explicit behavior-test seam is strictly
  necessary and does not change production behavior;
- this order, its independent review, `DECISIONS.log`, `handoff/LEDGER.md`.

No domain/HTTP/server/docs/schema/migration/permission/seed/dependency/CSS/HTML/local,
`.yellow`, command, deploy, merge or push.

## Executable proof

1. Deterministically settle the undated discovery after changing generation, active
   view, and selected property independently; each case makes zero dated requests,
   renders nothing and leaves history unchanged.
2. Execute discovery failure, dated deep-link bypass, and absent-date Refresh/Retry
   rediscovery behavior rather than asserting source tokens.
3. Removing the exact post-discovery stale guard must make the permanent proof red;
   restoring it must make the same proof green.
4. Preserve all Order393/384 focused, PostgreSQL, operator and static gates.
5. Different fresh Tier3 approval then separate complete Order384 restart mandatory.

## Definition of done

- [ ] Stale discovery protection is executable and mutation-sensitive.
- [ ] Failure/deep-link/refresh/retry paths are executable.
- [ ] Fresh reviewer approves from personally executed mutation evidence.
