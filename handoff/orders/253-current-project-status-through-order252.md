# Order 253 — Current project status through Order252

**Status:** BUILT-UNREVIEWED-D658
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/current-project-status-order252`
**Base:** `c5e6235` (approved Order252)
**Risk tier:** 1 — authenticated founder-status truth only
**Owner:** Codex implementation

## Outcome

Refresh the existing authenticated project-status snapshot to exact approved Order252
and current Order253 truth so the sole local can display the latest pushed build.
Preserve independently reviewed coverage through Order91 and keep unfinished Phases
5, 6 and 7 active rather than claiming completion.

## Exact scope

- `src/project-status.ts`;
- `tests/founder-status.integration.test.ts`;
- this order, `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`,
  `DECISIONS.log` and `handoff/LEDGER.md`.

## Fixed truth

- `recordedAt=2026-08-29`, `latestBuiltOrder=252`, `currentOrder=253`,
  `activePhase=7`, `phaseCount=13`;
- independent review remains generated through Order91;
- phase states remain reviewed 0–3, built-unverified 4, active 5–7 and planned 8–12;
- the compact Phase7 milestone becomes Orders237–252 and adds the canonical positive
  posting topology plus authoritative quoted-tax hold-to-reservation/first-segment
  lineage;
- governed journal posting, correction/reversal, account/transaction-code routing,
  fiscal documents/IRP, independent product review and Phase7 completion remain
  explicitly pending.

## Forbidden

No endpoint/HTML/CSS/client/schema/migration/seed/database/credential/runtime/local,
permission, dependency, merge, public/production deployment, Phase or app-complete
change. Local promotion requires a separate order.

## Definition of done

- [x] Intentional stale-snapshot proof precedes implementation.
- [x] Exact founder-status and standing gates are green.
- [x] Status closes built-unreviewed without changing runtime or local state.

## Built evidence

The intentional stale snapshot first failed because committed truth still reported
latest Order248. Focused status proof is **5 pass / 2 database-environment skips / 96
assertions**. Standing proof is **833 pass / 736 environment skips / 0 fail / 8,481
assertions** across 1,569 tests and 283 files. Typecheck, 93 import boundaries,
23-package licence policy, zero-vulnerability audit and diff hygiene are green. No
runtime or local state changed.
