# Order 557 — reservation operational-state matrix

## Objective

Close the remaining PMS04 evidence gap with an actual PostgreSQL matrix proving that
the reservation board reconciles stored reservation state, lifecycle facts, stay
instants and each property's timezone without inferring planned events as completed.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/reservation-operational-state-matrix.integration.test.ts`
- `handoff/reviews/557-reservation-operational-state-matrix.md`
- `handoff/LEDGER.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`

## Required behaviour

1. Exercise at least two materially different IANA property timezones against one
   database transaction clock.
2. Cover early/late local arrivals, same-day in-house with and without a current
   check-in fact, overnight stayover, due-in/due-out priority, current-day checkout
   and historical checkout.
3. Reconcile every projected board state to the stored reservation status, local
   stay dates and unsuperseded lifecycle fact business dates read from PostgreSQL.
4. Prove the read is tenant/property scoped and mutation-free.
5. Use only a disposable test database; no public/demo hotel record may change.

## Verification

- Intentional red before the fixture matrix exists.
- Fresh migrated PostgreSQL 16 disposable database, actual matrix green, strict
  TypeScript, focused reservation-board/UI state suites and invariant referee where
  available.
- Remove and verify absence of the disposable database after proof.
