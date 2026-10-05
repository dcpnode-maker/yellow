# Existing controller and continuity contract audit

Date: 28 September 2026. Reviewer: Codex agent `/root/controller_audit`, which did
not implement the inspected controller or bridge. Authority for this document:
`handoff/orders/HARNESS-001-controller-execution-foundation.md`.

**Verdict: a tested local proposal foundation, not an approved full harness.**
The controller has useful claim/completion safeguards, but its Windows reservations,
effect authorization and recovery contract are insufficient for remote workers or
source-writing tools. The findings below are regression gates for the selected
upstream runtime and Yellow adapters. They do not require building another scheduler.
The coordinator is evaluating T3 Code and its existing scheduling facilities; this
audit neither evaluates nor approves that upstream or a fork of it.

## Scope and exact source

The reviewer read PROJECT.md, AGENTS.md, the current Phase 0 plan, applicable
decisions, Orders 681/685/686, ASTRA-REVIEW-BRIEF.md, UPSTREAM.md, the controller,
bridge, their tests, and the older continuity worker. This was a read-only audit.
There were no live provider calls, Kaggle operations, application/database changes,
shared runtime mutations, source edits or order reservations. Tests used temporary
repositories/state and `PYTHONDONTWRITEBYTECODE=1`.

Initial executable audit checkout:
`C:/Users/astha/.codex/worktrees/yellow-harness-controller/yellow`, at
`c8cb60ada0e0f8aa981c04948a42adf94cc169e1`. The controller/bridge implementation and
test files were also compared with public handoff commit
`b9649cbb13992ac835a0ee761d63c7552ded7b5e`: the diff was empty. They remain identical
in the isolated `harness-app` checkout at the c8cb60ad base when this receipt was
written. Later GPU-lane changes in the controller checkout were not audited or
modified. Line references below refer to these exact audited files.

SHA-256 of inspected file bytes:

| File | SHA-256 |
| --- | --- |
| `tools/yellow-harness/controller.py` | `CF582CE0A822A3F917379E3A7AF39E793A58A33EB20C575CA70E439198D105B9` |
| `tools/yellow-harness/test_controller.py` | `69D8ABE6BF70A2EC0146795757ACF653AB8F0917DC0CC808A9F5DE0FB245DA7C` |
| `tools/yellow-harness/continuity-bridge/adapter.py` | `3827E3392F9882B39FC41878B9E5A5102B363EF0DA28E8C05A4528510A226551` |
| `tools/yellow-harness/continuity-bridge/test_adapter.py` | `3BCA2516B05945D5740AB8E8BDBDDB1724BA0B6AFAA143FA93E6B67CEDC40916` |
| `tools/build-continuity/continuity.py` | `41186C2FBA1CBB2AC144A117CEB8BA241FCAB6CA43EB0217F71F14CF4E4A226D` |

The first `state.sh` attempts failed through missing WSL bash, then an incorrectly
assumed Git Bash installation. The bundled shell initially lacked its utility
directory on PATH and emitted unreliable status. The coordinator subsequently
reported a successful run with the bundled `git/usr/bin` added to process-local
PATH. This reviewer used explicit Git/status/order checks; the failed shell output
is not evidence that runtime services were down.

## Personally executed offline proof

