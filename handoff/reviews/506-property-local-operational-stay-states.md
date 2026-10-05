# Order506 — Independent operational stay-state review

Reviewer: `/root/pms_delivery_audit`, non-implementer. Date:2026-09-20. Current verdict: **r3 ACCEPTED — bounded property-local operational-state/read-only board change**. Earlier initial/r2 findings and failures are retained below. No implementation edits, database writes or deployment by reviewer.

## Exact reviewed source

Root: `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

| File | SHA256 |
|---|---|
| src/contexts/reservations/board.ts |965C8B1CC5349962E7BA8D71DC38417D9812C0913006CC0BBC9980C9DAF396BA|
| src/http/operator.ts |67593F5A5AEC8917900FD132546268844E82B8A86907C043D64868BD7D6BBD3F|
| frontend/yellow/src/App.tsx |F82306244EF572655912AE7E3EF60A68F56C01CB527A8FFC0BCE9246BA6CF199|
| frontend/yellow/src/reservation-board.ts |D555BFBE93E8D8171F18802C8D9DF68B58183B2DD71B0FD11D8633D86CAA1978|
| tests/reservation-board.integration.test.ts |6103EDC78EEBD2618B5582489C79F47784F6493D2C57239442353D8BEEEABA89|
| tests/yellow-reservation-board-pages.test.ts |823AA070A0F0554D6F0117D24EA38B83BB24380F1442B678FFF97AE72A4744FE|

Board hash was unchanged before/after proof. The checks below were personally executed, not copied from implementer output.

## Blocking finding

The SQL projection checks `EXISTS` any matching fact on today's property business date. It does not exclude superseded facts or contradicting completion evidence, nor verify that a completed event agrees with the segment period. Order506 requirement3 explicitly requires contradictory evidence to fall back truthfully rather than fabricate a completed event.

I extracted the exact CASE expression from the reviewed source and evaluated it in PostgreSQL inside `BEGIN READ ONLY` using VALUES/CTE fixtures (no inserted synthetic facts). Results:

| Fixture | Required truthful outcome | Observed |
|---|---|---|
| in_house, stay began yesterday, today's check-in fact superseded by a correction with yesterday business_date | stayover; obsolete today fact ignored | checked_in_today |
| in_house, today's check-in plus contradictory checkout fact | in_house fallback/explicit conflict; no completed label from inconsistent evidence | checked_in_today |
| in_house, segment begins three days in future, today's check-in fact | in_house fallback/explicit conflict | checked_in_today |

These are read-model correctness failures, not permission bypasses or writes. Repair effective/canonical evidence selection and contradiction handling in the read projection, with executable PostgreSQL regressions. Do not solve them by fabricating missing events or changing stored states. The service mapper test only supplies precomputed operational_state strings and therefore cannot detect these SQL mistakes.

## Successful personally executed evidence

### Property-local event/date cases

The exact CASE expression was also evaluated at controlled instant `2026-09-20T00:30Z`: Los Angeles property date19, Tokyo property date20. A fact dated19 labels actual-today only in Los Angeles; a fact dated20 labels actual-today only in Tokyo; other cases remain stayover. Six timezone/entity cases passed, including wrong entity_type and different reservation entity_id. Separate basic cases passed: due_in remains expected, same-day scheduled in_house without a fact remains in_house, earlier continuing stay becomes stayover, canonical check-in today becomes checked_in_today, canonical checkout today becomes checked_out_today, and foreign-tenant fact cannot create an actual-event label.

This was a safe read-only equivalent of fixture insertion: production SQL expression with typed CTE relations and a controlled property-date clock. It does not claim that the complete app was run against newly persisted synthetic events.

### Actual PostgreSQL service/API/pagination proof

Using existing `yellow_public_demo`, a real app_role transaction, `SET TRANSACTION READ ONLY` and `set_config('app.tenant_id',...,true)`, I executed actual `OperatorHttpApi.reservationBoard` backed by actual ReservationBoardService, then fed its serialized pages into the shipped `collectReservationBoardPages` function.

| Property | API page sizes | Rows | Duplicate IDs | Exact match to independent SQL created_at DESC,id DESC |
|---|---|---:|---:|---|
| Locanda6081b544-22a1-534f-a86d-bb1ae0519e14 |100,31|131|0|yes|
| London01e4e102-c54f-5205-9542-d84d103084f8 |100,100,51|251|0|yes|

Both had operationalState serialized and stored status preserved. Result keys contained no email/phone/passport/contact fields. Current scenario states were Locanda105reserved,2due_in,12stayover,10checked_out,2due_out; London209reserved,4due_in,24stayover,10checked_out,4due_out. Actual-event labels were not invented for these contact-free scenario records without completion facts.

After switching transaction-local tenant to an outsider UUID, actual service returned0 rows for the scoped Locanda property. `SHOW transaction_read_only` remained `on`. All proof statements were reads and transaction-local settings; no fixture, reservation, segment, fact, occupancy or financial record was written.

Property scoping is established through property_context and page_reservations; fact matching then uses tenant_id+entity_type+globally unique reservation entity_id. There is no generic fact property column. A fact for another reservation/property cannot join simply because its date/type matches. Payload property hints are not treated as authority.

### Tests, typecheck and isolated build

- `bun test tests/reservation-board.integration.test.ts tests/yellow-reservation-board-pages.test.ts`:8pass,1explicit DB-suite skip,0fail,74 assertions. The skipped database fixture suite is not represented as executed. Independent real PostgreSQL read proof above covers existing-data pagination/isolation, and CTE proof covers derived date/event semantics.
- `bun run typecheck`:exit0.
- `bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/runtime/order506-independent-review-build --emptyOutDir false`:exit0;468 modules; JS index-B8ocXLhx.js480.48kB/gzip142.93kB; CSS index-BpDU6Kv0.css32.69kB/gzip7.42kB. Public artifacts were not overwritten.
- Collector tests verify ordered concatenation, frozen result, repeated-cursor rejection and maximum-page rejection. Default bound is50pages (normally up to5000 records); exceeding it errors rather than silently returning a partial list.

## Frontend/source assessment and retained limitations

The board dropdown/search and row badge consume `operationalState ?? status`, while stored status remains available. Explicit labels distinguish Expected arrival, Checked in today, Stayover, Departure today, Checked out today and Departed history. Existing table expansion remains;760px responsive controls/context CSS is present. This is source/build proof, not actual phone/browser interaction or pixel parity.

The all-reservation command surface now loads every bounded100-row keyset page. Separate pre-existing Today `loadLane` still uses a UTC-day overlap range and limit12; guest-history fetch still uses one100-row page. Those surfaces are not fixed by the full-board collector. Do not claim all Today/guest-history counts are complete or property-local on the strength of this order.

Stored due_out is labelled Departure today without additional segment-end validation. If stale imported states can occur, define their conflict fallback separately; current order should not imply scheduled dates are completed-event facts. Service accepts stored-state filters, while derived-state filtering is currently client-side after the full board loads.

## Required successor gate

Fix current/effective event selection and contradictory-state/period fallback. Add executable PostgreSQL read-only regression coverage for supersedes, event ordering/conflict, future effective dates and property-midnight cases; preserve successful pagination/API/RLS checks. Freeze successor source, rerun focused tests/types/build and these adversarial fixtures, then obtain a new independent verdict. No deployment acceptance is granted by this review.

## Successor r2 — original cases repaired; same-day regression blocks acceptance

Reviewed board.ts SHA256 `AEA56C94B1F068D716D8BCFF140A7E1A990077E5E824A8479FCAD0F1289F4029`; focused integration-test hash `DD5A08EA28F264498AC85F6F4E234C9BD5BFB8AB8CF93D0CE30CF6E9A7D52FA1`.

Personally reran the exact original PostgreSQL CASE/VALUES fixtures inside `BEGIN READ ONLY; ... ROLLBACK`. Added stay_to_instant because the repaired expression now checks the stay end. All nine original cases pass: expected, scheduled-not-actual, continuing, actual-today, checkout-today, outsider-fact, superseded-fact, contradictory-checkout and future-stay. The current-head anti-join binds successor tenant/entity_type/entity_id to the original fact; a foreign entity cannot suppress a fact merely by naming its ID as supersedes. Query remains SELECT-only.

However, the new `(stay_to_instant AT TIME ZONE property.timezone)::date > business_date` check requires an overnight stay. Executed additional fixture: stored in_house; Riyadh date2026-09-20; period08:00Z–18:00Z that day; inspection clock12:00Z; unsuperseded canonical check-in fact business_date2026-09-20. Expected checked_in_today; actual in_house. This is a valid active same-day/day-use interval, not future or contradictory evidence. Requiring the departure calendar date to be after today is not equivalent to an interval being valid for an actual check-in.

Required repair: preserve truthful interval consistency without excluding same-day actual check-ins. Include the exact fixture in executable projection regressions and retain all original adversarial cases. No new stored event or state mutation is needed.

Rerun commands/results:

- Exact source CASE extracted in-memory with Bun and piped to Docker psql against read-only CTE fixtures:9original pass,1same-day fail. No file or database fixture writes.
- `bun test tests/reservation-board.integration.test.ts tests/yellow-reservation-board-pages.test.ts`:8pass,1explicit DBskip,0fail,78 assertions.
- `bun run typecheck`:exit0.
- `bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/runtime/order506-independent-review-build-r2 --emptyOutDir false`:exit0;468modules; JS index-B8ocXLhx.js480.48kB/gzip142.93kB; CSS index-BpDU6Kv0.css32.69kB/gzip7.42kB. Isolated build only.

Earlier actual131/251-row API/pagination/read-only proof remains recorded; no final successor acceptance or deployment is asserted.

## Successor r3 — ACCEPTED

Final board.ts SHA256 `A26B063951F063129638D24591735ADDA6F3E388377A126AFA737AE0BD9F26CF`; focused integration-test SHA256 `36ACABD441A4A5FE03D7F6798E3567EAC327D3F8296BFE91E0D957BC1F271DB7`.

The property context now includes transaction_timestamp as `as_of`; check-in consistency uses `stay_to_instant > as_of` instead of requiring an overnight calendar date. This repairs same-day active stays without treating ended intervals as currently checked-in-today. Superseded-fact and contradictory-checkout defenses remain in place.

### Personally executed final proof

- Exact current CASE expression extracted from source, executed by PostgreSQL against CTE VALUES inside `BEGIN READ ONLY`, controlled clock2026-09-20T12:00Z and Riyadh property business date. **14/14 pass**: expected; scheduled-not-actual; continuing; actual-today; checkout-today; outsider fact; superseded check-in; contradictory checkout; future stay; active same-day day-use; ended same-day day-use; foreign-tenant successor cannot suppress current fact; different-entity successor cannot suppress current fact; superseded checkout falls back to departed history. `SHOW transaction_read_only` confirms on, then ROLLBACK. No synthetic fact insertion.
- Actual r3 ReservationBoardService and OperatorHttpApi against existing PostgreSQL under app_role, with transaction-local tenant and READ ONLY enforced, feeding the shipped frontend collector: Locanda pages100+31; London100+100+51. Both complete ID arrays exactly equal independently selected SQL keyset order; serialized operationalState and original status present. Outsider tenant returns0 rows; transaction_read_only remains on.
- `bun test tests/reservation-board.integration.test.ts tests/yellow-reservation-board-pages.test.ts`:8pass,1explicit DBsuite skip,0fail,79 assertions. The skipped persisted-fixture suite is not counted as executed; actual database and CTE proofs above were separately performed by this reviewer.
- `bun run typecheck`:exit0.
- `bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/runtime/order506-independent-review-build-r3 --emptyOutDir false`:exit0;468modules; JS index-B8ocXLhx.js480.48kB/gzip142.93kB; CSS index-BpDU6Kv0.css32.69kB/gzip7.42kB. Isolated artifact, no public asset replacement.

Tenant/entity current-head logic was also inspected: both fact match and superseding successor are bounded by tenant and reservation entity identity; the property-specific page relation owns which reservations can appear. Foreign facts cannot relabel or suppress another reservation's event through their dates/types alone. Query is SELECT-only; all final database proofs enforce READ ONLY. Existing mutable states, fact history, occupancy and financial records are unchanged.

**Acceptance scope:** Order506 read projection, serialization and full bounded reservation-board pagination/filter labels. Initial and r2 blockers are resolved for the tested canonical/fallback cases. This does not claim a deployed release or phone visual acceptance. Previously noted Today UTC/12-row loader and guest-history100-row loader remain separate work, not silently fixed by this acceptance. No full-PMS or provider-readiness assertion is made.
