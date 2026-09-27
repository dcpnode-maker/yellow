# Yellow harness: offline controller foundation

This is an internal development tool, not the Yellow PMS runtime. It currently
provides a small, non-resident Python/SQLite job coordinator. It does **not** call a
model, start Kaggle, listen on a network port, execute worker commands, edit
source, open a PR or deploy the app. Those are separate, gated integrations.

The controller uses Python's standard library and keeps its SQLite state in the
current worktree's private Git metadata, not on the tracked source tree. It exits
after each CLI command, so it does not consume background RAM. Keep the Windows
user profile and Git metadata access private. `doctor` shows the exact path.

```powershell
python tools/yellow-harness/controller.py --repo . doctor
python -m unittest discover -s tools/yellow-harness -p 'test_*.py' -v
```

## Worker contract

A task is a UTF-8 JSON file with exactly these fields:

```json
{
  "id": "order-681-example",
  "base_sha": "the-current-40-character-git-commit-hash",
  "order": "handoff/orders/681-yellow-harness-controller-foundation.md",
  "inputs": ["tools/yellow-harness/README.md"],
  "outputs": ["tools/yellow-harness/README.md"],
  "goal": "Propose the bounded change described by the order.",
  "capability": "code",
  "data_classification": "public_source"
}
```

The exact `base_sha` must be the current HEAD, and the order and input files must
exist in that commit. Paths are relative POSIX-style paths. The controller rejects
traversal, symlinks, duplicate paths, overlapping unfinished output paths and
non-public-source classifications. It does not parse an order's Scope list; the
coordinator must check that before approval and again before integration. Never
submit credentials, guest records, real hotel data or source you have not approved
for the chosen worker/model provider.

```powershell
python tools/yellow-harness/controller.py --repo . submit C:\path\to\task.json
python tools/yellow-harness/controller.py --repo . approve order-681-example
python tools/yellow-harness/controller.py --repo . register-worker local-worker code
python tools/yellow-harness/controller.py --repo . claim local-worker
```

`claim` prints a random lease token **once**. A local worker can heartbeat and
submit a JSON proposal containing exactly `files` and `summary`; `files` must map
the declared output paths to proposed UTF-8 file contents. A completed proposal
is immutable and must be reviewed before any source edit. The token is not a
network credential. There is no remote worker authentication or enrollment yet.

```powershell
python tools/yellow-harness/controller.py --repo . heartbeat order-681-example local-worker LEASE_TOKEN
python tools/yellow-harness/controller.py --repo . complete order-681-example local-worker LEASE_TOKEN C:\path\to\proposal.json
python tools/yellow-harness/controller.py --repo . status order-681-example
python tools/yellow-harness/controller.py --repo . result order-681-example
```

Lease expiry allows a new claim; an old worker/token cannot complete the new
lease. Same-token completion is idempotent only for identical proposal bytes.
The local database is a development artifact; do not treat it as a shared queue
or durable cloud backup. Back it up separately if this worktree will be removed.

## Next gates

1. Independently review this state machine and its hostile-input tests.
2. Benchmark provider/model choices on Yellow tasks using public fixtures and a
   fixed accuracy rubric. A free Kaggle accelerator is a finite interactive
   session, not an always-on worker. [Kaggle's published terms](https://www.kaggle.com/terms) limit service use
   to internal, personal, non-commercial purposes; do not activate it to build
   Yellow for business unless Kaggle grants permission covering that use.
   Verify each account's current quota and hardware before any permitted run.
3. Add a separately reviewed authenticated, outbound-only transport for remote
   worker claims/results. No raw public listener or shell authority is implied
   by this controller. Keep production secrets and guest data off free notebooks.
4. Choose one agent loop and one inference/router adapter by measured performance;
   see [upstream evaluation](UPSTREAM.md). Do not install every framework.

The existing `tools/build-continuity/` proposal router remains separate and
unchanged. This foundation can eventually provide its durable task envelope.
