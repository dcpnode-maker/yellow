# HARNESS-005 — Complete Universal Harness integration

Status: IN PROGRESS. Date: 2026-09-28. Phase 0, local build only.

## Authority and fixed architecture

Founder: "the universal harness should be completely ready dont stop complete
the harness with the scope given". D-91 authorizes scoped successor orders.
HARNESS-004 and Astra's accepted SOL6-HANDOFF remain the design: T3 is the one
UI and execution session engine; Paperclip is the sole durable job coordinator;
Goose remains optional. Do not revive the Python scheduler or invent another
job lease/queue. See HARNESS-005-scope-transition.md before implementation.

## Exact local scope

Preserve all existing work. Use `phase-0/harness-app` governance and existing
`phase-0/yellow-personal-harness` source branches; all commits `[codex]`.

- Governance: this order, its question, append-only decisions/ledger,
  `handoff/reviews/HARNESS-005-*`, `tools/yellow-harness/review/**`.
- Existing external adapter repo `D:/Yellow/harness/adapters/t3/**`: admission,
  immutable execution intents, supported host runtime, bounded authenticated
  T3 transport, finite outbound worker client, cost/resource routing, tests/docs.
- T3 `apps/server/src/universalHarness/**` and focused tests.
- T3 authenticated orchestration/HTTP/RPC seams: `apps/server/src/ws.ts`,
  `apps/server/src/server.ts`, `apps/server/src/auth/RpcAuthorization*`,
  `apps/server/src/orchestration/http.ts`,
  `apps/server/src/orchestration/Layers/ProviderCommandReactor*`,
  `apps/server/src/provider/Layers/ProviderService*`.
- T3 native action boundary: new `apps/server/src/nativeDesktop/**`,
  new `apps/desktop/src/nativeDesktop/**`, existing desktop `main.ts`,
  `preload.ts`, Electron foreground helpers and snapshot accessibility helpers
  only as needed for reviewed native capability wiring. No unrelated UI changes.
- MCP capabilities/tool registration: `apps/server/src/mcp/McpInvocationContext*`,
  `McpSessionRegistry*`, `McpHttpServer*`, new native toolkit files under `mcp/`.
- Typed contracts: new harness/native schemas, exports, `rpc.ts`,
  `environmentHttp.ts`, `desktop.ts`, `nativeApi.ts`, `settings.ts` and paired
  focused tests only where an existing wire must be extended.
- Narrow service-scope correction recorded before implementation in
  `HARNESS-005-service-scope.md`: `packages/contracts/src/auth.ts` and paired
  tests for a dedicated bridge execute scope. Permission grants remain human
  access administration and are never delegated to this service credential.
- Narrow persisted turn-evidence seam recorded before implementation in
  `HARNESS-005-turn-evidence-scope.md`: `packages/contracts/src/orchestration.ts`,
  `apps/server/src/orchestration/Layers/ProjectionSnapshotQuery.ts` and its
  paired test, to expose the existing start-message association only. No new
  table, migration, event or transition.
- Provider secret protection: `apps/server/src/auth/ServerSecretStore*` and
  new OS-protection helpers under `nativeDesktop/`; new references only. Do not
  copy/migrate installed credentials or rewrite existing provider settings.
- UI/client: existing `apps/web/src/components/universalHarness/**`, harness
  route/sidebar, `packages/client-runtime/src/state/server.ts` and relevant
  typed shared API state. Reuse existing provider/auth/model picker interfaces.
- Local launch/build: T3 `scripts/yellow-pilot*`, new `scripts/yellow-harness*`,
  existing desktop `package.json`/builder configuration only for product naming
  and local packaging, `docs/user/universal-harness.md`. Preserve MIT/provenance.
- Narrow build-fixture correction recorded in
  `HARNESS-005-desktop-typecheck-scope.md`: explicit exported return shape in
  `apps/desktop/src/updates/updatesTestHarness.ts` and its existing paired
  updater tests only. No updater behavior or dependency change.
- Native runtime display naming only in `apps/desktop/src/app/DesktopEnvironment.ts`
  and its paired test, recorded in `HARNESS-005-runtime-branding-scope.md`.
  Preserve IDs, protocol, state paths, auth and upstream provenance.
- Native driver dependency seam recorded in
  `HARNESS-005-native-driver-version-scope.md`: pin xa11y 0.15.0 in desktop
  `package.json` and generated `pnpm-lock.yaml`, with focused foreground and
  snapshot accessibility regression tests. No global installs or weaker identity.
- Synthetic retained state only beneath `D:/Yellow/harness/state-pilot`.
- Product-completion seams follow the pre-edit resolved note
  `HARNESS-005-product-completion-scope.md`: existing-workspace preparation,
  existing backlog assignment and explicit review surfaces; official hash-pinned
  upstream resource-monitor binary cache for the supported Windows packager.
- Finite registered worker integration follows the pre-edit resolved scope note
  `HARNESS-005-finite-worker-runtime-scope.md`: pinned Ed25519 identities,
  signed capacity reports, one existing coordinated turn, durable T3 proposal
  before ACK and fixed operator-owned localhost model adapter. No extra queue,
  migration, untrusted shell or real worker activation.

## Executable acceptance

1. Paperclip run → immutable linked worktree → deterministic T3 thread/command
   → acknowledged result, cancellation and failure. Effect-time ownership,
   fresh lease/budget/model quota/resource checks; cancellation and one-shot
   provider claim share the receipt journal serialization boundary. Interrupted
   or unknown work cannot replay under a fresh run identity. Source fallback is
   forbidden. Late cancellation requires positive owned-provider settlement.
2. Actual T3 engine fixtures exercise parallel isolation, restart, unavailable
   providers and ordered accepted-revision handoff. Completion is not automatic
   artifact acceptance/job closure. Reviewer personally executes this proof.
3. Official provider discovery/auth and known free/included/worker capacity;
   paid, metered, unpriced or unknown-quota fallback denied. Changing models
   starts a separate conversation with explicit accepted artifacts, not opaque
   provider resume-token transfer. Existing subscriptions do not imply API rights.
4. Finite outbound-only worker assignment/result protocol with registered worker
   identity, bounded jobs/time/bytes and no arbitrary shell/bootstrap supplied by
   an untrusted worker. Transport disconnect/restart is explicit, not success.
5. Native Windows list/observe/focus/invoke/keyboard actions use one serialized
   actuator, explicit host-bound revocable standing grant, effect-time grant and
   foreground/target identity checks, typed receipts, finite timeout and no
   mutation retry on uncertainty. Do not claim UI grants constrain full shell.
6. One UI shows jobs, agents, models/workers, run/results, cost/resource/permission
   status and usable native/provider setup. Whole-process RAM/startup measured;
   actual browser/desktop proof on owned fixtures. Local startup/stop is tracked
   and recoverable. Runnable build and concise operating instructions exist.

## Unchanged activation boundaries

No billable generation, Kaggle session start/stop, public tunnel, startup daemon,
credential copying, installed provider changes, UAC/security bypass, production
Yellow/database mutation, irreversible external action, public PR or self-merge.
Host-owned fixture activation and zero-provider test calls are permitted. Any
required real credential, spending, provider or external worker authority is a
specific founder decision, not silently inferred from "finish".

Do not claim "best in the world", finished native authority, healthy workers or
provider execution on the strength of unit tests, installed artifacts or enabled
toggles. Measure and state exact verified capability and remaining external gates.
