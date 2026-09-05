# Yellow project status

<!-- status-schema: yellow-project-status/v1 -->
<!-- current-phase: 7 -->
<!-- current-task: Order 440 — durable fiscal submission and reconciliation -->
<!-- current-order-files: handoff/orders/440-fiscal-submission-lifecycle.md -->
<!-- current-lifecycle: private provider-neutral contract accepted; durable integration in progress; no provider or runtime activation -->

This is the canonical current-state record. It identifies the consolidated source,
verified behavior, release boundaries and active work. Historical orders,
reviews, decisions and ledger entries remain evidence; their filenames are not an
active backlog. `state.sh` and `state.ps1` read the machine-readable comments above.

## Current task

**Order440 is the current Phase7 development task.** The operational baseline from
Orders438/439 merged through PR82 as main5879e2b719db18077e00556477ba34bdb9b9991c.
The accepted Order434 candidate is92346674c784b552356934e168d60e4b9650497a;
PR83 CI33993977811 passed all five jobs and merged as443e3826b47025106d1829fcbb406ce6302fbbba.
Neither the candidate nor the merge is a deployed native-fiscal release. Development
contains the complete 77-migration candidate and its derived 127-table schema
snapshot. The full migration suite passed 41/41,
including production-75 upgrade, rollback, checksum protection and fresh-install
equivalence. Independent native acceptance now passes all six suites (116 tests),
the 11-invariant referee, canonical database acceptance (23 tests) and exact schema
comparison. Consolidated Tier-3 inspection has no unresolved findings and the reviewer
discharged its conditional approval against PR83. Question195 records the numbering,
scope and strict separation from the retained hotel database.

Order440's subsequent private issued-wire candidate is now independently verified:
10 unit tests and4 genuine-issued PostgreSQL tests pass, including all three supported
GST component combinations, two-tenant source isolation and exact unchanged financial
rows. It verifies the immutable source hash and derives a distinct deterministic wire
hash without floating-point money conversion. Canonical0077's issued content already
includes the Qty1.000/UnitOTH compatibility pair; the ordinary intermediate candidate
does not. Q197 corrects the earlier description and limits this work to a private,
uncertified projection. Durable submission writers, delivery/reconciliation and live
provider evidence remain unfinished. The new required CI proof is wired but has not
yet run on this revision. The prior440/441 checkpoint13737a7 passed all five jobs in
CI33996041604 and is under PR85; neither result refreshes the founder's local app.

CI33992123191 at6bb7ba6 passed four of five jobs, including the real local launcher.
Its database job passed migration41/41, native116/116, containment/readiness7/7 and
operational/tax compatibility89/89 before four stale catalogue expectations failed.
Those exact assertions are repaired and independently pass23/23. D1375 records the
proof and failure history. PR83 is the subsequent exact-head green CI receipt; the
earlier failed run remains historical evidence and is not current acceptance.

Order438 consolidates the working operational application, documentation, local
workflow and Git-to-cloud release controls; Order439 is the highest completed order
identifier and contains the rejected legacy fiscal capability through migration0075.
Both have independent approval at
the exact source recorded below. Codex
owns implementation and coordination and may use internal models as bounded builders
or independent reviewers. There is no operational dependency on another vendor or
person for ordinary development.

## Source and release truth

