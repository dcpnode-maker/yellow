# Using and developing Yellow

Yellow is an actively built multi-tenant hotel/STR ERP: TypeScript/Bun/Elysia over
PostgreSQL 16 in a modular monolith. Read [PROJECT.md](PROJECT.md) first and navigate
with [the project map](docs/PROJECT-MAP.md). Setup guidance:
[START-HERE.md](START-HERE.md) / [Windows](START-HERE-WINDOWS.md).
Read [PROJECT-STATUS](docs/PROJECT-STATUS.md) for the one current task and the exact
distinction between candidate, merged, local and cloud state.

## Current build versus the app you are running

**Recorded checkpoint: 2026-09-05.** There are 18 phases, numbered 0–17:

- Phases 0–3, 5 and 6: independently reviewed.
- Phase 4: built; final integration/review outstanding.
- Phase 7: active. Orders438/439 form one consolidated release task. Order434's
  native-fiscal work is preserved but remains unfinished and unreleased.
- Phases 8–17: planned. Founder priority is 11 → 13 → 17, subject to dependencies.

Follow [BUILD-PLAN](BUILD-PLAN.md) and [roadmap](handoff/ROADMAP.md) for later changes.
“Built,” “reviewed,” “integrated” and “running locally” are separate states. The
consolidated baseline has a green five-job CI receipt in run `33986577250` and
independent approval in Reviews438/439. That receipt applies only to the
exact SHA tested by the run; every later revision needs its own result. Use the exact
checked-out revision and current release evidence rather than an old branch or PR
description.

The [24-ID feature register](docs/FEATURE-REGISTER.md) records the expanded ecosystem,
staff/STR journeys, regions, voice, RMS and channels. A specification is not completed
functionality merely because its document exists.

## Daily development loop

1. Inspect the existing branch, commit and dirty files; preserve work.
2. Read PROJECT, the role adapter, recent decisions and the scoped order.
3. Run `./state.sh` in the supported Unix environment or `./state.ps1` natively on
   Windows. Both read the active task and phase from PROJECT-STATUS and keep legacy
   unclosed markers separate as historical record counts.
4. Implement with tests. Delegate bounded non-conflicting work to suitable models;
   one coordinator owns integration and the dependency sequence.
5. Execute proportionate checks and required database/referee gates. Record skips
   as skips. Obtain independent executed proof for high-risk changes.
6. Commit only scoped files, push the actual branch and record the actual CI result.
   Integration is independent; do not self-merge.
7. Update living documentation and status evidence. Refresh the retained local app
   only through its authorized runtime workflow and verify the serving revision.

Routine source checks, with dependencies already installed:

```bash
git status --short --branch
bun run typecheck
bun run boundaries
bun run license-check
git diff --check
```

Choose tests from the order. Do not create infrastructure merely to edit prose.
On the current Windows workstation, avoid WSL/Bun execution while its dump recurrence
is unresolved; use native tools for supported source checks and recorded environments
for database proof.

## Runtime and synthetic data

The retained app is one loopback endpoint on port 3000. Use the one launcher described
in [RELEASE](docs/RELEASE.md) and [LOCAL-REVIEW](docs/LOCAL-REVIEW.md):

```bash
./scripts/local-review.sh start
./scripts/local-review.sh status
./scripts/local-review.sh stop
```

It refuses a dirty checkout, applies the migration-75 / 125-public-table catalogue,
runs the 11/11 referee, loads the canonical synthetic seeds, builds the exact revision
and proves login plus `/ready`. The readiness receipt must contain the same 40-character
Git SHA and expected migration frontier 75. `stop` preserves the PostgreSQL volume.

The underlying `setup.sh --db-only` and `setup.ps1 -DbOnly` paths mutate development
state and recreate disposable `yellow_test`; they are database proof workflows, not
an alternative manual app launch. Never target data to preserve. Credentials stay in
protected ignored local files. Local prefill uses the real synthetic account and is
never a production credential publication mechanism.

Project status separates recorded delivery evidence from live service checks.
Database health does not establish feature completion. The status model does not
automatically fetch GitHub or rebuild the running app. Fully clickable order1-onward
history remains a requirement until its UI proof exists (YF-021).

## Troubleshooting without losing work

| Symptom | Check first |
|---|---|
| Remote documentation differs from the checkout | Compare exact Git revisions and current release evidence; do not infer state from a stale browser tab or branch name. |
| Local app differs from source | Serving process/image commit, migration ledger and runtime receipt. A push does not update a local process. |
| Invalid local login | Approved synthetic account and protected prefill configuration agree; do not expose secrets or bypass authentication. |
| Port already in use | Identify the owner and reuse the retained runtime or its approved restart procedure. |
| Database tests skipped | The required environment was not exercised. Record the gap and execute the scoped proof in its approved environment. |
| Schema count differs from an old guide | Exact migration frontier/catalogue. Never delete schema or weaken checks to match the 80/81-table baseline. |
| Drive fills or files lock | Exact owners, dumps and caches; preserve Git history, active work, dependencies and live disks. |
| Vendor API/model unavailable | Defined provider boundary and supported fallback; external access/spending still needs authority. |

## Durable handoff to any developer or AI

Give the next maintainer a source commit plus PROJECT, project map, feature register,
current phase/order, contracts and proof. Read decisions before re-deciding a topic.
Historical orders and reviews are evidence, not files to rewrite as if a new design
existed when an earlier proof ran.

The original [UI specification](docs/UI-SPEC.md), [domain model](docs/DOMAIN-MODEL-V1.md),
[AI architecture](docs/AI-ARCHITECTURE.md) and [extensions](docs/EXTENSIONS.md) connect
current design to existing responsibilities. Keep one requirement index and link it;
do not paste every chat or duplicate all requirements in every source file. Never
export guest data, secrets, local authority, model weights or live disks into Git or
an external AI conversation.

Use [AGENTS.md](AGENTS.md), [workflow](docs/WORKFLOW.md) and [roster](handoff/ROSTER.md)
for ownership/model routing. Codex owns and coordinates implementation; qualified
internal non-implementers execute high-risk review. Use faster models for suitable
bounded work and the strongest available reasoning for foundations.
