# Start here — working on the existing Yellow project

Yellow is an active hospitality ERP implementation, not a Phase-0 starter package.
This guide is for a developer or AI joining the existing repository. For daily work,
use [USAGE.md](USAGE.md); Windows users should read
[the Windows guide](START-HERE-WINDOWS.md) before running shell commands.

## 1. Establish which source you are reading

Open the existing checkout. Do not unzip another copy, initialize another repository
or create a second database merely to resume work.

```bash
git status --short --branch
git log -1 --oneline
git remote -v
```

For a genuinely new machine without a checkout:

```bash
git clone https://github.com/dcpnode-maker/yellow.git
cd yellow
bun install --frozen-lockfile
```

The checkout already contains `package.json` and `bun.lock`. The command
`bun install --frozen-lockfile` installs that exact dependency graph; `bun init` would
scaffold a different project and is not a Yellow setup step.

**Consolidated baseline, 2026-09-05:** Orders438/439 unify the operational application
through [PR #82](https://github.com/dcpnode-maker/yellow/pull/82). Use a clean reviewed
`main` and [the local launcher](docs/RELEASE.md) for one app on port3000. Read
[PROJECT-STATUS](docs/PROJECT-STATUS.md) for the source acceptance and remaining
product/deployment boundaries. Preserve existing uncommitted work when updating.

## 2. Read the canonical entry points

1. [PROJECT.md](PROJECT.md): constitution, invariants and boundaries.
2. [Current project status](docs/PROJECT-STATUS.md).
3. Your role adapter: [AGENTS.md](AGENTS.md) or [CLAUDE.md](CLAUDE.md).
4. [Project map](docs/PROJECT-MAP.md) and [feature register](docs/FEATURE-REGISTER.md).
5. The current phase in [BUILD-PLAN.md](BUILD-PLAN.md), scoped
   [order](handoff/orders), recent [decisions](DECISIONS.log) and
   [ledger](handoff/LEDGER.md).

Run the session inventory in the supported shell:

```bash
./state.sh
```

The report reads its current task and phase from PROJECT-STATUS. It reports legacy
unclosed markers only as a historical-record count. On Windows, use the native report
described in the Windows guide.

The roadmap has **18 phases (0–17)**. The architecture still has **13 bounded
contexts**. The first migration's 80 tables plus migration ledger are an immutable
historical baseline, not the current schema census. Reviewed `main` at `443e3826`
has 77 migrations and 127 public base tables including the ledger. PR83 merged
Order434 after independent approval and five green CI jobs at `92346674`. The earlier
main `5879e2b7` had 75 migrations / 125 tables; that count is historical. Read [SCHEMA-GUIDE](docs/SCHEMA-GUIDE.md) before interpreting or updating
a count.

## 3. Verify the existing toolchain

Use versions pinned by [Dockerfile](Dockerfile), [bun.lock](bun.lock),
[package.json](package.json) and [requirements-ci.txt](requirements-ci.txt): Bun,
TypeScript, PostgreSQL 16 and Python for the invariant referee. Docker Compose runs
the retained development services when required. Node supports configured tools,
not a replacement application runtime. Read [dependencies](docs/DEPENDENCIES.md)
and [tooling](docs/TOOLING.md) before adding software.

```bash
git --version
bun --version
python3 --version
docker compose version
```

Do not reinstall working tools or download models for ordinary edits. Authenticate
GitHub through the configured credential manager or approved CLI flow. Never put real
tokens in tracked files, shell startup scripts, README examples or chat.

## 4. Know what setup changes before running it

On an approved development machine with the intended Compose project selected:

```bash
./setup.sh --db-only
```

The current Unix setup checks prerequisites, provisions protected local database
authority, starts configured PostgreSQL/Valkey services, applies the migration runner
to `yellow_dev`, **drops and recreates disposable `yellow_test`**, loads its
invariant fixture, runs the referee and removes the successful proof database.
It is not a read-only check. Never point it at records to preserve. Full founder
review hotel data is a separate, explicitly scoped synthetic-data workflow.

Without `--db-only`, setup also starts/verifies the app. It does not synchronize
GitHub or establish that the founder's retained app serves this commit. The exact
migration frontier belongs to the catalogue and CI, not a copied old table count.

Required invariant result:

```text
RESULT: 11 passed, 0 failed of 11
```

Record command, source commit, environment and output with the order. Database-skipped
tests are not database proof. An old green receipt is not verification of a new revision.

## 5. Work from an order, with bounded parallelism

Codex is the sole implementation and coordination owner. It may use capable internal models for foundations and
high-risk work, and faster/cheaper models for bounded routine tasks. This guide does
not mandate a vendor-specific model. Delegate non-overlapping files or read-only
analysis, retain one authoritative plan and integrate the results.

High-risk changes require a qualified non-implementer to execute relevant proof;
the implementer does not approve or merge its own change. Routine technical work
continues without founder intervention. Credentials, spending, legal/business policy,
irreversible external actions and genuinely missing intent remain founder decisions.
See [workflow](docs/WORKFLOW.md), [roster](handoff/ROSTER.md) and PROJECT.

## 6. Review the app at its verified runtime

The desired single founder-review endpoint is `http://127.0.0.1:3000`, but a written
URL is not evidence that a server is running or current. Check its serving-source
receipt, health, authentication and migration frontier first. Read
[local review](docs/LOCAL-REVIEW.md) alongside the current runtime order; its historical
multi-port and seed examples are not instructions to create duplicate stacks.

Local login prefill is explicitly configured and must match the actual synthetic
account. A missing protected file must not be replaced with invented credentials.
Do not commit local credentials or send them to another model.

## Where to go next

| Need | Source |
|---|---|
| Scope and phase status | [BUILD-PLAN](BUILD-PLAN.md), [roadmap](handoff/ROADMAP.md) |
| Schema definitions and counts | [Schema guide](docs/SCHEMA-GUIDE.md), ordered [migrations](migrations) |
| Current requirements | [Feature register](docs/FEATURE-REGISTER.md) |
| Staff/STR journeys | [UI specification](docs/UI-SPEC.md), [staff journeys](docs/design/STAFF-JOURNEYS.md) |
| Domain, API and events | [Domain model](docs/DOMAIN-MODEL-V1.md), [contracts](docs/CONTRACTS.md), [events](docs/EVENTS.md) |
| AI, voice and RMS | [AI architecture](docs/AI-ARCHITECTURE.md), [voice/RMS plan](docs/architecture/VOICE-RMS-PLAN.md) |
| Regional and OTA design | [Extensions](docs/EXTENSIONS.md), [regional packs](docs/architecture/REGIONAL-PACKS.md), [OTA plan](docs/integrations/OTA-CONNECTIVITY.md) |
| Decisions and proof | [Decisions](DECISIONS.log), [orders](handoff/orders), [reviews](handoff/reviews), [ledger](handoff/LEDGER.md) |

Partner onboarding can be prepared in parallel but needs appropriate external
authority. A public API page does not establish approved OTA, IRP/GSP, ZATCA or UAE
ASP access. No documentation milestone is a feature, certification or release receipt.
