# Order 249 — Current project status through Order248

**Status:** BUILT-UNREVIEWED-D648
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/current-project-status-order248`
**Base:** `f311308` (built-unreviewed Order248)
**Risk tier:** 1 — authenticated founder-status truth only
**Owner:** Codex implementation

## Outcome

Refresh the existing authenticated project-status snapshot to exact built Order248
and current Order249 truth so the sole local can later display the latest pushed build.
Preserve independently reviewed coverage through Order91 and keep unfinished Phases
5, 6 and 7 active rather than claiming completion.

## Exact scope

- `src/project-status.ts`;
- `tests/founder-status.integration.test.ts`;
- this order, `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `DECISIONS.log` and
  `handoff/LEDGER.md`.

## Fixed truth

- `recordedAt=2026-08-29`, `latestBuiltOrder=248`, `currentOrder=249`,
  `activePhase=7`, `phaseCount=13`;
- independent review remains generated through Order91;
- the compact Phase7 builder milestone covers Orders237-248 and names evaluation,
  jurisdiction resolution, quote preview, canonical attribution, persistence,
  definer-path repair and authoritative quoted-tax cart-hold binding;
- posting, fiscal documents/IRP, independent product review and Phase7 completion
  remain explicitly pending.

## Forbidden

No endpoint/HTML/CSS/client/schema/migration/seed/database/credential/runtime/local,
permission, dependency, merge, public/production deployment, Phase or app-complete
change. Local promotion requires a separate order.

## Definition of done

- [x] Intentional stale-snapshot proof precedes implementation.
- [x] Exact founder-status and standing gates are green.
- [x] Status closes built-unreviewed without changing runtime or local state.

## Built evidence

The stale snapshot first failed on recorded date2026-08-28. Focused status proof is
5/5 with two expected database-environment skips and 89 assertions. Standing proof is
824/824 with 727 expected environment skips and 8,393 assertions across 1,551 tests
and 280 files; typecheck, 92 boundaries, 23-package licence policy, zero-vulnerability
audit and diff hygiene are green. Runtime and the sole local remain untouched.
