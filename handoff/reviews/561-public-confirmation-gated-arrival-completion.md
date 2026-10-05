# Order561 independent preflight — REJECT PLAN / BLOCKED

Reviewer: Codex `/root/astra_review`, independent non-implementer. 2026-09-21.

**Do not execute either operational command yet.** The exact fictional arrival has the intended inspected/sole-folio-blocker state, but the target property has **zero non-fiscal folio document_series rows**. The canonical allocator requires exactly one and refuses with55000 otherwise (0073 lines75–85). FolioService translates that into the valid-series conflict. The readiness endpoint does not inspect this numbering prerequisite; a visible proposal does not prove folio-open can succeed.

Missing configuration must be handled by a separately scoped, independently reviewed governed provisioning action. No seed, raw ad-hoc INSERT, bypass or weakened allocator is authorized by561. Fresh preflight and ACCEPT PLAN are required after correction. No operation was attempted merely to reproduce a predictable failure.

## Personally inspected and executed

Read PROJECT.md/AGENTS.md, Order561, Reviews558/559 and496, relevant decision search, existing FolioService, CheckInService, HTTP adapter and current UI handlers. Yellow entity/PostgreSQL and code-review guidance shaped exact effects and rollback limits. Reused current personally executed560 public artifact/readiness proof; no source change or deployment action.

Executed `bun D:/Yellow/temp/astra-order561-preflight.ts`, final exit0. Designated protected env values stay process-local; target PostgreSQL only loopback55432. SQL is REPEATABLE READ READ ONLY; tenant set transaction-local true after exact property-to-tenant resolution. The only non-GET HTTP request is the existing automatic demo-session authentication; no command endpoint was called. Public readiness GET200 personally executed, not a pasted result. No contact/document/payment values read or printed.

Initial expanded reviewer query incorrectly used service alias response_body_json as a table column; that read-only transaction failed. Corrected to actual response_body JSONB, reran complete proof exit0. No partial success credited or DB mutation.

## Exact current binding

| Entity | Binding |
|---|---|
| Tenant |6d9b7ce2-2d14-5576-b8c3-80f06501a603|
| Property |6081b544-22a1-534f-a86d-bb1ae0519e14; Asia/Riyadh|
| Reservation |fbe1dc20-456e-5345-8d7d-420b41685955; unique tenant-wide L3R-DI-0015; due_in; SAR|
| Primary Party |1219737c-4b41-5077-8854-4681affd8bd3; exactly one primary guest link|
| Segment |40f774cc-f117-5e2d-a5af-9231e062b6df; exactly one booked segment|
| Assigned unit |96827dcd-04f4-5812-aa77-e1459ce49319|
| Assigned physical room |e636cb57-b99c-56f4-a7d7-40e04e975e3e; inspected|
| Existing occupancy |d753875a-770b-40ba-8ad4-b3c808f4279d; segment-owned exclusive claim [0,) matching segment period|
| Period |2026-09-20T15:00Z to2026-09-22T11:00Z, half-open|
| Session actor |9f90d3e9-94f9-54de-95ec-35bd00b99b15|

Canonical readiness: status due_in; canCheckIn=false; roomCondition inspected; blockers exactly [primary_folio_not_open]; identity required=false/satisfied=true; no dirty override required or authorized. Account matching tenant/property/primary Party/SAR/guest count0; all target folios0; property folio series0. Existing target fact/outbox each one reservation.scenario_seeded; no target folio-open/check-in command idempotency receipts.

## Persisted baseline

`D:/Yellow/temp/astra-order561-preflight-receipt.json`, SHA256 `52A37B9DD0F6AA76E441F27DE1C56D64B0A2829F62EFCEF52E82046744BBE026`, records minimized bindings and sorted complete-row hashes/counts of all129 public tables INCLUDING schema_migration. Aggregate `B9411D8C1B7E10A996DC4F907E4971CE62133FA30C95A29CA698F2F20048A750`. Different from559 aggregate only because561 includes the96-row ledger; do not compare unlike table sets.

