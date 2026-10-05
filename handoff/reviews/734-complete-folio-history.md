# Order734 independent source review

Reviewer: Codex agent `/root/app_next_slice727`, not an Order734 implementer.
Builder: Codex agent `/root/folio_history734` (taking over the initial draft from
`/root/antigravity_dubai728`). Date: 2026-09-25.
Repository: `D:/Yellow/git-live-order611-source-v2`.
Authority: Order734 and resolved scope question735; reviewer writes this record
only and does not modify implementation or tests.

## Verdict and boundary

**APPROVED for the final revised read-only source freeze below. No open blocking
finding.** The reviewer personally repeated the affected suite and static gates
after the builder's cap repair and final test freeze.

The reviewer waited for the builder's freeze, personally inspected the source and
existing statement contract, checked hashes, and executed the proofs below. This
approval is not browser verification or a production-readiness claim. Root's
actual local browser checks, including explicitly labelled synthetic 151-row
responses when the real folio has fewer than 51 postings, remain outstanding at
review time. No financial records should be created for that QA.

No application source or test edits, PostgreSQL operations, hotel financial writes,
network/service requests, uploads, deployment, or public-tunnel changes were
performed by this reviewer. Order732's existing statement/database proof remains
separate; it is not claimed as a command executed by this reviewer for Order734.

## Inspected contract

- The initial statement continues to use the existing default-50 endpoint.
  Explicit older-page reads send `limit=100`, the exact retained cursor, the
  selected property/folio path, the existing session authorization, and an abort
  signal. No automatic unbounded paging or write endpoint was added.
- The history projection checks folio/reservation identity, currency, metadata,
  exact string balances, family membership, generation, line count, row identity,
  timestamp/date ordering, and the canonical cursor's property/folio/last-row tuple.
  Duplicate rows, malformed/cyclic cursors, impossible final counts, shortened
  nonterminal older pages, and page/family/generation drift require refresh rather
  than being merged.
- The API does not expose the posting sequence separately on each row. For equal
  date/time/journal tuples the helper correctly retains server order; it does not
  invent a client-side sequence or recalculate running balances.
- History accumulation is detached/frozen read-model state. It does not call
  `queryClient.setQueryData`, replace the authoritative first-page cache, mutate
  financial drafts, grant eligibility, or supply command evidence.
- A new authoritative first-page object or `dataUpdatedAt` refresh key creates a
  new history session. Context changes are keyed by property/reservation/folio.
  Reset and disposal abort pending reads and use revisions to suppress late results.
  Duplicate load clicks are suppressed synchronously. Network retry keeps the same
  cursor. A financial lock arriving before completion discards the incoming page.
- The UI reports loaded versus total postings, explicitly limits search/filter/sort
  claims until complete, exposes loading/retry/refresh-required status accessibly,
  and retains the shared column/copy table. History loading and refresh controls
  are disabled during the existing financial locks or authoritative refetch.
- Existing correction and additional-window owned leases, command confirmations,
  replay/uncertainty recovery, and navigation guards remain in place. Order735's
  two scoped assertion changes preserve keyed identity and prove the shared table
  remains inside FolioHistory; mutation/recovery assertions were not deleted.
- No backend, schema, financial policy, grants, dependency, or persistence changes
  were introduced by this slice. The entity/compliance review therefore requires
  no new domain primitive or financial authority.

## Personally executed proofs

All commands ran in the repository above using Bun 1.3.14 at
`C:\Users\astha\.bun\bin\bun.exe`. Results below are reviewer-executed, not copied
builder output.

```powershell
& 'C:\Users\astha\.bun\bin\bun.exe' test tests/order734-folio-history.test.ts tests/order734-folio-history.test.tsx tests/order672-folio-workbench.test.ts tests/order721-guest-billing-workspace.test.tsx tests/order714-finance-integration.test.ts tests/order714-additional-folio-window.test.tsx tests/order727-finance-integration.test.ts tests/order727-folio-charge-correction.test.ts tests/order727-folio-charge-correction.test.tsx tests/order729-folio-table-controls.test.tsx
```

Final-freeze result: **67 passed, 0 failed, 522 assertions**, ten files, exit 0
(1,258 ms). Both complete
affected Order672/721 files passed, alongside correction/window uncertainty and
ownership recovery tests and table-control regressions.

```powershell
& 'C:\Users\astha\.bun\bin\bun.exe' test tests/order672-folio-statement.test.ts tests/order674-table-query.test.ts
```

Result: **11 passed, 0 failed, 57 assertions**, two files, exit 0. This separately
checks exact monetary formatting, original row/balance preservation, and shared
filter/sort behavior.

Against the initial source freeze, the reviewer constructed and executed an ephemeral synthetic probe through
`bun -e $historyReviewProbe` (PowerShell single-quoted here-string, no file writes).
Result: **17 assertions passed**, exit 0:

