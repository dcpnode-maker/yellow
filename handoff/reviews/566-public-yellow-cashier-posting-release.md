# Order566 — independent public preflight

Reviewer: independent Astra agent, 2026-09-21; not the Order565 implementer. **ACCEPT PLAN, subject to the execution gates below. No deployment, operational POST, database mutation or public charge was performed by this reviewer.** This is not final public acceptance.

Read PROJECT.md, Order566, the complete final Order565 review, relevant financial decisions, canonical charge service/API and synthetic scenario source. Used Yellow compliance/entity/PostgreSQL skills: existing balanced immutable journal authority only, property-local dates, exact minor-unit money, tenant-local context and same-transaction evidence. `bash ./state.sh` failed because WSL `/bin/bash` is unavailable; not counted as a successful ritual.

## Personally executed target-bound proof

`bun D:/Yellow/temp/astra566-preflight.ts` exited 0. Protected public-demo credentials were read only in process memory; URL/password were not printed. Connection pinned to loopback55432/current public-demo database. Every DB query ran in one **ISOLATION LEVEL REPEATABLE READ READ ONLY** transaction with transaction-local tenant setting; server settings independently returned `repeatable read` and `read_only=on`.

Snapshot captured **2026-09-21T06:27:07.612Z**. Script SHA256 `FFB0D57CB49499220009834D34E1F53ACAB97B04C53BF9A565AE5151654F7D4D`. Complete non-PII receipt: `D:/Yellow/temp/astra566-preflight-receipt.json`, SHA256 `DFE5B3CDFEF393B8C2C2192CFEA3DE7DDA9E8237A523F2039157054366BC9C2C`.

- Tenant `6d9b7ce2-2d14-5576-b8c3-80f06501a603`; property `6081b544-22a1-534f-a86d-bb1ae0519e14`, SAR, Asia/Riyadh. Property config proves `yellow-two-property-operating-v3`, privacy_safe and public_showcase. Target Party has the same scenario marker; one `reservation.scenario_seeded` fact binds that scenario. Source `scripts/provision-two-property-operating-scenario.ts` explicitly generates Omar and the L3R scenario. This is demonstrably fictional, not inferred from the name alone.
- Exactly one current eligible Omar stay: reservation `fbe1dc20-456e-5345-8d7d-420b41685955`, confirmation **L3R-DI-0015**, canonical **in_house**, SAR; primary Party `1219737c-4b41-5077-8854-4681affd8bd3`. Same-name in_house/due_out census is exactly 1.
- Exactly one folio total/open: `f728d2b3-eb9e-4e69-b433-6aa6ab88f649`, window1, guest account `926b416b-9399-440b-9e2f-93685bc95a05`, correct Party/property, open, SAR. Balance **0 minor**, posting rows **0**.
- Exactly one Laundry route: **L3R_LAUNDRY**, name Laundry, revenue group, USALI Guest Services, default guest→revenue, null fixed debit account, SAR; credit account `95582479-004c-53dd-a394-d395244ac135` is open revenue/SAR in the exact property.
- Active actor `9f90d3e9-94f9-54de-95ec-35bd00b99b15`; role `05802175-9b05-5a8d-8596-bccfbe36e99f`; exact-property scope grants **financials.charges:write** and **financials.folios:read**. Current app environment was inspected in memory and emitted only booleans: automatic demo enabled, designated review actor configured, credential present—all true. No authentication POST was needed for this preflight. A fresh deployed session must still be checked before the operation.
- Property business date **2026-09-21**, exactly one business_day row, unsealed.
- Journal/posting_line/payment/payment_operation/document all **0**; space_occupancy **233**; fact_log **956**, outbox **896**, api_idempotency **70**.

All **129** public tables were fingerprinted in the same snapshot. Per-table formula is count plus `md5(coalesce(string_agg(to_jsonb(x)::text,'|' ORDER BY to_jsonb(x)::text),''))`; sorted table/result array serialized to JSON then SHA256. Aggregate **465e0f5f9244d7fb5c921811bfd2d954a8c297d320a2ddb1017e499993f0f600**, exactly equal to the final accepted Order563 baseline. Therefore no intervening DB drift is observed across the entire table set, not merely the target counts. Use this exact formula for comparison; do not mix the older LF/backslash-n or row-MD5 variants.

