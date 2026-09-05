# Yellow project status

<!-- status-schema: yellow-project-status/v1 -->
<!-- current-phase: 7 -->
<!-- current-task: Orders 438 + 439 — consolidated operational release -->
<!-- current-order-files: handoff/orders/438-codex-consolidated-release.md;handoff/orders/439-contained-native-fiscal-release.md -->
<!-- current-lifecycle: candidate under implementation and independent review -->

This is the canonical current-state record. It tells a reader which source is being
integrated, what is actually released, and what work is active. Historical orders,
reviews, decisions and ledger entries remain evidence; their filenames are not an
active backlog. `state.sh` and `state.ps1` read the machine-readable comments above.

## Current task

**Orders 438 and 439 form one Phase 7 release task.** Order438 consolidates the
working operational application, documentation, local workflow and Git-to-cloud
release controls. Order439 contains the unapproved legacy native-fiscal capability
before that candidate can be integrated. Both require independent review. Codex
owns implementation and coordination and may use internal models as bounded builders
or independent reviewers. There is no operational dependency on another vendor or
person for ordinary development.

## Source and release truth

| Surface | Current candidate truth | Required next evidence |
|---|---|---|
| GitHub `main` | Older integrated application at `2e55b884`; its newer status documentation points to development work | Reviewed merge commit and post-merge CI |
| Consolidation branch | Based on PR80 development commit `ed6a07ee`; Orders438/439 are being applied here | Exact reviewed head, green required suites and reviewer verdict |
| GitHub work queue | 57 superseded or archived PRs were closed during consolidation; PRs 75, 76, 78, 79 and 80 remain, with PR80 carrying the current candidate | Preserve distinct refs/evidence and reconcile the four non-current PRs without discarding unique work |
| Database migrations | Candidate now includes proposed forward migration `0075`, which revokes the unapproved `0074` issue capability; the expected public-table census remains 125 | Fresh/upgrade/no-op proof, exact ACL denial, normalized schema and independent 125-table verification |
| Local app | A desired endpoint and historical receipts exist; this workspace does not prove the founder's retained app serves the candidate | Serving commit/build receipt, health, authentication and usable synthetic journey |
| Cloud app | No approved target, credential, immutable image digest, deployment receipt or public URL has been established | Green release workflow plus an explicitly configured target and deployment receipt |

These rows must be updated when evidence changes. A branch, document, green unit test,
container build, merge and deployment are separate events.

## Product status

| Scope | Status | Meaning |
|---|---|---|
| Phases 0–3, 5 and 6 | Independently reviewed | Recorded review exists for their accepted scopes; later changes still need regression proof |
| Phase 4 | Built; integration review outstanding | Preserve the implementation and close its remaining integration evidence |
| Phase 7 operational flows | Release candidate | PR80 contains substantial working PMS, stay, folio, payment, approval and fiscal-support flows; Orders438/439 determine release eligibility |
| Order434 native fiscal issuance | Preserved, unfinished and unreleased | D1371 includes large invoice/replay and correction/transfer concurrency evidence; inverse schedules, other authority/history cases, full 0076/0077 assembly, fresh/upgrade proof and independent Tier-3 acceptance remain |
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
