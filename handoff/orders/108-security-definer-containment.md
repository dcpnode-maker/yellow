# Order 108 — SECURITY DEFINER shadow-path containment

**Phase:** 5 security gate  
**Branch:** `phase-5/security-definer-containment-current`  
**Base:** `5f9d26c` — completed founder-status correction  
**Risk tier:** 3 — database privilege boundary, occupancy, outbox retention and business-day seal  
**Severity:** release-blocking critical  
**Owner:** Codex implementation; independent non-implementing reviewer required

## Outcome

Integrate the independently reviewed SECURITY DEFINER containment on the current
application line after that separate review is final. An `app_role` session must not
make any current definer resolve attacker-owned `pg_temp` relations or execute an
attacker trigger with the deployment owner's authority. Existing occupancy, outbox,
hold-expiry, day-open and day-seal behavior must remain exact.

## Confirmed red and provenance

The sealed Cyber scan `e2a116cd-6e6d-4c8d-a741-9fa5c9f33fbb` validated this as its
single critical finding (`occ_3e8dc89f07118473ce5c182e`). Separate branch
`phase-5/security-definer-containment` has an independently reproduced parent exploit
and a green candidate at `2c11ce9`, but it is not an ancestor of the live app and its
review record is not yet final. This order must not copy or claim that work until the
reviewing task sends its final immutable approval record. It then re-proves the result
against this exact current lineage.

This order contains that exploit class only. Caller-supplied tenant trust, runtime
superuser DSNs, the repository-known JWT key and actor-unbound idempotency remain
separate validated findings.

## Scope

- `migrations/0011_security_definer_containment.sql`
- `tests/security-definer-containment.integration.test.ts`
- `tests/migrate.integration.test.ts`, `tests/database-acceptance.integration.test.ts`,
  `tests/schema/expected.sql`
- `scripts/run-phase-3-gate.ts`, `tests/phase-3-gate-runner.test.ts` to restore the
  omitted inherited Order-104 financial suite documented by Question 137 and make
  the hostile proof reviewer-triggerable on a separate isolated database
- `tests/operator-inventory.integration.test.ts`,
  `tests/operator-rate-configuration.integration.test.ts`,
  `tests/operator-rate-pricing.integration.test.ts`,
  `tests/operator-restrictions.integration.test.ts`, and
  `tests/operator-oos-policy.integration.test.ts` only to correct Question 138's
  stale review-role scope labels/literals to the already-proven current seed
- `docs/SECURITY.md`, `docs/CONTRACTS.md` only for the exact definer/ACL contract
- `src/project-status.ts` only after green proof, to record the built order honestly
- this order, `handoff/PHASE-5-PLAN.md`, `handoff/LEDGER.md`, `DECISIONS.log`, the
  independent review record, and `handoff/questions/` if a hard floor fires

## Required work

1. Forward migration 0011 replaces exactly the six current SECURITY DEFINER
   signatures: `record_occupancy`, `release_occupancy`, `expire_holds`,
   `prune_outbox`, `assert_day_open`, and `seal_business_day`.
2. Every replacement uses exact function-level
   `SET search_path = pg_catalog, public, pg_temp`; every Yellow relation and Yellow
   function call is explicitly `public.`-qualified.
3. Preserve signatures, return types, defaults, trigger attachment, occupancy lock and
   claim behavior, hold expiry, posting-day latch, seal authority and SQLSTATEs.
4. Revoke all execution from `PUBLIC`. Grant `app_role` only the existing runtime
   authorities `record_occupancy`, `release_occupancy`, and `seal_business_day`.
   Trigger invocation of `assert_day_open` must continue without a direct app grant.
5. `prune_outbox` rejects negative retention with SQLSTATE `22023`; zero and positive
   retention retain existing published-row semantics.
6. Restore the exact already-reviewed financial-postings suite mapping omitted by the
   canonical lineage, then add the hostile suite. The cumulative runner must contain
   fifteen unique isolated suites so the independent reviewer can personally execute
   both inherited financial truth and this fix at an immutable current-line SHA.
7. Correct four inherited seventeen-scope proof literals and five stale display labels
   to the current exact twenty-seven-scope review seed. Do not change runtime authority.

## Forbidden

- Editing any existing migration or `tests/run_invariants.py`
- New table, column, index, event, state transition or application endpoint
- Changing occupancy capacity/exclusion, journal signs, seal behavior, outbox meaning,
  hold transitions, tenant policy shape, roles, DSNs, ownership or `RESET ROLE`
- Copying the candidate before its final independent review message arrives
- Bundling sibling findings, broad grants, dynamic SQL, dropping a choke point,
  self-review, self-merge or weakened assertions
- Touching user-owned `.agents/`, `.codex/hooks.json` or `handoff/chat-archive/`

## Pre-registered proof

### P0 — hostile red on exact parent

Against fresh migrations 0001–0010, app role creates attacker-owned temporary
`outbox` and `business_day` relations with hostile triggers. Direct app-role insertion
into an owner-protected probe is denied, yet `prune_outbox` and `seal_business_day`
reproduce owner-authority execution through the temporary objects.

### P1 — hostile shadows inert after 0011

On fresh 0001–0011, identical temporary objects remain untouched, no protected marker
is written, and each definer uses only its exact `public` relations. Catalog inspection
requires all six signatures, exact safe search path and schema-qualified Yellow objects.

### P2 — least execution authority

PUBLIC executes none of the six; app role calls only record, release and seal; direct
expire, prune and assert calls fail `42501`; the day-open trigger still works for an
authorized journal insert.

### P3 — invariant behavior retained

Occupancy, hold expiry, published-only pruning, negative-retention rejection, day-open
and both seal serialization directions retain their existing exact behavior.

### P4 — rollback and isolation

Every hostile or denied call leaves public domain truth and the protected probe
unchanged; tenant B cannot observe tenant A through ordinary RLS. No sibling finding
is silently claimed fixed.

### P5 — standing and independent execution

Focused, migration/deployment, exact schema, cumulative gate, standing, typecheck,
boundaries, licences/audit, protected hashes and pristine 85-table referee pass. A
non-implementing Tier-3 reviewer personally runs P0 on the parent and P1–P4 on the
immutable current-line implementation SHA.

## Definition of done

- [x] Order and hostile proof are specified before current-line implementation.
- [x] Separate candidate's final independent review record is received.
- [x] P0 reproduces the exploit on exact current parent.
- [x] Migration 0011 contains all six definers with safe resolution and ACLs.
- [x] P1–P4 pass without changing authorized domain semantics.
- [x] Cumulative/referee/standing gates pass and protected files remain exact.
- [x] Independent reviewer personally approves immutable executable SHA
  `ee4ec0c48d7ebb62328454f2df3c22ed665108a7`.