| Surface | Verified baseline | Release boundary |
|---|---|---|
| Source and integration | Accepted Order434 source `92346674c784b552356934e168d60e4b9650497a` is incorporated by merged PR83 commit `443e3826b47025106d1829fcbb406ce6302fbbba`; Order440 remains private integration work | No provider, runtime or cloud activation is claimed; the current work is not Phase-7 completion |
| Independent acceptance | Order434 review and [PR83 CI33993977811](https://github.com/dcpnode-maker/yellow/actions/runs/33993977811) passed native116/116, migrations41/41, compatibility89/89, catalogue23/23, exact schema and referee11/11 | Order440's private Lane A contract is independently approved; durable integration requires its own review and proof |
| GitHub work queue | All 62 PRs in the original audit are closed with exact source preservation; the working lineage is consolidated in PR82, while five unique research/worker lines remain preserved as archives | [The manifest](../handoff/CONSOLIDATION-MANIFEST.json) records each disposition; [GitHub](https://github.com/dcpnode-maker/yellow/pulls) is authoritative for the live open queue |
| Main database source | PR83 brings main to77 migrations and127 public tables; immutable0075 still revokes the rejected legacy entry point, while accepted0076/0077 implement the replacement | Exact-candidate fresh/upgrade/schema/native/ACL and referee proof passed; source integration does not migrate any retained hotel database |
| Development database | The isolated synthetic77/127 catalogue exactly matches the derived main schema; Order440 has no additional database migration | Independent migration41/41, native116/116, catalogue23/23 and referee11/11 plus final PR83 CI passed. No retained hotel database was migrated |
| Local app | The complete supported launcher passed in clean CI: real database, canonical/review seeds, exact-SHA readiness, authentication and volume-preserving stop | Run [the same launcher](RELEASE.md) on the user's supported machine for `http://127.0.0.1:3000`; CI does not prove that machine has been refreshed |
| Cloud app | Main CI33994717854 and image publication33995471357 succeeded at443e3826; immutable runtime and migration amd64 tags were published for that SHA with frontier77 | The reviewer personally read successful publication logs, but registry digests were not retrieved. No approved host, ingress, production credential or serving URL is connected; image publication is not deployment |

These rows must be updated when evidence changes. A branch, document, green unit test,
container build, merge and deployment are separate events.

## Product status

| Scope | Status | Meaning |
|---|---|---|
| Phases 0–3, 5 and 6 | Independently reviewed | Recorded review exists for their accepted scopes; later changes still need regression proof |
| Phase 4 | Built; integration review outstanding | Preserve the implementation and close its remaining integration evidence |
| Phase 7 operational flows | Consolidated and independently approved baseline | Working PMS, stay, folio, payment, approval and fiscal-support flows are preserved; source acceptance does not complete the entire phase |
| Order434 native fiscal issuance | Native acceptance passed; merged and unreleased | Real source-to-invoice, tax-only accounting, immutable replay, concurrency, tenant isolation, maximum bounds and migration proofs pass; provider registration and runtime activation remain separate |
| Order440 durable fiscal submission | Private state contract and issued-wire projection accepted; durable integration in progress | State reducer and genuine-issued projection proof pass; durable persistence, reconciliation, authenticated provider normalization, runtime activation and live sandbox evidence remain outstanding |
| Phases 8–17 | Planned | Requirements and architecture are retained; documentation is not shipped behavior |

The roadmap contains **18 phases, numbered 0–17**. The founder's highlighted feature
priority remains **11 → 13 → 17**, with mandatory dependencies. From the active phase,
the executable sequence is `7 → 8 → 9 → 10 → 11 → 12 → 13 → 17 → 14 → 15 → 16`.

## Preserved product destination

The consolidation keeps the full hospitality OS goal from the founder conversation:

- complete hotel and STR operations, native finance, distribution, booking/CRS, CRM,
  RMS, groups/events, outlets and hotel interfaces;
- one governed command and query layer shared by screens, chat, voice and automation,
  with role/property scope, exact approvals, idempotency and audit receipts;
- simple interfaces that reveal detail in context, with distinct, task-tested design
  families and layouts appropriate to desktop, tablet, phone and watch;
- local-first or low-cost components where measurements support them, replaceable AI
  and provider adapters, deterministic execution for established workflows, and more
  capable models reserved for research, ambiguity and hard development work;
- PostgreSQL authority for tenancy, inventory, money, business date and durable facts,
  with no claim of zero cost or unmeasured latency/performance superiority.

The independent analysis behind these choices is recorded in
`docs/research/ASTRA-TAKEOVER-REVIEW.md`. Capability claims require executable or
measured evidence; model benchmark results do not waive Yellow's review gates.

## Updating this record

Update the four machine-readable fields and the relevant table rows in the same
reviewed change whenever the active task, phase or lifecycle changes. Record the exact
commit, image digest and deployed target in release evidence rather than editing
historical orders. Append decisions and ledger entries; never rewrite their history.
