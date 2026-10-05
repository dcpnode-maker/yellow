# Order505 — independent two-property operating-performance review

Reviewer: `/root/pms_delivery_audit`, non-implementer. Date: 2026-09-20. Current decision: **v3 ACCEPTED — bounded privacy-safe scenario/data/reporting release**, as specified in the successor review below. The earlier v1/v2 rejection is retained verbatim as review history. No implementation or deployment edits by reviewer.

## Reviewed candidate and evidence limits

Source root: `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`. Database: existing Docker `yellow_public_demo` at local55432. Database proof used `app_role` with transaction-local tenant context; deployment credentials were consumed only in process memory, never written into this report.

Initially requested v1 IDs were `95699203-494c-5d5e-9c40-74d4c07c452d` and `d98c208c-4337-5fd5-9e05-7a310e473b36`. Root subsequently nominated v2: Locanda `9b87b01c-e02a-5aba-ab50-225bb51235af`, London `0554cfb0-4db0-500b-aff2-c65b9d9b12b6`. v1 is retained, not treated as final candidate.

Frozen-v2 seed inspected SHA256 `93198B1A11D0DB067634ADEED9E443D9F28F648F09606695D5B3AEB219CE1A9E`; reporting service `D5AB33DA459C3885395F61BBBF2B46065DA06E1045670C94357DDC5A57B26A9F`; React App `B666B365BBF96E05E93B7D4D0AF2561DE34231822620674E1465299767CFB998`. After the blocker report, seed changed to `452717FF11D5717B71C0325158B8B7DBE4AD3279D6547CB74D21FDE2A4E88F37`; that later change is not accepted by this v2 review. Any successor requires a new exact-source/data proof, not reuse of this review as green.

## Blocking findings

### B1 — v2 future OTB excludes continuing stays and overbooks the property/type

Personally executed SQL over all active reservation statuses (`reserved,due_in,in_house,due_out`) and exact segment periods at23:00 property-local. Across current day plus56 future nights, **4/57 nights per property disagree with stats_daily**. Tomorrow Locanda has28 booked room nights against20 rooms; London56 against40 rooms: **140% booked**, while the dashboard curve shows70%.

The seed's `futureSchedule` includes only new future reservations, omitting current in-house/due-in stays that continue into the next four nights. A comparison limited to `reserved` therefore gives a misleading pass. Moreover, every unassigned future stay uses the first room type: Locanda14 future L1BR bookings against6 units, alongside6 continuing L1BR stays; London28 future KING against18 units, alongside18 continuing KING stays. This violates a realistic bookable scenario even though unassigned reservations have no conflicting space_occupancy rows.

Required repair: first prove the complete proposed schedule in memory against property AND unit-type capacity for every night, including continuing stays. Project stats from that same complete canonical cohort. Unassigned is not permission to overbook. Do not repeatedly create live cohorts before the plan proof. Preserve insert-only historical evidence; do not rewrite/delete occupancy or facts.

### B2 — hidden-selector implementation breaks original proof deep paths

Inspected App.tsx takes requested URL propertyId, then substitutes DEFAULT_PROPERTY unless it is in SHOWCASE_PROPERTIES. It keeps the old reservationRouteId. Thus `/p/<old-property>/res/<old-reservation>` combines the new property with an old reservation; old proof pages no longer load their correct scoped entity. Filtering the selector is appropriate; rewriting an explicit valid property route is not. Order requires fixtures intact and reachable through existing test paths. This static defect needs a browser/API regression proof after repair.

### B3 — requested comparative UI is incomplete

Service returns ADR and RevPAR for MTD/QTD/YTD but the comparison table renders only room nights, occupancy and revenue. Daily result has no matching prior-year/forecast/budget comparison object. Existing daily KPI cards do not fulfill daily comparisons or period ADR/RevPAR comparisons. Add the scoped output/rendering or explicitly amend acceptance; do not claim the whole Order505 dashboard complete.

### B4 — reproducible proof and source binding remain incomplete

