# Order 395 — Order387 executable proof repair

**Status:** ACTIVE-D1143
**Phase:** 5 — Financials operator delivery proof repair
**Base:** exact Order387 executable `c0e2d5d`, governance `7d2a6b6`
**Risk tier:** 3 — proof of audited discrepancy-carry behavior

Close only the fresh reviewer evidence gap that withheld Order387 approval. Production
behavior is frozen unless an executable test exposes a defect; any product correction
then requires a separately recorded repair amendment before editing production.

## Exact scope

- extend `tests/business-day-discrepancy-carry.integration.test.ts` to execute inbox
  default-50 and explicit-100 pages, non-null cursor continuation, equal-created-at
  `(created_at,id)` ties, 101-row MAX+1 fail-closed overflow, tenant/property
  containment, minimized output and malformed stored carry evidence;
- replace Order387 source-string-only browser assertions with executable DOM/browser
  interaction proof for Request, Approve, Reject and Carry, dialog cancel/focus and
  keyboard operation, ambiguous retry-key retention versus success clearing, stale
  response suppression, responsive layouts and every approved appearance;
- retain the focused unit/HTTP assertions that prove caller-Tx reuse, strict inputs,
  minimized responses and exact operation names;
- update only Order395/Order387 review and append-only governance evidence.

No migration, schema, seed, permission, service, HTTP route, local, Docker, deploy,
merge or push change is admitted by this order. D1144 admits only the exact
`src/http/operator/operator.js` focus-order repair exposed by the executable browser
proof: re-enable the invoked approval action before restoring focus after failure.
No other UI production change is admitted.

## Required gates

Intentional proof failure must precede completed executable tests. Fresh official
PostgreSQL16.15 proves the full new inbox matrix. Browser tests must execute behavior,
not merely search source. Then rerun focused carry/workbench, review seed, acceptance,
migration/schema/referee11/11, operator, standing, type/boundary/licence/audit/diff and
send the exact repaired candidate to a different fresh non-implementing Tier3 reviewer.