## Artifact and process baseline

Personally rehashed candidate source; all four hashes exactly match final Review565:

| File | SHA256 |
| --- | --- |
| App.tsx | CD0161E882A1C41E41900177529243CBC296F57241A5DD6DB87D3230FBE00849 |
| voice.ts | 4E943795D57C173A381200F525449C6F13A40EEE136E982DB8FB7CA46CB6A838 |
| voice-routing test | 7D4BB61CBC1562BCC15FCAE67EDF7FF99C30B8C2A17CB584D985145031069297 |
| finance-workspace test | 1708C89E267E2989DC192FE4824CD2EF264AB91E6EEF7C76FFD476233139F446 |

`docker inspect` (only selected non-secret identity/status/mount fields) personally confirms:

| Component | Container ID | State |
| --- | --- | --- |
| app | de61f418cc8d0daaf7345878e5b43a5b601a097a8c35d9941b2dd28188414ff1 | running/healthy |
| PostgreSQL | 9f507e09cc387e7a96a436835a94d036338ed3acf87e70309031347c5ee48cb5 | running/healthy |
| Valkey | 781c68656c437bf39a2428838b7ebcdd8bbc0f52dcb88c1a6babf084991dea9b | running/healthy |
| tunnel | e17219ecd7aa403a70d4f82a755c45aca51a6768a82d63a802bb6dadc1acc92a | running |

Current app image `sha256:4318a74e5cabaed3dda3f9948832491be2a4d600ba3725f49521860e9137ccb1`. PG volume `yellow-public-demo_yellow-pgdata`. These match the previous accepted public release.

`bun D:/Yellow/temp/astra566-http.ts`: exit0; GET only. Local3010 and external `https://editing-alto-artists-quilt.trycloudflare.com` health/Today/assets all200. Both origins serve identical prior-release JS `index-B0X5FxLS.js` SHA256 `671bcf945a98566b2d40f87506fd082a0141c8b54ec65555c785f3488e259ab6` and CSS `index-BnrIAmaB.css` SHA256 `c81eecf1aa3464552482ef9f2a8f47c489351ebdca244da1ee8a03692f66cfd3`; all three referenced runtime/vendor chunks also match across origins. This is deliberately the old public app, not evidence that Order565 is already deployed.

## Precise execution and postflight oracle

1. **Before any action:** new inheritance-protected consistent custom dump, readable `pg_restore --list` catalogue, exact digests and checkpoint receipt; retain old app image before rebuilding its tag. No database restore is authorized. Immediately rerun the same repeatable-read census/fingerprints and target gates; any drift must be explained/reviewed before proceeding. This timestamped preflight is not a permanent freshness guarantee.
2. Promote only the accepted app candidate; no migrations, grants, catalogue provisioning, seeds or DB/container/tunnel recreation. Verify deployed image/source/asset chain, local and external health, unchanged PG/Valkey/tunnel/volume identities. Obtain the ordinary automatic session; verify tenant/actor/property and required scope without recording its token. GET fresh reservation/folio statement must agree with the above zero baseline and expose Laundry as server-provided option.
3. At actual public375px, type **post a SAR 25 laundry charge to Omar Siddiqui**. Before separate yes, verify visible exact Omar/L3R-DI-0015, **Folio L3R-FOL-1**, Laundry, **SAR25.00**, quantity1; no network charge or new statement row may precede confirmation. Do not substitute the old public app/manual form or another folio.
4. Separate explicit **yes** invokes only `POST /api/v1/properties/6081b544-22a1-534f-a86d-bb1ae0519e14/folios/f728d2b3-eb9e-4e69-b433-6aa6ab88f649/charges`, body `{"txCode":"L3R_LAUNDRY","amountMinor":"2500","quantity":"1"}` (canonical quantity normalized by the existing parser). Capture the actual browser body/key/correlation/status/receipt without authorization header. Expected first201/replayed=false. Retain exact original request bytes and key; at most the expressly scoped identical replay, expected201/replayed=true and same journal/business date/amount. Never invent a replacement key after uncertainty.
5. Exact primary deltas: **journal+1, posting_line+2, fact_log+1, outbox+1, api_idempotency+1**. Journal kind charge/source `financials.charge.post`, currencySAR/current Riyadh date, created_by the actor above. Line1 guest account/target folio +2500; line2 exact revenue account/null folio -2500; both L3R_LAUNDRY/quantity1/current date/SAR, sum0. Folio statement balance becomes **2500 minor (SAR25.00)** with exactly one charge row; folio/account records themselves remain byte-identical.
6. One `journal.posted` fact and outbox share journal ID, actor, property-local date and exact minimized payload (journal_id, kind, two account/folio/code/signed-amount legs); outbox property/correlation bind the original request. One `financials.charge.post` idempotency row binds original actor/property/folio/code/2500/quantity/key and original receipt. Replay creates no additional rows/evidence.
7. Every other business table must remain byte-identical, including reservations/segments/guests, occupancy, unit conditions, routes/codes/accounts/folios, business_day, document_series/documents, payment/operations/instruments, tax/fiscal tables and existing journal/evidence rows. No fiscal document, tax calculation, numbering, payment or actual settlement follows from this untaxed fictional charge. Consumer_processed/cursor acknowledgements may differ **only if individually attributable to the single new outbox event**; no blanket worker-drift waiver or availability/task mutation. Record exact consumer/event linkage. If an outbox published_at relay field changes, prove only that sanctioned delivery field changed, not payload.
8. On nonmatching/uncertain receipt or health failure: stop new operations; retain original key and evidence, perform read-only reconciliation. Do not reverse/delete/restore a committed immutable journal as an improvised rollback. App-only rollback is permitted by the release plan after stopping interaction, not data rollback. Mandatory independent final postflight must personally recompute all129 fingerprints, exact added rows/receipts/replay and rendered result before Order566 closes.