No focused Order505 automated test file was found during inspection. Seed changed while review was executing, including between requested v1 and v2. One initial existing-data rerun threw `locanda scenario is not canonical`; later calls loaded changed source and provisioned v2, then returned successfully. This is retained as a mixed-candidate failure, not silently recast as successful v1 idempotence. Final exact-source seed idempotence and original-fixture fingerprint comparison must be rerun after the implementation is actually frozen.

## Personally executed proofs

| Proof | Result | Interpretation |
|---|---|---|
| `bun run typecheck` | exit0, twice | Source compiles; no domain correctness implication |
| `bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/runtime/order505-independent-review-build-v2 --emptyOutDir false` | exit0;467 modules; JS478.36kB/gzip142.48kB; CSS32kB/gzip7.29kB | Isolated artifact only; public build was not overwritten or deployed |
| Actual `OperatingPerformanceService.load` under app_role | Both properties loaded; businessDate2026-09-20 and separate SAR/GBP | Real SQL/service, not mocked reporting |
| SQL vs service MTD/QTD/YTD revenue/room nights/available/ADR/RevPAR (initial inspected reporting service) | all six property-period comparisons match, bigint division matches | Arithmetic matches projection; projection is not booking truth |
| Actual `OperatorHttpApi.operatingPerformance` with real DB transaction and granted operator | v2 both200; three periods,56 OTB rows | Actual HTTP handler exercised directly; full bearer middleware/transport not certified |
| Handler denial cases | badUUID400; queryString400; noScope403; ungrantedProperty403; ungrantedActor403 | Property scope and permission gates operate |
| Outsider tenant under app_role | stats0; reservations0; current_rate_price view0; direct service rejects property | RLS and service tenant predicate resist cross-tenant reads |
| Duplicate existing valid occupancy via record_occupancy, rollback transaction | SQLSTATE23P01 | Database exclusion conflict enforced |
| Direct INSERT into space_occupancy under app_role, rollback transaction | SQLSTATE42501 | Choke-point invariant enforced |
| Pairwise occupancy overlap query |0 overlapping claims | No existing space conflict; does not prove unassigned type inventory |
| v2 adult counts vs unit_type.max_occupancy |0 violations | v1 had6 Locanda and26 London violations; v2 cap repair verified |
| v2 contact points / identity docs / journals |0 /0 /0 | No guest contacts/identity records or fabricated financial journals in reviewed cohort |
| Existing properties inventory | Original Yellow Demo, Identity Gate Review and Yellow House Mumbai still present; v1 retained | Existence proven; full historical equality/deep-link reachability not proven |

Actual v2 daily service values: Locanda14/20 room nights,7000 occupancy basis points, room revenue1028160SAR minor units, ADR73440, RevPAR51408. London28/40,7000 basis points,813960GBP minor units, ADR29070, RevPAR20349. Today reconciles; future continuing-stay reconciliation does not.

Names in the script are an explicit invented static list; source contains no OTA/provider import. Contact-free scenario flags and zero contacts/identity records support privacy-safe scenario status, not proof of actual client financial or booking data. No private source bytes, provider credentials, messages, payment records or genuine guest identities were imported by this reviewer. Full accidental-real-name coincidence cannot be mathematically disproven; names are generated scenario identities, not sourced records.

## Money and reporting concerns for follow-up

Service aggregates monetary strings using BigInt and serializes strings. Frontend `money()` converts `BigInt` to Number for Intl formatting and rounds to whole currency units; exact large-value display is not guaranteed. Plan config accepts Number integers rather than safe integer/string money. Add large-value fixture above2^53 and exact formatting/plan parsing tests. No cross-currency totals were introduced in inspected service.

Projection is a fixed scenario snapshot. No inspected mechanism refreshes stats_daily after an operator changes a reservation. This must remain visibly scenario reporting, not be sold as real-time current OTB after edits. Historical scenario revenue is expressly not ledger truth. Calendar-to-date forecast/budget is derived from actual projected available room nights; it is not a user-uploaded budget or full-month forecast.