1. No request is made automatically.
2. An actual 50-row first page plus a 100-row older page yields 150 rows.
3. The first request uses the exact first-page cursor.
4. The next request uses the exact preceding older-page cursor.
5. The last ten rows finish the 160-row statement with a null cursor.
6. All 160 rows retain server order.
7. All 160 exact `9007199254740993` minor-unit amounts are unchanged.
8. The authoritative input remains its original 50 rows and cursor.
9. Two concurrent load calls make only one request.
10. Reset aborts that request's signal.
11. A late completion cannot overwrite the reset first page.
12. A financial lock arriving during a read discards that incoming page.
13. That discarded completion retains the old cursor for safe retry.
14. An active financial lock prevents another request.
15. Disposal aborts its pending request.
16. A late disposed completion cannot append rows.
17. Effect-style reactivation returns to a usable ready state.

The fixture used 160 synthetic descending microsecond timestamps/unique UUID rows,
50/100/10 page slices, consistent family/generation/count metadata, canonical
property/folio cursors, and manually resolved promises. All reads were injected
in-memory functions; no network or real hotel records were used.

### Revised-freeze cap proof and retained findings

After the initial 64/0/504 proof, the builder found and fixed a cap edge: adding a
constant 100 to the loaded count blocked a final short page even when the complete
statement fit below 10,000. The shared `folioHistoryAtLimit` helper now considers
the server's remaining count; both controller and view use it. Initial approval was
withdrawn while the source freeze was replaced.

The reviewer then executed another ephemeral `bun -e $historyCapProbe` against
the final implementation hashes below: **622 assertions passed**, exit 0. Every
page cursor and accepted state was checked, alongside exact order/money,
completeness, bounded counts, and refusal to fetch after completion or at the cap.

| Server total | Initial page | Older-page calls | Loaded result | Complete |
| --- | --- | --- | --- | --- |
| 160 | 50 | 2 (100 then 10 rows) | 160 | yes |
| 9,999 | 50 | 100 | 9,999 | yes |
| 10,000 | 50 | 100 | 10,000 | yes |
| 10,001 | 50 | 99 | 9,950 | no; cap prevents the next full page |

While additional tests were being finalized, one superseded rendering fixture
rendered roughly 20,000 table rows across two SSR calls and exceeded Bun's 5,000 ms
test budget: reviewer result **66 passed, 1 failed, 522 assertions**, with the
failing cap-render test taking 12,460 ms. This was reported, not discarded as a
passing run. The builder changed only that fixture to retain 9,950 loaded rows but
select the single payment-class row for rendered table content. This still proves
loaded/total and cap text without rendering every copy control twice. No timeout
was raised and the final version passed in **14 ms**. The final pure controller
test also genuinely loads through the cap boundary.

Large-statement browser rendering performance at approximately 10,000 visible
rows remains unverified. The focused cap-text test and pure pagination proof do
not establish that performance; root's normal browser interaction proof remains
separate.

```powershell
& 'C:\Users\astha\.bun\bin\bun.exe' run typecheck
& 'C:\Users\astha\.bun\bin\bun.exe' run boundaries
git diff --check -- frontend/yellow/src/folio-history.ts frontend/yellow/src/ui/FolioHistory.tsx frontend/yellow/src/yellow-api.tsx frontend/yellow/src/workspaces/FinanceWorkspace.tsx tests/order734-folio-history.test.ts tests/order734-folio-history.test.tsx tests/order672-folio-workbench.test.ts tests/order721-guest-billing-workspace.test.tsx
```

Results, personally repeated after the final freeze: root and frontend typechecks passed, exit 0; import boundaries passed for
**208 TypeScript files**, exit 0; scoped diff check passed, with only the inherited
FinanceWorkspace CRLF-to-LF advisory. No unrelated baseline assertion repair was
made during this review.

## Frozen source and tests (SHA-256)

| File | SHA-256 |
| --- | --- |
| `frontend/yellow/src/folio-history.ts` | `d07fc55a733b1a84d74a20f7d144fd59316f0bfd5ea4026266a7e10e5f344cc5` |
| `frontend/yellow/src/ui/FolioHistory.tsx` | `80cc6fb65177a6eb6be386be7c7a31dcf5ae85bc2b1b83de037315b8c7d4e90d` |
| `frontend/yellow/src/yellow-api.tsx` | `e0b81d762cecfe6220635dc6ef1eea7151fb801697b0e0d602b228bfe59419b5` |
| `frontend/yellow/src/workspaces/FinanceWorkspace.tsx` | `7ffc72b8bc2c5da7cb6e4ffa7b10448e5f175613bd8e79eebadda19f31016ff9` |
| `tests/order734-folio-history.test.ts` | `742aa5f9da2fd20174e77f1342b9f03cc7e2f986adc1f1563ab2ea30852f7312` |
| `tests/order734-folio-history.test.tsx` | `bde34008e61bb365fd79b6c585925f320f5bbda50eed325b12f39b14d1e4504a` |
| `tests/order672-folio-workbench.test.ts` | `9fc258bfff89a3074f393862bf75366f9c1fa6ca62b5a277c16fe34b5d132520` |
| `tests/order721-guest-billing-workspace.test.tsx` | `5a0c3e147d2673b6cf0b29aebff9fa60494ee4ed6c764ad71957ab8fb851130e` |

Hashes were personally read using `Get-FileHash -Algorithm SHA256`. The four
implementation hashes match the builder's declared freeze. Any later source change
requires proportionate re-review; root browser evidence should identify its tested
candidate separately.
