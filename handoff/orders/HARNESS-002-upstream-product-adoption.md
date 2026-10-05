# HARNESS-002 — upstream product adoption

Status: IN PROGRESS. Phase 0 personal development tooling.
Branch: `phase-0/harness-app` for Yellow governance and integration artifacts.

## Decision and founder scope

28 September 2026: the founder requests broad internet research followed by a
real fork of an existing open-source app, retaining Codex/Claude-class coding,
parallel or rotating Codex GPT, Gemini keys, Antigravity, Kaggle and later cloud
workers, and broad Windows control with standing permissions for routine work.
The initial Goose preference is reopened after broader primary-source research.

Select T3 Code v0.0.42, Git commit
`719a76ca1dbf5490f1aa33ffb9966301e02be9a9`, as the product pilot: an MIT desktop/web
app already containing Codex, Claude, OpenCode and Antigravity agent adapters,
durable orchestration and checkpoints. This is an adoption candidate until it
builds and passes local proof. Upstream claims are not Yellow acceptance.

Use `D:/Yellow/harness/t3code` as a new, separate local source fork. It must not
touch `D:/Yellow/git-live-order611-source-v2` or existing runtimes/credentials.
E: has only about 3.3 GiB free; D: had about 14.4 GiB at preflight. Bound download
and build footprint and preserve a minimum 5 GiB free on D:.

## Scope

- This order and append-only Yellow ledger/decision entries.
- `tools/yellow-harness/review/**` for selection, proof and implementation handoff.
- Read-only public upstream acquisition into new `D:/Yellow/harness/t3code`.
- An isolated branch there named `phase-0/yellow-personal-harness`.
- Its ignored dependency/build directories, using the pinned lockfile and
  reviewed package install scripts; no global runtime/package changes.
- Isolated synthetic application state under `D:/Yellow/harness/state-pilot`.
- Read-only existing installed `codex --version/--help`, `agy --version/--help`
  and provider status metadata. No model generation or key/session extraction.

## Required result

1. Record source identity, root license, direct/transitive dependency-license
   findings, Windows build requirements and actual footprint. Preserve upstream
   notices. No wholesale combination with other frameworks.
2. Inspect provider/session/permission/orchestration contracts before configuring
   the fork. Use one source of task authority; the old Python controller is a
   regression reference, not a second active scheduler.
3. Install only required desktop/web/server dependencies from pinned manifests,
   with scripts initially disabled and any necessary scripts explicitly reviewed.
   Do not install optional model weights or a fleet of browsers/gateways.
4. Build/start the existing UI against a new synthetic state directory, bind
   loopback only, capture own process IDs, and verify actual rendered behavior.
   No public tunnel, daemon, account sign-in, provider call or live project import.
5. Record exact extension paths for worker routing, quotas and Windows tools;
   create a subsequent scoped implementation order before modifying source.

## Authority boundaries and proof

Standing routine permissions apply only within the declared workspace/tool scope.
No hidden paid fallback, quota evasion, credential copying, security-control/UAC
bypass, unrestricted Administrator runtime or irreversible external action.
The broad personal harness goal stays open until real provider/worker and device
proof; a rendered app does not close it. Preserve GPU Worker 2 and all unrelated
processes. No hospitality source, SQL, Docker, public runtime, PR or merge change.
