# Order 535 — governed showcase BAR price publication

## Objective

Create the missing audited BAR price rows for the six already-configured unit
types across the two isolated showcase properties so canonical availability can
return bookable offers and Order533 can complete its real reservation proof.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tools/provision-public-showcase-rate-prices.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-public-showcase-rate-prices.test.ts`
- existing POST `/api/v1/properties/:property/rate-prices` and GET current APIs
- exact Locanda and London property/rate-plan/unit-type IDs already returned by
  the authenticated current runtime
- `handoff/reviews/535-public-showcase-governed-bar-prices.md`
- independent execution and verification by a non-implementing reviewer

## Fixed scenario rows

- Period: 2026-09-21 through 2027-09-22; all weekdays.
- Locanda display prices in SAR: L1BR 750/850; L2BR
  1250/1250/1400/1550; LPH 2500/2500/2700/2900/3100/3300 by adult occupancy.
  The exact stored minor-unit strings are respectively 75000/85000,
  125000/125000/140000/155000 and
  250000/250000/270000/290000/310000/330000.
- London display prices in GBP: KING 180/205; DLX 240/270; STE 420/460/500 by
  adult occupancy. Exact stored minor-unit strings are 18000/20500,
  24000/27000 and 42000/46000/50000.
- Values are internal showcase scenario prices. They are not
  represented as OTA-imported, contracted or client-approved live prices and
  must not be pushed to any provider/channel.

## Required behaviour

1. Authenticate only through the existing automatic demo entry; never embed or
   emit a bearer or credential.
2. Preflight every stay date and weekday across all six plan/unit pairs before
   the first write. Zero rows is expected; one exact full-period prior Order535
   row may be retained, but partial coverage, multiple current IDs or any
   different overlapping row aborts before a new write.
   Because the public current-price endpoint intentionally returns only the
   latest applicable row, the independent reviewer must additionally run a
   tenant/property-scoped read-only PostgreSQL census over all `rate_price`
   history for these six pairs. First execution requires zero overlapping
   unsuperseded rows; recovery may retain only exact Order535 rows and must fail
   on any other overlap. The API script does not claim to replace that census.
3. Write only through the governed rate-price API with one deterministic stable
   idempotency key per exact command.
4. Verify each current row's exact property/plan/unit/range/mask/pricing and prove
   future canonical availability returns at least one bookable, priced,
   promise=false, commit-arbitrated offer for each property.
5. Output only non-sensitive counts/codes/statuses. Never print guest/Party data,
   tokens, credentials or environment values.

## Exclusions

- No direct SQL/DML, supersession, rate-plan/inventory/policy change, OTA/channel
  publication, provider call, reservation creation, public app rebuild or deploy.
- No claim that scenario prices are sourced market rates.

## Risk and review

These immutable rows affect canonical sellability. A non-implementing reviewer
must inspect the exact script, personally execute it once (replay only if needed),
then verify current-price/fact/outbox/idempotency evidence and availability before
the rows are relied on by Order533.

## Verification

- Static contract test or script dry validation before execution.
- Reviewer-personal governed API execution and exact postflight.
- Reviewer-personal read-only all-history rate-price census before and after the
  write, plus exact fact/outbox/idempotency evidence.
- Then reviewer-personal distinct Order533 reservation commit/replay and evidence.
