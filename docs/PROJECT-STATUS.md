# Yellow project status

<!-- status-schema: yellow-project-status/v1 -->
<!-- current-phase: 7 -->
<!-- current-task: Codex Yellow — hotel journeys, schema clarity and workbench review -->
<!-- current-order-files: handoff/orders/440-hotel-journeys-and-schema-guide.md -->
<!-- current-lifecycle: native fiscal source merged and CI verified; journey design under independent review -->

This is the canonical current-state record. It identifies the consolidated source,
verified behavior, release boundaries and active work. Historical orders, reviews,
decisions and ledger entries remain evidence; their filenames are not an active
backlog. `state.sh` and `state.ps1` read the machine-readable comments above.

## Current task

**One Codex Yellow task continues from the reviewed application on main.**
Orders438/439 consolidated the operational app in PR82. Order434's native fiscal
source then passed independent whole-candidate Tier-3 review and all five jobs in
[CI178](https://github.com/dcpnode-maker/yellow/actions/runs/33993977811) at exact
head `92346674c784b552356934e168d60e4b9650497a`. [PR83](https://github.com/dcpnode-maker/yellow/pull/83)
merged it as `443e3826b47025106d1829fcbb406ce6302fbbba`. Main now contains **77
migrations and 127 public base tables**, including `schema_migration`.
The final review condition was discharged by that exact green CI and recorded in
the PR and merge receipt. Earlier failed runs are history, not a current database
failure. [Schema guide](SCHEMA-GUIDE.md) explains the original 80-table baseline.

**Order440** documents guest and staff work across departments, 16 synthetic cases,
and a 14-case interactive design study. Research, casebook, specification and
prototype feed the same Codex-owned roadmap. The prototype uses fictional in-memory
records; it does not add live event, outlet, spa or purchasing capabilities.
Its functional review and visual-source comparison have separate receipts.

Codex owns implementation and coordination and may use internal models as bounded
builders or independent reviewers. Ordinary development has no separate vendor or
person dependency. Independent review and exact-source verification remain required.

## Source and release truth

| Surface | Verified baseline | Release boundary |
|---|---|---|
| Source and integration | PR82 operational baseline followed by reviewed native fiscal PR83 at main `443e3826` | `main` is the sole release branch; every subsequent change needs its own review and CI |
| Native fiscal acceptance | Independent migration41/41, six native suites116/116, catalogue23/23, exact PostgreSQL schema and referee11/11; all five [CI178 jobs](https://github.com/dcpnode-maker/yellow/actions/runs/33993977811) passed at `92346674` | [Review434](../handoff/reviews/434-native-fiscal-source-completion.md) plus PR83 records full acceptance; provider activation and a retained hotel database are outside this receipt |
| GitHub work queue | All 62 PRs in the original audit are closed with source preservation; PR82 and PR83 are merged | [The manifest](../handoff/CONSOLIDATION-MANIFEST.json) preserves dispositions; [GitHub](https://github.com/dcpnode-maker/yellow/pulls) owns the live queue |
| Database schema | Main has 77 migrations / 127 public tables; 0076 adds two tables and 0077 completes governed native source functions without adding a table | Immutable 0001 still declares 80 application tables; 0075's legacy capability containment stays intact; no retained hotel database was migrated here |
| Hotel journey design | [Workbench specification](design/STAFF-WORKBENCH-SPEC.md), [casebook](design/HOTEL-CASEBOOK.md) and [research](research/HOTEL-OPERATIONS-REVIEW.md) | Interaction study for review; visual fidelity requires an accessible reference image and matched screenshot evidence |
| Local app | The complete supported launcher passed in CI178 with a real database, canonical/review seeds, exact-SHA readiness and login | [Local instructions](RELEASE.md) provide `http://127.0.0.1:3000`; CI does not prove that the user's machine was refreshed |
| Main verification and cloud | All five post-merge [CI179 jobs](https://github.com/dcpnode-maker/yellow/actions/runs/33994717854) passed for `443e3826`, including exact schema, catalogue23/23 and referee11/11; [image publication33995471357](https://github.com/dcpnode-maker/yellow/actions/runs/33995471357) succeeded | No cloud host, ingress or serving URL is connected; publishing images is separate from deploying a hotel runtime |

A branch, document, test, container build, merge and deployment are separate evidence
states. The runtime must identify its exact source and applied migration frontier.

## Product status

| Scope | Status | Meaning |
|---|---|---|
| Phases 0–3, 5 and 6 | Independently reviewed | Later changes still require regression proof |
| Phase 4 | Built; integration review outstanding | Preserve its implementation and close remaining integration evidence |
| Phase 7 operational flows | Consolidated and independently approved | Working PMS, stay, folio, payment, approval and fiscal-support flows are preserved |
| Order434 native fiscal source | Independently approved and merged through PR83 | Real source-to-invoice, tax-only accounting, immutable replay, concurrency, tenant isolation, maximum bounds and migration proof passed; a provider submission or operator invoice screen is not implied |
| Phases 8–17 | Planned | The department study defines future acceptance; documentation is not shipped behavior |

The roadmap contains **18 phases, numbered 0–17**. Founder priority remains
**11 → 13 → 17**, with mandatory dependencies. From the active phase, the executable
sequence is `7 → 8 → 9 → 10 → 11 → 12 → 13 → 17 → 14 → 15 → 16`.

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
`docs/research/ASTRA-TAKEOVER-REVIEW.md` and
`docs/research/HOTEL-OPERATIONS-REVIEW.md`. Capability claims require executable or
measured evidence; model benchmark results do not waive Yellow's review gates.

## Updating this record

Update the four machine-readable fields and the relevant table rows in the same
reviewed change whenever the active task, phase or lifecycle changes. Record the exact
commit, image digest and deployed target in release evidence rather than editing
historical orders. Append decisions and ledger entries; never rewrite their history.
