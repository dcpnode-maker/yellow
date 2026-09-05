# Start here: Yellow for developers and AI agents

**Updated:** 2026-09-05 · Orders438/439 consolidated release.
This is a navigation guide, not a second constitution.

Yellow is a modular hospitality ERP built with strict TypeScript, Bun, Elysia and
PostgreSQL. Keep one domain core with distinct hotel and STR experiences, optional
regional packs and integrations. Do not rewrite the core or invent a programming
language just to claim speed: profile first and improve the measured bottleneck.

The existing architecture has 13 bounded contexts; the delivery plan has 18 phases
(0–17). The immutable 80-table baseline and the current additive migration catalogue
are different counts. None of these numbers alone measures product completion.

Current work is the paired [Order438](../handoff/orders/438-codex-consolidated-release.md)
and [Order439](../handoff/orders/439-contained-native-fiscal-release.md) release task.
[PROJECT-STATUS](PROJECT-STATUS.md) records its exact lifecycle. Order434's native
invoice work is preserved but unfinished and unreleased. The operational baseline
and supported local launcher passed independent CI proof; IRP, Phase7 completion,
the user's own local refresh and cloud deployment require their separate evidence.

## First ten minutes

1. Read [PROJECT.md](../PROJECT.md), [PROJECT-STATUS](PROJECT-STATUS.md), then the
   applicable [AGENTS.md](../AGENTS.md).
2. Run `git status --short`, `git branch --show-current`, `git worktree list` and
   the native state report: `.\state.ps1` on Windows, `./state.sh` in the configured
   POSIX environment. Use native Windows tools while the documented WSL Bun
   crash-dump recurrence is unresolved. Do not print environment files or credentials
   to diagnose configuration; interpret the report with the caveat below.
3. Read the relevant phase in [BUILD-PLAN.md](../BUILD-PLAN.md), the current scoped
   order in [handoff/orders](../handoff/orders/), and recent decisions/ledger entries.
   Search `rg -n -i "topic" DECISIONS.log` before making a new decision.
4. Find the requested YF ID in [FEATURE-REGISTER.md](FEATURE-REGISTER.md), then follow
   its design, contract, code and evidence links. A model need not ingest every old
   test log to work on one bounded task.
5. Establish a baseline with the relevant commands below. Record skipped database
   tests as skipped, not as successful integration verification.

### State-report source

[state.sh](../state.sh) and [state.ps1](../state.ps1) read the explicit current phase,
task, lifecycle and order files from PROJECT-STATUS. They report files lacking the
legacy `## MERGED` heading only as a historical-record count. A large historical
count does not create active implementation work. Update PROJECT-STATUS through a
reviewed change when the task or lifecycle changes.

## Authoritative map

| Question | Read here |
|---|---|
| What must never change? | [PROJECT.md](../PROJECT.md): tenancy, occupancy, money, immutable records, business dates and atomic outbox |
| What has the founder requested? | [Feature register](FEATURE-REGISTER.md) → [18-phase plan](../BUILD-PLAN.md) → [decisions](../DECISIONS.log) |
| What is current right now? | [PROJECT-STATUS](PROJECT-STATUS.md), then exact commits, CI and release evidence |
| What has been done or independently verified? | [Orders](../handoff/orders/), [reviews](../handoff/reviews/), [ledger](../handoff/LEDGER.md); [app status](../src/project-status.ts) is a recorded product projection |
| What can a module call? | [CONTRACTS.md](CONTRACTS.md), each context's `index.ts`, [state machines](STATE-MACHINES.md), [events](EVENTS.md) |
| How does configuration vary? | [EXTENSIONS.md](EXTENSIONS.md), [regional pack proposal](architecture/REGIONAL-PACKS.md) |
| What should staff see and do? | [Journeys](design/STAFF-JOURNEYS.md), [design atlas](DESIGN.md), [UI specification](UI-SPEC.md) |
| Why this direction? | [Current research](research/STAFF-STR-ECOSYSTEM-2026-09.md), [research archive](research/README.md); vendor claims are not implementation proof |
| Where are OTA, voice and RMS contracts proposed? | [OTA](integrations/OTA-CONNECTIVITY.md), [voice/RMS](architecture/VOICE-RMS-PLAN.md) |
| How do I run and contribute? | [START-HERE.md](../START-HERE.md), [Windows guide](../START-HERE-WINDOWS.md), [workflow](WORKFLOW.md), [dependencies](DEPENDENCIES.md) |

## Code navigation and responsibilities

- `src/server.ts`: composition/startup. Keep business policy out of boot code.
- `src/http/`: authenticated transport, input validation, error/response mapping;
  `operator.ts` and `operator/` are existing operator API and browser surfaces.
- `src/contexts/<context>/`: authoritative domain behavior. `index.ts` is the only
  cross-context import surface; repositories accept the caller transaction.
- `migrations/`: immutable applied history, forward-only future changes.
  `0001_init.sql` is the baseline, not the current entire schema.
