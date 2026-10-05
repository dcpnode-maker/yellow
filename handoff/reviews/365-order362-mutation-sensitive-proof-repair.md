# Orders 365 / 362 / 361 / 360 / 353 mutation-sensitive proof — fresh Tier-3 rereview

**Disposition:** WITHHOLD

**Reviewer:** `/root/order365_fresh_tier3`, fresh independent non-implementing Tier-3

**Exact subject:** test-only candidate `cb22cb5be5de0dde7643e82773f7fd9f80c201ce`;
governance `f3d122c1b5c184dae335e133d95ad468735ab073`

## Order365 repair result

The three D1030 proof defects are repaired. In separate detached worktrees and separate
fresh databases, each single mutant failed only its exact new permanent case:

- removing both ordinal comparisons: **16/1 (612)**, sole failure the coherent
  ordinal-only corruption case;
- removing `value <= 0n`: **16/1 (612)**, sole failure the coherent-total zero-night
  case; and
- changing the exercised `set_config(..., true)` to session-level `false`:
  **16/1 (612)**, sole failure the post-commit same-connection tenant-reset case.

The restored exact candidate passed authority **17/0 (612)**. Inspection confirms the
ordinal case preserves dates, values and total; the zero case adjusts the valuation
total to the remaining positive sum; and the locality case inspects the same reserved
connection after transaction completion. Each case is independently load-bearing.

## Blocking repository gate

The required standing suite is red on exact `cb22cb5`: **1214 passed / 945 skipped /
2 failed (18,517)**. One Chromium geometry failure passed immediately when rerun
focused at **4/0 (46)** and is excluded as transient. The deterministic remaining
failure is `tests/current-management-demo-status.intentional-red.test.ts`: its Order311
oracle still requires Phase 6 `active`, while the candidate ancestry records Phase 6
`reviewed` under Order364/D1028. That stale standing oracle is outside Order365's
one-file scope. A full-gate review cannot approve a red repository.

## Reviewer-executed evidence

- fresh PostgreSQL 16.15 exact catalogue: **63 migrations / 116 public tables / 106
  RLS tables / 15 FORCE-RLS tables / 2 views**;
- migration integration **39/0 (187)**; the first protected-`yellow_dev` refusal is
  excluded and the fresh unprotected reviewer-admin run is the claimed result;
- canonical seeded acceptance **23/0 (65)**; deterministic seed **10/0 (63)**;
  review-seed **24/0 (111)**;
- runtime-DML **5/0 (120)**; SECURITY-DEFINER **3/0 (192)**;
- independently rebuilt fixture database referee **11/11**;
- typecheck, 139-file import boundaries, 23-package licence policy, zero-vulnerability
  audit and diff hygiene passed;
- schema normalization **4/0 (19)**. The live schema-dump command did not complete
  after the host Docker CLI became unresponsive under severe host disk pressure; no
  live-schema green claim is made. Exact catalogue, migration and acceptance passed,
  and the candidate changes no schema path, but those facts do not waive the red
  standing gate.

## Disposition and cleanup

**WITHHOLD** Orders365/362/361/360/353. Repair the stale Order311 standing oracle in
its own governed scope, restore the full standing and live-schema gates, and obtain a
different fresh Tier-3 rerun before approval. No tax calculation, posting, document,
IRP, local, merge, deployment, Phase-7 or application-completion authority follows.

Canonical Order366 work and `.yellow` were excluded. All three mutant worktrees and
the principal detached review worktree were removed; reviewer databases were dropped
directly. Docker project teardown is separately confirmed after engine recovery.
