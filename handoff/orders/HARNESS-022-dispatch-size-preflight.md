# HARNESS-022 — Fixed-source size preflight and fresh successor claim

Status: implementation in progress.

## Authority and exact scope

Founder 2026-09-30 continuation/all3 bounded GPU workers. Correct a reproducible
HARNESS-018 dispatch defect without widening the 40,000-byte protocol limit.
Scope: worker-jobs/operator.mjs, test_operator.mjs, progress.mjs, test_progress.mjs;
this order, question HARNESS-022-source-budget.md and matching review receipt.

## Contract

Compact the fixed Python source by removing only blank lines and standalone
comments; prove AST identity against the original. Leave the on-disk source and
all substantive limits/pins untouched. Preflight exact bytes before any claim.
Read current micro-0929c status with the compact fixed source. Only after no_job
is confirmed may one fresh start-successor claim invoke the same fixed start.
Keep original start/unconfirmed receipts and source. No replay or overwriting.
Existing remote start() guard rejects any retained job/root; no shared-kernel
restart or generated-code execution. No other batch, model, credentials or limits.
Progress polling must not run without a start result and must stop on unconfirmed
execution. Subsequent advisory observations are explicit operator actions.

## Acceptance

Paired RED reproduces the oversized payload before fix. Exact bytes <=40,000;
Python AST identity and substantive pins unchanged; successor claim path distinct;
one-shot collision fails; no-job proof required. All existing Node/Python tests.
Actual response establishes worker state; local tests never establish inference.
