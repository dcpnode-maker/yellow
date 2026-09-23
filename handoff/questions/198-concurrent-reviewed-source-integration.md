# Question198 — Integrate concurrent reviewed Yellow work

**Status:** CLOSED; exact-head GitHub CI passed and PR85 merged independently.
**Date:** 2026-09-06
**Owner:** Codex implementation coordinator.

PR85's exact13737a7 passed all required CI/CodeQL checks, but PR84 subsequently
advanced main to7829eae47d4281efa117c8d3c788c3be52d10d06. Both descend from reviewed
native fiscal main443e3826. Neither accepted development line may be discarded.
The local Q197 projection checkpoint is separately preserved asbb48246.

## Admission

Integrate the already-reviewed upstream files without changing their domain code,
dependencies, SQL or prototype behavior. Resolve overlapping current documentation
and exact recorded-status test expectations by combining evidence, not by choosing
one branch wholesale. All later tests and exact-head CI must run on the integrated
source before PR85 becomes mergeable/reviewable again.

The exact manual-resolution scope is:

```text
BUILD-PLAN.md
DECISIONS.log
docs/PROJECT-STATUS.md
docs/research/README.md
handoff/LEDGER.md
handoff/PHASE-7-PLAN.md
handoff/ROADMAP.md
src/project-status.ts
tests/current-management-demo-status.intentional-red.test.ts
tests/founder-status.integration.test.ts
tests/project-status.test.ts
handoff/orders/440-fiscal-submission-lifecycle.md
handoff/questions/198-concurrent-reviewed-source-integration.md
```

Keep the upstream PROJECT.md clarification unchanged: it updates baseline versus
current schema counts, not the Ten Invariants. Preserve all added hotel/STR journey,
casebook, design-study and research files, as well as the Astra Ultra RMS paper and
model policy. Do not rename the product, publish simulated department functions as
live features, activate providers or claim that the founder's machine was refreshed.

## Concurrent identifier provenance

Separate branches independently used Order440 and Question196. Keep both descriptive
filenames and histories. Refer to `440-fiscal-submission-lifecycle` and
`440-hotel-journeys-and-schema-guide` when distinguishing them. The numbered build
snapshot remains439 built/440 current, with18phases and11→13→17 priority unchanged.
The fiscal lane remains active; the hotel journey study is merged, while final
reference-matched visual review and actual laptop execution remain separate.

Preserve colliding append-only decision/ledger records verbatim. Append a provenance
record citing each branch/source rather than renumbering historical decisions or
silently overwriting a record. Current status must expose both workstreams and the
documented RMS research, without portraying proposed algorithms as revenue uplift.

Root may create the local integration commit and push the combined PR candidate.
Root must not merge its own PR; a non-implementing coordinator must verify final
exact-head proof and perform any authorized PR integration.

## Executed local integration proof

Root combined upstream7829eae47d4281efa117c8d3c788c3be52d10d06 with local296d8db
(including separately preserved Q197 checkpointbb48246). Eight overlapping status,
plan and research files retain both workstreams; no applied migration or upstream
prototype behavior changed. The status test initially omitted `summary` from its
local result type; root added that field without weakening the new assertions.

Final root `bun run typecheck` and `bun test` pass:1597/0 with1195 explicit database
skips,21785 assertions,2792 tests/488 files,90.93 seconds. The log is retained outside
Git at `D:\Yellow\temp\order440-integrated-standing-20260906.log`. Boundaries171,
licences23, audit0, five-job YAML parse, release-workflow4/0(53) and diff checks pass.
The three Q197 implementation/test hashes and Astra Ultra paper hash are unchanged
from their accepted receipts. This local standing run is not a database acceptance run.

Non-implementing `/root/native_migration_assembly` personally ran
`bun test tests/project-status.test.ts tests/current-management-demo-status.intentional-red.test.ts tests/founder-status.integration.test.ts`
(11pass,2explicit database skips,0fail,186 assertions) and `bun run typecheck` (pass).
It independently checked status/provenance boundaries and compared upstream hotel,
design and research artifacts byte-for-byte with origin/main; no loss or substantive
misleading claim was found. It made no edits and exercised no database/runtime.

Publish this combined revision for its own mandatory CI, including Q197's newly
required genuine-issued proof. Old13737a7 green checks do not approve the new head.

## Exact-head CI failure and repair

CI33998572070 at4ecee0bb30d96818f604c3f1020edc3407915858 passed Windows/local checks
but failed quality before database/container jobs. CodeQL passed. Root reproduced
the cause: Bun1.3.14 nested `toMatchObject`/`expect.stringContaining` replaced shared
snapshot text with matcher objects. The current-demo test then failed depending on
file order. A permanent whole-snapshot unchanged assertion failed0/1 before repair;
scalar assertions now preserve the same state/text requirements without mutation.

Root also reproduced a private LaneA revoked-proxy exception. A bounded non-root
builder moved Array.isArray inside the existing try/catch after three regression
failures; all three input boundaries now return frozen invalid_input results. Final
LaneA17/0(75), combined state/status28/0+2DBskips(264), whole1600/0+1195DBskips
(21797;2795tests/488files;82.37s) and types pass. Non-implementing
native_migration_assembly personally reran22/0(134) and types; its exact hash receipt
is appended to review440. These repairs do not alter lifecycle or database authority.
Publish the repaired revision for a new complete exact-head CI execution; failed
4ecee0b is not accepted or merged.

## Final integration receipt

The reviewed RMS-only correction advanced the candidate to
088d093ee6b813cb79cee8a98a4bfb67d72fecb0. CI33999540391 passed all five jobs;
CodeQL passed without findings. Non-implementing native_migration_assembly checked
migration41/41, seed10/10, native116/116, required Q197 issued-wire4/4,
compatibility89/89, exact schema and referee11/11. No skipped required proof was
substituted. GitHub confirms PR85 merged2026-09-06T00:04:14Z as
b5ef70842b658183f7b5b4c650c8e78c7a0b513d. Root independently checked the PR state,
fetched main, verified its tree equals088d093 and fast-forwarded the active branch
without changing the uncommitted Q199 work. No own-PR merge or runtime refresh.

The earlier fee23d5 database job was canceled by the newer research push, not
accepted as passing. The complete successor33999540391 supplies the required proof.
MainCI34000319799 and image publication34000989837 also succeeded atb5ef708.
Q199's subsequently developed durable foundation is not included in this acceptance.
