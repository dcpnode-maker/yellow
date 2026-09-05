# Question198 — Integrate concurrent reviewed Yellow work

**Status:** RESOLVED technical scope admission; integration proof pending.
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
