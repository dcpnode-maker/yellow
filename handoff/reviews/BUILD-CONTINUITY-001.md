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

## Receiving Windows execution record — 13 September 2026

Coordinator: root Codex. Independent launcher/source check and focused proof:
`/root/q258_source_adapter`, which did not implement these activation changes.
This section supersedes the originating cloud activation status, not its
historical source-review results.

The exact fetched commit was35e100963b433b00497cc334ff7e9fb08b897d71.
Only14 new tooling/order/review files were imported, preserving existing branch
`phase-7/operator-invoice-workflow` and dirty work. The commit's modifications
to DECISIONS/LEDGER were not copied over local records. Subsequent scoped native
profiles/tests and activation documentation remain local modifications.

### Personally executed provider proof

| Check | Actual result |
| --- | --- |
| Requested native installer | Kilo wrapper7.6.2 plus matching Windows baseline binary privately installed; native version probe passed |
| Official Kilo device login | Founder completed authorization; CLI returned Login Successful; auth listing showed one OAuth credential |
| First bounded coding task | Nemotron Free session `ses_f645939c2ffebkVfL9bNClsVCa`; exit0; reported cost0; root62-case acceptance passed before parallel launch |
| Worker1 | `ses_f645481c4ffezoZxIb1aoSfsaQ`; regression-test proposal; exit0; reported cost0 |
| Worker2, concurrent with Worker1 | `ses_f64548157ffewGdnMJwzJ7PHw5`; catalogue-helper proposal; exit0; reported cost0 |
| Integration corrections | Root corrected one generated nested-price test expectation and one relative import, then added catalogue tests; not accepted blindly |
| Focused suite | `python -m unittest discover -s tools/build-continuity -p 'test_free_*.py'`:46 passed; independent agent also personally executed46 passing tests |
| Original full controller suite on Windows |13 passed;3 fixture errors creating symlinks, WinError1314. No Windows16/16 claim |
| North Mini Free | Two bounded attempts rejected, not used as passing coding proof; one summarized, one returned malformed JSON/wrong function signature |
| Gemini CLI | Private0.59.0 install/version probe passed; Google service rejected individuals route and directed Antigravity migration |
| Antigravity | Existing signed Google CLI auto-updated1.1.19→1.2.2; authenticated with existing Google AI Pro; UI showed Use AI Credits off |
| Antigravity coding | Gemini3.8FlashLow; session `e7fde5da-a278-4f6d-9b65-699d5d63d8da`; SUCCESS;3.7324872s reported;8 behavioral plus8 input-preservation checks passed |
| FreeModels.Pro | Requested ClaudeSonnet5, response identified Nemotron3Super120B; first HTTP200, generated source not accepted; second HTTP429, stopped |

The independent agent confirmed the current static Kilo configuration hash
`F3492468FE20FF3E05C23B00C59757513BD32ABB5DCB0B536086B58FCAA7F602`
matches the launcher's pin; default main/helper/agent model is exact free
Nemotron, only Kilo enabled, and no paid fallback path was found. It flagged the
two-step ceiling and optional North selection. Coordinator disposition: both
are intentional explicit changes; the one-step ceiling prevented a useful North
proposal. Documentation now states two steps and does not recommend North's
failed coding output. Dynamic selection rewrites the whitelist and all model
fields together; there is no automatic transition to North.

Native Kilo binary SHA256:
`5D54B522D8A59228951D141CD70438C29115963ECB38D7CDFCF313F59C0F865B`.
Credential file contents were never printed. Private Kilo directories have the
current Windows user's sole full-control ACL. No provider credit purchase,
billing upgrade or auto-top-up occurred.

See `tools/build-continuity/FREE-CAPACITY.md` for caveats: variable queue latency,
initial synthetic session ingestion before opting out, Antigravity's settings
overwrite without a prior backup, and its plan/slash-command flag warning.
The observed public-only Antigravity proposal and response metadata are preserved
in `tools/build-continuity/activation-proof-20260913.json`.

### Correction to the originating Qwen claim

