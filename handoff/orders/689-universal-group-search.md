# Order 689 — shared search opens persisted reservation groups

24 September 2026. Founder asks to start finishing almost-ready All Ecosystem
features. Audit found Shared hotel search beta indexes stays/profiles but not
persisted reservation groups. Deliver this complete bounded read flow, preserving
the wider search destination and its remaining indexes.

Status: bounded live delivery verified24 September. Receipt689-universal-group-search.md
and independent review689 record exact proof and limits; Shared hotel search stays beta.

## Scope and ownership

Implementer ecosystem_journey_gaps, root integrates, independent non-implementer
personally executes tenant/property proof. Exact allowed files:
- src/contexts/reservations/groups.ts: optional bounded list query against existing
  group name/code, tenant/property-scoped transaction; stable UUID cursor and limit.
- src/http/operator.ts: validate optional q (2–100 characters, reject duplicate or
  control characters) on existing group GET, retaining authorization/property grant.
- frontend/yellow/src/group-reservations-api.ts; hotel-search.ts;
  ui/HotelSearch.tsx: group result type/filter/count and bounded server search with
  independent loading/error/retry, debounce and stale query/property isolation.
- frontend/yellow/src/workspaces/GroupReservationWorkspace.tsx: canonical
  ?view=groups&group=<uuid> deep link loads actual same-property group detail,
  including a result not in first list page; stale/unmount protection; pending
  create/link idempotency recovery unchanged.
- frontend/yellow/src/reservation-navigation.ts: clear obsolete group parameter
  only when switching away from groups, preserving documented other query state.
- tests/order668-hotel-search.test.ts; tests/order687-groups.test.ts;
  tests/order687-groups.http.test.ts; tests/order687-groups.integration.test.ts;
  tests/order689-group-search-ui.test.ts; tests/reservation-workspace-routing.test.ts.
- This order, handoff/reviews/689-universal-group-search.md, handoff/receipts/689-universal-group-search.md,
  docs/PROJECT-STATUS.md, handoff/LEDGER.md; coordinator owns shared status/ledger.
- Generated public/yellow-next and temporary release recipe under D:/Yellow/temp
  for the same existing app; frontend/backend deltas only after proof.

## Definition of done

Search group name or code from the universal dialog, get real authorized matches,
select result, open exact group's existing member workspace. At least51-group
isolated fixture proves no first-page illusion. Unmatched/invalid/unauthorized,
foreign property/tenant, stale query and unavailable endpoint are explicit.
SQL parameters escaped for literal substring matching; no SQL string interpolation.
Actual runtime-role PostgreSQL authorization proof independently executed, plus
types/boundaries and live readonly browser selection of existing synthetic groups.

## Forbidden / remaining

No new table/migration, mutation authority, provider/credential change, App.tsx or
menu redesign. No live QA records. Beta remains beta: folio/task/catalogue-wide
search still unbuilt. Do not relabel whole search or ecosystem complete.

## Explicit catalogue amendment (question689)

Admit frontend/yellow/src/ecosystem/capability-registry.ts only for the existing
Shared hotel search record's summary/purpose/prerequisite/statusReason and a
focused assertion in tests/order689-group-search-ui.test.ts. Reflect actual group
name/code results once proved. Keep beta, route and missing folio/task/catalogue
indexes; do not inflate any other status or claim whole capability completion.
