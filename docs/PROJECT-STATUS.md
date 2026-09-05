# Yellow project status

<!-- status-schema: yellow-project-status/v1 -->
<!-- current-phase: 7 -->
<!-- current-task: Orders 438 + 439 — consolidated operational release -->
<!-- current-order-files: handoff/orders/438-codex-consolidated-release.md;handoff/orders/439-contained-native-fiscal-release.md -->
<!-- current-lifecycle: independently reviewed operational baseline; main CI gates publication -->

This is the canonical current-state record. It identifies the consolidated source,
verified behavior, release boundaries and active work. Historical orders,
reviews, decisions and ledger entries remain evidence; their filenames are not an
active backlog. `state.sh` and `state.ps1` read the machine-readable comments above.

## Current task

**Orders 438 and 439 form one Phase 7 release task.** Order438 consolidates the
working operational application, documentation, local workflow and Git-to-cloud
release controls. Order439 contains the unapproved legacy native-fiscal capability.
Both have independent approval at the exact source recorded below. Codex
owns implementation and coordination and may use internal models as bounded builders
or independent reviewers. There is no operational dependency on another vendor or
person for ordinary development.

## Source and release truth

| Surface | Verified baseline | Release boundary |
|---|---|---|
| Source and integration | This revision consolidates the operational application and PR80 history through `6a7cd8a4`; `main` is the sole release branch | [PR82](https://github.com/dcpnode-maker/yellow/pull/82) records the exact reviewed integration; only successful post-merge main CI permits image publication |
| Independent acceptance | Both reviews approve operational candidate `bb3b8f933ce344f9325445dac1e6fc77d646c9de`; all five jobs in [CI33986577250](https://github.com/dcpnode-maker/yellow/actions/runs/33986577250) passed | Final receipt/status changes require review and green CI on their exact head; the earlier failed run is retained in the review history |
| GitHub work queue | All 62 PRs in the original audit are closed with exact source preservation; the working lineage is consolidated in PR82, while five unique research/worker lines remain preserved as archives | [The manifest](../handoff/CONSOLIDATION-MANIFEST.json) records each disposition; [GitHub](https://github.com/dcpnode-maker/yellow/pulls) is authoritative for the live open queue |
| Database migrations | 75 runnable migrations, 125 public tables; migration `0075` revokes the unapproved `0074` issue capability | Fresh/upgrade/no-op, default-aware ACL denial, normalized schema, compatibility suites and genuine PostgreSQL 11/11 referee passed; native issuance stays disabled |
| Local app | The complete supported launcher passed in clean CI: real database, canonical/review seeds, exact-SHA readiness, authentication and volume-preserving stop | Run [the same launcher](RELEASE.md) on the user's supported machine for `http://127.0.0.1:3000`; CI does not prove that machine has been refreshed |
| Cloud app | Main CI automatically gates immutable runtime/migration image publication | No approved host, ingress, production credential or serving URL is connected; image publication is not cloud deployment |

These rows must be updated when evidence changes. A branch, document, green unit test,
container build, merge and deployment are separate events.

## Product status

| Scope | Status | Meaning |
|---|---|---|
| Phases 0–3, 5 and 6 | Independently reviewed | Recorded review exists for their accepted scopes; later changes still need regression proof |
| Phase 4 | Built; integration review outstanding | Preserve the implementation and close its remaining integration evidence |
| Phase 7 operational flows | Consolidated and independently approved baseline | Working PMS, stay, folio, payment, approval and fiscal-support flows are preserved; source acceptance does not complete the entire phase |
| Order434 native fiscal issuance | Preserved, unfinished and unreleased | D1371 and the Order434 D1372 checkpoint include large invoice/replay, correction/transfer concurrency, tax-history and durable-delivery evidence; inverse schedules, other authority/history cases, full 0076/0077 assembly, fresh/upgrade proof and independent Tier-3 acceptance remain |
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