- `tests/` and `tests/schema/expected.sql`: executable behavior and exact schema
  contract. `scripts/`: gates, controlled migrations/seeds and operational tooling.
- `handoff/`: bounded orders, decisions through linked logs, review evidence and
  questions. Documents link to code; comments explain *why*, not every syntax detail.

Follow existing concrete patterns before adding abstractions. Typed results and
exhaustive status unions are preferable to loosely shaped JSON. Avoid duplication,
cross-context private imports, hidden queries, catch-all success responses and
speculative plugin layers. Extract a small reusable helper only when it has a clear
contract and more than incidental similarity. Keep permission and policy enforcement
server-side even when several visual experiences call the same operation.

## Change and verification loop

`YF requirement → scoped order → contract/test → implementation → proof → review when required → CI → independent integration → runtime verification`

Record the exact base/candidate commit, files, proof commands, environment, failures,
remaining work and next safe action. Keep implementation and independent high-risk
review identities distinct. A later correction appends evidence rather than erasing
an earlier failed result. Never call a financial, migration, tenant or occupancy
change finished because unit tests alone passed.

Useful commands from the configured repository environment:

```sh
bun run typecheck
bun run boundaries
bun run license-check
bun test path/to/the/relevant.test.ts
git diff --check
```

These are a quick development loop, not a substitute for the order's full gates.
Real-database work also needs the scoped PostgreSQL proof, exact schema validation
and the canonical `./setup.sh --db-only` referee (`11 passed, 0 failed`) before PR
reviewability. Use the repository's pinned installation/CI instructions; do not run
migrations or seeds against an arbitrary existing database. Dependency installation,
local stack start and deployment are distinct from reading this guide.

## Performance: targets need measurements

Preserve existing contractual targets, including availability-search server-side
`p99 < 50 ms` in BUILD-PLAN/UI-SPEC; they are targets, not measured claims in this
guide. Report hardware, OS/browser/runtime, dataset, concurrency, query mix, cache
state and test duration alongside p50/p95/p99. Separate DB time, server time,
network time and perceived interaction; an occupancy microbenchmark does not measure
an end-to-end voice check-in or guest search.

Implementation practices to test rather than merely advertise:

- Bounded keyset pagination, tenant-leading indexes, real query plans and no N+1
  reads. Reuse a transaction-consistent snapshot instead of repeating expensive
  source validation unnecessarily; never remove required integrity checks for speed.
- Bounded pools, request timeouts, backpressure and cancellation. Measure under
  concurrent booking/posting as well as idle reads.
- Caches/projections are read accelerators with explicit freshness. PostgreSQL still
  decides sellability; money and journal truth are not eventually-consistent caches.
- Load only the active workspace, material assets, locale and required adapters.
  Heavy 3D, voice models and analytics must not block first useful PMS interaction.
- Animate transform/opacity where suitable; keep readable fallback materials and
  reduced motion. Measure dropped frames/long tasks on an ordinary staff device.
- Measure payload compressed bytes, memory, CPU, DB growth, model footprint and
  cost per useful operation. The founder has not imposed an arbitrary size ceiling,
  but unnecessary payload and duplicated data still make the experience worse.
- New dependencies need licence/maintenance review and demonstrated value. New
  languages, microservices or model training need evidence that simpler existing
  components cannot meet the requirement. No universal hardware latency guarantee.

Store benchmark commands and results beside the implementing order so future models
can reproduce them. Do not lower a failing budget or soften a test without a separately
recorded, evidence-backed decision.

## Main, development, CI and local runtime are separate states

There is one GitHub repository: `dcpnode-maker/yellow`. Orders438/439 consolidate the
PR80 development line on the release-candidate branch. Check PROJECT-STATUS and the
PR's exact published commit; a local HEAD or documentation edit is not proof of a push
or merge. `main` is not yet that candidate. A worktree shares Git history; it is not a
separate product/repository. Do not
copy files between checkouts to simulate a merge, force-reset a dirty checkout, or
delete an unintegrated worktree to make folders appear consolidated.

| State | What establishes it | What it does not establish |
|---|---|---|
| Main/default-branch contents | Exact main commit and reviewed integration | Every development feature is present, even if a main README links to it |
| Development work | Exact branch/worktree commit, scoped diff and order status | Independent approval, successful CI or deployment |
| CI | Named workflow run and its exact tested commit/results | A different commit is green, a fiscal review passed, or a local app was refreshed |
| Local runtime | Separately authorized promotion and verified commit/runtime receipt | Automatic equality with main, development, a document or a passing CI run |

After independent integration and a clean-status check, update the retained checkout
and promote the verified build to the single approved local runtime. That sync is a
separate operation with a commit/runtime receipt. No folder name, worktree link or
documentation statement proves a local app is current.

Source and non-sensitive evidence belong in Git. Credentials, hotel/guest data,
database dumps, model weights, `node_modules`, Docker disks and temporary database
clusters do not. Preserve active work before consolidation; do not synchronize live
database/virtual-disk files as source backups. See current cleanup orders before
performing any deletion.
