# Order 252 independent Tier-3 review — APPROVED

**Reviewer:** OpenAI Codex independent production reviewer (implemented only the
Order252 proof lane and D-654 Order081 harness correction; did not implement migration
0041 or `ReservationCommitService` production changes)

**Reviewed base:** `7857655` descendant worktree at the final uncommitted Order252 diff

**Decision:** APPROVED

## Summary

The final Order252 implementation satisfies D-653 and the narrow D-654 proof-surface
correction. A successful held reservation can append exactly one immutable link from
an existing quoted-tax hold binding to its newly inserted reservation and first
segment. The link, one minimized fact and one minimized outbox event are inside the
existing reservation idempotency transaction. Unquoted held reservations return from
the capability with zero rows, direct reservations do not call it, exact replay emits
no duplicate evidence, and the public reservation receipt is unchanged.

No blocking finding remains. Earlier executable review exposed two issues that are
corrected in the final diff: the no-binding branch originally followed actor/product
authority checks and broke inherited unquoted fixtures; it now returns immediately
after the invoker, tenant-context and non-null identity guards. The inherited Order081
proof originally used deployment authority for application transactions; D-654 now
uses separate deploy fixture and runtime application connections without changing its
five behavioral cases.

## Scope and implementation inspection

- Migration `0041_quoted_tax_reservation_lineage.sql` has reviewed SHA-256
  `01034a5fd25d44a1244ef7da872d7d3f9b6b498d5476ba7d0d9c683842f9a00d` and adds one
  tenant-leading append-only root. Exact composite foreign keys retain the complete
  source binding identity and bind the reservation and first segment; tenant-leading
  unique constraints prevent binding, reservation or segment reuse.
- The table is owned by `yellow_owner`, has tenant RLS, grants `app_role` SELECT only,
  grants no runtime/PUBLIC/table mutation, and exposes only the exact six-UUID
  capability to `app_role`.
- The owner-mediated capability is `VOLATILE SECURITY DEFINER` with fixed
  `pg_catalog, public, pg_temp` search path and schema-qualified references. Its
  `session_user=yellow_runtime`, explicit `SET ROLE app_role`, `current_user` owner,
  transaction-local tenant and non-null identity guards fail closed.
- An absent hold binding returns no row and reveals no product truth. A present
  binding requires active tenant/property/actor, serializes on the immutable binding,
  returns an exact stored receipt for replay, and locks/checks consumed hold, reserved
  reservation and booked first segment with exact property, currency, sellable unit,
  half-open period and parent reservation agreement before insertion. Divergent reuse
  cannot rebind the lineage.
- `ReservationCommitService` calls the capability only for an acquired hold, after
  the existing inventory transfer and frozen preparation/acquisition equality check.
  Receipt UUID/hash/currency/time/actor and acquired identities are validated. A
  created receipt records the exact nine-key payload as fact first and outbox second,
  before the existing primary guest and reservation evidence, through the same `Tx`.
  Zero rows and `created=false` are quiet no-ops. Any failure rolls the entire outer
  idempotent reservation transaction back.
- The generated schema, migration acceptance manifest, setup 41/96 oracle, contract,
  Phase7 plan/build/roadmap/decision/ledger text and D-654 split-authority harness are
  consistent with the order. No folio, account, transaction-code, tax-route, journal,
  posting, document, India/IRP, HTTP, UI, seed, credential, local-promotion or deploy
  authority was added.

## Personally executed evidence

- Intentional red before implementation: focused migration-presence proof was
  **0 pass, 1 fail** because migration0041 was absent.
- Fresh PostgreSQL Order252 proof with split deploy/runtime authority:
  **7 pass, 0 fail, 24 expectations**. It covers unquoted held/direct zero lineage,
  exact quoted lineage/fact/outbox, replay/divergence/foreign authority, injected
  publication rollback, public-response containment and zero financial/document
  artifacts.
- Affected Order129 reservation-parent/occupancy regression:
  **7 pass, 0 fail, 45 expectations**. This personally confirms the corrected
  no-binding branch for held conversion, rollback and hold contention.
- D-654 Order081 reservation-commit regression on a fresh database with separate
  deploy/runtime URLs: **5 pass, 0 fail, 106 expectations**.
- `./setup.sh --db-only` on isolated reviewer infrastructure: migrations **1–41**,
  **96 public tables**, **86 RLS-enabled tenant tables**, **86 policies**, and referee
  **11 passed, 0 failed**.
- Fresh canonical seed plus database acceptance:
  **10 pass, 0 fail, 22 expectations**; migration ledger, ownership, ACL/RLS,
  capability signature and exact 96/86 schema shape pass.
- `bun run schema:check`: exact match to `tests/schema/expected.sql`.
- `bun x tsc --noEmit`: pass. `bun run boundaries`: pass, **93 TypeScript files**.
  `git diff --check`: pass.
- Default `bun test` produced **832 pass, 736 environment skips, 1 inherited timeout,
  8,474 expectations**. The sole result was Order239 P4 crossing its fixed five-second
  ceiling (6.315 seconds in the standing run and 5.176 seconds focused), unrelated to
  every Order252 surface. The same complete final tree with a ten-second test ceiling
  was **833 pass, 736 skips, 0 fail, 8,474 expectations across 1,569 tests/283 files**.
  This timing disclosure is retained and is not represented as a canonical default
  standing green result.

## Verdict

**APPROVED.** The reviewed production migration and reservation hook preserve the Ten
Invariants and satisfy the bounded D-653/D-654 contract with fresh executable
PostgreSQL proof. Approval covers only the quoted-tax hold-to-reservation/first-segment
lineage and its exact proof surfaces. It does not approve folio/account routing,
posting, document or India policy, local promotion, merge, push, public/production
deployment, Phase7 completion or application completion.
