# Yellow project status

<!-- status-schema: yellow-project-status/v1 -->
<!-- current-phase: 7 -->
<!-- current-task: Codex Yellow — fiscal submission with hotel journey and RMS research integration -->
<!-- current-order-files: handoff/orders/440-fiscal-submission-lifecycle.md;handoff/orders/440-hotel-journeys-and-schema-guide.md -->
<!-- current-lifecycle: native fiscal source and journey study merged; private fiscal state and issued-wire proof accepted; durable integration in progress; no provider or runtime activation -->

This is the canonical current-state record. It identifies the consolidated source,
verified behavior, release boundaries and active work. Historical orders, reviews,
decisions and ledger entries remain evidence; their filenames are not an active
backlog. `state.sh` and `state.ps1` read the machine-readable comments above.

## Current task

**One Codex Yellow project preserves both reviewed development streams.**
Orders438/439 consolidated the operational app through PR82. Order434's native
fiscal source passed independent whole-candidate Tier-3 review and all five jobs in
[CI178](https://github.com/dcpnode-maker/yellow/actions/runs/33993977811) at
`92346674c784b552356934e168d60e4b9650497a`, then merged through
[PR83](https://github.com/dcpnode-maker/yellow/pull/83) as`443e3826`.
[PR84](https://github.com/dcpnode-maker/yellow/pull/84) subsequently merged the
independently reviewed hotel-journey/schema/design study as
`7829eae47d4281efa117c8d3c788c3be52d10d06`. Main contains77 migrations and127 public
base tables, including the runner ledger; [SCHEMA-GUIDE](SCHEMA-GUIDE.md) explains
the immutable80-table baseline and historical125-table frontier.
The combined private fiscal/RMS follow-up passed all five jobs in
[CI33999540391](https://github.com/dcpnode-maker/yellow/actions/runs/33999540391)
at088d093 and merged through[PR85](https://github.com/dcpnode-maker/yellow/pull/85)
asb5ef70842b658183f7b5b4c650c8e78c7a0b513d. That merge changes no migration frontier.

**Order440 fiscal submission** continues the durable request/delivery/reconciliation
implementation. Its private state contract passes17 tests; the new private issued-wire
candidate independently passes10 unit tests and4 genuine-issued PostgreSQL tests.
Those prove the supported GST component combinations, two-tenant source isolation and
unchanged financial rows. The source hash remains distinct from the deterministic
wire hash; money never passes through floating-point conversion. Canonical0077's final
issued content includes Qty1.000/UnitOTH; the ordinary intermediate candidate does
not. Q197 corrects that description. The candidate remains uncertified. Q199's
private repository/worker and SQL draft now pass17 real PostgreSQL tests: exact
source/wire preservation,100 concurrent claims, unknown-delivery recovery, bounded
explicit retries, forced rollback of all four delivery operations, retained history
and both audited business-day seal race orders. These are isolated-database proofs,
not a canonical migration or activated worker. Independent private-foundation review
also passed the canonical referee11/11 and reproducible draft-schema comparison.
Canonical integration, provider authentication and live sandbox evidence are unfinished.

**Order440 hotel journeys** preserves cross-department guest/staff research,
16 synthetic cases and a14-case interactive design study. Its fictional in-memory
workbench does not release event, outlet, spa or purchasing capabilities. Functional
review, reference-matched visual review and actual laptop execution have separate
receipts. **Order441 RMS research** records the founder-selected Astra Ultra algorithm
portfolio; proposals are not implemented algorithms or measured revenue uplift.
[Question198](../handoff/questions/198-concurrent-reviewed-source-integration.md)
disambiguates the concurrent Order440/Question196 identifiers without losing history.

Prior fiscal/research checkpoint13737a7 passed all five jobs inCI33996041604 and
PR85 CI33996882192. PR85 then required integration because main advanced through
PR84. Combined candidate4ecee0b failed quality inCI33998572070 because a test matcher
mutated shared status text; Windows/local and CodeQL passed, database/container did
not execute. Root reproduced and repaired that test-order defect, plus a private
revoked-proxy input exception. The repaired source passed1600 local standing tests
with1195 explicit database skips. The later088d093 exact-head CI discharged the
combined-source gate, including the required issued-wire database proof. Q199's next
private draft passes1613 standing tests with1214 explicit database skips, types,
import boundaries across173 TypeScript files,23 package licence checks and dependency audit; its separate
genuine DB run is17/17. The independent private-foundation approval permits development
publication and subsequent canonical admission, not an activated feature.
No retained hotel database or founder-local app was refreshed by this work.

Earlier failure CI33992123191 at6bb7ba6 remains evidence: migration41/41,
native116/116, containment7/7 and compatibility89/89 passed before four stale
catalogue expectations failed. Those were repaired and independently passed23/23;
PR83's subsequent exact-head green CI discharged the native acceptance condition.
Codex owns implementation and coordination; ordinary development has no separate
vendor/person dependency. Independent high-risk proof remains required.

## Source and release truth

| Surface | Verified baseline | Release boundary |
|---|---|---|
| Source and integration | Reviewed native fiscal PR83 at443e3826, hotel-journey/schema/design PR84 at7829eae and private fiscal/RMS PR85 atb5ef708 | Main is the sole release branch; the next Q199 durable draft is separate unpromoted work |
| Native fiscal acceptance | Independent migration41/41, native116/116, compatibility89/89, catalogue23/23, exact schema and referee11/11; all five [PR83 CI jobs](https://github.com/dcpnode-maker/yellow/actions/runs/33993977811) passed | [Review434](../handoff/reviews/434-native-fiscal-source-completion.md) approves bounded native issuance, not provider activation or a retained hotel database |
| GitHub work queue | All62 PRs in the original audit are closed with source preservation; PR82/83/84/85 are merged | [The manifest](../handoff/CONSOLIDATION-MANIFEST.json) preserves dispositions; [GitHub](https://github.com/dcpnode-maker/yellow/pulls) is authoritative for the live queue |
| Database schema | Main has77 migrations /127 public tables;0076 adds two tables and0077 adds no table. Order440 projection adds no migration | Immutable0001 declares80 application tables;0075's legacy containment stays intact. No retained hotel database was migrated |
| Private issued-wire proof | Independent10/10 unit and4/4 real-issued tests, including exact unchanged financial rows and cross-tenant isolation | Source/wire hashes differ deliberately; no certified provider, durable submission writer or fiscal acceptance is claimed |
| Hotel journey design | [Workbench specification](design/STAFF-WORKBENCH-SPEC.md), [casebook](design/HOTEL-CASEBOOK.md) and [research](research/HOTEL-OPERATIONS-REVIEW.md) are preserved from PR84 | Fictional interaction study; final visual fidelity needs an accessible reference and matched screenshot evidence |
| Local app | The supported launcher passed clean CI with real database, canonical/review seeds, exact-SHA readiness, authentication and volume-preserving stop | [Local instructions](RELEASE.md) provide127.0.0.1:3000; CI does not prove the user's machine was refreshed |
| Main verification and cloud | Mainb5ef708 CI34000319799 and runtime/migration image publication34000989837 succeeded | Registry digests were not retrieved; no approved cloud host, ingress or serving URL is connected. Publication is not deployment |

A branch, document, test, container build, merge and deployment are separate evidence
states. The runtime must identify its exact source and applied migration frontier.

## Product status

| Scope | Status | Meaning |
|---|---|---|
| Phases0–3,5 and6 | Independently reviewed | Later changes still require regression proof |
| Phase4 | Built; integration review outstanding | Preserve implementation and close remaining integration evidence |
| Phase7 operational flows | Consolidated and independently approved baseline | PMS, stay, folio, payment, approval and fiscal-support flows remain preserved; this does not complete the whole phase |
| Order434 native fiscal issuance | Independently approved and merged through PR83 | Real source-to-invoice, accounting, replay, concurrency, tenant isolation, bounds and migration proofs pass; no provider registration or operator invoice screen is implied |
| Order440 fiscal submission | Private state, issued-wire projection and durable foundation independently accepted | Canonical persistence/worker integration, provider authentication, runtime activation and live sandbox evidence remain outstanding |
| Order440 hotel journeys | Reviewed study merged through PR84 | Cross-department research and a fictional prototype; final reference-matched visual QA and laptop execution remain separate |
| Order441 RMS research | Astra Ultra portfolio documented | Known methods, falsifiable proposals and experiment design; no live algorithm or measured uplift |
| Phases8–17 | Planned | Requirements, research and department studies are preserved; documentation is not shipped behavior |

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
