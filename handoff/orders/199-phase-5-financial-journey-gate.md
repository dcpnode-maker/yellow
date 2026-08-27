# Order 199 — Phase-5 financial journey gate

**Status:** BUILT-UNREVIEWED-D540 — executable journey and builder proof complete; independent review deferred
**Phase:** 5 — Financials
**Branch:** `phase-5/financial-journey-gate`
**Base:** `101bc90bf721` (built-unreviewed Order198)
**Risk tier:** 3 — cross-service immutable money, tenancy and settlement proof
**Owner:** Codex implementation; independent review deferred until the built Phase-5 candidate

## Outcome

On pristine PostgreSQL, prove that one reservation's primary guest folio can receive
a governed charge, reach exact zero through either a governed token-only payment
capture or the governed company/travel-agent receivable transfer, then move through
the existing `open -> settled -> closed` folio lifecycle. Hostile authority, stale
approval and concurrent money commands must leave one coherent immutable result.

## Natural-solution boundary

This is a composition and executable-gate order. Reuse the existing reservation,
primary-folio, charge, payment, receivable and settlement services plus their shared
PostgreSQL locks, facts, outbox and idempotency. Do not add schema, authority, product
routes, UI, seed data or a substitute orchestration service merely to make the proof
pass. Checkout and account/reservation closure remain later commands.

## Exact scope

- `handoff/orders/199-phase-5-financial-journey-gate.md`
- `tests/phase-5-financial-journey.intentional-red.test.ts`
- `tests/phase-5-financial-journey.integration.test.ts`
- journey-only test helpers inside that new integration file
- Phase-5 status only in `BUILD-PLAN.md` and `handoff/PHASE-5-PLAN.md`
- this order, its question if required, `DECISIONS.log`, and `handoff/LEDGER.md`

No production source, migration, schema snapshot, permission, seed or dependency file
is admitted. `migrations/0001_init.sql` remains byte-identical.

## Required work

1. Commit an intentional P0 red proving the composed pristine-database journey is
   absent before implementation.
2. Execute a charge-to-token-payment-capture-to-zero-to-settle-to-close journey using
   the real services and immutable journals.
3. Execute a charge-to-within-limit-receivable-transfer-to-zero-to-settle-to-close
   journey, proving exact exposure and absence of fake AR artifacts.
4. Prove over-limit different-user one-use approval and fail closed for self, foreign,
   stale, rejected and forged evidence.
5. Prove transfer/capture/settle concurrency admits only lawful coherent outcomes and
   never non-zero settlement or duplicate durable evidence.
6. Re-run exact schema/authority, standing repository and referee gates without
   claiming checkout, Phase-5 approval or application completion.

## Forbidden

- migrations, schema snapshots, services, HTTP/operator UI, scopes, seeds, dependencies
- AR invoice/allocation/aging/statement, cash posting, refund/chargeback, trust or FX
- checkout, account/reservation closure, documents, tax/fiscal, day roll/seal
- real PSP/provider settlement, local promotion, second local, merge, push, public or
  production deployment

## Pre-registered proof

- **P0 red:** the composed journey integration file and exact journey markers are absent.
- **P1 card path:** charge -> one balance-capped capture -> exact zero -> settle -> close;
  all journals remain balanced, linked and immutable.
- **P2 receivable path:** charge -> server-derived within-limit transfer -> exact zero ->
  settle -> close; exposure increases exactly and no fake AR artifact exists.
- **P3 approval path:** over-limit needs exact different-user one-use approval; self,
  foreign, stale, rejected and forged evidence write nothing.
- **P4 arbitration:** capture/transfer/settle contenders converge to one lawful outcome
  without duplicate journal, fact, outbox or idempotency effect.
- **P5 hostile authority:** tenant/property/role/raw DML/capability attacks fail closed.
- **P6 standing:** migrations1–25, exact schema93/83, authority suites, type/boundary/
  licence/audit/full and referee11/11 remain green.

## Definition of done

- [x] Intentional red precedes journey implementation.
- [x] Both exact-zero settlement paths execute on pristine PostgreSQL.
- [x] Approval, hostile-boundary and concurrency proofs are executable.
- [x] No production authority or new product behavior is invented for the gate.
- [x] Built result is recorded without claiming checkout, independent approval, Phase5
      completion or application completion.
