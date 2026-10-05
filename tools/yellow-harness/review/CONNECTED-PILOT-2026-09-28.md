# Universal Harness — connected pilot and receipt foundation

28 September 2026. HARNESS-004 remains **in progress**, not full-product or
live-worker acceptance. Canonical Yellow source/runtime was not changed.

## Exact sources and delivered slice

- T3 upstream v0.0.42: `719a76ca1dbf5490f1aa33ffb9966301e02be9a9`.
- Connected-screen commit: `e9362f737747c11221300c234dc99b1b7d4386c4`,
  `D:/Yellow/harness/t3code`, branch `phase-0/yellow-personal-harness`.
- Paperclip v2026.916.1: `d554c4789ed3930f8a53ac9fdf6503b3187097da`,
  `D:/Yellow/harness/paperclip`; no core source change.
- Nonactivated adapter foundation: `c71b1392495f27f2b0e403e58ece493c2a407652`,
  `D:/Yellow/harness/adapters/t3`, same branch name. No remote configured.
- Upstream MIT notices retained. No push, PR, merge or global setting change.

The T3 sidebar now opens **Jobs & agents** at `/harness`. Jobs, Agents and Runs
use an authenticated `orchestration:read` RPC, not an iframe. The server fixes
the numeric loopback origin and company, rejects redirects, caps each JSON
response at 2 MiB and projects away configurations, secrets, prompts and raw
run results. Cross-company/malformed/incomplete reads clear the snapshot.
Costs are reported events only; zero budget is explicitly **no enforced limit**.
Agent registration is explicitly not a live-worker health check.

The separate SQLite journal binds company/run/agent, immutable request digest
and deterministic T3 command/thread IDs. It claims before dispatch, rejects
changed requests, does not replay uncertain acknowledgements or restart, and
cancels only its owned thread after matching ACK. This is **not another
scheduler**. Its callbacks are fixtures, not live integrations.

## Executable evidence

Parent server/web typechecks, production web build (6,008 modules), server
bundle and `corepack pnpm --filter t3 exec node scripts/cli.ts build` passed.
Large-chunk warnings remain; no speed superiority is claimed.

- `corepack pnpm --filter t3 exec vp test run src/universalHarness/paperclip.test.ts src/auth/RpcAuthorization.test.ts`: **15 passed**.
- `node --test scripts/yellow-pilot.test.mjs scripts/yellow-pilot-paperclip.test.mjs`: initial **6**, guard repair **7**, compiled-mode extension **8 passed**.
- `node scripts/yellow-pilot.mjs check`: passed real schema-decoded settings.
- `node scripts/yellow-pilot-paperclip.mjs check` and `check-built`: passed.
- `node --test receipt-store.test.mjs`: **14 passed**, including duplicate,
  changed request, lost/foreign ACK, reassignment, company isolation, owned
  cancellation, cancellation during authorization and durable restart.
- Actual browser: onboarding, not-configured and connected states, Jobs/Agents/
  Runs, empty-runs wording and Refresh exercised. Refresh changed snapshot from
  06:06:04 to 06:06:33 local time. No captured console warnings/errors.
- During the owned coordinator restart, Refresh explicitly showed
  **Disconnected** at 06:23:17, clearing the previous tasks and costs.
- Unauthenticated `GET /api/orchestration/snapshot`: **401**. Paired browser
  read succeeds without receiving a coordinator credential.
- `git diff --check` passed before local commit.

Nonimplementing reviewer **/root/harness_luna_review**, GPT-6 Luna, was explicitly
authorized after the configured Spark model could not start. It personally
executed 6+15+14 tests, T3 unauthenticated401 and Paperclip health200, and accepted
the read-only synthetic pilot. It did **not** independently claim the new RPC's
authenticated browser behavior or UI proof. Those are parent evidence above.
Its P2 runtime-mode/background-polling guard finding was repaired; its personal
7-test rerun and real pilot check closed that finding. The next compiled-mode
extension is separately reviewed; no execution activation is approved.

## Isolation and measured resources

Marked root `D:/Yellow/harness/state-pilot`, synthetic OS home and allowlisted
environment. Providers, account sources, telemetry, announcements, updates,
automatic jobs and backups remain disabled. Paperclip initialized its own 278
upstream pilot migrations; this is **not Yellow's canonical database gate**.

At 06:12 local, T3 PID18736 listened on 127.0.0.1:38873; source Paperclip PID25464
on 127.0.0.1:38874, PostgreSQL master17916 on loopback38875. Three backlog jobs,
three paused records, zero execution runs. The combined service descendant
working-set sample was **1,446.6 MiB**, private memory **1,207.4 MiB**, including
PostgreSQL children and TSX/esbuild but excluding launchers/browser/Electron.
Shared pages may be double-counted: this is not a peak or steady-state benchmark.
A nearby sample had 2.65 GiB free RAM and 9.63 GiB free D: disk. No unrelated or
security process was stopped.

