# Order 654 - governed cashier settlement command review

Reviewer: `/root/order654_settlement_review`
Date: 2026-09-23
Result: PASS

## Scope reviewed

- `handoff/orders/654-governed-cashier-settlement-command.md`
- `src/demo/governed-cashier-settlement-command.ts`
- `src/demo/demo-arrival-fixture.ts`
- `src/app.ts`
- `src/demo/action-safety-matrix.ts`
- `src/demo/proof-bundle.ts`
- `src/demo/colleague-readiness.ts`
- `src/demo/share-packet.ts`
- Focused matching tests:
  - `tests/demo-governed-cashier-settlement-command.test.ts`
  - `tests/demo-action-safety-matrix.test.ts`
  - `tests/colleague-demo-proof-bundle.test.ts`
  - `tests/colleague-demo-readiness.test.ts`
  - `tests/demo-share-packet.test.ts`

## Findings

No blocking findings.

## Commands and results

```powershell
bun test tests/demo-governed-cashier-settlement-command.test.ts tests/demo-action-safety-matrix.test.ts tests/colleague-demo-proof-bundle.test.ts tests/colleague-demo-readiness.test.ts tests/demo-share-packet.test.ts
```

Result: PASS. `18 pass, 0 fail, 219 expect() calls`.

```powershell
bun run typecheck
```

Result: PASS. `tsc --noEmit` completed with exit code 0.

```powershell
bun run boundaries
```

Result: PASS. `Import boundaries OK: 18 TypeScript files scanned`.

```powershell
.\setup.ps1 -DbOnly
```

Result: PASS. PostgreSQL/Valkey already running on project ports. `yellow_test` was recreated, migrated, loaded with the invariant fixture, and the referee reported `RESULT: 11 passed, 0 failed of 11`.

First live proof attempt against the freshly recreated invariant fixture failed before settlement mutation because that fixture does not include the public-demo org node:

```text
PostgresError: insert or update on table "unit_type" violates foreign key constraint "unit_type_property_node_fkey"
```

I then applied the ordinary project seed to the same disposable `yellow_test` database so the fixed public-demo tenant/property graph existed:

```powershell
$env:DATABASE_URL='postgres://yellow:yellow@127.0.0.1:5442/yellow_test'; bun scripts/seed.ts
```

Result: PASS. `seed tenant: inserted`, `seed property: inserted`, `seed summary: status=applied`.

Reviewer-owned live proof then provisioned the Sara Al Harbi fixture, posted one controlled positive demo charge, executed settlement, replayed settlement, and audited counts in PostgreSQL.

Key observed facts:

- Before settlement: folio balance was `125000`; settlement journals/payments/outbox/lines were all `0`.
- First settlement:
  - `executed: true`, `realPmsExecuted: true`
  - journal id `439024fc-4c0d-4e65-863a-e9255cf36175`
  - payment id `fc35bb33-0623-43f9-b400-6afdb0e614b3`
  - amount `125000`
  - posting line count `2`
  - before balance `125000`, after balance `0`
  - outbox event `folio.payment_settled`, outbox seq `2`
- PostgreSQL audit after settlement:
  - settlement journals `1`
  - settlement payments `1`
  - settlement outbox rows `1`
  - settlement posting lines `2`
  - cash marker instruments `1`
  - journal sum `0`
  - payment method `cash`
  - payment PSP marker `yellow-demo`
  - instrument kind `cash_marker`
  - instrument token `demo-cash-marker`
  - instrument last4 `null`
  - documents `0`
  - fiscal submissions `0`
  - statutory submissions `0`
  - occupancy rows `0`
- Replay:
  - `executed: false`, `realPmsExecuted: false`, `replayed: true`
  - settlement journal/payment/outbox/line counts stayed `1/1/1/2`
  - balance stayed `0`
  - no new outbox seq/correlation id was emitted on replay.

## Review conclusion

Order 654 is independently accepted. The scoped implementation keeps execution confirmation-gated, fixed to the public-demo folio and settlement key, uses the tenant transaction path, writes one balanced payment journal with two posting lines, one payment row and one outbox row on first execution, rereads `folio_balance`, and treats replay as non-mutating. The live audit found no PAN/last4, no document/fiscal/statutory writes, and no occupancy mutation.