The upstream Qwen Code authentication documentation now explicitly states free
Qwen OAuth ended15April2026. The historical2,000/day statement above must not be
counted as current capacity. Alibaba's separately eligible API trial remains
unactivated locally and requires verified Free Quota Only controls.

No Yellow feature, app runtime, database, migration, Docker, WSL, deployment,
merge or push was performed for this activation. No application/release gate is
being closed by these tooling and synthetic-model results.

## 2026-09-13 subsequent resource and week-queue execution

The preceding no-runtime-change statement describes the earlier activation,
not this later founder-authorized resource operation. Root stopped six exact
idle Claude Desktop processes and Yellow preview child17936 after checking
executable/source, parent17096, start receipt and loopback3000 ownership. The
supervisor exited itself at17:58:16.9001299Z: child_exit, failureType null,
automaticRestart false. Databases and Windows security were preserved. No WSL
or Docker VM was started.

Spark synthetic session01a09be6-113e-7cb3-a53b-4da018a87007 passed22 checks.
Spark Q285 session01a09bea-ab4b-7093-82a8-21b73a9ac3b6 and Kilo Q286 session
ses_f6415031fffeAslXxabFTOCwIi ran concurrently with disjoint proposals.
Root inspected/integrated selected patches, adding missing full-pair assertions
and correcting Kilo's immutability snapshot. Root executed:

`bun test ./.yellow/evidence/order460/market92-local-review-grant.test.ts ./.yellow/evidence/order460/market92-local-review-grant-native.test.ts ./.yellow/evidence/order460/market92-metadata-preservation.test.ts`

Result12pass,3explicit native skips,0fail,77assertions. Q285 test source now
succeeds the former f105d1e3 hash and needs its own exact-source native admission.
No previous native approval is inherited. No SQL helper, migration, production
verifier or database data was changed by these proposals.

FCC upstream bf59598ccc04b02befa1d649dfbcc569534c365c was installed in a frozen
isolated environment onD:. Root personally ran9 focused guard/configuration
tests; the separate setup worker executed the bounded native smoke:401 admin
without auth,200 with auth,200 health,405 inference POST, stopped afterward.
No inference billing/provider entitlement is enabled.

Qwen initially refused launch below4GiB free RAM. After cloud workers exited,
it pulled the2B q4 model and answered at18:10:36Z in13.43seconds. Its finally
block stopped the owned server. Root inspected the synthetic code: non-string
members raise AttributeError, not the required TypeError. Coding acceptance
failed; do not label it ready for unsupervised work. Both attempts are preserved
in tools/build-continuity/qwen-local-proof.json.

WEEK-PLAN.md and week-plan.json contain16 dependency-linked cards, a two-cloud
worker ceiling, no paid fallback and priorities11 then13 then17 with mandatory
prerequisites. Future scopes are not admitted by this plan. The goal is paused;
the founder must Resume goal for automatic continuation. No merge, push,
release, full-week completion or Phase7 completion is claimed.

Final coordinator proof:11 focused Python tests passed (Spark acceptance,
Qwen static guards, FCC guard/config). The inspected Qwen response was executed
against22 checks:20passed,2failed with AttributeError. Rejected as a coding lane.
Queue validation passed16unique topologically ordered cards; paid_fallback=false,
max_parallel_cloud_proposals=2. Scoped git diff --check passed.

Accepted source-only successor hashes:
- Q285 native test:7EDC49D4C09B37C03FE4B7335DF9C2ABA327E3C0A2B65D6D42AF492174BF549B.
- Q286 pure test:FADA2060913F00BEC5B60817AF583E4AD733557D1CC6D662206E2868E27BD5E1.

FCC smoke hardening pinned native Git, refuses an occupied18082 port and checks
owned loopback listener before sending local credentials. The coordinator's
post-hardening smoke failed readiness (exit1); its finally stopped its child.
The earlier setup-worker smoke is historical, not a pass for this successor.
No inference call was made. FCC remains unavailable as a coding lane; do not
spend further build time on it while Spark/Kilo/Gemini capacity is available.
