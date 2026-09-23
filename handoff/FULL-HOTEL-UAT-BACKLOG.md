# Full-hotel UAT delivery backlog

**Evidence base:** `docs/FULL-HOTEL-UAT.md` at Order 137 (`285e496`)
**Approved product base:** `origin/main` (`952478d`)
**Order ceiling observed across refs/worktrees:** 140
**Decision ceiling observed on the active advanced lineage:** D-375

This backlog does not reserve order numbers after Order 141. Each successor receives the
next repository-global free number only when admitted, after rechecking every ref/worktree.
The primary Cyber/finance/security sequence (130 review/integration, then 126→127→132→136),
live local workbench/status runtime, Orders 134/135 review records, migrations, RLS,
occupancy and journal/posting internals remain excluded from this lane.

## Dependency-ordered scoped orders

| Key | Dependency | Scoped outcome | Expected implementation scope | Explicit exclusions | Acceptance evidence |
|---|---|---|---|---|---|
| FH-01 (Order 141) | Approved Orders 096–108 on `origin/main` | Exact-confirmation reservation detail/history read model | reservations context + focused integration test | HTTP/UI/runtime, schema, auth, mutation, finance logic | deterministic aggregate, tenant/property concealment, whole append-only history, no-write snapshot |
| FH-02 | FH-01 | Read-only reservation detail UI and strict route | operator adapter/assets/tests; a new read permission only if separately admitted | lifecycle edits, check-in, finance mutation, status runtime | authenticated property-scoped route; accessible detail; stale-response guard; no browser persistence |
| FH-03 | FH-01 | Arrivals, departures and in-house read boards with guest/share/travel/request readiness columns | reservations/stay-ops read model, route/UI/tests | check-in/out commands, occupancy writes, scheduler | property-local date bounds; stable pagination; tenant/property negatives; board/detail convergence |
| FH-04 | FH-01, then admitted travel/request write contracts | Travel, vehicle and structured special-request detail plus readiness status | stay-ops domain/adapter/UI/tests; migration only if existing schema cannot represent typed requests | silent stay-time changes, unowned tasks, statutory/payment invention | exact arrival/departure legs; owner/due/privacy/status; replay/rollback; delayed-arrival priority evidence |
| FH-05 | approved financial visibility contracts, independent of payment work | POS/room-service/taxi/minibar source visibility on reservation and folio | financial read projection/adapter/UI/tests | posting, tax calculation, service eligibility or outlet authentication changes | source/check/item/tip/discount metadata shown only when authoritative; foreign/closed concealment; exact money |
| FH-06 | approved transfer/split command order (future high-risk lane) | Folio split/routing/transfer visibility, including original-source lineage and named payer destinations | financial read model/adapter/UI/tests | writing journals/posting lines, rounding policy, payments | allocations equal source; original remains visible; reversal/supersession chain; replay-safe display |
| FH-07 | approved tax/fiscal and payer-profile contracts (future legal/high-risk lane) | Invoice/GST payer profile and fiscal status display | tax-fiscal/financial read model/adapter/UI/tests | invoice issuance, GST calculation, document mutation, legal certification | occupant/payer separation; legal name/address/GSTIN; room-night basis/totals/status; immutable correction links |
| FH-08 | admitted housekeeping/stay-ops commands and consumers | Arrival/stayover/departure HK, luggage, minibar and room-health coordination UI | housekeeping/stay-ops adapters, mobile/operator UI/tests | direct condition edits, silent clean, payment detail leakage | idempotent tasks; ack/start/finish/verify; DND/damage/lost-item/minibar blockers and role-scoped visibility |
| FH-09 | approved ledger/payment/close/reconciliation contracts (future high-risk lane) | Finance export and reconciliation visibility | reporting read models, export adapters/receipts, UI/tests | second accounting truth, dual write, unreceipted export, journal/payment mutation | trial-balance debit=credit; mapping ids; retry receipts; unmatched/failed reconciliation; sealed-day truth |

## Admission notes

- FH-02 and FH-03 may proceed after FH-01 review if their runtime files are no longer owned
  by the primary lane. Recheck coordination before order creation.
- FH-04 may split into travel/vehicle and typed-request orders if representing request
  ownership/privacy/status needs schema or product policy; do not overload notes/alerts.
- FH-05 is visibility only. Safe room charging requires a separate authenticated service
  command that verifies current in-house eligibility and is not admitted here.
- FH-06 through FH-09 depend on future high-risk commands and cannot honestly start from
  the current approved base. Their UI must display authoritative records, never simulate
  posting, tax, settlement, housekeeping completion or reconciliation.
