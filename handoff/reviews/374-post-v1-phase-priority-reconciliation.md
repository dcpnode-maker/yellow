# Order 374 post-v1 phase-priority reconciliation — fresh Tier-2 review

**Disposition:** CHANGES REQUIRED

**Reviewer:** `/root/order374_fresh_tier2`, fresh independent non-implementing Tier-2

**Exact candidate reviewed:** `5eac1da26920d6d009166f33e9cdfe65b77855cb`

**Exact base:** `ae9c2c3`

## Scope and independently executed proof

The exact base-to-candidate diff is limited to the seven Order374 files:
`BUILD-PLAN.md`, `handoff/ROADMAP.md`, `docs/AI-ARCHITECTURE.md`,
`docs/UI-SPEC.md`, the order, `DECISIONS.log` and `handoff/LEDGER.md`. There is no
source, test, migration, schema, contract, event, state, permission, dependency,
runtime, local or `.yellow` delta. The untracked protected `.yellow/` directory was
not read or changed.

Reviewer-authored structural assertions independently prove that Phase13–17 headings
occur exactly once in both plans, the exact priority `[13, 17, 14, 15, 16]` occurs
exactly once in each, the Phase0–12 `BUILD-PLAN.md` definitions are byte-equivalent,
and no Phase14→Phase16 dependency cycle remains. Phase17 explicitly reuses Phase11
group/block truth, leaves financial/occupancy/privacy authority in existing contexts
and treats interface/provider details as later bounded decisions. The order's
clean-room and no-proprietary-copy boundary is explicit.

Reviewer-personal gates pass: `git diff --check`; TypeScript typecheck; import
boundaries **139 files**; dependency licence policy **23 packages**; `bun audit`
**0 vulnerabilities**; standing suite **1,217 passed**, **949 expected skips**,
**0 failed**, **18,524 assertions** across 2,166 tests/400 files. No database or local
stack was started or mutated for this governance-only review.

## Blocking finding

The Voice provider boundary is internally contradictory. Order374 requirement 5 says
local/open-source adapters are benchmarked deployment choices rather than a hard-coded
vendor promise, and its Forbidden section bars choosing a speech/model/provider.
`docs/AI-ARCHITECTURE.md` likewise says no vendor/model is canonical before a
reproducible benchmark. But `docs/UI-SPEC.md:41` still mandates **Whisper.cpp** for
voice input and **Piper** for spoken confirmations.

This is not merely legacy prose outside the reviewed contract: it is in the same
“Command palette + voice (same pipeline)” section that the candidate extends with the
Phase13 behavior. A reader cannot simultaneously implement the named stack exactly
and preserve the new no-canonical-provider rule. Static/test success cannot resolve
that design contradiction.

## Required repair

Replace the named Whisper.cpp/Piper prescription with capability/adapter language
consistent with the benchmarked local-first provider policy, while retaining the same
intent parser, optional speech response and deterministic text/manual fallback. Then
rerun the scoped structural/static/standing proof and obtain a fresh independent
Tier-2 re-review of the repaired exact candidate.

Order374 remains unapproved. This review grants no product, runtime, local, provider,
deployment, phase-completion or merge authority.