Relevant counts: account12, folio7, series1 globally (none at target), reservation654, segments654, guests653, occupancy233, facts953, outbox893, idempotency67. Journal/postings/payments/payment-operation/documents all0. Target reservation immutable hash excluding ONLY status9FDEE574FDBE13B12298F6FB423AC12F; segment excluding ONLY status55839D3F56A1801CD7F0D5C408199900. Other653 reservation complete-row digest A3A0ACD66D676644F09F5B6D90ACFE58.

Reviewer script SHA256 `4F4202B45FADB1A59B687D079F7B11C8D16528CA8B93AF62D25C3F4E39B06F91`. Baseline is observational, not a backup or permission to proceed. It becomes stale after any prerequisite provisioning; recapture then.

## Required plan corrections and eventual effect envelope (NOT current authorization)

Order561 originally says check-in commits occupancy. **Existing CheckInService does not create or alter occupancy.** Existing occupancy must remain byte-identical, not +1. Any wording/effect plan must reflect this. Folio opening may advance its existing non-fiscal numbering series; that intentional counter is not a fiscal document or financial posting, but cannot be omitted from expected writes.

After independently accepted configuration and fresh exact state, expected first-command effects for current zero-account/zero-folio target:

- Canonical POST `/api/v1/properties/6081b544-22a1-534f-a86d-bb1ae0519e14/reservations/fbe1dc20-456e-5345-8d7d-420b41685955/primary-folio`, body exactly `{}`, existing Bearer session and captured stable UI idempotency key.
- One open SAR guest account bound to exact Party/property; one open window1 primary folio; exactly one non-fiscal series next_no +1; one folio.opened fact and one matching outbox; one completed financials.folio.open idempotency row. No account.created event is invented.
- Fact/event bind exact new folio/account/reservation/window/reference, tenant/property/current actor and correlation/business date. Reservation/segment/occupancy/condition/guest and all financial rows remain unchanged.
- Fresh detail/readiness must show that exact folio, inspected condition, identity satisfied, blockers[] and canCheckIn=true before proposing the second command.

Expected second-command effects:

- Canonical same-reservation POST `/check-in`, body exactly `{}`, no override, separate stable UI key.
- Only target reservation due_in→in_house and target segment booked→in_house; preserve all other row columns and existing occupancy. One reservation.checked_in fact and matching outbox, one completed stay.checkin.commit idempotency row. Payload binds segment/space/primary folio/inspected, override=false/reason=null, identity and statutory facts.
- No Party/guest/condition/task/room/period change. No journal/posting/charge/payment/instrument/invoice/document. Folio remains open, balance zero. No fiscal chain/number change beyond the first command's NON-FISCAL folio counter.

Exact same-body/key replay after EACH success must retain response identity and `idempotency-replayed` (folio header) / replayed result (check-in), with ZERO further account/folio/counter/state/fact/outbox/idempotency effects. Actor binding must remain the same. Capture each original key/body/response/correlation without Authorization header/token; UI keys are per-mounted refs, **not durable across reload**. Reload is read-only reconciliation, not permission to invent a new key and issue another effect. No retained key or uncertain prior response → stop and reconcile canonically before retry.

## Visible UI and safety gates after future acceptance

Use actual fresh DOM rather than persisted numeric selectors. Activate Yellow → Ask Yellow named preparation → scope to exact .overwatch-journey/confirmation. For folio, exact visible label “I confirm opening the primary folio for this arrival” and button “Open confirmed primary folio”; only that checkbox may be checked. Wait response + authoritative refresh and the separate check-in proposal. For check-in, distinct label “I confirm this named arrival and the live readiness result” and button “Confirm and check in”. Never select a generic first checkbox or infer a yes for both actions. Retain one mounted journey and capture keys before first submission. Review559/560 personally showed both initially unchecked and writes disabled.

Before any future accepted first command: new restricted-owner/SYSTEM/Admin checkpoint, verified custom dump digest/readable archive; never inherit broad recovery-parent rights or print secrets. Capture fresh full baseline, target eligibility and command evidence counts. No service/worker restart or configuration command belongs to this operation proof.