**Final preflight verdict: ACCEPT PLAN.** Fictional identity, zero financial baseline, exact authority/catalogue/day, unchanged current target and accepted candidate hashes are independently established. The new checkpoint and promoted-artifact/session/UI gates are still execution prerequisites, not claimed completed. This preflight itself issued no public write and does not assert completed financial posting or whole-PMS readiness.

## Protected checkpoint and immediate refresh — personally verified

2026-09-21 independent reviewer rerun; no public mutation or deployment.

- `Get-FileHash` on `D:/Yellow/recovery/order566-public-20260921-120500/database.dump`: 2,619,379 bytes, SHA256 **38B84FC82E5A6EC3FC9D2137F469C3CF0B8D8391C0C921F6AD4A17057E7083A4**. Catalogue202,276 bytes, SHA256 **AE8278D1239D5710A805E438D3F58339BAD4471F0506C2F3846267278AA3BA9B**.
- `Get-Acl` personally verifies checkpoint directory inheritance protected with exactly owner Astha/astha, SYSTEM and Administrators full control. Dump/catalogue/receipt children inherit only these three restricted entries; the children are not independently inheritance-protected. This is a restricted inherited tree, not a claim that each file has a protected flag.
- `bun D:/Yellow/temp/astra566-checkpoint.ts` streams archive to `docker exec -i yellow-public-demo-postgres-1 pg_restore --list` only: exit0, **2,095 readable lines**, same saved catalogue after CRLF/LF normalization. Raw bytes differ only in line-ending formatting; no restore was attempted.
- `bun D:/Yellow/temp/astra566-preflight.ts` personally repeated at **2026-09-21T06:31:08.874Z**: read_only on/repeatable read; all exact target, synthetic marker, unique current-name, open SAR0 folio, route, actor/grant and unsealed business-day checks still pass. All129 aggregate remains **465e0f5f9244d7fb5c921811bfd2d954a8c297d320a2ddb1017e499993f0f600**. All financial counts remain0, occupancy233, facts956/outbox896/idempotency70. Refreshed receipt replaces the generated temp receipt, now SHA256 **D06BFA89397DA80B3B2302C05F3D5FE91D67ECC291C322E8112E1B4A95FB8D1C**; earlier timestamp/hash remain historical evidence above.
- `bun D:/Yellow/temp/astra566-http.ts` again returns local/external health/page/all referenced assets200 and identical old-release hashes.
- `docker image inspect yellow-public-demo-app:pre-order566 --format '{{.Id}}'` returns **No such image**. Before any build replaces the current tag, preserve exact currently-running image `sha256:4318a74e5cabaed3dda3f9948832491be2a4d600ba3725f49521860e9137ccb1` under an explicit rollback tag and verify that tag resolves to the same image. Do not infer rollback retention from the live container alone.

