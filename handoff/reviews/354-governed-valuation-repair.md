# Order 354 — independent Tier-3 review

**Verdict:** WITHHOLD  
**Reviewed subject:** `62a5870ec113a1f91cf58ef5e4a6a52cf3a32f99`  
**Governance descendant:** `bf1d8b5ec7adb4ba195b90bcba828ea020d08e23`  
**Withheld parent implementation:** `6b61e72b6450981c5f69d81bb132e3490ff12dc5`  
**Reviewer:** `/root/order350_builder/order352_fresh_tier3`, fresh independent non-implementer

## Findings

### P1 — buyer override approval has no expiry boundary

Order 354 required an outside-candidate legal buyer to consume a different-user,
unexpired, one-use approval. The repaired migration checks that the approval is
`approved`, has a non-null `decided_at`, was decided by another active user, and has
the exact payload. It never compares `decided_at` or another persisted instant with
`transaction_timestamp()`, and `approval_request` has no expiry column. Consequently
an otherwise matching approval remains usable indefinitely. This does not satisfy
required repair 4 and must fail closed under an executable expired-approval case.

### P1 — mandatory hostile proof matrix is absent

The repair adds only three pre-database input-validation cases and expands the prior
single happy-path database case. It does not personally exercise the required:

- exhaustive manual-reason partitions;
- buyer expiry, reuse, concurrent consumption, or candidate-set change;
- correction-chain reclassification, fork, or race rejection;
- exact replay and divergent idempotency;
- injected rollback after each persisted effect and fact/outbox atomicity;
- allocator/reconciliation mutation sensitivity; or
- hostile direct-DML and authority cases.

These are explicit Order 354 repair 8 and definition-of-done requirements. Tier-3
executable proof is non-waivable, so green broad gates cannot substitute for the
missing cases.

## Reviewer-executed evidence

An immutable archive of exact subject `62a5870` was used with its own disposable
dependencies and the real repository object store for provenance-only tests.

```text
bun install --frozen-lockfile
23 packages installed

bun test tests/india-gst-accommodation-final-valuation.test.ts
7 pass, 0 fail, 16 expect() calls

bun run typecheck
pass

bun run boundaries
Import boundaries OK: 137 TypeScript files scanned

bun run license-check
Dependency license policy passed for 23 installed package(s)

bun audit
No vulnerabilities found

GIT_DIR=<shared object store> GIT_WORK_TREE=<subject archive> bun test
1208 pass, 919 skip, 0 fail, 18489 expect() calls
```

Source inspection commands:

```text
git show 62a5870:handoff/orders/354-order350-governed-evidence-and-proof-repair.md
git show 62a5870:DECISIONS.log | Select-String -Pattern 'D-999|D-1001' -Context 1,5
git show 62a5870:migrations/0062_india_gst_accommodation_final_valuation.sql
git show 62a5870:src/contexts/tax-fiscal/india-gst-accommodation-final-valuation.ts
git diff 6b61e72..62a5870 -- tests
```

The database catalogue, migration, authority, attribution, Order 341 and referee
gates were not represented as reviewer approval proof: the required hostile database
tests do not exist, and the approval-expiry defect independently makes the candidate
unapprovable. Provisioning PostgreSQL could not turn absent assertions into Tier-3
proof.

## Cleanup and containment

The disposable archive and its dependencies were removed. No database, container,
network or volume was created during this review. The shared candidate, order,
decisions, ledger, product, tests, `.yellow`, stable local services and port 3000 were
not changed.

Order 354 remains withheld until the approval lifetime is explicitly enforced and a
different fresh non-implementing Tier-3 reviewer personally executes the complete
hostile database matrix and all required gates on the repaired exact candidate.
