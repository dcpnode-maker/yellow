# ORDER 472 — live synthetic account reconciliation deployment

**Phase:** 0 · **Branch:** `phase-0/live-synthetic-account-reconciliation-deployment` · **Written by:** Codex · **Date:** 2026-09-20

## Goal

Apply reviewed migration0094 and invoke its one target-bound, synthetic-only
`ARR-CLEAN` account-name correction on the verified public-demo database.

## Scope

- `handoff/orders/472-live-synthetic-account-reconciliation-deployment.md`
- `handoff/reviews/472-live-synthetic-account-reconciliation-deployment.md`
- `handoff/LEDGER.md`

## Constraints

- Use the normal migration runner only. Do not edit any applied migration, run the
  seed, touch a non-target record, or expose credentials or raw fixture values.
- Before migration, record deterministic content fingerprints for the target and
  all protected tenant tables; verify target account/folio/reservation/Party/role
  identity, no posting/payment activity, current ledger, and current health.
- Apply exactly0094. Invoke the reviewed SECURITY DEFINER function once through
  yellow_runtime/app_role with tenant-local context. A canonical rerun is a no-op;
  do not retry a changed invocation.
- After mutation, independently verify ledger/checksum/function ACL, exactly one
  minimized fact/outbox pair and permitted account-name-only delta, preservation
  of protected fingerprints, RLS/direct UPDATE denial, and local/public health.
- The independent reviewer must personally execute postflight and record commands
  and results. Any unexpected preflight delta or command result stops this order.

## Acceptance

The final record distinguishes source acceptance from current-target deployment
acceptance. No claim about historical no-delta state is allowed unless a preflight
content baseline was actually captured in this order.