No full11/11 referee, concurrency race, real-browser/mobile screenshot or external hosted smoke was performed by this reviewer for this candidate. Rollback conflict/RLS proofs above must not be labelled that broader proof.

## Next acceptance boundary

Freeze successor source and explicit property IDs. Execute complete all-status, all-unit-type night-capacity/OTB proof; unchanged-existing-cohort seed idempotence with pre/post fingerprints; original proof deep-link regression; daily/period comparison tests; exact-money test; role/API denial tests; mobile rendered verification. Then independent review may accept this narrow privacy-safe scenario/dashboard release. None of these proofs certify full PMS, source-client data import, RMS or provider readiness.

## Frozen v3 successor — independent acceptance

Final decision: **ACCEPTED-BOUNDED-SCENARIO-DATA-REPORTING**. The earlier overbooking, comparison omissions and property-ID coercion are repaired in the inspected v3 source. This accepts only the Order505 scenario/reporting slice. It is not production-readiness certification of the entire PMS, a claim of real client data, proof of live projection refresh after booking mutations, or hosted/mobile visual acceptance.

Final property IDs:

- Locanda Homes: `6081b544-22a1-534f-a86d-bb1ae0519e14`.
- The Harrington London: `01e4e102-c54f-5205-9542-d84d103084f8`.

Final source SHA256, read before proof and rechecked after proof:

| File | SHA256 |
|---|---|
| scripts/provision-two-property-operating-scenario.ts |452717FF11D5717B71C0325158B8B7DBE4AD3279D6547CB74D21FDE2A4E88F37|
| src/contexts/reporting/operating-performance.ts |69DB58A2555D02DCE645627F280A92C732FEEF26C54B975CB4F7A7DE0C4B241A|
| frontend/yellow/src/App.tsx |3D835ECA0BA8F9CFE70F9EBDB0080AA7FCFC0E5A0D65D78C5DD7047C8C933DDD|

Other inspected integration hashes: reporting index AF18D9E4F0575FC94C0D17E6C0E48EB7EEF547F73AE5C4680F2E12C5706DFDA5; operator E960A1F398481F0C971A9A9FE9B40D058D5C147FF2C3BE649626408896F16420; app9D1F0F6C9C6B9C6F82DB0D2E9189BB4BC67845A05B57F9FD702B7844E7C92839; server C88848641D17A6A4EF0713498D5224C4D92D946A4364E6559466984035718693; styles0736F1BFCE90CBD65147BB28C4A83AB66D8EB6D3BBFBE26ACEEFCD0DDF47B122.

### Personally rerun v3 evidence

