# Order 492 independent cashier posting review

Date: 2026-09-20. Reviewer: **Codex Astra**, independent agent `/root/astra_review`; not the implementer.

**Verdict: ACCEPT the frozen, bounded cashier charge-posting source slice.** No remaining blocking finding in the reviewed path after the implementer corrected monetary presentation. This is not public deployment approval, full Order 492 completion, or a mobile/browser end-to-end certification.

## Frozen bytes

Runtime source: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

| File | SHA256 |
| --- | --- |
| frontend/yellow/src/App.tsx | `16454CB2462CE282A6BBCDCEC9747A1E0C21A54A4483A0B02F1F090A3D5F7213` |
| frontend/yellow/src/styles.css | `1F4D00089A6C08679FCAB2F953458E1E4E18428BCBD3540D295D899F566856C3` |
| tests/yellow-next-finance-workspace.test.ts | `724C596CEDE7B451FA93DC5CE803B08B0CE0BDE465DC9DE91693735B89344C83` |

Read Order 492 and inspected the client helper/workbench, CSS, focused tests, existing HTTP adapter and financial posting service. Used code-review and Yellow Postgres/entity skills to check confirmation, canonical server authority, bigint boundaries, immutable accounting and real-database proof. Reviewer made no production source changes.

## Source findings and resolution

- `postFolioCharge()` calls only **POST `/api/v1/properties/:property/folios/:folioId/charges`**, with bearer session, supplied idempotency key and only `txCode`, string `amountMinor`, optional string `quantity`. No account, journal, posting, tenant, tax, override or business-date authority is invented in the browser.
- The workbench loads the existing reservation/detail/folio-statement surfaces. `chargeOptions` come solely from the statement; no invented transaction codes are offered. Posting requires the server's `chargeAvailability.allowed`, a selected supplied option, syntactically positive amount/quantity, visible explicit confirmation and no current post.
- Statement loading/error hides posting. Server-denied availability disables it. The immutable rows are displayed from the returned statement rather than optimistic local accounting.
- One key is retained in a ref for an unchanged failed candidate. Editing code/amount/quantity or changing stay/folio clears the key and confirmation. Success clears the candidate; denial keeps the same candidate/key, displays the error and refetches the statement. Neither branch fabricates ledger rows or a false success message.
- Existing HTTP code checks write scope, exact property grant, IDs and charge body/key, derives actor/tenant/property audit authority, and delegates to the canonical `ChargeService`. That service handles current folio/account/catalogue/route/day truth, exact bigint amounts, balanced postings, idempotency and same-transaction fact/outbox. No new financial semantics or raw DML were added by this UI.
- Initial UI displayed raw balances beside currency without a minor-unit label and rendered `quantity × amountMinor`, although the service treats amountMinor as the **total**, with quantity metadata. The reviewer reported both. The implementer changed the frozen UI to explicitly label minor units and `total … · quantity …`; the tests now guard these labels. No multiplication or major-unit conversion is implied.
- CSS retains a visible confirmation panel and stacks the cashier grid at the existing mobile breakpoint. This is source inspection, not a viewport rendering claim.

## Personally executed frontend proof

```powershell
bun test tests/yellow-next-finance-workspace.test.ts tests/yellow-voice-routing.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-next-public-surface.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bunx tsc --noEmit
bun D:/Yellow/temp/astra-order492-cashier-review-20260920/component-proof.ts
```

Final results: **16 pass / 0 fail / 84 assertions**, no skips; both TypeScript checks exit **0**. The initial before-label-fix run was 16/0/81; final approval is tied to the hashes above and the final rerun.

Independent retained harness SHA256: `476C827C55148B187B48769FAE367746EA5C8982CD0EC0AC9C0DDA97AF107BBB`.

The harness extracts/transpiles the actual `CashierWorkbench` and `postFolioCharge`, executes controlled hooks/query responses, and asserts:

