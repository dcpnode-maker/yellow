# Codex ownership and operating model

Codex is Yellow's sole development and coordination owner under the founder's
2026-09-05 directive. It owns the authoritative task, repository lineage, integration
sequence and release record. Codex may use multiple internal models for bounded build,
research and independent review work. Those workers do not create a second roadmap,
project state or release path.

## Start every session

1. Read `PROJECT.md` and `docs/PROJECT-STATUS.md`.
2. Read `AGENTS.md`, the current order and the relevant phase section of
   `BUILD-PLAN.md`.
3. Run `./state.sh` (or `state.ps1` on native Windows).
4. Inspect the exact branch, head and dirty files before modifying anything.
5. Search `DECISIONS.log` for the topic and inspect the existing code and tests.

`PROJECT-STATUS.md` is the current-state source. Orders, reviews, decisions and the
ledger preserve history. A legacy order without a `MERGED` heading is not automatically
current work.

## Internal delegation

Codex chooses a model for each bounded lane by consequence, uncertainty and cost:

| Work | Default routing |
|---|---|
| Architecture, migrations, tenancy/RLS, occupancy, money, fiscal chains and hard diagnosis | Strongest available reasoning model |
| Scoped implementation, tests, adapters and refactors | Capable implementation model |
| Documentation, inventory, static analysis and research extraction | Faster model when the scope is mechanical |
| Independent high-risk review | A model that did not implement the change and personally executes the registered proof |

One coordinator assigns non-overlapping files, integrates results and owns the final
diff. Model identity does not grant permission to approve its own implementation,
merge a PR, spend money, create accounts, use credentials or claim deployment.

## Repository and release flow

```text
current status → bounded order → branch → implementation → proof → independent review
→ pull request → integration → immutable build → configured cloud target → receipt
```

Use `phase-N/slug` branches and `[codex]` commit prefixes. Main changes only through a
reviewed PR. Keep code, tests, safe configuration examples and release provenance in
Git. Keep credentials, guest/hotel data, protected local authority, model weights,
database volumes and machine caches outside Git.

Local speed comes from the same source and build inputs used by CI. A local process is
current only when its health and build receipt name the serving commit. A Git push does
not refresh a local process, and a merged commit does not prove cloud deployment.
`docs/RELEASE.md` owns the exact build, local and cloud commands for the consolidated
baseline. `./scripts/local-review.sh` accepts `start`, `status` or `stop`; do not
recreate its seed, credential or Compose sequence manually. A valid readiness receipt
names the exact Git SHA, `yellow_runtime_database` target and expected migration
frontier 77.

## Proof and review

Run focused checks during implementation. Before a reviewable PR, run the order's full
gate, including real PostgreSQL and `./setup.sh --db-only` when required. The canonical
referee must report `11 passed, 0 failed of 11`; skipped database tests stay skips.

High-risk changes require an independent non-implementer to inspect the diff and
execute relevant proof personally. The reviewer records commands, environment, exact
commit, assertions, skips, findings and verdict. Never soften an assertion, grant or
catalogue check to manufacture green output.

## Tool and credential boundary

Project configuration intentionally launches no third-party MCP server. Use repository
scripts, local database tools and the configured Git/GitHub connection. New tools need
exact provenance, a permissive licence, a bounded credential scope and a reviewed order.
Deployment authority and runtime authority stay separate; the app never receives the
deployment DSN as a fallback. See `docs/TOOLING.md`.

Install or authenticate Codex through the user's approved environment. Do not place
tokens in tracked files, prompts, shell history examples or model conversations. No
subscription, provider or model is treated as permanently free; measure cost per
correctly completed task and keep adapters replaceable.