Abort on ambiguity, identity/property/actor mismatch, stale period/room/condition/status, noncanonical/multiple series, account/folio conflict, permission denial, malformed receipt, refresh failure or any unexpected write. In particular, after first command succeeds but second is blocked, retain the legitimate empty open folio and STOP; do not delete it or force check-in. Backup is disaster recovery evidence, never an automatic undo of append-only business history.

Following eventual actions, independent read-only proof must compare exact expected rows/evidence, non-target/immutable hashes, financial/occupancy preservation and canonical Today lane counts. Workers may update derived projections/cursors in response to events; report those separately and prove they are attributable, not silently whitelist unexplained changes. Current verdict stays **REJECT PLAN / BLOCKED** until the missing numbering prerequisite is separately fixed and freshly reviewed.

## Fresh post-Order562 preflight — 2026-09-21 — ACCEPT PLAN

Reviewer: Codex Astra `/root/astra_review`, independent non-implementer. The initial rejection above is preserved as failure evidence. Order562 now has independent PUBLIC ACCEPT and its separately authorized missing prerequisite is present. This is admission of the precise two-command plan below, **not execution or postflight acceptance**.

Read PROJECT.md, current Order561, this prior review and final Review562; re-inspected current canonical folio/check-in helpers, service commit and Overwatch confirmation/refresh logic. Yellow PostgreSQL/entity rules required tenant-local read-only snapshots, unchanged occupancy and the non-financial boundary. `bash ./state.sh` was attempted but failed because WSL `/bin/bash` is unavailable; no successful state ritual is claimed. Current amended Order561 SHA256 `E0BC52752C8490CDE3670CA4DCA3A9CE6A81BD0026DB271C0D74D002D9F537DA` correctly states existing occupancy preservation and the non-fiscal counter1→2.

### Personally executed, current target

1. `bun D:/Yellow/temp/astra-order561-preflight.ts` — exit0. REPEATABLE READ READ ONLY against designated public loopback55432, tenant transaction-local context; no operational writes. Automatic demo authentication200 followed by public readiness GET200, actor `9f90d3e9-94f9-54de-95ec-35bd00b99b15`. Authentication is the only POST and creates no business operation; tokens/credentials remain process-local.
2. `bun D:/Yellow/temp/astra562-public-postflight.ts` — reran current ledger/security/topology/series/evidence and complete129-table comparison: current matches recorded562 postconfiguration exactly; no unexpected drift. Raw LF versus literal delimiter differences described in Review562 remain comparison-format issues, not data changes.
3. `bun D:/Yellow/temp/astra562-public-http.ts` — loopback/public health/page/assets200, exact accepted `index-BPC7WH-E.js` and `index-suC8KNf1.css` digests. Current app image `sha256:60d2ca02b140619efe015b1d36ffccb993dd7ab0d9cad5c20047e88d1f6f97d6`, healthy. Deployment/PG/Valkey/tunnel identity and source binding remain those independently accepted in562.
4. Separate tenant-scoped `BEGIN READ ONLY` Party boolean assertion returns true: exact bound Party exists once, is active, and its display name equals the order's fictional Omar Siddiqui. No contact/document/payment values were inspected or emitted.

Fresh minimized receipt: `D:/Yellow/temp/astra-order561-post562-preflight-receipt.json`, SHA256 `1D9FE4316FA0C46793E229FCDE827F3ED2B9708956A73024DC9B57D86D35B3BC`; capture `2026-09-21T04:34:15.121Z`; all129-table aggregate `4C646519D3024F6461DDC4936DBA56B41C2693E0204D20E4743E1F851F83BB34`. This uses the561 original row-md5/comma/sorted-md5 basis, intentionally different from562 raw-JSON/literal-backslash+n receipts. Compare like bases only. The receipt is a non-sensitive observational baseline, **not a backup**.

### Fresh facts and precise admission

All target UUIDs/period/guest/occupancy bindings in the original table above remain exactly the same. Unique tenant-wide confirmation L3R-DI-0015 is due_in; exactly one booked assigned segment; one primary guest; active exact Party; assigned space inspected. Existing occupancy `d753875a-770b-40ba-8ad4-b3c808f4279d` is the same exclusive segment-owned claim, same half-open period and room. Readiness is exactly blockers `[primary_folio_not_open]`, canCheckIn=false, identity satisfied=true/required=false, no dirty override authorized/required, primaryFolioId=null. Target folios0, compatible guest accounts0, original target fact/outbox each only one scenario_seeded, target command idempotency0.