- offered charge codes are exactly the server-provided choices; a fabricated code cannot enable posting;
- a prepared amount/code cannot submit before confirmation;
- failure refreshes truth and displays denial, without claiming success;
- unchanged candidate retry uses identical key and body;
- amount change clears consent and issues a new candidate key only after reconfirmation;
- changing folio clears consent;
- denied availability and unavailable statement cannot offer posting;
- acknowledged success clears amount/confirmation/key and refetches without constructing a ledger row;
- the helper preserves exact canonical route, POST, bearer, supplied key and string-money payload.

An initial harness-only missing JSX Fragment stub was fixed; the final harness exits **0**. This is controlled component-function testing, **not React DOM, browser or mobile E2E**.

## Personally executed fresh financial and authenticated HTTP proof

Created a wholly new reviewer-owned native **PostgreSQL 16.15** cluster at `D:/Yellow/temp/astra-order492-cashier-review-20260920/data`, bound only to **127.0.0.1:55518**, database `yellow_astra492_cashier`. No public target or implementer database was touched.

```powershell
initdb.exe -D D:/Yellow/temp/astra-order492-cashier-review-20260920/data -U yellow_deploy --auth=trust --encoding=UTF8
# Hidden postgres: -D <above> -h 127.0.0.1 -p 55518
# Created documented deployment/owner/runtime/registrar authority.
# Random runtime/registrar passwords generated only in-process.
# Normal runMigrations applied 0001-0095; tests create their own synthetic fixtures.
$env:YELLOW_FINANCIAL_POSTINGS_URL='postgres://yellow_deploy@127.0.0.1:55518/yellow_astra492_cashier'
$env:YELLOW_REQUIRE_FINANCIAL_POSTINGS='1'
$env:YELLOW_OPERATOR_FOLIO_URL='postgres://yellow_deploy@127.0.0.1:55518/yellow_astra492_cashier'
$env:YELLOW_REQUIRE_OPERATOR_FOLIO='1'
bun test tests/financial-postings.integration.test.ts tests/operator-folio-workbench.integration.test.ts --timeout 120000
```

Result: **35 pass / 0 fail / 377 assertions**, no skips, 15.80 seconds. Independently verified the resulting ledger is contiguous **1–95** and every migration checksum matches its source.

Personally executed coverage includes:

- exact signs, zero balance, posting routes and minimized journal fact/outbox;
- exact replay, changed-request conflict and twenty same-key contenders producing one effect;
- injected failure after actual outbox insertion rolls back all artifacts, then safe retry;
- concurrent seal latch and sealed-day rejection;
- malformed money/quantity/audit authority and invalid folio/catalogue/route/day truth writing nothing;
- foreign-tenant financial table/view/route denial and prohibited reference/seal actions;
- **500 charges, 1,000 balanced immutable posting lines**, exact replays with no drift, and denied direct journal/posting mutation;
- real authenticated HTTP read/write grant separation, property hierarchy and tenant containment;
- hostile request/body denial before effects and canonical POST producing the expected journal with exact replay.

The suites use a deployment connection for isolated fixture setup and the normal `Database.withTenantTransaction()`/app_role path for financial commands; this is not misrepresented as a separate yellow_runtime-login test. Authenticated HTTP tests exercise the existing in-process app and canonical endpoint, not the newly rendered React surface.

## Boundaries and remaining work

The UI offers a bounded positive integer-quantity subset of the canonical contract and does not add a free-text reason field unsupported by that exact charge API. No new reason/price calculation semantics should be inferred. Broader natural-language guest/room/folio resolution, operation catalogue, complete prerequisite workflows and desktop/mobile rendered acceptance remain separate Order 492 work.

Retry identity is retained for the unchanged in-memory candidate, not across reload/unmount or a deliberately edited/replaced candidate. Durable unknown-outcome recovery is not proved here. Public deployment requires its own target-bound review; a green source suite is not authorization. Whole-repository referee/CI was not run, and the 35-test result must not be called the 11-invariant referee.

Reviewer stopped only this owned cluster using `pg_ctl.exe -D D:/Yellow/temp/astra-order492-cashier-review-20260920/data -m fast -w stop` (exit 0). Retained harness/data remain local. No public DB mutation, operational action, migration, app release, payment/provider call or financial data export occurred.
