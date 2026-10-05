# Review 655 - governed checkout completion command

**Reviewer:** `/root/order655_checkout_review`  
**Verdict:** PASS after re-review. No remaining findings.

## Resolved finding

The prior P1 contract-truthfulness defect is fixed. `src/demo/property-config.ts` now reports `publicDemoMutationMode="governed-proof-routes"`, `writesJournal=true`, `writesOccupancy=true`, `writesPayment=true`, and cashier posting/settlement enabled only through governed proof routes with exact confirmation. The related mobile shell, readiness, operating-journey, proof-bundle and property-config tests no longer carry stale "posting disabled" or "read-only-or-synthetic-only" claims.

Stale-copy check personally rerun:

```text
rg -n "read-only-or-synthetic-only|posting disabled|checkout remains disabled|writesJournal\s*:\s*false|writesOccupancy\s*:\s*false|writesPayment\s*:\s*false|enabledRealMutations=4|governedRealMutationFamilies=4|four governed" src tests handoff/orders/655-governed-checkout-completion-command.md
```

Result: no matches.

## Static review

- `src/demo/governed-checkout-command.ts` accepts only `CONFIRM YELLOW OPERATION`, the exact reservation `L3R-HX-0126`, folio `FOL-DEMO-303`, and room `303` before connecting to the database.
- Checkout reads the authoritative `folio_balance`, rejects non-zero balance, calls `release_occupancy(...)`, updates reservation to `checked_out`, segment to `departed`, folio to `closed`, and inserts one `reservation.checked_out` outbox row inside one tenant transaction.
- Replay branch rereads reservation/segment/folio/balance/occupancy and does not insert another outbox row.
- The scoped diff does not add direct `space_occupancy` DML; checkout uses `release_occupancy()`.
- Public/readiness/share/property contracts now truthfully distinguish mostly read-only/synthetic surfaces from the five reviewed governed real mutation families.

## Commands and results

```text
./state.sh
```

Completed with no output in this Windows shell.

```text
bun test tests/demo-governed-checkout-command.test.ts tests/demo-action-safety-matrix.test.ts tests/colleague-demo-proof-bundle.test.ts tests/colleague-demo-readiness.test.ts tests/demo-share-packet.test.ts tests/demo-property-config.test.ts tests/demo-governed-checkin-command.test.ts tests/demo-governed-cashier-posting-command.test.ts tests/demo-governed-cashier-settlement-command.test.ts
```

Passed: 35 tests, 0 failed, 341 assertions.

```text
bun run typecheck
```

Passed: `tsc --noEmit`.

```text
bun run boundaries
```

Passed: `Import boundaries OK: 18 TypeScript files scanned`.

```text
.\setup.ps1 -DbOnly
```

Passed. PostgreSQL 18 setup completed; `yellow_test tables: 81`; invariant referee reported `RESULT: 11 passed, 0 failed of 11`.

## Database proof

Because `setup.ps1` loads the referee fixture rather than the app demo seed expected by `scripts/provision-demo-arrival.ts`, I recreated `yellow_test`, ran migration plus app seed, and provisioned the demo arrival fixture for the governed route proof:

```text
docker compose exec -T postgres psql -U yellow -d postgres -v ON_ERROR_STOP=1 -c 'DROP DATABASE IF EXISTS yellow_test WITH (FORCE)' -c 'CREATE DATABASE yellow_test'
$env:DATABASE_URL='postgres://yellow:yellow@127.0.0.1:5442/yellow_test'
bun scripts/migrate.ts
bun scripts/seed.ts
bun scripts/provision-demo-arrival.ts
```

Result: migration applied `0001_init.sql`; seed inserted tenant/property; provision created Sara Al Harbi fixture with reservation `due_in`, segment `booked`, folio `open`.

Initial counts:

- `journal_count=0`
- `posting_count=0`
- `payment_count=0`
- `document_count=0`
- `checkout_outbox_count=0`
- `occupancy_count=0`
- reservation `due_in`, segment `booked`, folio `open`

Then I ran the governed flow sequentially:

```text
executeGovernedCheckInCommand({ confirmationPhrase: 'CONFIRM YELLOW OPERATION' })
executeGovernedCashierPosting({ confirmationPhrase: 'CONFIRM YELLOW OPERATION', chargeKey: 'dinner-charge-001' })
executeGovernedCashierSettlement({ confirmationPhrase: 'CONFIRM YELLOW OPERATION', settlementKey: 'cash-settlement-current-balance' })
executeGovernedCheckout({ confirmationPhrase: 'CONFIRM YELLOW OPERATION' })
executeGovernedCheckout({ confirmationPhrase: 'CONFIRM YELLOW OPERATION' }) // replay
```

Observed proof:

- Check-in executed from `due_in/booked` to `in_house/in_house`; `occupancyRowsForSegment=1`; outbox `reservation.checked_in`.
- Charge executed; journal inserted with 2 posting lines; balance `0 -> 125000`; outbox `folio.charge_posted`.
- Settlement executed; payment journal inserted with 2 posting lines and 1 payment row; balance `125000 -> 0`; outbox `folio.payment_settled`.
- Before checkout: `journal_count=2`, `posting_count=4`, `payment_count=1`, `document_count=0`, `checkout_outbox_count=0`, `occupancy_count=1`, reservation `in_house`, segment `in_house`, folio `open`, balance `0`.
- Checkout executed; proof showed `beforeBalanceMinor="0"`, `afterBalanceMinor="0"`, `releasedOccupancyRows=1`, `remainingOccupancyRows=0`, reservation `checked_out`, segment `departed`, folio `closed`, outbox event `reservation.checked_out`, seq `4`.
- Replay executed `false`; proof showed unchanged `checked_out/departed/closed`, balance `0`, `releasedOccupancyRows=0`, `remainingOccupancyRows=0`, existing outbox seq `4`.
- After replay: `journal_count=2`, `posting_count=4`, `payment_count=1`, `document_count=0`, `checkout_outbox_count=1`, `occupancy_count=0`, reservation `checked_out`, segment `departed`, folio `closed`, balance `0`.

Checkout itself therefore did not add journal, posting, payment, document, fiscal, or statutory writes in the measured bracket; only the checkout outbox count changed from 0 to 1 and occupancy for the segment changed from 1 to 0 through the governed command proof.

## Notes

- A first review attempt against the `setup.ps1` referee fixture database failed with `unit_type_property_node_fkey` because that fixture is not the app seed expected by the demo provisioner. The clean proof above used migration + app seed + provision.
- Earlier harness mistakes from the first review attempt were discarded and not counted as product failures: one PowerShell inline backtick parsing error and one accidental concurrent-promise race before settlement. The re-review proof above ran sequentially and passed.
