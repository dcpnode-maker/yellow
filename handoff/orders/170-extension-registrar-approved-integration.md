# Order 170 — Integrate approved extension registrar onto the local workspace lineage

**Status:** READY
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

- [ ] Approved Order156 capability is present on the exact Order169 descendant.
- [ ] P0-P4 are green without weakening assertions.
- [ ] Independent Tier-3 review approves one immutable executable.

