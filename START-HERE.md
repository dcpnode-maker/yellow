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
```

**Publication checkpoint, 2026-09-05:** GitHub's default `main` still holds the older
integrated baseline. Current development is on
[the Phase-7 branch](https://github.com/dcpnode-maker/yellow/tree/phase-7/persisted-india-final-component-tax-evidence)
and [PR #80](https://github.com/dcpnode-maker/yellow/pull/80).
A clone of `main` does not contain every development feature. Select the task's
source ref only after checking its order and preserving existing uncommitted work.
Do not reset, replace the default branch or merge unapproved code to hide the gap.

## 2. Read the canonical entry points

1. [PROJECT.md](PROJECT.md): constitution, invariants and boundaries.
2. Your role adapter: [AGENTS.md](AGENTS.md) or [CLAUDE.md](CLAUDE.md).
3. [Project map](docs/PROJECT-MAP.md) and [feature register](docs/FEATURE-REGISTER.md).
4. The current phase in [BUILD-PLAN.md](BUILD-PLAN.md), scoped
   [order](handoff/orders), recent [decisions](DECISIONS.log) and
   [ledger](handoff/LEDGER.md).

Run the session inventory in the supported shell:

```bash
./state.sh
```

At this documentation checkpoint the historical-open-order parser can report an
inflated count and the highest phase mentioned in an old order. Reconcile it with
the latest decision and current order; that one number is not a completion oracle.
On Windows, use the native report described in the Windows guide.

The roadmap has **18 phases (0–17)**. The architecture still has **13 bounded
contexts**. The first migration's 80 tables plus migration ledger are an immutable
historical baseline, not the current schema census.

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

Codex owns implementation and coordination. Use capable models for foundations and
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
| Current requirements | [Feature register](docs/FEATURE-REGISTER.md) |
| Staff/STR journeys | [UI specification](docs/UI-SPEC.md), [staff journeys](docs/design/STAFF-JOURNEYS.md) |
| Domain, API and events | [Domain model](docs/DOMAIN-MODEL-V1.md), [contracts](docs/CONTRACTS.md), [events](docs/EVENTS.md) |
| AI, voice and RMS | [AI architecture](docs/AI-ARCHITECTURE.md), [voice/RMS plan](docs/architecture/VOICE-RMS-PLAN.md) |
| Regional and OTA design | [Extensions](docs/EXTENSIONS.md), [regional packs](docs/architecture/REGIONAL-PACKS.md), [OTA plan](docs/integrations/OTA-CONNECTIVITY.md) |
| Decisions and proof | [Decisions](DECISIONS.log), [orders](handoff/orders), [reviews](handoff/reviews), [ledger](handoff/LEDGER.md) |

Partner onboarding can be prepared in parallel but needs appropriate external
authority. A public API page does not establish approved OTA, IRP/GSP, ZATCA or UAE
ASP access. No documentation milestone is a feature, certification or release receipt.
