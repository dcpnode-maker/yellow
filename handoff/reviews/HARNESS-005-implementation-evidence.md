# HARNESS-005 — Implementation evidence, not full acceptance

2026-09-28. Parent Codex executed these checks. This is not independent review,
not a release approval, and not an order closure. The accepted T3/Paperclip
architecture is unchanged; all model providers remain disabled in the synthetic
pilot. No paid generation, Kaggle start/stop, public tunnel, production database
change, credential copying or artifact auto-acceptance occurred.

## Earlier executable evidence (superseded by the final local checkpoint below)

- Adapter `node --test`, with explicit host-owned `YELLOW_TEST_GIT`: 139/139 pass.
  An earlier invocation without that Git selection failed; it was not discarded
  as success. This is local protocol/fixture proof, not live worker health.
- Latest server focused invocation, from `apps/server` with the same explicit
  Git selection: `vp test src/universalHarness/engineIntegration.test.ts
  src/orchestration/Layers/ProjectionSnapshotQuery.test.ts
  src/mcp/HarnessToolkit.test.ts src/nativeDesktop/core.test.ts
  src/auth/RpcAuthorization.test.ts`: 63 passed / 5 files / 24.02 seconds.
  Its first package-directory invocation exposed a cwd-dependent adapter path.
  The test now resolves the external adapter from its own module URL; rerun
  passed. The real provider is a deterministic zero-network fixture.
- `vp test src/mcp/HarnessToolkit.test.ts src/mcp/McpHttpServer.test.ts`:
  17 passed / 2 files / 11.60 seconds. The pre-fix registration proof failed
  twice with `SchemaError: Missing key at [type]`; the exact empty-object
  parameter schema repairs it. A Windows-specific JSON path assertion was
  corrected by comparing its decoded value, not by skipping the test.
- `node --test scripts/yellow-pilot.test.mjs`: 5 passed / 0 failed.
- Server `vp run typecheck`: exit 0. Full desktop typecheck: exit 1, two TS2883
  errors retained in HARNESS-005-desktop-typecheck-scope.md.
- Server bundle, web build with the license gate, desktop pack, and upstream
  `node scripts/cli.ts build` asset staging: exit 0. Packaging output is not a
  finished installer or usable-screen proof.
- Existing Node 24.19.0 / Electron 44.1.0 finite entry probe returned
  `runtimeMain: true` and a matching entry URL on both; the entrypoint hypothesis
  was disproved and no entrypoint logic was changed.

## Actual local startup limits

The first owned desktop launch had no backend listener: MCP tool registration
failed, while Electron continued retrying readiness. After its schema repair,
backend readiness was reached and a loopback listener appeared. After staging
the client assets, desktop run `488223aeff8f` reported backend ready at 10:58:01.930
and main window created at 10:58:01.969 local time. These logs do not prove a
visible usable window: the Windows inventory did not return that window.
An independent in-app-browser read reached the desktop-managed pairing screen;
no bootstrap credential was copied and no pairing bypass was attempted.

Only identity-checked synthetic desktop launches/children were stopped. A
cleanup guard detected a changed/disappearing child identity and refused that
extra termination; the subsequent read-only checks showed all recorded children
and listeners 38873/38874/38875 absent. No user Codex, Task Manager or Notepad
process was stopped; no data/fixtures were removed. Whole-process memory
measurement did not yield a confirmed result and is not a benchmark claim.

The pilot now refuses missing client/preload assets and bypasses shell-profile
hydration only in its explicit isolated pilot environment.

## Earlier remaining acceptance gates

Finite signed worker host/runtime integration and verified connections; usable
desktop screen; real native Windows action proof with a scoped revocable grant;
UI/MCP assignment/start and accepted-artifact workflow; complete policy/config
pinning; tracked whole-stack startup/stop and memory measurement; full desktop
typecheck; independent reviewer-executed engine/effect/cancellation proof and
final runnable packaging. Neither Kaggle worker is verified active. No claim
that the universal harness or Yellow ecosystem is complete is authorized.

