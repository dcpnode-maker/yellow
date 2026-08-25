# Order 142 — Compose approved post-130 integration on canonical main

**Status:** ADMITTED  
**Phase:** 5  
**Tier:** 3 — authentication, role/ACL migrations, idempotency, reservation/occupancy
sequencing and protected-referee composition  
**Branch:** `phase-5/post130-approved-integration`  
**Base:** `952478d17bcebd67e696d5cb76eec37e89cabcf3` (`origin/main`)  
**Owner:** Codex integration builder; independent non-implementing Tier-3 review required

## Admission evidence

Order 130 is independently approved at executable
`f7867cd7fa8aad0e38893575cad6158ba171d0a4`, approval metadata
`e447eb9903adab3112e862cc52af855a50e5e9ac`. Its reviewer personally reproduced P0–P5,
including the TC-12.2 primary-guest observation, and recomputed:

- `tests/run_invariants.py`: `2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`
- `tests/seed_fixture.sql`: `bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`
- `migrations/0001_init.sql`: `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`

`origin/main` was fetched and re-resolved to the exact Base immediately before this order.

## Problem and composition rule

The approved Orders 123, 124 and 129 plus approved Order 130 live on a historical line
that also contains draft finance Orders 109–115 and blocked Order 126 work. Merging or
cherry-picking that ancestry would import unapproved scope. Applying Order 130's three-file
diff alone would omit its approved runtime predecessors.

Create one synthetic candidate from Base by restoring only the manifests below in exact
dependency order. A later approved source owns a shared path's final blob. Do not merge,
rebase or cherry-pick the historical branch, hand-edit approved product semantics, or
import any unlisted path.

## Exact executable manifests

### Order 123 composite — source tree `be279bb09536c6b122575f275cd11e09161e057e`

```text
.codex/config.toml
.env.example
.gitignore
.mcp.json
Dockerfile
docker-compose.yml
docs/CODEX.md
docs/CONTRACTS.md
docs/LOCAL-REVIEW.md
docs/SECURITY.md
docs/TOOLING.md
docs/research/CAPABILITY-MATRIX.md
migrations/0012_app_role_nonlogin.sql
scripts/check-container-image-pins.ts
scripts/run-phase-3-gate.ts
setup.ps1
setup.sh
src/app.ts
src/contexts/identity/index.ts
src/contexts/identity/local-login.ts
src/contexts/identity/login-guard.ts
src/contexts/identity/token.ts
src/http/operator.ts
src/project-status.ts
src/server.ts
tests/app-role-nonlogin.integration.test.ts
tests/container-image-pins.test.ts
tests/database-acceptance.integration.test.ts
tests/founder-status.integration.test.ts
tests/jwt-runtime-secret-security.test.ts
tests/local-login-abuse.test.ts
tests/migrate.integration.test.ts
tests/operator-idempotency-actor.integration.test.ts
tests/operator-operational-blocks.integration.test.ts
tests/operator-workbench.integration.test.ts
tests/phase-3-gate-runner.test.ts
tests/project-mcp-config.test.ts
```

### Order 124 overlay — source tree `b93574d3d9f2b5d5712173dfe7c160088a457521`

```text
docs/CONTRACTS.md
docs/SECURITY.md
docs/STATE-MACHINES.md
migrations/0013_revoke_app_role_business_day_seal.sql
scripts/run-phase-3-gate.ts
tests/business-day-seal-authority.integration.test.ts
tests/database-acceptance.integration.test.ts
tests/financial-postings.integration.test.ts
tests/migrate.integration.test.ts
tests/phase-3-gate-runner.test.ts
tests/schema/expected.sql
tests/security-definer-containment.integration.test.ts
```

### Order 129 overlay — source tree `9a6ef73e5e39c8594dda4e56fe5e405aebaa0b90`

```text
docs/CONTRACTS.md
scripts/run-phase-3-gate.ts
src/contexts/inventory/holds.ts
src/contexts/inventory/index.ts
src/contexts/inventory/reservation-occupancy.ts
src/contexts/reservations/commit.ts
tests/phase-3-gate-runner.test.ts
tests/reservation-parent-before-occupancy.integration.test.ts
```

### Order 130 overlay — source tree `f7867cd7fa8aad0e38893575cad6158ba171d0a4`

```text
tests/referee-typed-parent-fixtures.integration.test.ts
tests/run_invariants.py
tests/seed_fixture.sql
```

## Exact metadata union

Restore historical order/review/question files without changing their prose from the
approved tips: Orders/reviews 116–123 from `be279bb`; Order/review 124 and Questions
141–142 from `ee0cdc5299d88ba0355972482f5fe5aa4a017b02`; Order/review 129 from
`972d0cfef0b7e4b8499065f70eea3226aeacb187`; Order/review 130, Question 146 and
`handoff/GATE-3-MANIFEST.md` from `e447eb9903adab3112e862cc52af855a50e5e9ac`.