T3 bundle SHA256 `FF998D0525C62B9114507988719399CF81A2E53EC6415A47AC9D73669DD8F009`;
packed index `1A8D4E2FBACC1CF267C129E2EB3C911A323740B477A7637B73B472897E1B005F`.
Adapter source `6770FC076F4C842D8EB934BC130CD6B28BA66439D5A12BDECFE59426F6455D3A`;
test `D8AF47FF85393383A74ADE238F61B981AC8877F384FE148BDA8C49C202321420`.
Screenshot outside repo: `C:/Users/astha/AppData/Local/Temp/yellow-harness-jobs-20260928.png`.

Retained issues: Windows schema import required shared build output; initial
runner build required its eval-kernel dependency. The first T3 restart guard
expected index.mjs instead of actual bin.mjs and correctly refused without
stopping a process. Paperclip compiled server TypeScript and upstream runner
vendor-dependency scan passed. The source-to-built runtime trial stopped only
owned services: PG had already exited when pg_ctl stop ran, so that command
returned nonzero. Subsequent pg_ctl status, PID and listener checks confirmed
the old server absent; no cluster file was removed or reset. Built PID15152
started against the same synthetic database; its recovery/result is recorded
in the continuation below, not assumed successful here.

Worker 2's observed Kaggle draft session was **off** this turn. Historical Qwen
inference is not a current worker connection. No Kaggle session was started.

## Remaining full-product gates

Authenticated adapter transport, live ownership/budget/lease revalidation,
atomic cancellation fencing and ACK reconciliation, immutable workspace
resolution, ordered accepted-artifact handoff, finite outbound Kaggle transport,
official provider auth/model entitlement and zero paid fallback, serialized
Windows standing grants/actions, native desktop visual proof and representative
resource/quality acceptance. **The harness and Yellow ecosystem are unfinished.**

## Final built-runtime checkpoint

T3 guard/launcher documentation commit:
`a80bed3ec9a8ece0fd0c72023aa8c94c42c35de8`; T3 working tree clean. The original
connected UI/server bundles are unchanged by these launcher-only repairs.

Paperclip built PID15152 reached ready at **06:23:37 local** against the same
cluster (initialization skipped; migrations already applied). PG master **23344**
owns loopback38875. Parent health returned200/statusok/authReadytrue/startupReady;
actual browser Refresh at **06:25:49** restored Connected and the same three
YEL-1/2/3 records, three paused agents, zero execution runs. Reviewer independently
read health after startup: **HTTP200, ok, ready**. Its initial unavailable probe
is preserved in `handoff/reviews/HARNESS-004-READ-ONLY-PILOT.md`.

Final independent suites cover **37 distinct tests**, not the sum of repeated
reruns. The P2 guard finding is closed; the explicit compiled launcher extension
is accepted for its narrow purpose only. Whole dispatch/native activation remains
unsigned and disabled.

One later built-service descendant sample: **1,282.7 MiB** working-set sum,
**1,043.1 MiB** private, 21 processes; coordinator alone 723.2 MiB. Windows free
RAM5.52 GiB and D: free9.57 GiB. This is not a controlled comparison or a claim
that global free RAM improvement was caused by this change. Shared-page/other-app
measurement caveats above still apply. No unrelated process was killed.
Paperclip compiled entry SHA256:
`6D555626F86CA4318CD223C7B9114F0BF5852991DBDAB0C8E72B0560914BC5FF`.

Current accessible output: `http://127.0.0.1:38873/harness`, retained browser tab21.
No public tunnel, background generation, provider connection or native-control
grant was activated. Keeping the local pilot running does not mean models are
continuing to build after a Codex turn ends.

## Draft jobs and inert execution-adapter foundations

Final local commits: T3 `aff473c14717aa4dccfe229000bd584c0bab2e61` and external
adapter `8f8746e86fdaa3fc12a8fcc642a166a3fa099280`. Both worktrees are clean;
Paperclip core remains at its exact upstream pin. Upstream notices and generated
third-party license output are preserved. No remote publication or PR.

**New draft job** is an authenticated `orchestration:operate` RPC, not a provider
request. The host fixes company/origin; title/details/priority are the only
editable fields. Backlog status, null agent/user assignments and no execution
run are enforced and checked in the response. Extra controls fail validation.
Unconfirmed responses lock the attempted fields and retain the key across tab
switches/transient outages; retry is explicit and uses the same key. Seven-day
Paperclip idempotency retention and full-reload limitations are documented.
User-assigned jobs now have their own label; missing assignment data fails closed.