Prerequisite now exact: target non-fiscal folio series `e5785f11-dae4-4eaf-ad43-15c37a68b7bd`, prefix L3R-FOL-, next_no1, fiscal=false, supplier/FY/hash lineage null. It is the only target kind=folio root and has the exact configured evidence accepted in562. Complete authorized role topology remains66 permissions/nine memberships/single configure recipient; no new grants are needed for561.

Fresh counts: account12, folio7, document_series2, reservation654, segments654, guests653, occupancy233, facts954, outbox894, idempotency68. Journal/posting/payment/payment_operation/document all0. Target immutable reservation hash excluding only status remains `9FDEE574FDBE13B12298F6FB423AC12F`; segment excluding only status remains `55839D3F56A1801CD7F0D5C408199900`; all653 other reservation hash remains `A3A0ACD66D676644F09F5B6D90ACFE58`.

**ACCEPT PLAN**, conditional on completing the immediate execution gates below:

- Before first write, create a NEW private restricted consistent561 dump/checkpoint, verify SHA256/readable catalogue and capture same-basis full current fingerprints. The562 backup predates these operations but does not replace this required pre-action checkpoint. Recheck target status/room/series/sole blocker and actor immediately; any drift expires this admission.
- Use the public named-arrival UI, not a direct replacement workflow. Prepare Omar and verify exact confirmation/reservation. The folio checkbox starts unchecked; select only “I confirm opening the primary folio for this arrival” then “Open confirmed primary folio”. Exact canonical primary-folio URL/body `{}`, Bearer identity and one retained per-mount folio key. Expected result: account+1, folio+1, series1→2 only, fact/outbox/idempotency each+1. No financial posting and no reservation/segment/occupancy mutation.
- Await canonical detail/readiness refresh. It must show the exact new open primary folio, inspected room, satisfied identity, no blockers and canCheckIn=true. Retain the same conversation; no combined or inferred consent. Only then separately check “I confirm this named arrival and the live readiness result” and use “Confirm and check in”. Exact canonical check-in URL/body `{}`, no dirty override, distinct retained key. Expected result: only target reservation/segment statuses become in_house; one fact/outbox/idempotency each. Existing occupancy and every other target column remain byte-identical. No new occupancy claim.
- Preserve each original request key/body/correlation/status/response without Authorization/token. Exact identical-key/body replay after each original command must produce no extra rows/counter advance; do not count these retries as new business operations. UI refs are stable within the mounted journey, not durable over reload. Reload is read-only reconciliation, never permission to generate a new key after an uncertain response. Stop on lost key/unknown outcome and reconcile current evidence.
- Global combined expected counts after the two first effects: account13, folio8, series2 with only target next_no2, reservation654/segments654/guests653/occupancy233 unchanged counts; fact956, outbox896, idempotency70. Financial zero tables remain zero. Consumer bookkeeping may acknowledge the two exact new event IDs; require attributed cursor/processed deltas and unchanged preexisting rows rather than blanket permission for unrelated changes.

The current source uses distinct confirmation states, separate per-mounted keys, one concurrent child command guard, authenticated canonical endpoints and detail/readiness refetch. Server check-in repeats readiness with transaction-time room-condition locking before the two status changes and same-Tx fact/event. This preflight rechecked source plus exact served artifact identity; it did **not** click or freshly render the live proposal, nor check a box. Execution must inspect actual DOM/current named card and disabled/unchecked controls before interacting, using labels above rather than generic checkbox indices. No new mobile/aesthetic proof is claimed.

On any denial, unexpected state/receipt, refresh failure, second blocker, stale room/status/period, financial effect or non-target change: STOP. If folio succeeds but check-in cannot proceed, retain the legitimate empty open folio and report partial completion; do not delete/reset/force. The new backup is disaster recovery evidence only, not an undo authorization. Independent postflight must verify exact evidence/old-row preservation/empty folio balance plus Today due-in/in-house canonical refresh before561 can close. No whole-PMS readiness claim follows.

