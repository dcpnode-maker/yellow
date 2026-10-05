# Order 608 — four-day zero-Codex worker queue

## Objective

Create a durable, visible four-day work queue that lets Goose use an explicit
OmniRoute/OpenRouter `:free` model or an admitted local worker for routine Yellow
work while Codex is idle. Preserve one coordinator, one integration writer,
independent high-risk review and the exact accepted public runtime. Prepare a
separate Spark-ready lane without claiming that this host can select or launch
Codex Spark programmatically.

## Scope

- this order;
- `handoff/SPARK-FOUR-DAY-SCHEDULE.md`;
- `tools/build-continuity/four-day-queue.json`;
- `tools/build-continuity/validate_four_day_queue.py` and its focused test;
- private task instructions, worker receipts and logs below
  `.git/yellow-continuity/four-day-queue/**`;
- append-only review, ledger and decision entries after executable proof.

No Yellow product source, migration, database, fixture, provider credential,
public container, phone configuration or operating-system setting is changed by
this order.

## Required behavior

1. The queue derives from the founder capability ledger and starts only after
   Order605 public-origin closure is independently accepted.
2. Every packet names its day, dependency, owning order, lane, risk, input/output
   boundary, validation, acceptance evidence and terminal state.
3. `omni-free` and `local-*` packets are proposal/read-only unless a later product
   order explicitly grants an isolated writer scope. They never mutate the shared
   checkout, public runtime or database.
4. `spark` packets are ready for the founder to run after selecting Codex Spark in
   the UI. Scheduled is not running; running is not complete; complete requires a
   receipt and current-state verification.
5. At most one implementation packet may hold the writer lease. Finance, occupancy,
   tenancy, RLS, migrations, fiscal, payments and destructive work are never
   auto-integrated and require an independent non-implementing reviewer.
6. A model may request review-runtime start/stop, but only the deterministic
   allowlisted host controller may execute it. No model receives arbitrary Docker,
   shell, credential or production access. The public demo stays live during
   proposal work.
7. The laptop 9B lane is not dispatched while the Yellow Docker runtime is live.
   Phone and explicit free-provider lanes may continue when their health, auth and
   thermal gates pass.
8. Provider denial, quota, timeout, unavailable tunnel, thermal refusal or missing
   capability produces a durable blocked/waiting receipt and releases the slot. No
   key rotation, paid fallback, busy retry loop or fabricated success is allowed.
9. The queue validator rejects unknown states/lanes, missing dependencies, cycles,
   duplicate IDs, overlapping concurrent writer scopes and product packets without
   a repository order.
10. Four days is a bounded acceleration sprint, not a claim that every remaining
    PMS, distribution, website, RMS or statutory journey will be complete.

## Acceptance evidence

- focused validator tests pass;
- the committed queue validates with no cycle or overlapping writer scope;
- at least one explicit-free or local read-only packet returns a secret-redacted
  receipt and is independently checked before its recommendation is used;
- Spark packets are visibly marked `prepared-unlaunched` until the founder launches
  them from a Spark-capable Codex UI;
- no public runtime/database fingerprint changes during queue preparation.

## Forbidden

- importing raw Codex transcripts or exposed keys;
- unattended edits in the dirty shared checkout;
- automatic commit, merge, deploy, seed, migration, operational confirmation or
  public database action;
- claiming a worker, model, test, review or four-day outcome that did not execute;
- stopping the accepted public demo merely to load the laptop model without a
  separate explicit build-window decision.