PowerShell commands, run in the initial executable audit checkout:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
python -m unittest discover -s tools/yellow-harness -p 'test_controller.py' -v
python -m unittest discover -s tools/yellow-harness/continuity-bridge -p 'test_adapter.py' -v
```

| Suite | Result |
| --- | --- |
| Controller | Exit 0; 9 tests run in 14.561s: 8 passed, 1 skipped because this host did not permit the symlink fixture. |
| Bridge | Exit 0; 11 tests passed in 34.771s. |

The older continuity suite was inspected but was not executed in this audit. Its
16-test result recorded in Review 685 is historical reviewer evidence, not a fresh
result from this reviewer. No database referee, provider integration, model quality,
cost, full application acceptance or upstream-runtime test was run.

Additional adversarial probes used the existing test fixtures via
`importlib.util.spec_from_file_location`, called `setUp()`, and always called
`doCleanups()` in `finally`. The inline probe programs ran through `python -`;
their only mutations were inside fixture-created temporary directories. They
were not added to repository test files during this review.

| Probe | Observed result |
| --- | --- |
| Submit outputs `src/example.ts`, then another task with `SRC/EXAMPLE.TS` | Both returned `awaiting_approval`; Windows `Path.samefile()` returned `True`. |
| Submit output `src/newdir`, then `src/newdir/child.ts` | Both returned `awaiting_approval`. |
| Submit separate output proposals `.git/config`, `src/example.ts:payload`, `src/NUL`, `src/example.ts.` | All four returned `awaiting_approval`. No output file was written. |
| Submit at SHA A, commit changed fixture source to SHA B, then approve/claim/complete | SHA-A manifest was leased and proposal reached `completed`. |
| Reclaim a bridge lease before its provider dispatch | Stale attempt made one mocked provider call; completion was rejected; task remained `leased` by `worker-b`. |

The final probe registered two code workers, submitted/approved one task, patched
the controller clock to 100, and let the bridge claim its 900-second lease. A
wrapper around continuity `run_task` advanced the clock to 1001 and claimed the
expired task as `worker-b` before delegating to the real offline continuity
workflow. `call_model` was replaced with a function that counted calls and returned
one synthetic exact-scope JSON proposal. The old attempt's final completion failed
as expected, but the mock call count was 1. No key other than a synthetic test value
was used, and no transport function reached the network.

## Implemented contracts worth preserving

- `controller.py:188-211,228-284`: SQLite immediate transactions serialize claims;
  registered capabilities gate selection; random lease tokens are stored hashed;
  worker/token/deadline checks reject stale completion and heartbeat.
- `controller.py:301-333`: results must have exact declared output keys, text
  contents and bounded size. Completion is immutable and exact repeat completion
  is idempotent. This stores a proposal, not an applied source edit.
- `adapter.py:79-115,154-165`: default preview validates without provider dispatch
  or initializing controller SQLite; live prompts use committed Git blobs.
- `adapter.py:168-235,261-285`: explicit live opt-in, configured account key,
  official free routes and a dedicated code-only worker are prerequisites.
  Pinned-context checks prevent dirty working-tree bytes reaching the model.
- `continuity.py:155-185,248-328`: price is rechecked before OpenRouter completion,
  paid fallback is disabled, attempts are durably reserved, and quota/access
  rejection persists rather than triggering account rotation.

## Findings and adapter regression gates

### F1. Windows scope identity is incomplete

Evidence: `controller.py:117-134,162-165,193-199`. Raw string intersection misses
case aliases and ancestor/descendant conflicts. Path validation admits ADS,
reserved devices, trailing-dot aliases and Git metadata as proposed outputs.
The bridge's older continuity validator separately rejects hidden paths and colons,
so several examples are controller-only gaps; neither layer currently writes the
proposed files. The risk increases when a new adapter applies output or runs tools.

Gate: compare normalized Windows reservation identities deterministically on all
test hosts; reject aliases, protected metadata and ancestor/descendant conflicts
within and across tasks. Revalidate symlink/junction/reparse ancestry at execution,
including the nearest existing parent of new files. Prove one winner for concurrent
conflicting reservations. Host symlink skips do not prove junction safety.

### F2. Completion fencing does not authorize effects

Evidence: `adapter.py:199,215-223,252`; `controller.py:272-283`. A stale attempt can
dispatch before its eventual completion is rejected, as independently reproduced.
The bridge has no current-lease check immediately before provider dispatch.

Gate: the selected runtime or common broker must validate current task/attempt,
worker, lease generation/token, cancellation and deadline for every effect. The
bridge must recheck before every call/fallback and after a response. Add bounded
heartbeat/deadline handling and retain dispatch receipts. A revoked attempt must
make zero calls when revocation precedes admission. Cancellation cannot recall a
request already sent; state this explicitly and test the transaction-order boundary.
Do not hold a local database write transaction across network I/O.

### F3. Moving checkout HEAD can outlive task approval

Evidence: `controller.py:144-148,213-269,301-327`. Only submission checks current
HEAD. The controller alone can approve, lease and complete an old-base proposal
after HEAD changes. The bridge adds its own changed-HEAD rejection.

Gate: execute against an immutable approved source snapshot/worktree and record its
identity; reject or mark stale a task whose admitted checkout no longer matches.
Integration separately checks current base and intervening changes. A proposal
being received does not grant integration authority.

### F4. Approval and review are local coordinator conventions

Evidence: `controller.py:88-113,176-225,325-330`. Local APIs register workers and
approve jobs without authenticated role separation; events use the literal actor
`coordinator`. States are only awaiting approval, ready, leased and completed.
There is no cancellation, dependency gate, independent review acceptance or
integration evidence record. This is a trusted-local API, not remote enrollment.

Gate: preserve separate proposal, verification, independent review and integration
states. Bind acceptance to artifact/source hashes, reviewer identity and personally
executed commands/results. Workers must not receive registration, policy-changing
or self-approval authority. Do not infer review success from provider prose.

### F5. Crash and retry recovery is intentionally incomplete

Evidence: `adapter.py:239-258`; `continuity.py:112-123,265-275`; existing Review 685.
Failures leave leases pending until expiry, without a controller blocked/retry
classification. A crash-left `run.lock` requires reconciliation. Valid persisted
multi-message retry history is rejected by the bridge after restart. Conversion
also drops the model's `remaining` list (`adapter.py:243-252`).

Gate: reuse the adopted runtime's durable attempts, cancellation, checkpoints and
recovery where available. Preserve unresolved checks and distinguish blocked,
retryable and terminal outcomes. Crash recovery must not silently replay effects,
erase consumed budget or release an uncertain live process. Test crash points.

### F6. Provider receipts omit resolved model identity

Evidence: `continuity.py:178-185,279-287`. Receipts retain requested route and usage,
but the model response's resolved model/provider/request identity is discarded.
This particularly matters for a router alias that selects different models.

Gate: record requested and resolved identity, attempt, request/response hashes,
authorization, usage/cost and timestamps. Configured route names and subscription
entitlements alone are not evidence of model identity or available API credits.

### F7. Public handoff lacks the bridge's runtime dependency

Evidence: `adapter.py:19-23,42-45` unconditionally loads
`tools/build-continuity/continuity.py`. `git ls-tree -r --name-only b9649cbb
tools/build-continuity` returned no paths. A fresh checkout of that handoff cannot
import the bridge or run its test suite.

Gate: package a pinned, reviewed dependency or retire the bridge in favor of the
selected runtime adapter. Keeping it requires at least `continuity.py` and
`routes.json`; reproducing its existing suite also requires `test_continuity.py`
and `batch.py`. Include provenance and required public context files, not private
Git state, account configuration, sessions or unrelated history. Prove import and
offline execution from the standalone artifact with no original-worktree access.

## Local schema implications if this controller is retained

`controller.py:84-114` uses only `CREATE TABLE IF NOT EXISTS`, with no schema
version. Its state CHECK does not admit cancellation. A retained controller needs
a versioned, transactional local SQLite migration before changing that state
machine. Preserve jobs/events/result hashes, indexes and foreign keys; prove fresh
creation, exact legacy upgrade, rollback on injected failure, integrity checks and
unsupported-newer-version refusal. Report legacy invalid/conflicting reservations
without silently discarding them. Prevent mixed old/new executables during upgrade.

These are harness-local data changes only. They do not authorize Yellow PostgreSQL
migrations, new hospitality tables/events, application or runtime changes. If the
adopted upstream already owns durable scheduling, prefer a bounded import/adapter
and these regression gates over a parallel scheduler or duplicate state authority.

## Cross-worktree orders and existing implementation context

Read-only inventory covered canonical Yellow, controller, harness-app,
harness-astra-handoff, yellow-order175-folio-responsive-containment and the existing
`D:/Yellow/git-live-order611-source-v2` checkout. Order numbers cannot be allocated
by looking only at one branch. In D:, 681-686 name product work and therefore
already collide with this lane's harness orders. Every number 687-700 is occupied:

| IDs | Existing D: orders |
| --- | --- |
| 687-690 | group-creation-workspace; native-map-approved-release; universal-group-search; arrival-pickup-staff-journey |
| 691-694 | folio-window-comparison; reservation-journey-ribbon; compact-reservation-detail; shared-navigation-table-polish |
| 695-698 | ecosystem-completion-reconciliation; guest-movement-selector; yellow-startup-helper; requested-map-data-cleanup |
| 699-700 | free-street-map; compact-today-and-bottom-dock |

The HARNESS namespace in the current order avoids reserving another conflicting
numeric ID. The D: checkout contains substantial pre-existing dirty/untracked work;
none of it was staged, changed or imported by this reviewer.

Related evidence read from that checkout:

- **Order 738:** an included-quota Antigravity/Gemini queue pilot with explicit
  execution, bounded jobs, durable evidence and no paid fallback. Its recorded
  September 26 account/quota snapshot was not refreshed in this audit.
- **Order 741:** directly overlapping company/personal harness research. DeepSeek
  is a candidate, with Goose/OpenCode/OpenHands comparisons requested. It describes
  structured OS intents through a trusted executor, one controller/worker first,
  ACP/MCP boundaries, SQLite checkpoints and Windows Job Objects. Its installed
  DSH/Goose paths are documentary context, not freshly verified installations.
- **Order 744 and Review 744:** a self-contained, sample-data control-room HTML
  design concept. The recorded browser review is not a functioning backend,
  scheduler, provider connection or proof of a completed harness.
- **Order 745 and Review 745:** a Bun/SQLite Antigravity coding runner exists as
  dirty/untracked work. The inspected review explicitly says no live tasks were
  dispatched and lists ten required repairs. It does not establish accepted,
  working execution. No fresh execution of that runner was performed here.

Review 745 is a useful regression corpus: manifest version/types; malformed or
denied provider responses; pinned verifier/output hashes; Windows path/reparse
TOCTOU; bounded before/after file auditing including deletions; overflow/timeouts;
transaction cleanup and global verifier lock; actual child PID/orphan recovery;
secret-safe metadata; and rejection of no-op work. Reuse these cases rather than
assuming its code or prose-success handling is safe to import.

Canonical Order 595 and Decisions D1507/Order595-11R further preserve one coordinator
and one writer, bounded local/phone proposal workers, and explicit capability
requests for unavailable actions. Earlier installed/runtime/phone proofs in those
records were not re-executed here. The current HARNESS-001 order preserves isolation
and serialized integration while permitting parallel disjoint worker scopes.

## Status at delivery

Only this audit document was authored by this agent. Controller/bridge fixes,
schema changes, fork adoption, new regression test implementation and independent
acceptance remain work for their admitted orders. Passing the existing offline
suites does not resolve the reproduced gaps or approve the full harness.