**Fresh verdict: ACCEPT PLAN for these two separately confirmed commands only, after the new checkpoint and just-in-time recheck. No operational command was submitted by this reviewer.**

## Independent completed-operation postflight — 2026-09-21 — ACCEPT

Reviewer: Codex Astra `/root/astra_review`, independent of the operator who submitted the public commands. I personally recomputed the complete129-table snapshot, exact target/evidence/replay bindings, old-row preservation, archive readability/digests/ACL and current health/artifacts. This postflight performed **no public operation, replay POST, migration, seed, restart or data mutation**. Only this review file was changed.

### Executed commands and checkpoint

- Reviewer-owned inline Bun script executed as PowerShell here-string `@' … '@ | bun -`; final exit0. It loads the protected designated password only in memory, verifies loopback55432/database, opens `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, sets app.tenant_id transaction-local, and compares each public table to `astra-order561-post562-preflight-receipt.json`. Exact final inline source SHA256 `8A0A8FF765C06B619C40CD1B186D3961EC8C049A28A7482FF39F79B261923EBE`; it is retained in this task's tool invocation, not written into runtime or a new file. Queries use the original561 fingerprint basis: sorted MD5 of each complete JSONB row, comma-concatenated and MD5'd, plus row counts. Assertions additionally reconstruct only the two original statuses and counter in SELECT expressions, never UPDATE, to prove no other column changed.
- `Get-FileHash D:/Yellow/recovery/order561-public-20260921-100648/*` and `Get-Acl` personally match the checkpoint: dump2,617,087 bytes SHA256 `0E6927E2DA11D191AB3ABAD3084FCA18D31F8BF8C6D185E5E573CFB993EAF964`; catalogue200,181 bytes SHA256 `7BFD70960525AD86AE21806C4CD032C788A5DC5DC44F2CEFC0D7CE8BAC877418`. ACL inheritance protected, only ownerASTHA/astha, SYSTEM and Administrators full control. Streaming the dump to `docker exec -i yellow-public-demo-postgres-1 pg_restore --list` personally succeeded,2095 catalogue lines; no restore was performed.
- `bun D:/Yellow/temp/astra562-public-http.ts` — exit0, local/public health200, Today200, both accepted asset bytes200/exact hashes. `docker inspect` confirms unchanged healthy app/PG/Valkey identities and unchanged running tunnel. A health-template query on the tunnel initially lacked its optional Health member; a separate State.Status inspection succeeded. No restart was needed.
- Tenant-scoped READ ONLY `folio LEFT JOIN folio_balance` confirms target open folio, balance_minor0, posting lines0.

An initial reviewer fact-payload assertion omitted the existing audit helper's `request_id` enrichment, so that attempt rejected its own incomplete oracle. Inspection of the actual minimized fact and service contract corrected it to require request_id exactly equal to the corresponding outbox correlation. The complete final proof then passed; no failing intermediate assertion is presented as success.

### Complete preservation and exact deltas

Fresh final129-table aggregate: `277D2DBD34FF393A38EF1210F58EEB444240810A93F6ED414992929735DD0BDB`, compared with accepted preaction aggregate `4C646519D3024F6461DDC4936DBA56B41C2693E0204D20E4743E1F851F83BB34` on the same basis.

Exactly ten tables changed:

| Table | Before→after | Verified bounded effect |
|---|---|---|
| account |12→13|one exact target guest account|
| folio |7→8|one primary open window1|
| document_series |2→2|only target non-fiscal next_no1→2|
| reservation |654→654|only target status due_in→in_house|
| reservation_segment |654→654|only target segment booked→in_house|
| fact_log |954→956|exact folio.opened and reservation.checked_in facts|
| outbox |894→896|exact corresponding two events|
| api_idempotency |68→70|one completed record per original key|
| consumer_processed |1788→1792|two consumers × the exact two new events|
| consumer_cursor |2→2|each last_seq940→942 plus acknowledgement timestamp|

All119 other complete-table fingerprints are identical. In particular **space_occupancy233 rows is byte-identical**, including the accepted segment-owned claim; all guests/Parties/contacts, unit/room/condition/task/projection, journals/postings/payments/payment operations/documents and migration ledger are unchanged. Financial tables remain zero. Removing only the exact new account/folio/two facts/two events/two idempotency/four acknowledgement rows in SELECTs reproduces their original full-table fingerprints. Replacing only the target reservation status, target segment status and target series next_no in SELECT JSON reproduces those original full-table fingerprints. This proves unchanged preexisting rows and non-target records, not merely equal counts.

Target reservation/segment UUIDs and period remain those admitted above. New open SAR guest account `926b416b-9399-440b-9e2f-93685bc95a05` is bound to the exact primary Party/property; open folio `f728d2b3-eb9e-4e69-b433-6aa6ab88f649`, window1, reference `L3R-FOL-1`, points to that account and reservation. Balance0/lines0. Series `e5785f11-dae4-4eaf-ad43-15c37a68b7bd` remains non-fiscal, same prefix, next2, all supplier/FY/hash-chain fields null.

### Audit, replay and derived consumers

Exactly one fact/event for each action, actor `9f90d3e9-94f9-54de-95ec-35bd00b99b15`, exact tenant/property and business-date2026-09-21:

- Folio event `2c87f86a-f6c2-4270-897e-f8975bad3ca7`, seq941, correlation `6f7d15d8-7199-4af1-9181-c8f48f93a943`, aggregate the exact new folio; exact five-field payload binds folio/account/reservation/window/reference. Fact type folio.opened adds only the corresponding audit request_id.
- Check-in event `4602c9b8-91d7-4b68-a07e-56f168c949db`, seq942, correlation `ed8890ae-8c2f-4a05-a62f-fe5d91a55fa2`, aggregate target reservation; exact payload binds original segment/space/new primary folio, inspected condition, override=false/reason=null, adapter=null, identity required=false/satisfied=true. Matching fact adds only the corresponding request_id.

Completed idempotency records independently match SHA256 of original keys `yellow-public-demo-68bc6022-1438-45e6-b4c8-5ed650114dbc` (financials.folio.open/status201) and `yellow-public-demo-8b00fe00-ced2-42f2-8575-d857267521bf` (stay.checkin.commit/status200). Request hashes bind exact actor/property/reservation and, for check-in, false override authority/null reason. Stored original bodies bind the exact new folio/account and in-house/inspected state. No extra idempotency rows or business effects exist after the operator's reported identical-body/key replay. The operator reports first/retry201 and200 with replay flags and retained body hashes; this read-only reviewer verified durable receipts and zero extra effects, **did not personally repeat a public replay or witness the earlier UI clicks**.

Both arrival-pickup-task and availability-projection have exactly one acknowledgement for each941/942 event; each cursor is now942. The previously inspected handlers do not act on folio.opened or reservation.checked_in, and task/projection hashes confirm no side effects. These four acknowledgements and cursor timestamps are acceptable attributable delivery bookkeeping, not unexpected operational writes.

### Current public outcome and limits

Independent current property status census: due_in1, in_house13, due_out2, checked_out10, reserved108. It agrees with the operator's reported Today2→1 arrivals and12→13 in-house, and reload result. I did not reenact a browser mutation or claim independent visual observation of the operator's prior confirmations/reload; source/served artifact identity, current state, immutable evidence and exact no-duplicate effects are independently verified.

App remains healthy image `sha256:60d2ca02b140619efe015b1d36ffccb993dd7ab0d9cad5c20047e88d1f6f97d6`. Local/public page and health200; served `index-BPC7WH-E.js` SHA256 `0EE6D44EF8D8FB3BBDD4BE7E55AD91252F6361187172E0E291150834E66D0401` and `index-suC8KNf1.css` SHA256 `C7F62AD7203036D340B5A9904801998C2232A569754BA05A2F1371B917F3DD0B` unchanged. PG/Valkey/tunnel identity is preserved.

**Final verdict: ACCEPT the bounded Order561 completed-operation postflight. Exact two effects and their retries have not introduced extra occupancy or financial effects. No further operation, data erasure/restore, phase completion or whole-PMS readiness is authorized or implied. Preserve the legitimate business history and private checkpoint.**
