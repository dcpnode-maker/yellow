# HARNESS-001 — controller execution foundation

Status: REVIEW COMPLETE; PROTOTYPE REPAIRS DEFERRED PENDING FORK INTEGRATION.
Phase 0 development tooling only. No controller implementation changed.
Branch: `phase-0/harness-app`. Base: `c8cb60ada0e0f8aa981c04948a42adf94cc169e1`.

## Founder direction and isolation

On 28 September 2026 the founder expanded the architecture review into building
a personal Windows-first, open-source-derived harness. It must retain a
Codex/Claude-class workflow and connect Codex GPT, Gemini keys, Antigravity,
Kaggle and later cloud workers, in parallel or rotation. Research beyond the
initial candidate list; reuse a maintained product instead of writing a new
agent loop/UI. Routine actions use standing scoped grants, not repeated prompts.
This does not authorize paid calls, provider-limit evasion, credential export,
UAC bypass, external publication or mutation of unrelated laptop processes.

Use the isolated `harness-app` worktree. Preserve the GPU Worker 2 lane, dirty
canonical checkout and all D:/Yellow work. Numeric orders collide across local
lineages; this tooling series uses the HARNESS namespace. Prior Orders 738,
741, 744 and 745 in the D: checkout are evidence to inspect, not completed work
to assume or dirty code to import. Existing one-coordinator/one-writer rules
remain: parallel workers have disjoint isolated scopes; integration is serialized.

## Scope

- This order.
- `tools/yellow-harness/controller.py`, `test_controller.py`, `README.md`.
- `tools/yellow-harness/continuity-bridge/adapter.py`, `test_adapter.py`.
- New `tools/yellow-harness/review/**` architecture/research/receipts only.
- `handoff/reviews/HARNESS-001-controller-execution-foundation.md`.
- Append-only `DECISIONS.log` and `handoff/LEDGER.md` entries for this order.

## Required first slice

The following are activation requirements retained from the audited prototype.
Broader upstream research identified a complete application with its own durable
orchestration. Apply these requirements to the selected integration instead of
building two competing schedulers. HARNESS-002 admits the upstream source pilot.

1. Harden Windows path identity and output reservations: reject Git metadata,
   alternate data streams, reserved devices, trailing dot/space aliases, escaping
   reparse/symlink paths and ancestor/descendant collisions. Case-insensitive
   reservation comparisons must be deterministic on all test hosts.
2. Add explicit cancellation and a public current-lease validation method. A
   cancelled attempt may not heartbeat, dispatch a provider call or complete.
   Preserve existing proposal immutability, valid idempotency and atomic claims.
   Version/migrate the local SQLite schema safely; never touch Yellow business DBs.
3. Bridge checks current lease immediately before each provider dispatch and after
   response, extends an active lease within a bounded run deadline, and fails
   closed on expiry/cancellation. Test stale/reclaimed workers make zero calls.
   State accurately that an already dispatched external call cannot be recalled;
   a future common broker is required to serialize all effect authorization.
4. Keep pure proposal receipt separate from acceptance/integration. Retain the
   approved immutable base in receipts and require changed-base tasks to be
   rejected or marked stale before work. No automatic source integration.
5. Add hostile regression tests alongside changes. Existing controller/bridge and
   continuity tests pass offline. No provider/OS/Kaggle calls in acceptance.

## Gates and exclusions

No upstream dependency install, model call, remote worker enrollment, privileged
execution, global configuration edit, hospitality source/SQL/runtime change,
publication, PR or merge in this order. Fork adoption and a usable application
are subsequent bounded orders, not claimed by this slice. The non-implementing
reviewer personally runs the relevant tests and records remaining limits.