Parent actual authenticated browser created and retained YEL-4
`e1c5de0f-48ae-46da-a332-6437753c6966`; independent Luna created and retained
YEL-5 `c51a24d1-eb60-4642-9857-161b09a457e2`, proving 4→5 jobs and same-ID replay,
three paused agents and zero→zero runs. Neither performed cleanup or provider
execution. The independent helper proof is not falsely claimed as browser RPC
proof. Full review commands, the initial Windows import failure and closed P2
are in `handoff/reviews/HARNESS-004-ADAPTER-AND-DRAFTS.md`.

Current distinct focused cases: bridge/auth/draft24, launchers8, receipts14,
adapter16, workspace10 and pinned-loader1: **73**. Parent final server and web
typechecks passed. The assignment test initially inferred nullable fixture IDs
as null-only and failed TypeScript; the fixture's declared string-or-null types
fixed that mismatch without altering production guards or expectations.
Final web production build: **6,008 modules, 1m3s**, large-chunk/plugin warnings
retained. Final server pack: **8.32 MB**, 1.586 seconds. These durations are not
an end-to-end startup, steady-state RAM or comparative harness benchmark.

New bundle hashes:

- `apps/server/dist/bin.mjs`:
  `12E56EEF84AC7C5F1B2B8AEAA62FDE146379479F2AA50575C9BCF9F508DD73C5`.
- `apps/web/dist/index.html`:
  `32ABF73541920B79281FB1B802732C3F40F75ED801EB91727A0F93B62A708F16`.

Parent validated real pilot settings, exact old T3 command and listener owner,
and zero execution runs before replacing only PID23088. New T3 **PID1544** owns
127.0.0.1:38873; Paperclip15152 and PostgreSQL23344 remain unchanged. Health is
ok; unauthenticated T3 snapshot remains401. Browser reload at **07:14:27 local**
shows Connected with **five jobs, three paused agent records and zero runs**.
All five are unassigned backlog records. A nearby build-time resource sample
had 5,574,636 KiB free RAM and 10,359,648,256 bytes free D: disk; no optimization
or peak-memory claim is made. Screenshot outside Git:
`C:/Users/astha/AppData/Local/Temp/yellow-harness-drafts-20260928.png`.

The supported Paperclip loader accepts the external adapter, but its default
factory reports runtime_not_configured and cannot enable generation. Its injected
callbacks remain fixtures. The workspace verifier uses actual isolated linked
Git worktrees, exact clean bases and exclusive registered path ownership; no
worktree lifecycle or second lease/scheduler is introduced. Temporary test Git
fixtures originally failed ambient CRLF handling; only fixture-local Git config
was corrected, not production repositories or global Git settings.

**Still not finished:** live authenticated dispatch, no cross-run replay after
unknown outcomes, effect-time workspace/ownership fencing, atomic cancellation,
accepted artifact integration, official model auth/entitlements, free-only cost
admission, finite Kaggle transport and serialized native Windows control.
Independent review did not approve these activation boundaries. No live Qwen
connection, Kaggle session start, paid API generation, public tunnel, background
build or full Yellow completion is claimed.

## Cross-run reconciliation guard

External adapter successor `14329a1c5fe314747fdf361f241eefa534b7e643` closes the
specific same-task/fresh-run replay gap. Atomic SQLite issue bindings keep new
run IDs from dispatching while old task receipts remain nonterminal, including
changed agent/prompt/base input. Older unknown-task receipts fail closed without
deletion or assumed settlement. Observation loss returns reconciliation
evidence, not a generic adapter exception; no automatic transport reconciliation
is claimed. Separate tasks/companies and explicitly admitted future terminal
work remain distinct. Host issue-company ownership and authority are still
activation requirements, not journal guarantees.

Parent first reproduced29pass/4fail, repaired33/0, then passed51/0 across adapter18,
receipt22, real-Git workspace10 and pinned-loader1. Nonimplementing Luna personally
executed the same final51/0/0skip (11.892s) against exact clean source/hashes and
proved an aborted blocked run cannot interrupt the original: dispatches1,
interrupts0, old accepted receipt retained, new receipt absent. Narrow inert
foundation accepted; full activation remains unapproved. Full evidence and
retained failures are in `handoff/reviews/HARNESS-004-CROSS-RUN-RECONCILIATION.md`.
Current distinct focused foundations total83, including unchanged T3/launcher
proof; do not claim83 newly rerun cases.

T3/Paperclip services and bundles were not changed. Fresh API reads show five
unassigned backlog tasks, three paused records, zero runs; loopback listeners
remain1544/15152/23344 and coordinator health is200/ok/ready. No model execution,
provider activation, Kaggle start/stop, tunnel, native grant or production action.
Founder-authorized market/pricing/proxy handoff was delivered to the verified
existing **Choose model for CompSet pipeline** chat and acknowledged there.
This chat remains the harness build lane; HARNESS-004 is still in progress.
