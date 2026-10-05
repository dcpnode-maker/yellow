# Order 123 — integrate the approved Cyber current line

**Status:** READY
**Phase:** 5 · current-line Cyber integration
**Branch:** `phase-5/integrate-cyber-lineage`
**Base:** `ec4c563` — Order 118 D-354 approval integrated, including verified Order 122
**Risk tier:** 3 — provenance-sensitive integration of database privilege, API
idempotency, and supply-chain security work
**Owner:** Codex coordination; independent non-implementing Tier-3 integration
review required

## Admission gate

This order is executable. Order 118 is independently approved
under D-354 at exact executable `b6a1319f571ea0cb079f75cedf06edf35548a1d2` and
its review metadata is integrated on this planning lineage. Order 121 is independently
approved under D-357:

- **D-357 / Order 121:** exact reviewed executable
  `bc27020e8c3f26e9cc68658cab00a2f9ac1929ed`; independent review commit
  `b5a4a264920d774a408e9b4b4152ba1397a9e6d8`.

Orders 119 and 120 are approved, exact-SHA artifacts and are eligible for later
integration: Order 119 at `7ba93e4cfe88648e2f3b8bd8fe2edd93e7fdfdc1`, and Order 120
at `0ca144b9eb7ad3dcc13c1cac5931c89560e13448`. Fixture-only Order 125 is
coordinator-verified at exact implementation `8fb42bb3c1e99c7bcee45d8b7bfd7fab908e0290`
with verification metadata head `7d37d74`; it is eligible only as proof maintenance.
Order 118/122 and Order 121 may now be admitted only at those exact approved
artifacts; integration and live status still require this order's own complete proof
and independent review.

## Goal

When unblocked, integrate the exact approved Order 119 and 120 blobs, plus the
exact independently reviewed Order 118 and Order 121 blobs once available, onto
the current Order 118+122 lineage. This is provenance-preserving integration only:
it must not reimplement, restyle, reinterpret, or semantically combine any Cyber
fix. Each imported implementation must remain byte/SHA-equivalent to its approved
executable artifact, subject only to the mechanical merge necessary to place the
artifacts on this lineage.

The integrated line must preserve the canonical Order 108 lineage, approved Order
116/117 ancestors, Order 118's database-role boundary, Order 119's empty MCP
configuration boundary, Order 120's exact OCI image pins, Order 121's
authenticated-actor idempotency boundary, and Order 122's fixture-only correction.
No sibling finding is closed by implication.

## Proposed scope (future execution only)

The integration may touch only the exact files already authorized by the four
source orders, their provenance metadata, and additive governance records:

- Order 118/122 artifacts: the exact migration 0012, focused role proof,
  cumulative-runner/status corrections, and the Order 122 fixture correction,
  with their already-authorized documentation and test files;
- Order 119 artifacts: `.mcp.json`, `.codex/config.toml`, `docs/TOOLING.md`,
  `docs/CODEX.md`, and its focused static validator/test;
- Order 120 artifacts: `Dockerfile`, `docker-compose.yml`, its static validator,
  and focused test;
- Order 121 artifacts: `src/http/operator.ts` and its focused actor-bound
  idempotency test, only at the independently reviewed executable SHA;
- Order 125 artifacts: only the exact Order 053 inline expected-scope correction,
  Question 142, its order and D-355/verification evidence; no production authority;
- every source order and independent review record, plus the exact additive
  `DECISIONS.log` and `handoff/LEDGER.md` provenance entries;
- `src/project-status.ts` and its exact founder-status assertions, only after all
  integration proofs are green, to record built/current Order 123 without advancing
  generated independent-review coverage beyond its evidence;
- additive `handoff/orders/123-integrate-cyber-lineage.md` and its later
  status/ledger/decision/review records expressly required to record provenance.

No product behavior may be rewritten during integration. If any source blob,
status, migration number, generated snapshot, or review claim conflicts with
current-line truth, stop and write a question; do not choose a winner silently.

## Collision reconciliation

The only permitted reconciliation is additive and mechanical:

1. Union-merge append-only `DECISIONS.log`, `handoff/LEDGER.md`, and order/review
   status evidence without editing or rewording historical lines.
2. Reconcile the cumulative runner and current status snapshot so every included
   suite appears exactly once and the snapshot names the actual integrated tip;
   preserve Order 122's exact fixture-isolation evidence.
3. Retain each source order's exact file contents and approved SHA claims. Verify
   blob equality with `git cat-file`/`git diff --no-index` (or equivalent) before
   and after integration.
4. Preserve migration ordering and checksums. Any migration, schema, RLS,
   tenant-scope, role, API semantics, image digest, or product-intent collision
   is a hard stop requiring a question and founder direction where applicable.

## Required proof after unblocking

The integrator must personally prove the exact current line, not rely on builder
claims:

- exact provenance: source and integrated blobs/SHA-256 values match for every
  implementation artifact; protected baseline and referee hashes remain exact;
- full current-line isolated matrix, restarted from suite one, with at least these
  16 suites and no duplicate mapping: rate-models, rate-targeting,
  rate-publication, rate-quote, operator-rate-builder, operator-rate-intent,
  review-seed, founder-status, operator-inventory, operator-rate-configuration,
  operator-rate-pricing, operator-rate-price-correction, operator-bulk-rooms,
  financial-postings, security-definer-containment, app-role-nonlogin, plus the
  actor-bound HTTP idempotency proof when Order 121 is admitted (therefore 17
  suites if it is a separate isolated mapping);
- focused green proofs for Orders 118, 119, 120, 121, and 122, with each finding
  tested only at its exact approved/reviewed SHA and with all parent-red proofs
  retained as provenance;
- the complete Order 053 suite remains 7/7 with the exact approved 27-scope fixture;
- `./setup.sh --db-only` (or the exact Windows equivalent) with `11 passed, 0
  failed of 11`, container health, Windows state, exact schema/drift, typecheck,
  import boundaries, licences, audit, and protected hashes;
- fresh isolated PostgreSQL/Compose proof, no MCP launch, no registry/network
  dependency in static validators, and no live-stack mutation;
- independent Tier-3 integration review personally rerunning the current-line
  security proofs and checking exact blob/SHA equivalence.

## Forbidden

- push, deployment, canonical merge, or self-review/self-merge under this order;
- semantic reimplementation, conflict resolution by behavior change, migration
  renumbering, weakening assertions, or claiming review from builder evidence;
- editing `migrations/0001_init.sql`, existing decisions/ledger lines, or unrelated
  product/status files;
- integrating Order 121 from any artifact other than D-357's exact reviewed
  executable;
- marking Order 118/121 approved, or closing any sibling Cyber finding, before the
  required independent reviews and proofs;
- resolving a product-intent, migration, tenant/RLS, role, API, or security
  collision without a question and the required authority.

## Definition of done

- [x] D-354 Order 118 receives independent Tier-3 approval and reviewer-run proof.
- [x] D-357 Order 121 receives an immutable implementation SHA and independent
      review approval.
- [ ] Orders 119 and 120 exact approved SHAs are integrated without blob drift.
- [ ] Order 118+122 and Order 121 exact reviewed SHAs are integrated without
      semantic reimplementation.
- [ ] Order 125 exact fixture correction and verification metadata are integrated
      without changing any production permission or seed.
- [ ] Full 16+/17-suite current-line matrix, setup 11/11, container/Windows/
      schema/hash and standing proofs pass from fresh isolated state.
- [ ] Independent Tier-3 integration reviewer approves the immutable integration
      tip and records exclusive provenance; no self-review or self-merge.
