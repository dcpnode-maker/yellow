# Order729 independent source review

Reviewer: Codex agent `/root/app_next_slice727` (not the Order729 implementer).
Date: 2026-09-25.
Repository: `D:/Yellow/git-live-order611-source-v2`.
Authority: Order729 review-only scope, explicitly extended by root to this record.

## Verdict and boundary

Source-only approval: no blocking finding in the four frozen Order729 files.
This is not browser verification, deployment approval, or an ecosystem-complete
claim. Root's actual hide/show/reset/copy interaction and mobile localized-scroll
checks remain outstanding at the time of this review.

The reviewer inspected the implementation and personally executed the commands
below; these results are not copied implementer proof. No source changes, financial
writes, runtime deployment, map requests, or uploads were performed in this review.

## Inspected contract

- Selected columns are projected in canonical order and have a non-empty fallback.
- The same visible-column collection drives headers and body cells.
- Reset clears the query and restores all columns.
- Copy controls receive the exact displayed cell text; the existing exact bigint
  monetary formatter is unchanged.
- Numeric styling uses amount/balance field identity rather than column position.
- Filtering and sorting retain original ledger values and do not calculate new
  running balances.
- Existing shared table editor and copy components are reused, without changing
  their semantics.

## Personally executed proof

Commands ran in the repository above with Bun 1.3.14, invoked as
`C:\Users\astha\.bun\bin\bun.exe`.

```powershell
& 'C:\Users\astha\.bun\bin\bun.exe' test tests/order729-folio-table-controls.test.tsx tests/order672-folio-statement.test.ts tests/order674-table-query.test.ts
```

Result: **15 passed, 0 failed, 80 assertions**, three test files, exit 0.

A broader adjacent sweep was also personally executed:

```powershell
& 'C:\Users\astha\.bun\bin\bun.exe' test tests/order729-folio-table-controls.test.tsx tests/order672-folio-statement.test.ts tests/order672-folio-workbench.test.ts tests/order672-navigation.test.ts tests/order674-table-query.test.ts tests/order674-shell.test.ts tests/order674-search-context.test.ts tests/order674-movement.test.ts
```

Result at review time: **38 passed, 3 failed, 210 assertions**, eight files. This
broader command was not green and is not represented as a passing release gate.
The precise failures were reported to root:

1. `tests/order672-folio-workbench.test.ts:13` expected the old source literal
   `locked={depositLocked && additionalWindowLease.current === null}`. The new
   Order727 correction lease intentionally adds another ownership exclusion. This
   stale expectation was induced by Order727, not Order729; its repair requires
   explicit Order727 scope amendment and must preserve the strong lock assertion.
2. `tests/order672-navigation.test.ts:35` expected `Group blocks</h2>` in the
   reservation workspace. That source is untouched by Orders727/729; this is an
   unrelated pre-existing copy assertion.
3. `tests/order674-shell.test.ts:14` expected the Reservations parent navigation to
   have `aria-current="page"`. The existing nested navigation puts current-page
   state on Individual instead. OperatorHeader is untouched by Orders727/729;
   this is an unrelated pre-existing navigation assertion.

No unrelated baseline tests were repaired or weakened by this reviewer.

After Order730 also froze, the same reviewer personally ran the combined source
type and boundary checks while the Order729 hashes below remained unchanged:

```powershell
& 'C:\Users\astha\.bun\bin\bun.exe' run typecheck
& 'C:\Users\astha\.bun\bin\bun.exe' run boundaries
```

Results: root and frontend TypeScript checks passed, exit 0; import boundaries
passed for **208 TypeScript files**, exit 0.

## Reviewed source freeze (SHA-256)

| File | SHA-256 |
| --- | --- |
| `frontend/yellow/src/ui/FolioStatementTable.tsx` | `c3b2dc75e963001c9eb521b6746e5790c2d5a96e8e10ec78409b2ff9273c2937` |
| `frontend/yellow/src/folio-statement-view.ts` | `3d1f85a8e321ce32c9338b911daed363575f9804cda8a80ae5d553ad06189a8b` |
| `frontend/yellow/src/ui/folio-workbench.css` | `291226eb072b6f22a8b1975ca5e94c789fe79c0bbadf0b74dcbe85e02596020b` |
| `tests/order729-folio-table-controls.test.tsx` | `8d837a27379c59f66abb4a1748d73e8d5b2c06d48d5f98a012d2e2ac301ad705` |

These hashes were personally read with `Get-FileHash -Algorithm SHA256` and matched
the reviewed freeze. Changes after this snapshot need proportionate re-review.