**Checkpoint and fresh public-data gates PASS. ACCEPT PLAN remains valid, but the deploy/build gate is conditional on retaining and verifying the rollback image first.** Once that ordinary accepted-plan retention step is satisfied, the bounded app-only promotion may proceed; posted-charge permission still depends on deployed artifact/session/visible proposal gates. No operation was submitted by this reviewer.

## Independent deployed preparation admission — SINGLE-ACTION GATE OPEN

Reviewer Astra, 2026-09-21. This is a personally executed post-promotion/pre-operation check, **not** a completed-charge postflight. No yes, checkbox, financial button or operational request was submitted.

- `docker image inspect yellow-public-demo-app:pre-order566`: now resolves to exact previous image **sha256:4318a74e5cabaed3dda3f9948832491be2a4d600ba3725f49521860e9137ccb1**, closing the rollback-retention prerequisite.
- `docker inspect`: new app **c7daebb83d619d0498107ba28cf6009530fb13ae647df86a296eb03e8652d066**, image **sha256:f52aeae902a3af00c14d76c06d4bc77c1fa62a979c767dad5fa5c9ae0c29f122**, healthy. PostgreSQL/Valkey/tunnel exact full IDs remain those recorded above; PG/Valkey healthy, tunnel running.
- `bun D:/Yellow/temp/astra566-http.ts`: local/public health/page/all five referenced assets200. Main JS **index-DRHenqJQ.js**, SHA256 **AE040BDF3C69E1DA25A1926E63648F6085BB8EDF366C643B15DB9AD4C256CE6A**; CSS **index-BnrIAmaB.css**, SHA256 **C81EECF1AA3464552482EF9F2A8F47C489351EBDCA244DA1EE8A03692F66CFD3**. Personal `Get-FileHash` on the independently built Review565 temp assets gives these exact same bytes. Runtime/vendor chunks match between origins. Runtime image intentionally lacks frontend source TSX/TS (`sha256sum /app/frontend/yellow/src/...` returned absent); source binding is therefore through the exact independently source-bound compiled assets, not a false claim of source files inside the image.
- CUA inventory returned no apps/browsers. `node D:/Yellow/temp/astra566-prepared-public.cjs` used installed Chrome through the bundled browser harness at375×812 against the **actual public origin**. It allowed only read requests plus ordinary automatic demo authentication; every operational method was blocked before transmission. Automatic authentication returned200; process-memory token claims bind exact actor **9f90d3e9-94f9-54de-95ec-35bd00b99b15**, tenant **6d9b7ce2-2d14-5576-b8c3-80f06501a603**, and **financials.charges:write**. Token/credentials were never logged.
- Typed exact `post a SAR 25 laundry charge to Omar Siddiqui`, waited for the proposal and live embedded cashier. Personally inspected screenshot **D:/Yellow/temp/astra566-public-prepared-375.png**: separate Folio L3R-FOL-1 row, Laundry/SAR25.00/quantity1, L3R-DI-0015 and In house are visible. Folio center hit-test true; rect x19..143.4375/y88.046875..106.046875. Page width/scrollWidth **375/375**, checked-checkbox count0; refreshed embedded cashier shows SAR0 and no postings. **Zero operational requests attempted, zero page errors**. Browser closed with proposal unsubmitted; no pending reviewer proposal is delegated to an execution session.
- Harness initially assumed noncanonical JWT claim names/array scope and reported session identity/scope failure despite successful preparation. Read existing identity token/resolver contract (`tid`, space-delimited `scp`), corrected only reviewer harness, then reran successfully. Those initial oracle failures are not presented as product failures or passing runs. Final harness SHA256 **9B199615572838B78141419C921E472775E857FBC8ED0F24CD3E258712D2035C**.
- Immediately after browser proof, `bun D:/Yellow/temp/astra566-preflight.ts`: exit0 at **2026-09-21T06:35:45.180Z**, repeatable-read/read-only. Exact target, unique synthetic current stay, sole SAR0 folio, Laundry route, grant and unsealed day still pass. All129 aggregate is still **465e0f5f9244d7fb5c921811bfd2d954a8c297d320a2ddb1017e499993f0f600**; journal/posting/payment/payment_operation/document remain0, occupancy233, fact956/outbox896/idempotency70. Latest generated receipt SHA256 **0FC4CF804AD773A0FC6DC8DDEC52863BA5E00037C058CB595CDAA52047E1171A**.

