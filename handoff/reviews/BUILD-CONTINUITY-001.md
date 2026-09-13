# BUILD-CONTINUITY-001 independent review

Reviewer: independent read-only review by `/root/free_route_research`
Date: 2026-09-13
Scope reviewed: `tools/build-continuity/continuity.py`, `batch.py`, `start.py`,
`routes.json`, `test_continuity.py`, and `README.md`

## Re-review verdict

**Continuity controller: pass for the tested temporary-fixture scope.** F-001 is
fixed by `private_directory()`/`plain()` checks and symlink-safe temporary JSON
writes. F-002 is fixed by plain-checking the Kilo launcher before both execution
paths. The focused suite now passes 16/16, including actual two-lane concurrency
and overlapping-output rejection. The bootstrap handoff also prepares
successfully in a temporary repository containing the real-size project files,
using the bounded status range described below.

## Material finding

### F-001 — private state can escape through a symlink (high) — fixed

The prior version constructed `git_dir / "yellow-continuity" / task_id` and
followed a symlink. In the prior proof, that escaped to a temporary external
directory. The current version rejects symlinked private base/task directories
before any provider call, rejects a symlinked state file, and rechecks parents
around atomic replacement. The new tests exercise all three cases in temporary
fixtures; no actual Yellow private state was used in this re-review.

### F-002 — bootstrap launcher path was not plain-checked (low/medium) — fixed

The prior version used `launcher.is_file()` and then passed the path to Node
without calling `c.plain(launcher)`. The current version applies `c.plain(launcher)`
after installation and before both the version probe and interactive launch, so a
symlinked private launcher is rejected.

## Proof executed

All tests were local and synthetic; no provider request, account, credential, or
installation was used.

| Check | Result |
| --- | --- |
| Python import and `py_compile` | pass |
| `../`, `..`, absolute, backslash, hidden, and source symlink paths | pass; rejected |
| OpenRouter route validation, including `openrouter/free` | pass |
| Missing OpenRouter key rejected before transport | pass |
| Zero-price recheck and `allow_fallbacks: false` request body | pass |
| OpenRouter 429 persists `quota_wait` and does not retry before `retry_at` | pass |
| OpenRouter 403 becomes `access_blocked` without rotating routes | pass |
| Crash after durable reservation preserves consumed attempt and resumes at next route | pass |
| Synthetic valid proposal written to private state | pass |
| Source mutation during model call rejected after the call | pass; final state `blocked` |
| Private Git base/task/state symlink containment | pass; temporary fixtures |
| Bootstrap handoff with real-size status file | pass; bounded range; 39,351-byte context, private mode 700 |
| Batch concurrency with two disjoint outputs | pass; barrier proved both calls in flight |
| Batch overlapping output scopes | pass; rejected before model calls |
| Batch same-provider 429 stop | pass; one call, second lane blocked |

The current default configuration is OpenRouter-only:
`cohere/north-mini-code:free`, `nvidia/nemotron-3-ultra-550b-a55b:free`, then
`openrouter/free`. Each route must still pass the live `/models` zero-price check
at call time. No live provider generation was attempted in this review.

## Exact re-review hashes

These hashes identify the uncommitted files reviewed in this workspace:

| File | SHA-256 |
| --- | --- |
| `tools/build-continuity/continuity.py` | `41186c2fba1cbb2ac144a117ceb8ba241fcab6ca43eb0217f71f14cf4e4a226d` |
| `tools/build-continuity/batch.py` | `61c013b999500a93933dca806225f6e7e777d8512d6ecc9ca584ee9e2851bf15` |
| `tools/build-continuity/start.py` | `03bd3194748eb52d5fdabf107bfdb0c83bd9bdaf85ff61a605f93c16135e2f0d` |
| `tools/build-continuity/routes.json` | `f4435a67db84a8541a88cc2593cfd415fc53372b45adcf58713150f593b050ce` |
| `tools/build-continuity/test_continuity.py` | `25db6553ae3f9033a6545b303339d7bd4df85b8764627dd9222c76e266793bdc` |
| `tools/build-continuity/README.md` | `ee7ec4809d31b75fdc69002f813ff647f2a754daa4f00a753922a8796b97adea` |

Focused command: `python3 -m unittest discover -s tools/build-continuity -p 'test_*.py' -v` → **16 passed, 0 failed** in 0.510s. The command ran only temporary fixture repositories. A separate temporary full-size handoff fixture ran `start.py` with no flags → exit 0, generated two private handoff files, 39,351-byte context, private directory mode 700, and left the fixture checkout clean. No real Yellow `.git/yellow-continuity` path was touched.

## Alibaba Model Studio correction

The current official page is:
<https://www.alibabacloud.com/help/en/model-studio/new-free-quota>
(last updated 2026-09-11).

It documents a real new-user free API allowance: first activation in the
Singapore region grants eligible models whose service deployment scope is
International a model-specific quota, typically 1,000,000 combined input/output
tokens per model, valid for 90 days. The quota is shared by the account and its
RAM users, and is independent per model/version. It covers real-time invocation
only; batch, fine-tuning, deployment, custom models, PAI-DSW, and storage/request
fees are excluded.

The allowance is not recurring. A general-purpose API key uses it automatically;
Token Plan and Coding Plan dedicated keys do not. `Free Quota Only` is disabled by
default and should be enabled per model before use. Without that protection,
accounts with completed billing information can be charged pay-as-you-go after
the quota is exhausted or expires. The same page separately documents OAuth at
2,000 calls/day; that allowance is not shown in the API-key quota page and should
not be mixed with the token allowance.

This is a viable bounded official-API route only for an eligible Singapore/
International model with `Free Quota Only` enabled and a locally verified expiry
and remaining quota. It should be classified as a 90-day new-user trial allowance,
not a recurring free provider pool. The controller currently has no Alibaba
route, which is appropriate until those account-side conditions are explicitly
verified.
