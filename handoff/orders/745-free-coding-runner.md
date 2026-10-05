# Order745 — free/included coding runner, engine reuse

Read PROJECT.md, AGENTS.md and this order. Actual root
D:/Yellow/git-live-order611-source-v2. Phase7 unchanged. Founder wants a WORKING
coding harness before dashboard polish. Reuse installed agent engines via their
documented CLI, not new inference clients or wholesale forks. Free/included only.

## Exact scope

Gemini writes ONLY:
- scripts/free-build/runner.ts
- scripts/free-build/example-task.json
- tests/order745-free-coding-runner.test.ts
- docs/FREE-CODING-RUNNER.md
- handoff/receipts/745-free-coding-runner.md

Root owns this order, questions/745.md, reviews/745-free-coding-runner.md,
docs/PROJECT-STATUS.md, handoff/LEDGER.md and sanitized proof artifacts under
D:/Yellow/temp/order745/. Root may add exact file permissions to existing backed-up
AG config preserving strict/deny rules. No existing app/source files changed.
No package changes, installs, credentials, git branch/reset/commit/PR or deployment.
Use file tools only. Root executes all tests; never claim worker ran commands.

## Small architecture

One dependency-free Bun TypeScript CLI, using built-in bun:sqlite for durable queue.
Reuse installed Antigravity as the actual coding engine. Include a Goose/Ollama
adapter command planner as disabled/unverified until a separate real local proof.
DSH and Paperclip are later adapters/dashboard, not implemented in this slice.
Avoid generic services/frameworks/UI. Aim compact <=500 implementation lines.

Installed exact programs (no PATH fallback):
AG C:/Users/astha/AppData/Local/agy/bin/agy.exe
Bun C:/Users/astha/.bun/bin/bun.exe
Goose E:/yellow/goose/v1.51.0/dist-windows/resources/bin/goose.exe (1.51.0).
AG launch cwd D:/Yellow/temp/antigravity-quota-check-20260925 is trusted;
the task workspace is explicitly in its prompt, not implicitly this cwd.

AG args fixed: --sandbox --mode accept-edits --model gemini-3.8-flash-low
--effort low --print-timeout <bounded>s --output-format json --print=<prompt>.
No --dangerously-skip-permissions, no agent flags from manifests, no paid fallbacks.
Fresh session per build, preserving conversation_id as metadata (never autoresume
failed/uncertain actions). Existing account uses included quota; not unlimited free.
Don't touch AG auth/config programmatically from the runner. Scoped file permissions
must already be granted by the operator; rejection means needs_attention.

## Task and commands

Manifest version1: id (safe ASCII <=64), workspace absolute existing dir,
orderPath absolute existing file, prompt (1..6000 chars), writePaths (1..30 exact
workspace-relative file paths), checkPaths (0..10 exact existing workspace-relative
test files, must not overlap writePaths), timeoutSeconds (30..600), engine:'antigravity'.
Reject unknown keys, unsafe types, traversal, absolute/nul write/check paths,
case-insensitive duplicates, symlink/reparse escapes using nearest real parent,
secret/attachment/.git/node_modules paths; orderPath must be a regular nonsymlink file.
Read no secrets into prompts. Prompt includes scope/order + no commands except
read/write scoped files + no credential/provider/permission change or deployment.

Commands:
- help/status: no model calls; status with absent DB reports empty without creation.
- enqueue --manifest <path> --db <path>: validate and persist; same id/hash idempotent,
  different manifest same id rejected. DB explicit, parent must exist, no default writes.
- plan --id <id> --db <path>: show sanitized execution plan, no model calls.
- run --id <id> --db <path> --execute: one job only, global single-running lock/lease.
  queued -> running -> needs_review on genuine clean provider success.
  provider failure/denial/timeout/parse error -> needs_attention, nonzero CLI exit.
  Do not trust process exit0 or string SUCCESS alone: AG JSON denied_actions nonempty
  or empty response is not success. No automatic retries or paid fallback.
- verify --id <id> --db <path>: only needs_review; execute fixed Bun test args from
  checkPaths (if empty report needs independent proof, don't mark done). No shell.
  capture exit + duration + test-file hashes; failure -> needs_attention; pass ->
  tests_passed (STILL requires independent review, not production acceptance).
- recover --id <id> --db <path>: interrupted running -> needs_attention only;
  no replay. Never recover a still-owned live child; store pid and check liveness,
  uncertain state blocked rather than kill/relaunch. Document manual reconciliation.

Statuses include queued/running/needs_attention/needs_review/tests_passed. No
auto-accepted/done, self-approval, deployment or indefinite loop in this slice.
Atomic claim under SQLite BEGIN IMMEDIATE, globally one running task across
processes using that DB. WAL local disk only. Store bounded sanitized metadata:
id, state, times, conversation id, model usage numeric values, check exit, changed
paths and hashes. Don't persist raw model response/stderr/credential values.
Prompt stored in SQLite (private local file), not printed in status; document
operator must never put secrets in task text. No remote upload except explicit
task prompt + worker-read permitted code to already-authorized AG account.

## Scope/evidence checks and limitations

Snapshot exact writePaths/checkPaths before and after; pin check hashes at enqueue
and before/after verifier. Record produced/changed file hashes. For git workspaces
also fingerprint git ls-files -z --cached --others --exclude-standard (bounded
file count/total bytes, fail closed if exceeded) before/after and reject changes
outside writePaths. Preserve existing dirty changes, never restore/reset/delete.
Exclude private/secret paths from content logging; hashes only. Explicitly state
post-run diff auditing is NOT a security sandbox and does not monitor ignored files
or other disks; AG strict native tool permissions remain the preventive boundary.
First real proof uses a dedicated small temp workspace, not live app code.

Use argv arrays (no shell/string-built commands). Inject executor/clock for unit
tests through exported functions only, never CLI/env test bypass. Bound output
capture e.g.4MiB and timeout; kill only the directly owned subprocess if timeout,
classify needs_attention and don't dispatch another. Document descendant cleanup
not guaranteed (no global process-name kill or unverified JobObject promises).
No no-op return represented as verified completion. Changes to protected tests
or outside scope halt. No fallback to GPT/Claude/paid API endpoints.

Goose local planner must use inspected flags: run --no-profile --with-builtin
developer --provider ollama --model <localName> --max-turns 8
--max-tool-repetitions 3 --output-format json --text <prompt>. Planner only in745,
not exposed as runnable engine. Validate model simple name and reject :cloud.
Document local runtime is presently unavailable, requiring a separately scoped
local-model health/resource/permission proof before activation.

## Tests and delivery

Mocked Bun tests alongside implementation: validation/path/symlink escape, explicit
execution, engine/model/argv policy, default status no disk/model mutation, enqueue
idempotency/conflict, process0 plus denied_actions/empty/malformed response failure,
success needs_review not done, verifier pin/exit gate, global lock, persisted resume
no duplicate run, recover refusal for live pid, output/timeout stop, out-of-scope
changes preserve data, Goose paid/cloud rejection. No real provider calls in tests.
Use unique temp dirs and cleanup only your own test temp roots, no user-file deletion.
Example manifest points to temp proof, never auto-runs app work.

Receipt must honestly say worker tests unexecuted. Root independently runs tests,
inspects all code, then enqueues one tiny real code-generation task and verifies
it with root-owned pre-existing tests. A second run must refuse replay. No claim
that task proof completes Yellow or proves OS sandbox / full Codex parity.
