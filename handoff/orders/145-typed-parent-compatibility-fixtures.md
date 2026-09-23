# Order 145 — Strict typed-parent compatibility fixtures

**Status:** APPROVED — INDEPENDENT TIER-3 REVIEW COMPLETE
**Phase:** 5 · Cyber remediation prerequisite
**Branch:** `phase-5/typed-parent-compatibility-fixtures`
**Base:** `2faf5e8db8264af59e65effdfcb5603da628a181` — independently approved Order-143 metadata frontier
**Question:** `handoff/questions/148-order126-strict-parent-compatibility-predecessors.md`
**Question provenance:** exact file imported from Order-126 metadata commit `7124777`
**Risk tier:** 3 — occupancy choke-point fixture compatibility
**Owner:** Codex implementation; independent non-implementing Tier-3 review required

## Admission — D-384

Question148 identifies two inherited test fixtures that are incompatible with the strict
typed-parent contract admitted by Order 126. This order is the bounded test-only
predecessor. It updates only stale fixture setup/cleanup; production code, migration
0014, protected referee/fixture tests, assertions, concurrency, ACL/search-path proof,
and lifecycle semantics remain unchanged.

## Exact scope

- `tests/operational-blocks.integration.test.ts`
- `tests/security-definer-containment.integration.test.ts`
- this order and additive decision/ledger/review metadata
- Question148 is provenance only and is not rewritten

No other path is authorized. In particular, do not edit production sources, migrations,
the protected referee or architect fixture, normal reservation callers, security-definer
function bodies, ACLs, roles, search paths, expected SQLSTATEs, concurrency counts,
assertions, cleanup semantics, or any Order-126 source.

## Required implementation

1. In the operational-block fixture, release only authoritative occupancy claims whose
   parent is an actual captured `ooo_oos` claim; do not call release for wrong-kind,
   zero-claim rows. Preserve all Order-037 lifecycle and rollback assertions.
2. In the security-definer fixture, create the exact tenant/property/space and a valid
   same-tenant live typed parent before the app-role `record_occupancy` call, or use an
   exact authoritative OOO parent. Preserve app-role execution, safe-path, owner-prune,
   direct-DML denial and release-count assertions without weakening any expected state.
3. Keep all fixture mutations transaction-local/cleanable and deterministic. No fake
   caller authority, owner/BYPASSRLS role, GUC exception, migration relaxation or
   production bypass is permitted.

## Pre-registered proof

- **P0 red, before test edits:** on the exact base with strict typed-parent validation,
  reproduce the stale fixture failures as exact `P0003` while prior cases remain green.
- **P1 green:** run both complete unchanged-strength suites with authoritative typed
  parents; preserve exact `42501`/`22023` and all existing counts/assertions.
- **P2 canaries:** retain permanent assertions for typed-parent legitimacy, direct-DML
  denial, safe definer paths, owner-only pruning, release counts, rollback and cleanup.
- **P3 gates:** run non-DB focused tests, typecheck, boundaries, licence and audit checks.
  Docker/DB proof and Tier-3 review require later explicit authorization.

## Definition of done

- [x] Admission metadata committed before test edits with `[codex]`.
- [x] Exact strict-parent red reproduced first.
- [x] Both fixture suites pass without assertion or semantic weakening.
- [x] Non-DB gates pass; no Docker/WSL used before authorization.
- [x] Independent non-implementing Tier-3 review personally executes required proof.
- [ ] No merge, push, deployment, live or Order-126/Cyber closure claim.
