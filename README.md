# Yellow — hospitality operating system

Yellow is an actively implemented, tenant-scoped hotel and STR platform: PMS,
bookkeeping and cashier finance, stay operations and fiscal compliance, with planned
channel management, booking engine/CRS, CRM, multilingual voice, RMS and hotel interfaces.
The domain core is a TypeScript/Bun/Elysia modular monolith over PostgreSQL 16.
Use open-source infrastructure, measured latency and replaceable integrations rather
than speculative rewrites or a separate app fork for every country.

## GitHub checkout and schema count

This is an existing Bun project. Clone or open the repository, then install the locked
dependency graph with `bun install --frozen-lockfile`. Do **not** run `bun init`: that
command scaffolds package metadata, while this repository already has the authoritative
[`package.json`](package.json) and [`bun.lock`](bun.lock).

| Source line | Exact commit | Runnable migrations | Public base tables | Acceptance state |
|---|---|---:|---:|---|
| Reviewed `main` | [`b5ef70842b658183f7b5b4c650c8e78c7a0b513d`](https://github.com/dcpnode-maker/yellow/commit/b5ef70842b658183f7b5b4c650c8e78c7a0b513d) | 77 | 127, including `schema_migration` | [PR85](https://github.com/dcpnode-maker/yellow/pull/85) independently merged the consolidated work; all five jobs in [CI187](https://github.com/dcpnode-maker/yellow/actions/runs/34000319799) passed, including database acceptance23/23, issued-wire4/4 and referee11/11 |
| Earlier operational baseline | [`5879e2b719db18077e00556477ba34bdb9b9991c`](https://github.com/dcpnode-maker/yellow/commit/5879e2b719db18077e00556477ba34bdb9b9991c) | 75 | 125, including `schema_migration` | Historical PR82 release; later forward migrations preserve this history |

The historical **80** is the number of application tables declared by immutable
`migrations/0001_init.sql`. The migration runner creates the ledger as table 81, and
later forward migrations expand the catalogue. Migration 76 in reviewed main
adds two tables; migration 77 adds no table. See the [schema guide](docs/SCHEMA-GUIDE.md)
for definitions, arithmetic and read-only catalogue queries. A source count does not
prove that an existing local or cloud database has applied those migrations.

## Start with the actual project

Read [PROJECT.md](PROJECT.md), your [role adapter](AGENTS.md), then
[current project status](docs/PROJECT-STATUS.md) and
[the project map](docs/PROJECT-MAP.md). The [feature register](docs/FEATURE-REGISTER.md)
maps the founder's current requirements to phases, design, existing source and
remaining acceptance work. [START-HERE.md](START-HERE.md),
[Windows setup](START-HERE-WINDOWS.md) and [USAGE.md](USAGE.md) describe working on
this existing repository—not creating another package or database.

**Consolidated baseline: 2026-09-05.** Orders438/439 bring the operational application,
current project records and repeatable local setup into one Codex-owned release in
[PR #82](https://github.com/dcpnode-maker/yellow/pull/82). Independent reviewers verified
all five CI jobs, including the real database and complete local launcher. All 62 PRs
in the original audit have recorded closure and source-preservation evidence.
Use reviewed `main` for the app and [RELEASE](docs/RELEASE.md) to start or update it.
[PROJECT-STATUS](docs/PROJECT-STATUS.md) distinguishes source acceptance, merge, the
user's local runtime and cloud deployment. No cloud host is connected yet.

## Guest and staff journeys — Astra review

Order440 connects the hotel guest lifecycle to work across FO, HK, finance, sales,
banquets, F&B, spa, engineering, concierge, security, stores and management.

- [Independent findings](docs/research/HOTEL-OPERATIONS-REVIEW.md)
- [Hospitality UX benchmark](docs/research/HOSPITALITY-UX-BENCHMARK.md) and [UI/UX direction](docs/design/UIUX-DIRECTION.md)
- [App name shortlist](docs/research/APP-NAME-SHORTLIST.md) — preliminary, no rename yet
- [Guest and department journeys](docs/design/STAFF-JOURNEYS.md)
- [16 synthetic case studies](docs/design/HOTEL-CASEBOOK.md)
- [Interactive workbench and local viewing instructions](docs/design/STAFF-WORKBENCH-SPEC.md)

**Order442 UI candidate:** Calm Workbench, Precision Desk and Service Timeline are
three selectable workspace skins around the same mounted controls. Profile-card
design applies to guest and staff/management identities. The fictional study adds
generated example portraits; production does not attach those portraits to real
people. This candidate requires rendered visual review before release; see the
[current QA record](design-qa.md). Skin selection is page-session only, matching
the existing no-browser-storage policy.

The prototype has 16 department views and 14 playable fictional scenarios. It is a
reviewable design inside this repository; the main hotel's domain commands and
future-phase acceptance remain authoritative. This work is part of the same Codex
Yellow task, with no separate development owner or app backend.

## Current build snapshot

The roadmap has **18 phases, numbered 0–17**:

| Phases | Recorded state |
|---|---|
| 0–3, 5, 6 | Independently reviewed |
| 4 | Built; final integration/review outstanding |
| 7 | Active; Order434 native fiscal source approved and merged; provider/operator completion remains |
| 8–17 | Planned |

Order430 was rejected for incomplete canonical provenance (D1323).
[Order434](handoff/orders/434-native-fiscal-source-completion.md) completed the governed native source repair and merged through PR83. Forward
migration0075 still contains the rejected legacy capability; reviewed0076/0077 add
the new source path. Main integration does not claim IRP provider activation or a
refreshed hotel runtime. Founder priority is
**11 → 13 → 17**, subject to mandatory dependencies. From the active phase:
`7 → 8 → 9 → 10 → 11 → 12 → 13 → 17 → 14 → 15 → 16`.

[BUILD-PLAN.md](BUILD-PLAN.md) owns phase definitions;
[ROADMAP.md](handoff/ROADMAP.md), [decisions](DECISIONS.log) and
[ledger](handoff/LEDGER.md) carry current execution evidence.
[The recorded app status model](src/project-status.ts) is not a live GitHub query;
its per-order prose can lag later decisions until a scoped status update.
Neither it nor a filename is proof that a local process has the latest build.

## Current product direction in the original specifications

| Area | Original specification and detailed implementation destination |
|---|---|
| Hotel and STR workspaces; reservations, arrivals, room readiness and checkout coordination | [UI specification](docs/UI-SPEC.md), [domain model](docs/DOMAIN-MODEL-V1.md), [staff journeys](docs/design/STAFF-JOURNEYS.md) |
| Cashiering, immutable corrections, folio windows, payer separation and authorized post-seal actions | [Contracts](docs/CONTRACTS.md), [state machines](docs/STATE-MACHINES.md), [events](docs/EVENTS.md) |
| Apple, Android/Pixel, Win95/98, glass, neo and ERP materials with contextual disclosure | [Design](docs/DESIGN.md), [UI specification](docs/UI-SPEC.md) |
| Multilingual voice answers and role-bound workflow actions; explainable room recommendations | [AI architecture](docs/AI-ARCHITECTURE.md), [voice/RMS plan](docs/architecture/VOICE-RMS-PLAN.md) |
| Revenue/profit forecasting, STR revenue workbench, permitted market signals and OTA visibility | [Voice/RMS plan](docs/architecture/VOICE-RMS-PLAN.md), [OTA connectivity](docs/integrations/OTA-CONNECTIVITY.md) |
| Lightweight country/region/locality/property preferences, Arabic/RTL and local distribution | [Extensions](docs/EXTENSIONS.md), [regional packs](docs/architecture/REGIONAL-PACKS.md) |
| Durable developer/AI handoff, order/phase traceability and one repository lineage | [Project map](docs/PROJECT-MAP.md), [feature register](docs/FEATURE-REGISTER.md) |

These are linked requirements and designs, not a claim that all workflows, native
appearances, providers, voice or RMS are implemented. Preserve the distinction
between a located foundation and the complete requested experience. The design
direction allows different layouts; the existing runtime's global
Simple/Advanced/Expert selector is not the final contextual-disclosure design.

## Source, architecture and evidence

- [PROJECT.md](PROJECT.md) is the canonical constitution; [AGENTS.md](AGENTS.md) and
  [CLAUDE.md](CLAUDE.md) are role adapters, not competing constitutions.
- [migrations/0001_init.sql](migrations/0001_init.sql) is the immutable **80-table,
  13-context baseline**. The migration runner adds its ledger; later forward migrations
  expand the schema. **13 contexts is not 13 phases**, and 81 is not today's table census.
  Use the [schema guide](docs/SCHEMA-GUIDE.md) for the branch-specific catalogue.
- [src/contexts](src/contexts), [kernel](src/kernel), [contracts](docs/CONTRACTS.md),
  [events](docs/EVENTS.md) and [security](docs/SECURITY.md) define executable boundaries.
- [Orders](handoff/orders), [reviews](handoff/reviews), decisions and ledger preserve
  exact scope, findings and proof. Historical records are not rewritten to look new.
- [Tests](tests), [dependency policy](docs/DEPENDENCIES.md), [lockfile](bun.lock) and
  [CI](.github/workflows) provide reproducible checks. Database skips are not passes.
- [Research](docs/research/README.md) separates historical findings, dated public-source
  research and proposed capability. The September
  [PMS/STR benchmark](docs/research/STAFF-STR-ECOSYSTEM-2026-09.md) includes public
  Oracle/Beds24 material; it does not claim copied proprietary code or assets.

## Development and local review

Use the existing checkout. Before starting services, read the platform setup guide
and identify the retained runtime. Unix `./setup.sh --db-only` migrates development
data and recreates disposable `yellow_test`; it is a mutating proof workflow, not
a read-only health command. The required invariant referee is **11 passed, 0 failed**.
Full setup also starts/verifies the app; a current serving-source receipt is still
required before calling the founder's local app up to date.

The desired single review URL is `http://127.0.0.1:3000`, not a live-status promise.
See [local review](docs/LOCAL-REVIEW.md) alongside its current runtime order.
Keep synthetic login-prefill credentials and database authority protected and out
of Git. Never restore deleted hotel records, duplicate stacks or erase active work
merely to make a demo available.

## Implementation and external boundaries

Codex is the sole implementation and coordination owner. It may use bounded internal
models selected by risk, cost and capability. High-risk changes require a qualified
non-implementer to execute proof personally; implementers do not self-review or
self-merge. See [workflow](docs/WORKFLOW.md) and [roster](handoff/ROSTER.md).

Provider contracts, certifications, credentials, spending and legal/business policy
remain explicit external gates. Public API documentation does not establish access.
Source-permitted market collection and approved own-extranet operations do not imply
anonymous scraping, access-control evasion, universal integrations or guaranteed OTA
ranking. Research, design and a green service check are never substitutes for an
implemented, tested and authorized customer journey.