## Final local source checkpoint — 2026-09-28

Parent implementation evidence, not independent acceptance:

- T3 commit `719290044d1921be9758c9dafe62dfae0dc07107`, branch
  `phase-0/yellow-personal-harness` (69 scoped changed files).
- Adapter commit `27b3b8c251ebca043b42ec5016176106ddd95cb4`, same branch
  name (30 scoped changed files). Source default remains inert.
- Adapter documentation-only successor `a5f4dd192b0ec4e2f2415174b187b2fa74a66d28`
  corrects the example worker origin to the exact signed exchange path.
- Upstream T3 v0.0.42 `719a76ca1dbf5490f1aa33ffb9966301e02be9a9`;
  Paperclip v2026.916.1 `d554c4789ed3930f8a53ac9fdf6503b3187097da` preserved.
- All commits local only; no PR, merge, branch publication, real credentials,
  billable generation, Kaggle action or canonical Yellow/production mutation.

### Current proofs and commands

Counts below are per invocation and overlap. Do not add them as distinct cases.

1. Adapter `node --test` with explicit
   `YELLOW_TEST_GIT=C:/Users/astha/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe`:
   **148 passed, 0 failed, 0 skipped**; final formatted-source run 16.78s.
2. Server focused complete harness/MCP/auth/native/projection/reactor invocation:
   **183 passed / 14 files / 157.73s**. Command from `apps/server`:
   `vp test src/universalHarness src/mcp/HarnessToolkit.test.ts
   src/mcp/McpHttpServer.test.ts src/auth/RpcAuthorization.test.ts
   src/nativeDesktop/core.test.ts
   src/orchestration/Layers/ProjectionSnapshotQuery.test.ts
   src/orchestration/Layers/ProviderCommandReactor.test.ts`.
3. After formatting, `vp test src/universalHarness/engineIntegration.test.ts
   src/universalHarness/workerHttp.test.ts`: **3 passed / 2 files / 19.18s**.
   Actual persistent T3 SQLite and real loopback HTTP prove signed capacity,
   one owned claim, one synthetic-model generation, durable proposal publication
   before ACK, unchanged claimed turn/messages after restart and no replay.
   The synthetic provider is not a trained model or a live worker. Existing
   parallel isolation/cancellation/failure/accepted-revision fixture remains.
4. `YELLOW_NATIVE_ACCEPTANCE=owned-fixture-only vp test
   src/nativeDesktop/windowsAcceptance.test.ts`: **1 passed / 5.86s** on latest
   source. Actual Windows UIA invokes an owned Electron counter button, repeats
   the same command without a second click, revokes authority and denies the
   next action. Fixed stable HWND/automation identities use xa11y **0.15.0**.
   No general laptop-control or caller-supplied app target was exercised.
5. Desktop `vp test src/app/DesktopEnvironment.test.ts
   src/electron/WindowsForeground.test.ts
   src/electron/WindowsForegroundFocusWorker.test.ts
   src/electron/WindowsForegroundFocusThread.test.ts
   src/snapShot/SnapShotAccessibilityProcess.test.ts`:
   **28 passed / 5 files / 2.09s** after formatting. Earlier updater suites
   passed separately. An earlier invocation with wrong test names selected
   only the naming test; it is not counted as those five regression suites.
6. `node --test scripts/yellow-harness-runtime.test.mjs
   scripts/yellow-pilot.test.mjs scripts/yellow-pilot-paperclip.test.mjs`:
   **13 passed, 0 failed, 0 skipped**. Includes a real read-only Windows census
   with a nonexistent launcher, sealed environment, disabled heartbeat,
   bounded stop time and built-entry/no-fallback assertions.
7. Server, desktop and web `vp run typecheck`: **all exit 0** after formatting.
   Desktop TS2883 repair is limited to its recorded explicit fixture return type.