**SINGLE SAR25 PUBLIC ACTION GATE OPEN under Order566's exact execution oracle above.** The executor must freshly prepare the same exact proposal in its own public375px session and visibly verify it before one separate yes; retain the original key/body/correlation/receipt and perform only the authorized identical replay. Any intervening drift, changed proposal, closed day, ambiguity or uncertainty stops new actions. No other charge/action is admitted, and final independent financial preservation/receipt postflight remains mandatory. This reviewer performed no operational write.

## Independent final READ-ONLY PUBLIC postflight — ACCEPT

Reviewer: independent Astra, 2026-09-21. The executor—not this reviewer—performed the previously admitted public375px proposal→separate yes. I personally verified the resulting persisted financial effect, preservation, published assets and current rendered cashier. **No reviewer operational POST or live replay was executed.** Ordinary automatic demo authentication alone was expressly permitted for the read-only browser check; its token was not recorded.

### Executed proof and exact deltas

`bun D:/Yellow/temp/astra566-postflight.ts`: exit0 in tenant-local **repeatable-read/read-only**, final recorded snapshot **2026-09-21T06:43:31.320Z**. The script rechecks the actual public table inventory is exactly the baseline129, recomputes all fingerprints using the identical preflight expression, verifies each new row and compares every other preexisting row. For consumer cursors only, it reads the checkpoint archive's `consumer_cursor` data as SQL text using `pg_restore --file=- --data-only --table=consumer_cursor` (no database restore), reconstructs its digest with read-only SELECT, and proves it equals the saved preflight baseline before comparing the attributable cursor changes.

| Table | Before → after | Verified cause |
| --- | --- | --- |
| journal | 0 → 1 | the single admitted charge |
| posting_line | 0 → 2 | +2500 guest / -2500 revenue |
| fact_log | 956 → 957 | one journal.posted fact |
| outbox | 896 → 897 | one journal.posted event |
| api_idempotency | 70 → 71 | one completed original command |
| consumer_processed | 1792 → 1794 | exactly two acknowledgements of that event |
| consumer_cursor | 2 → 2 | each existing consumer advances942→943 |

The other **122 tables match count and full-row fingerprint byte-for-byte**, including occupancy233, reservation/segment/guest/Party data, room condition, catalogue/routes/accounts/folios, business_day, series, documents, payments/payment_operations, fiscal/tax tables and schema_migration. Excluding only the exact new IDs/key/event acknowledgements from each append table reproduces its old baseline fingerprint: **all old rows preserved**. No generic background-worker exception was needed. Final aggregate **9eb12c723a3e9b049a39e993ae16ba4349a784913bfcfe4544fbf99fd4c158b5**.

Journal **6045b427-054c-42d4-841d-d9e312d406a0** is charge/Laundry/SAR, source `financials.charge.post`, exact property and actor, Riyadh business date2026-09-21. Its only lines are:

- seq1: guest account926b416b-9399-440b-9e2f-93685bc95a05, foliof728d2b3-eb9e-4e69-b433-6aa6ab88f649, **+2500** minor.
- seq2: revenue account95582479-004c-53dd-a394-d395244ac135, null folio, **-2500** minor.

Both lines are L3R_LAUNDRY, quantity **1.000**, SAR/current business date; net **0**. app_role and yellow_runtime both lack UPDATE/DELETE on journal/posting_line. Folio's single posting sums to **2500 minor**; account/folio rows themselves remain unchanged.

Exactly one fact **b877ea7b-4851-4daf-b8fa-e9b4d7523486** and one outbox event **96ae65f6-5d11-4705-97a8-1301199b59d8**, seq **943**, bind the journal, correct actor/property/date, exact two signed account/code/folio payload legs and correlation **f1d8fbfa-5978-4c1e-b634-1003c7614f70**. The canonical fact helper adds `request_id` to the fact payload; this equals that correlation. Outbox payload has the base minimized financial payload; published_at remains null. No name/contact is copied into financial evidence.

