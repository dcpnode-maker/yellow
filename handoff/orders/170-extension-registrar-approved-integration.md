# Order 170 — Integrate approved extension registrar onto the local workspace lineage

**Status:** BUILT-UNREVIEWED
**Phase:** 5 · security prerequisite integration
**Branch:** `phase-5/extension-registrar-approved-integration`
**Base:** `cb88b664463c81a59c064e638b203f3b33b51304`
**Risk tier:** 3 — global catalogue mutation, credential boundary and SECURITY DEFINER authority
**Owner:** Codex implementation; independent non-implementing Tier-3 reviewer

## Outcome

Compose the already independently approved Order156 product change at executable
`f8d546a1cbf189a1b0a728b6e9b6d0424ae64c60` onto the exact approved Order169 source
lineage. Preserve the promoted reservation workspace and every later runtime/security
correction. Do not merge or cherry-pick the old branch ancestry wholesale.

## Scope

- the exact non-governance paths changed by approved Order156: migration 0018;
  registrar provisioning/configuration; extension registration service wiring;
  Order156 focused/cumulative tests; mechanically regenerated expected schema; and
  the exact affected security, contracts, tooling and local-review documentation;
- `handoff/orders/170-extension-registrar-approved-integration.md`;
- additive `DECISIONS.log`, `handoff/LEDGER.md`, and one independent review.

No other path is in scope. In particular, no reservation, folio, charge, payment,
occupancy, tax, UI asset, package, dependency, existing migration, protected referee,
or live local container change is authorized.

## Required integration

1. Reapply only the approved Order156 product diff, resolving against current files
   without weakening either lineage. Preserve the exact registrar role/function/ACL,
   dedicated unprepared pool, credential non-retention and runtime settlement contract.
2. Prove every approved Order156 product blob is either byte-identical or has a
   documented mechanical integration delta caused solely by the newer approved lineage.
3. Keep ports 3000 and 3002 on the independently approved Order169 image. This order
   builds and reviews a candidate only; promotion is a separate order.

## Pre-registered proof

- **P0:** on exact Base, reproduce and roll back the direct `app_role` global
  `extension_type` insert with no required audit fact.
- **P1:** candidate direct insert returns SQLSTATE `42501`; exact registrar role,
  function owner/signature/search path/ACL, zero generic table authority, credential
  separation/non-retention, pg_temp resistance and session settlement all pass.
- **P2:** authenticated platform registration preserves exact 403/201/200/409/422,
  one tenant-bound audit fact, identical replay, divergent/concurrent behavior and no
  cross-tenant or partial artifact.
- **P3:** migration 0018 checksum/catalogue/schema/acceptance and the runtime-DML
  recurrence canary pass on the current lineage.
- **P4:** complete isolated phase matrix, standing tests, typecheck, boundaries,
  licences, audit, schema check, protected hashes and fresh app-never-started
  `./setup.sh --db-only` return exactly 11/11.

An independent reviewer who did not implement the composition must personally execute
P0-P4 against one immutable candidate before approval.

## Forbidden

- Editing an existing migration, `migrations/0001_init.sql`, or
  `tests/run_invariants.py`.
- Importing stale Order156 ancestry/governance wholesale, broadening registrar
  authority, exposing credentials, adding dependencies, or changing product behavior.
- Merge, push, local promotion, deployment, destructive cleanup, self-review or
  Phase-wide completion claims.

## Definition of done

- [x] Approved Order156 capability is present on the exact Order169 descendant.
- [x] P0-P4 are green without weakening assertions.
- [ ] Independent Tier-3 review approves one immutable executable.

## Builder evidence — 2026-08-26

The product executable is
`b18aa577d4b1d21e7510054ae76fcd4549d82499`, an exact descendant of admitted
Order170 commit `b859517d858b77e4bbc64eea4d7d17d38913b2bb`. It composes only the two
approved Order156 product commits `8e62232` and `f8d546a` without their ancestry,
orders, questions, decisions, ledger or review. The result changes exactly the 25
authorized non-governance paths. Twenty final blobs are byte-identical to approved
Order156. The five mechanical integrations retain only newer approved Order169
content alongside the exact registrar delta: reservation read contracts in
`docs/CONTRACTS.md`, the founder booking/UI walkthrough in `docs/LOCAL-REVIEW.md`,
booking permission in `scripts/seed-review.ts` and its exact test oracle, and
reservation board/detail wiring in `src/server.ts`.

P0 used a detached exact-Base `b859517` worktree and a fresh 17-migration database.
The real `yellow_runtime` transaction-local `app_role` path inserted one global
extension type with affected-row count one and no audit fact; rollback left exact
row/fact counts zero. The detached worktree and proof database were removed. On the
candidate, the isolated registrar suite passed 6/6 and proves the same direct path is
SQLSTATE `42501`, exact role/function/ACL containment, wrong-principal/tenant/property
denial, rollback and pg_temp resistance, race/idempotency behavior and clean unprepared
backend reuse. Runtime database authority passed 10/10. The real extension HTTP/service
suite passed 6/6 with 25 assertions, preserving authorization, validation, tenant
isolation, audit and compatibility behavior.

Fresh app-never-started canonical `setup.sh --db-only` applied migrations 0001–0018
and returned exactly **11 passed, 0 failed of 11**. The isolated phase matrix passed
**23/23 suites**. Native WSL migration execution passed **23/23** with 118 assertions;
fresh deployment acceptance passed **6/6** with 13 assertions; live normalized schema
matched `tests/schema/expected.sql`. Standing `bun test` passed **199**, skipped 479
database-gated cases and failed zero, with 2,402 assertions across 103 files. Typecheck,
66-file boundaries, 23-package licence policy and `bun audit` passed. Migration 0018's
raw SHA-256 is `77e80f10c1c148fe79dcf71c546afe87fbdf97ac7f320644f5e550c88d409fc3`.
Protected SHA-256 values remained exact: migration 0001
`fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`, referee
`2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`, and fixture
`bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`.

The first non-login WSL setup attempt could not see Bun, and two native migration
launcher attempts did not transfer/clean the required environment. They stopped at
readiness/authentication or skipped before database assertions and are not counted.
The canonical login-shell setup and exact WSLENV-backed native suite above are the
successful proofs. Secrets remained redacted, the app was never started, and live
ports 3000/3002 were not touched. Independent Tier-3 P0–P4 review remains mandatory;
there is no merge, push, promotion, deployment or broader Phase claim.