8. Web build with its licence gate, server upstream `node scripts/cli.ts build`
   asset staging, and desktop secret/CSS generation plus `vp pack`: **exit 0**.
   Windows build warnings about optional X11/import.meta are retained, not hidden
   or bypassed. Final committed-source web build transforms 6016 modules and
   passes its licence gate in 70s; upstream server/client staging and desktop
   pack subsequently both exit 0. This is a runnable local build, not a
   distributable Windows installer.
9. Both scoped source diffs pass `git diff --check`. Commit identity reused the
   existing `OpenAI Codex <codex@yellow.local>` with command-local `git -c`;
   missing default author identity was retained as a failed first attempt.
   No global Git settings were changed.

### Visible screen and tracked lifecycle

Computer Use selected the unique owned **Universal Harness (Alpha)** Electron
window, opened Jobs & agents and read the actual Jobs/Agents/Runs/Models & workers/
Windows controls screen. Five retained drafts, three paused agents and zero runs
survive restart. No bootstrap pairing secret was copied. All six providers remain
disabled; primary role and execution host are not configured in this pilot.

`scripts/yellow-harness.ps1 -Command start|status|stop -Mode both|desktop|paperclip`
records exact root/descendant identities, log path, startup and working-set sums.
Owned desktop PID 24384 became ready in **7341ms, 758MiB, six processes**.
Compiled-entry Paperclip PID 24132 became ready in **34449ms, 1170MiB, 22
processes**; another restart PID 32208 reached readiness in **20244ms,
1159MiB, 22 processes**. These are observations on this laptop, not comparative
benchmarks; working-set sums include shared pages and fluctuate.

The first shutdown order let the embedded API restart PostgreSQL. Its exact owned
replacement IO child was identity-checked and stopped, after which the port was
proven free. No unrelated old PostgreSQL process was touched. Null command-line
handling for protected/unrelated processes was repaired. Another stop initially
failed after its API termination had already stopped the database; the launcher
now rechecks the exact owned postmaster before requesting graceful shutdown.

Final full-stack stop: **exit 0**, desktop PID24384 and Paperclip PID32208 both
reported stopped; subsequent TCP bind proofs show **38873, 38874 and 38875 free**.
No retained fixture/database was deleted. Initial failed/unconfirmed starts were
not reported as ready. The tracked Paperclip launch now reuses the complete sealed
pilot environment and compiled-entry check; log explicitly reports heartbeat
disabled. It never launches a second coordinator or takes over a busy port.

After the final committed-source build, both components were restarted and left
running for the founder: Paperclip root **29156**, ready **20324ms / 1156MiB /
22 processes**; desktop root **22304**, ready **5918ms / 766MiB / six
processes**. Subsequent status observes both owned trees running. D: remains
about 9.3GiB free. No model job is running in this alpha.

### Remaining full-product gates

- Current changes still require nonimplementing, reviewer-executed acceptance.
  A bounded Luna review was asked for, not authorized in the current visible
  continuation; earlier focused authorization/reviews cannot be silently reused.
  No confirmed free/local reviewer is connected.
- No real model/Kaggle worker is connected or benchmarked. Exact model rights,
  identity, known free/included quota and activation are separate founder choices.
- The task preparation/assignment and reviewer accepted-artifact UI remain
  incomplete; current approved plans/worktree assignment are host-owned manual
  steps. Prepared-job Start, result/cancel inspection and explicit handoff
  fixtures are implemented, not automatic job approval/integration.
- The local Electron build runs, but a distributable installer/archive remains
  blocked by upstream preflight's absent Rust/Cargo, Visual Studio SDK and Spectre
  build libraries. No global SDK installation or packaging bypass was attempted.
- Canonical `setup.sh --db-only` / 11-invariant referee was not run; no PR or
  database acceptance is claimed. Order stays **IN PROGRESS**, not complete.