Idempotency operation **financials.charge.post**, original key `yellow-conversation-charge-bd93fc26-bdef-466b-be46-8f926c6c61d1`, key SHA256 **0a488a8698bac7ee6454a2ea227e84e9cbb363920feef1a7be26d993b145bcce**. I independently recomputed canonical request hash from actor/property/folio/L3R_LAUNDRY/2500/normalized quantity1.000: **a82a5ca0c00485e0562ce378daf600df0ede51841cce161c81ab102a67aa0b7f**. Exactly one completed201 row has that hash and the exact original response body/journal/date/amount. Retained executor action receipt reports first201/replayed=false and matches these durable rows. **No live identical replay was executed or claimed**; acceptance uses exact single effect, durable idempotency binding and read-only statement reconciliation. Isolated repeated-request behavior remains separately proven in Review565. Order566's optional replay was not needed.

Only `arrival-pickup-task` and `availability-projection` acknowledged event96ae65f6…/seq943. Their existing cursor rows advance942→943 with matching processing timestamps after event creation; all earlier consumer_processed rows preserve their baseline. These are acceptable derivative acknowledgements, **not** new pickup tasks or changed availability; those business tables remain identical.

### Current public rendering, artifacts and checkpoint

`node D:/Yellow/temp/astra566-current-public.cjs`: exit0. Actual public375×812→Ask Yellow→**Open cashier for Omar Siddiqui** loads the current L3R-DI-0015/L3R-FOL-1 window. Personally inspected screenshot **D:/Yellow/temp/astra566-current-cashier-375.png**: balance **SAR25**, exactly one **L3R_LAUNDRY / Laundry / SAR25 / quantity1.000 / 2026-09-21** row, running balanceSAR25. Width/scrollWidth375/375; no checked boxes; Post confirmed charge disabled. **Zero operational requests attempted, zero page errors.** Network interception rejects all mutating requests except ordinary automatic demo authentication. No amount, yes, checkbox, replay or charge action was entered.

`bun D:/Yellow/temp/astra566-http.ts` again verifies local/public health/Today/assets200 and identical accepted JS **index-DRHenqJQ.js / AE040BDF3C69E1DA25A1926E63648F6085BB8EDF366C643B15DB9AD4C256CE6A**, CSS **index-BnrIAmaB.css / C81EECF1AA3464552482EF9F2A8F47C489351EBDCA244DA1EE8A03692F66CFD3**, plus all runtime/vendor chunks. `docker inspect` confirms appc7da…/imagef52… healthy and exact unchanged PostgreSQL9f507…/Valkey781c…/tunnele172… identities. Dump/catalogue hashes were rechecked unchanged; action receipt inherits only owner/SYSTEM/Administrators access from the protected checkpoint directory.

### Reproducibility and honest limitations

| Reviewer artifact | SHA256 |
| --- | --- |
| D:/Yellow/temp/astra566-postflight.ts | 75DDB9273220DC946FCAC59932D7453105C546258752277D74689015B93B47A1 |
| D:/Yellow/temp/astra566-postflight-receipt.json | 14930D1BF0F0B2A49D15F08A1E597CE76307D0A3E60F4B7EE4454D775852895C |
| D:/Yellow/temp/astra566-current-public.cjs | BE98779A4692702D1019520CB4124533BCBBA1EE066BD1CE1E5A08283138E037 |
| protected action-receipt.json | F4C9180DA1D190096BCF3FF13EAC877BC93FFC28A4BA67317D7E68A33CD91867 |

Initial reviewer archive extraction omitted required `--file=-` and failed before any DB query; corrected to stdout-only extraction. Initial exact fact oracle omitted canonical `request_id`; inspected `src/kernel/fact-log.ts`, corrected the expected payload, and reran. Initial rendered oracle expected raw2500 text rather than the existing formatted SAR25 display; replaced it with exact rendered balance/amount/quantity/date/single-row assertions and reran. These are retained reviewer-harness mistakes, not production fixes or waived mismatches.

**FINAL PUBLIC ACCEPT for bounded Order566.** The admitted fictional SAR25 charge has exactly one balanced immutable effect, correct audit/idempotency linkage, correct live statement, no protected/unrelated data drift, and healthy exact deployment. This closes only the specified synthetic release/journey; it authorizes no further financial operation and claims no live replay, payment, fiscal/tax issuance, settlement or whole-PMS completeness.
