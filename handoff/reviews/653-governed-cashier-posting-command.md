# Order 653 independent review — governed cashier posting command

Reviewer: Codex independent review agent (`/root/order653_cashier_review`)
Date: 2026-09-23
Verdict: PASS

## Scope inspected

- `handoff/orders/653-governed-cashier-posting-command.md`
- `src/demo/demo-arrival-fixture.ts`
- `src/demo/governed-cashier-posting-command.ts`
- `src/app.ts` route `POST /api/v1/demo/governed/cashier/post-charge`
- `src/demo/action-safety-matrix.ts`
- `src/demo/proof-bundle.ts`
- `src/demo/colleague-readiness.ts`
- `src/demo/share-packet.ts`
- `tests/demo-governed-cashier-posting-command.test.ts`

I did not edit implementation files.

## Findings

No blocking findings.

The command performs confirmation, fixed demo confirmation/folio, and finite charge-key validation before constructing a database connection. The supported path requires the existing explicit public-demo fixture, inserts one journal plus two posting lines in one tenant transaction, rereads `folio_balance`, writes one `folio.charge_posted` outbox event, and detects replay by the fixed journal `source @>` charge key.

## Proof executed

Focused test:

```text
bun test tests/demo-governed-cashier-posting-command.test.ts
5 pass
0 fail
31 expect() calls
```

Explicit fixture provisioning against local PG18 `yellow_dev`:

```text
$env:DATABASE_URL='postgres://yellow:yellow@localhost:5442/yellow_dev'; bun scripts/provision-demo-arrival.ts
tenantId=6d9b7ce2-2d14-5576-b8c3-80f06501a603
propertyNode=4518a22f-b455-54c6-a50a-4584383749b9
confirmationNo=L3R-HX-0126
roomCode=303
reservationStatus=in_house
segmentStatus=in_house
folioStatus=open
guestAccountId=00000000-0000-4000-8000-000000006523
revenueAccountId=00000000-0000-4000-8000-000000006527
```

Early-return proof with unusable DB URL `postgres://yellow:yellow@127.0.0.1:1/yellow_dev`:

```text
unconfirmed:
confirmed=false executed=false realPmsExecuted=false databaseConfigured=true proof=null
reason="Exact confirmation phrase is required before any database mutation."

unsupported charge:
confirmed=true executed=false realPmsExecuted=false databaseConfigured=true proof=null
reason="This governed cashier posting command is limited to the fixed public-demo folio and charge catalog."
```

Supported posting proof used `chargeKey=«REDACTED-SECRET»`:

```text
before:
folio_balance=125000
charge_journals=0
charge_lines=0
charge_outbox=0
folio_count=1
reservation_state=00000000-0000-4000-8000-000000006525:in_house
occupancy_count=1
payment_count=0
payment_instrument_count=0
document_count=0
statutory_submission_count=0
sealed_business_day_count=0

first execution:
executed=true
realPmsExecuted=true
journalId=cdebf76b-9f35-4889-b4f3-cb3f654dc3f7
amountMinor=65000
postingLineCount=2
beforeBalanceMinor=125000
afterBalanceMinor=190000
outboxEventType=folio.charge_posted
outboxSeq=10
replayed=false

after first execution:
folio_balance=190000
charge_journals=1
charge_sum=0
charge_lines=2
charge_outbox=1
folio_count=1
reservation_state=00000000-0000-4000-8000-000000006525:in_house
occupancy_count=1
payment_count=0
payment_instrument_count=0
document_count=0
statutory_submission_count=0
sealed_business_day_count=0

replay:
executed=false
realPmsExecuted=false
journalId=cdebf76b-9f35-4889-b4f3-cb3f654dc3f7
postingLineCount=2
beforeBalanceMinor=190000
afterBalanceMinor=190000
outboxEventType=null
outboxSeq=null
replayed=true

after replay:
folio_balance=190000
charge_journals=1
charge_sum=0
charge_lines=2
charge_outbox=1
folio_count=1
reservation_state=00000000-0000-4000-8000-000000006525:in_house
occupancy_count=1
payment_count=0
payment_instrument_count=0
document_count=0
statutory_submission_count=0
sealed_business_day_count=0
```

Static gates:

```text
bun run typecheck
$ tsc --noEmit

bun run boundaries
$ bun scripts/check-import-boundaries.ts
Import boundaries OK: 18 TypeScript files scanned
```

PG18 referee:

`./setup.sh --db-only` exits successfully in this PowerShell environment but does not surface Bash output. I therefore reproduced its DB-only commands visibly: migrated/seeded `yellow_dev`, dropped and recreated `yellow_test`, applied migration `0001_init.sql`, loaded `tests/seed_fixture.sql`, confirmed `81` public tables, then ran the referee directly.

```text
PASS  TC-12.1  50-thread exclusive race → exactly 1 winner  winners=1
PASS  TC-12.2  private vs beds never coexist  exclusive=1 beds=0
PASS  TC-12.3  40 threads for 6 beds → exactly 6  claims=6
PASS  TC-12.4  direct INSERT blocked (42501)  code=42501
PASS  TC-12.5  concurrent commit throughput  162 commits in 1.07s = 151/s
PASS  TC-5.6   unbalanced journal rejected at COMMIT
PASS  TC-7.1   balanced journal commits
PASS  TC-5.4   posting to sealed day blocked
PASS  TC-8.2   100 concurrent invoice numbers gapless  issued=100 range=1..100
PASS  TC-13.1  table RLS: A sees 16, B sees 0  A=16 B=0 tenant_tables=73 rls=73 policies=73
PASS  TC-13.4  view RLS: each tenant sees only itself  A:2rows B:1rows views=2 security_invoker=2

RESULT: 11 passed, 0 failed of 11
```

## Notes

- The fixture was already checked in (`reservationStatus=in_house`, `segmentStatus=in_house`) before this review proof. The cashier posting command did not change reservation state.
- `dinner-charge-001` had already contributed `125000` to the folio balance before this review; this review used `«REDACTED-SECRET»` to prove a fresh supported first posting and replay behavior.