1. **Complete night/type reconciliation:** under app_role with `set_config(...,true)`, join every property unit type to days0–56, count all active reservation segments whose exact timestamp range contains23:00 property-local, compare to stats_daily and configured sellable units. Locanda171 rows, London171 rows; mismatches0 each; oversold0 each; max booked-minus-capacity0. This includes continuing in-house/due-in/due-out and reserved stays, not merely the future cohort. Today is14/20 and28/40, both70%.
2. **Capacity/privacy:** adult capacity violations0; v3 contact_point0, identity_document0, journal0. The static invented-name list and contact-free flags remain; no provider records or private guest data were used. Scenario values are not client financial truth.
3. **Occupancy gate:** rollback-only duplicate of a valid existing v3 occupancy through record_occupancy rejects23P01; direct occupancy INSERT under app_role rejects42501. No authoritative occupancy DML bypass was used.
4. **RLS:** outsider tenant reads0 scenario stats,0 scenario reservations,0 current_rate_price view; actual reporting service denies the foreign property. Role app_role is nonsuperuser/non-BYPASSRLS.
5. **Idempotence and preservation:** personally invoked exported provisioning twice after freeze. Both return exactly the final IDs/20 and40 rooms/14 and28 occupied counts. Whole-row ordered-json fingerprints plus counts of22 tables before/after show `changedTables:[]`. Included org_node,user_role,space,unit_type,sellable_unit,sellable_unit_space,unit_condition,rate_plan,reservation,reservation_segment,reservation_guest,party,party_role,contact_point,identity_document,space_occupancy,stats_daily,journal,posting_line,fact_log,outbox,document. Thus the reruns preserve original fixtures, retained rejected cohorts and reviewed v3 data; no cleanup/delete performed.
6. **Real service and API handler:** actual OperatorHttpApi.operatingPerformance with a real app_role transaction and granted operator returns200 for both. Invalid UUID and extra query return400; no scope, ungranted property and ungranted actor return403. Bearer middleware/public transport were not part of this direct-handler proof.
7. **All period actuals/LY reconciliation:** Today/MTD/QTD/YTD × actual/prior-year × two properties =16 comparisons, each room nights/available/revenue exactly equals independent SQL. ADR and RevPAR match BigInt integer division in all16. Both return56 OTB rows and explicit daily comparison. Forecast/budget remain documented scenario plan calculations, not uploaded client budgets.
8. **Focused money/projection test:** `bun test tests/operating-performance.test.ts` →2pass0fail14 assertions; includes revenue string90071992547409930 beyond Number-safe integer range, exact service preservation, comparisons and malformed-scope pre-SQL rejection.
9. **Compile/build:** `bun run typecheck` exit0. `bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/runtime/order505-independent-review-build-v3 --emptyOutDir false` exit0;467 modules; JS index-BUZt11q2.js479.12kB/gzip142.55kB; CSS index-BMmxaKFA.css32.00kB/gzip7.29kB. Output isolated from public assets; no deployment by reviewer.
10. **UI source repair:** explicit requested URL property now remains unchanged; only selector list is filtered. Comparison rows now include Today/MTD/QTD/YTD and all five measures: room nights, occupancy, revenue, ADR, RevPAR across actual/LY/forecast/budget. This is source/build proof, not a rendered mobile or old-fixture-browser proof.

### Release-owner checks and retained limitations

- Bind the staged/deployed artifact to these source hashes; execute hosted login, both property selections, old explicit-property reservation path, mobile overflow and arrival/departure/in-house drilldown. Build-only evidence is not hosted UI proof.
- Preserve the visible scenario-projection disclosure. The snapshot is not automatically refreshed by reservation edits in this slice; a later governed rebuild/refresh order is required before claiming live OTB/revenue synchronization.
- Large-value service arithmetic is verified. Frontend whole-unit Number formatting and numeric plan configuration remain outside an arbitrary-bigint input guarantee; scenario configured amounts are bounded. Exact arbitrary money formatting/validation belongs in a follow-on before supporting unrestricted financial datasets.
- Budget upload, companies/GST grouping, sales ownership, group negotiation and outbound proposal delivery remain documented follow-ons; this acceptance does not imply they exist.
- No full11/11 referee or real-browser/mobile run by this reviewer is asserted. The precise independent data/API/occupancy/compile proofs above are the acceptance basis for this bounded successor.

## Release-owner deployment smoke

After independent v3 acceptance, the release owner built image
`yellow-public-demo-app:latest`, recreated only the application container and
preserved PostgreSQL, Valkey and the existing tunnel. The application became
healthy and the public Locanda Today route returned HTTP 200 at
`https://apps-assessing-appreciated-malpractice.trycloudflare.com/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today`.

Authenticated public-runtime checks returned 7000 occupancy basis points,
non-zero room revenue, three MTD/QTD/YTD periods and 56 OTB points for both v3
properties. A rendered in-app-browser smoke showed the Locanda selector, six
centred clickable scorecards and the Today/MTD/QTD/YTD comparison table. The
release owner corrected desktop overflow and responsive scorecard layout after
that smoke; the final stylesheet SHA256 is `2D48B0307AE4DB7316729B1823F4D81B67EDB0B2E741555EFC087AFFC1944476`. CSS defines a three-column
tablet and two-column phone ribbon without horizontal page overflow. No claim is
made here for a physical-device matrix or for automatic projection refresh after
operator reservation mutations.
