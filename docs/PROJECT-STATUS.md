# Yellow project status

<!-- status-schema: yellow-project-status/v1 -->
<!-- current-phase: 7 -->
<!-- current-task: Order 434 — native fiscal completion on the consolidated baseline -->
<!-- current-order-files: handoff/orders/434-native-fiscal-source-completion.md -->
<!-- current-lifecycle: building and verifying candidate migrations 76/77; native issuance unreleased -->

This is the canonical current-state record. It identifies the consolidated source,
verified behavior, release boundaries and active work. Historical orders,
reviews, decisions and ledger entries remain evidence; their filenames are not an
active backlog. `state.sh` and `state.ps1` read the machine-readable comments above.

## Current task

**Order434 is the current Phase7 development task.** The operational baseline from
Orders438/439 merged through PR82 as main5879e2b719db18077e00556477ba34bdb9b9991c.
All five main CI jobs in33987884230 and image publication33988185696 succeeded.
Development additionally preserves D1373 checkpoint7249b27 and integrates the
reviewed release source at96b808d. Neither development checkpoint is a deployed
native-fiscal release. Development now contains the complete 77-migration candidate
and its derived 127-table schema snapshot. The full migration suite passed 41/41,
including production-75 upgrade, rollback, checksum protection and fresh-install
equivalence. Whole native-fiscal acceptance remains in progress. Question195 records
the numbering, scope and strict separation from the retained hotel database.

Order438 consolidates the
working operational application, documentation, local workflow and Git-to-cloud
release controls. Order439 contains the unapproved legacy native-fiscal capability.
Both have independent approval at the exact source recorded below. Codex
owns implementation and coordination and may use internal models as bounded builders
or independent reviewers. There is no operational dependency on another vendor or
person for ordinary development.

## Source and release truth

| Surface | Verified baseline | Release boundary |
|---|---|---|
| Source and integration | Operational main `5879e2b7` contains PR80 history through `6a7cd8a4` plus reviewed Orders438/439; `main` is the sole release branch | [PR82](https://github.com/dcpnode-maker/yellow/pull/82) merged; subsequent native candidate work is not yet merged or released |
| Independent acceptance | Both reviews approve operational candidate `bb3b8f933ce344f9325445dac1e6fc77d646c9de`; all five jobs in [CI33986577250](https://github.com/dcpnode-maker/yellow/actions/runs/33986577250) passed | Final receipt/status changes require review and green CI on their exact head; the earlier failed run is retained in the review history |
| GitHub work queue | All 62 PRs in the original audit are closed with exact source preservation; the working lineage is consolidated in PR82, while five unique research/worker lines remain preserved as archives | [The manifest](../handoff/CONSOLIDATION-MANIFEST.json) records each disposition; [GitHub](https://github.com/dcpnode-maker/yellow/pulls) is authoritative for the live open queue |
| Released database | Main retains 75 migrations and 125 public tables; migration `0075` revokes the unapproved legacy issue capability | Released fresh/upgrade/no-op, ACL denial, normalized schema, compatibility and genuine 11/11 referee passed; native issuance stays disabled |
| Development database | Candidate migrations `0076`/`0077` are assembled in source; actual fresh catalogue has 127 tables and exactly matches the derived snapshot | Migration tests passed 41/41; full native/legacy and independent acceptance are not yet complete. No retained hotel database was migrated |
| Local app | The complete supported launcher passed in clean CI: real database, canonical/review seeds, exact-SHA readiness, authentication and volume-preserving stop | Run [the same launcher](RELEASE.md) on the user's supported machine for `http://127.0.0.1:3000`; CI does not prove that machine has been refreshed |
| Cloud app | [Main CI33987884230](https://github.com/dcpnode-maker/yellow/actions/runs/33987884230) and [image publication33988185696](https://github.com/dcpnode-maker/yellow/actions/runs/33988185696) succeeded for `5879e2b7` | No approved host, ingress, production credential or serving URL is connected; image publication is not cloud deployment |

These rows must be updated when evidence changes. A branch, document, green unit test,
container build, merge and deployment are separate events.

## Product status

| Scope | Status | Meaning |
|---|---|---|
| Phases 0–3, 5 and 6 | Independently reviewed | Recorded review exists for their accepted scopes; later changes still need regression proof |
| Phase 4 | Built; integration review outstanding | Preserve the implementation and close its remaining integration evidence |
| Phase 7 operational flows | Consolidated and independently approved baseline | Working PMS, stay, folio, payment, approval and fiscal-support flows are preserved; source acceptance does not complete the entire phase |
| Order434 native fiscal issuance | Actively integrating; unfinished and unreleased | D1373 concurrency cases are preserved. The complete `0076`/`0077` candidate is now in the development runner with its derived catalogue. Production-75 upgrade, rollback/checksum and fresh equivalence passed; native, legacy and independent full-outcome acceptance continue |
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
