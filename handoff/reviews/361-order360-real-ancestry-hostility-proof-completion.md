# Orders 361 / 360 / 353 real-ancestry hostility proof completion — independent Tier-3 review

**Verdict: WITHHOLD**
**Reviewer:** `/root/order361_review_fast`, fresh non-implementing Tier-3 reviewer
**Exact subject:** product `b6aaa1f`, real ancestry proof `e79b935`, statutory matrix `d4d6662`, governance head `7557112`

## Incremental evidence — code and authority-proof inspection

The exact ancestry checks pass: `b6aaa1f` is an ancestor of `e79b935`, which is an ancestor of `d4d6662`, which is an ancestor of `7557112`. The production repair remains migration-free. The proof commits modify the bounded authority integration suite and export the real Order341 fixture/helper; no production authority, migration, schema, permission, route, UI, posting, document or IRP surface changes after `b6aaa1f` were found.

The permanent PostgreSQL authority file invokes the real `IndiaGstAccommodationQuotedRateApplicabilityService.resolve` in setup and invokes `IndiaGstAccommodationFinalComponentTaxService.calculate` under `BEGIN`, transaction-local tenant context and `SET LOCAL ROLE app_role`. It no longer monkeypatches the Order341 resolver. It includes persisted IGST, CGST+SGST and CGST+UTGST output checks, threshold, half-up/fractional, signed-int64 overflow, duplicate-current constraint, hash/missing/null/negative/gap, foreign tenant/property, manual/successor, recursive freeze and an eight-surface zero-write census.

### P1 — required permanent hostility matrix is incomplete

The file contains only five `test(...)` cases. Direct inspection finds no executable permanent case for several Order361 Required Proof items:

- reservation mismatch and folio mismatch;
- same-UUID foreign-tenant isolation (the existing foreign-tenant call merely substitutes a different tenant UUID and does not create colliding UUID rows in another tenant);
- reordered ordinals, business-date mismatch, zero room-night value, or explicit room-night sum mismatch;
- an explicit zero-current-head case for the exact otherwise-valid scope;
- one instrumented supplied transaction/snapshot proving every query uses that supplied transaction.

These omissions are directly required by Order361 and D1020's rereview contract. The imported Order341 suite proves its resolver receives an exact caller transaction in a test fixture, but the permanent PostgreSQL Order360 suite does not instrument the production component-tax service's resolver and valuation/night queries as one supplied database transaction/snapshot. The duplicate-current case correctly proves the database constraint rejects a second current ordinary head, but does not replace the omitted scope and room-night hostility cases.

Fresh execution did not reveal equivalent committed proof elsewhere. Approval is therefore withheld even though the implemented subset passes.

## Commands recorded so far

```text
git merge-base --is-ancestor b6aaa1f e79b935
git merge-base --is-ancestor e79b935 d4d6662
git merge-base --is-ancestor d4d6662 7557112
```

Result: all exited 0.

```text
rg -n '^\s*test\(' tests/india-gst-accommodation-final-component-tax-authority.integration.test.ts
```

Result: exactly five permanent test cases, at lines 77, 82, 94, 99 and 104 of the reviewed file.

## Fresh PostgreSQL execution

A disposable PostgreSQL 16 stack named `yellow-review361-fast` was provisioned from the exact detached `7557112` worktree. Migrations 0001–0063 applied successfully (`applied=63`). The exact catalogue query returned:

```text
63|116|106|15|2
```

The permanent authority suite was executed against that fresh database:

```text
YELLOW_ORDER360_DATABASE_URL=<fresh deploy URL> \
  bun test tests/india-gst-accommodation-final-component-tax-authority.integration.test.ts
```

Result: `10 pass, 0 fail, 594 expect() calls`. Five passing cases are the imported Order341 suite and five are the Order360 persisted-authority suite. This confirms real Order341 execution and the implemented statutory subset; it does not cure the specifically absent permanent cases listed above.

## Required completion before rereview

Add permanent fresh-PostgreSQL cases, through the real production component-tax service, for:

1. reservation and folio mismatch;
2. colliding same UUIDs in another tenant, proving tenant isolation rather than merely requesting an empty different tenant;
3. reordered ordinals, business-date mismatch, zero night value and total-versus-night sum mismatch;
4. explicit zero-current-head behavior for an otherwise-valid exact scope;
5. instrumentation proving the resolver and persisted valuation/night reads all use the one supplied transaction/snapshot.

Then a different fresh non-implementing Tier-3 reviewer must rerun the completed authority matrix and all Order361 database, static, standing, schema and referee gates. Broad gates were intentionally stopped after this decisive non-curative P1, at the coordination owner's direction.

## Cleanup

The disposable database stack, containers, network and volume were removed. The detached review worktree was clean and removed. Canonical `.yellow`, the dirty pre-existing `tests/migrate.integration.test.ts`, stable local services and port 3000 were not touched.