The allowed metadata paths are:

```text
handoff/orders/116-jwt-secret-fail-closed.md through 125-operational-block-review-scope-fixture.md
handoff/orders/129-reservation-parent-before-occupancy.md
handoff/orders/130-referee-typed-parent-fixtures.md
handoff/reviews/116-jwt-secret-fail-closed.md
handoff/reviews/117-local-login-abuse-controls.md
handoff/reviews/118-app-role-nonlogin.md
handoff/reviews/119-remove-floating-project-mcp.md
handoff/reviews/120-pin-container-images.md
handoff/reviews/121-actor-bound-api-idempotency.md
handoff/reviews/123-integrate-cyber-lineage.md
handoff/reviews/124-revoke-app-role-business-day-seal.md
handoff/reviews/129-reservation-parent-before-occupancy.md
handoff/reviews/130-referee-typed-parent-fixtures.md
handoff/questions/141-order-118-inherited-founder-login-budget.md
handoff/questions/142-order-053-review-scope-fixture-drift.md
handoff/questions/146-order126-protected-referee-typed-parents.md
handoff/GATE-3-MANIFEST.md
```

`DECISIONS.log` and `handoff/LEDGER.md` are additive unions: preserve Base byte-for-byte
and append only missing provenance for the included approved work and this integration.
`src/project-status.ts` and its founder-status assertions must describe the real composed
candidate without claiming merge, deployment, live status or review of Order 142.

## Explicit exclusions

```text
handoff/orders/109-* through 115-*
handoff/PHASE-5-PLAN.md from the draft finance line
handoff/questions/139-* and 140-*
handoff/orders/126-* and handoff/questions/143-* through 145-*
tests/occupancy-caller-tenant.integration.test.ts
all Order 127 artifacts
all duplicate-number legacy 112/113 security branches
```

No migration beyond approved `0012` and `0013`, dependency, new domain behavior, new
permission, test weakening, runtime wiring or status inflation is in scope.

## Blob and allowlist verification

For every manifest path, machine-record `path | owning source SHA | source Git blob |
candidate Git blob | result` using `git rev-parse <source>:<path>` and
`git hash-object <candidate-path>`. The final blob must equal the latest approved overlay
owner. The candidate diff must contain no path outside the executable manifest, metadata
union, this order, its review record, `DECISIONS.log`, `handoff/LEDGER.md`, and truthful
status reconciliation.

Minimum fixed blobs:

```text
migrations/0012_app_role_nonlogin.sql b44757121cb97d7e3b4f98446507d2329ec72b71
migrations/0013_revoke_app_role_business_day_seal.sql 1bd3a83e838143253ebb5e51a3ff8bc97b62b506
src/http/operator.ts 5e7cd2f5b3a2cabbb76dde83d5ece09751849618
```

## Pre-registered proof

### P0 — admission and rejected alternatives

Record Base/source/approval SHAs and protected hashes. Machine-prove a full ancestry merge
contains excluded finance/Order-126 paths, and the three-file Order-130 patch alone lacks
approved 123/124/129 product paths.

### P1 — mechanical composition

Restore exact manifests in 123 → 124 → 129 → 130 order. Verify every owning source blob,
the exact final allowlist, exclusions, migration order and one unique phase-gate mapping.

### P2 — focused source proofs

Execute the approved JWT, login-abuse, app-role NOLOGIN, MCP-config, image-pin,
actor-idempotency, day-seal, reservation-parent and typed-parent-referee proofs. Preserve
parent-red evidence; do not substitute builder output for reviewer execution.

### P3 — isolated current-line integration

On fresh isolated databases, run migrations through 0013, database acceptance, the
Order-123 integration/static suite, business-day authority, direct/held reservation commit,
HTTP and holds suites, the 19-suite phase gate, Order-130 focused proof, exact schema and
protected hashes.

### P4 — standing and pristine referee

Run standing tests, typecheck, import boundaries, frozen install, licences, audit, clean
state, and app-never-started `./setup.sh --db-only`/`setup.ps1 -DbOnly` with exact table
count and `11 passed, 0 failed`.

### P5 — independent Tier-3 review

A non-implementing reviewer personally repeats P0–P4, the full blob/exclusion manifest and
governance audit on one immutable executable SHA. Record commands/results in
`handoff/reviews/142-post130-approved-integration.md`. The builder may not self-review,
self-merge, push, deploy or claim live status.

## Rollback

Before merge, abandon only this dedicated worktree/branch; never move `main` or delete
source evidence. After merge, use a separately ordered and independently reviewed forward
correction/revert. Never rewrite migrations 0012/0013 or applied migration history.
