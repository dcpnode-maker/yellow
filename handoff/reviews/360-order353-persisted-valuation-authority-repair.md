# Order360 / Order353 persisted valuation authority repair — independent Tier-3 review

**Verdict: WITHHOLD**  
**Reviewer:** `/root/order350_builder/order352_fresh_tier3`, fresh non-implementing Tier-3 reviewer  
**Exact subject:** product `b6aaa1f`, permanent proof `28b3a45`, governance `0bc71d7`  
**Reviewed ancestry:** `b6aaa1f` is an ancestor of `28b3a45`, which is an ancestor of `0bc71d7`; withheld Order353 parent is `15a1a06` / `1adc277`.

## Finding

### P1 — the committed PostgreSQL proof does not execute the required authority matrix

The repair correctly removes caller-supplied valuation, room-night and quoted-result fields. Production replays Order341 in the supplied transaction, selects up to two scoped current ordinary-final INR heads, rejects zero/multiple heads, loads room nights by tenant and valuation id, and validates dense order, positive values, total and persisted Order341 evidence hash.

However, `tests/india-gst-accommodation-final-component-tax-authority.integration.test.ts` contains only three cases and monkey-patches `IndiaGstAccommodationQuotedRateApplicabilityService.resolve` to return a fabricated replay. It therefore does not personally prove the production service's real Order341 replay in the same snapshot. It also omits required executable cases for two simultaneous current ordinary heads, duplicate/forked lineage, reservation mismatch, folio mismatch, reordered multi-night evidence, explicit same-UUID foreign-tenant containment, caller/snapshot transaction instrumentation, recursively immutable database-derived output, and comprehensive pre/post zero-write census across fiscal/document/posting state. The database suite's only successful calculation is one CGST+SGST value at 700000; the statutory below/at/above threshold, IGST, CGST+UTGST, unequal fractional, exact-half, bigint/overflow and multi-night deterministic calculations remain unit-level rather than mutation-sensitive persisted-authority proof.

D1019's claimed `3/0` is reproducible, but three green cases cannot satisfy Order360 Required proof 2–4 or D84's non-waivable reviewer-executed proof requirement. Broad/static gates cannot cure this missing evidence.

## Commands and exact results

All commands ran in disposable detached worktree `yellow-review360-fresh` at exact `0bc71d7`; canonical dirty worktrees, `.yellow`, Order359 and stable port3000 were not used.

```text
git show --stat --oneline b6aaa1f
git show --stat --oneline 28b3a45
git show --stat --oneline 0bc71d7
git merge-base --is-ancestor b6aaa1f 28b3a45
git merge-base --is-ancestor 28b3a45 0bc71d7
```

Result: both ancestry checks exited 0. Diffs are exactly service/export/unit repair at `b6aaa1f`, one authority integration file at `28b3a45`, and governance-only recording at `0bc71d7`.

```text
bun test tests/india-gst-accommodation-final-component-tax.test.ts \
  tests/india-gst-accommodation-final-component-tax-authority.integration.test.ts \
  tests/india-gst-accommodation-quoted-rate-applicability.test.ts \
  tests/india-gst-accommodation-levy-component-identity.test.ts
```

Without the database opt-in: `18 pass, 5 skip, 0 fail`, `818 expect()`; the three repaired API tests and approved Order310/337/341 ancestors pass.

```text
bun run typecheck
bun run boundaries
bun run license-check
bun audit
```

Results: typecheck exit 0; import boundaries `139 TypeScript files scanned`; licence policy passed for 23 packages; no vulnerabilities.

Fresh isolated PostgreSQL 16.15 used Compose project `yellow-order360-fresh`, loopback port 5680. Provision and migrations ran from the exact worktree:

```text
docker compose up -d postgres
docker compose --profile tools run --rm provision
docker compose --profile tools run --rm migrate
```

Result: authority provisioned and migrations 0001–0063 applied, `applied=63`.

```text
YELLOW_ORDER360_DATABASE_URL=<fresh-yellow_deploy-url> \
  bun test tests/india-gst-accommodation-final-component-tax-authority.integration.test.ts
```

Result: `3 pass, 0 fail, 12 expect()`:

- exact persisted-head calculation plus narrow fact/outbox/valuation/night count equality;
- hash mismatch and missing/null/negative/gapped nights fail;
- missing/manual/superseded/foreign-property cases fail.

Catalogue query result:

```text
63|116|106|15|2
```

An initial migration-gate invocation incorrectly targeted protected `yellow_dev` and correctly failed with `Admin URL must not point at protected database yellow_dev`. Re-run against the fresh admin database began successfully and passed the URL guard plus migration0015 connected-runtime rejection/retry and owned-sequence cases; it was not treated as a complete migration gate in this review.

## Missing proof required before rereview

Add permanent fresh-PostgreSQL cases that execute, through the real production service and real Order341 resolver in the supplied transaction:

1. zero and two current ordinary heads, fork/duplicate prevention, and manual successor exclusion;
2. tenant, property, reservation and folio mismatches, including same UUIDs in another tenant;
3. multi-night dense order, duplicate/reordered/gapped ordinals, date mismatch, null/zero/negative and sum mismatch;
4. below/at/above every slab, IGST/CGST+SGST/CGST+UTGST, unequal fractional, exact-half and signed-int64 overflow using persisted values;
5. query/transaction snapshot instrumentation, recursive immutability and full zero-write census covering valuation/night/fact/outbox plus document, fiscal, journal and posting surfaces.

Then a different fresh Tier-3 reviewer must personally run the completed hostile suite and the still-unexecuted migration, acceptance, runtime-DML, SECURITY-DEFINER, seed, review-seed, standing, schema and referee `11/11` gates. No Order353 approval or downstream fiscal authority follows from this review.

## Cleanup

Disposable Compose containers, network, volumes and detached worktree were removed after recording this evidence. No candidate, order, decision, ledger, canonical `.yellow`, local runtime or stable port3000 state was changed.
