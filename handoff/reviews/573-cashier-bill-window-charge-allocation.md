# Order573 independent review

## R1 — CHANGES REQUIRED — 2026-09-21

Reviewer: `/root/astra_review` (independent non-implementing agent). Read PROJECT.md, ran `state.ps1`, read Order573 and D-492/canonical transfer service, applied Yellow compliance/entity/PostgreSQL skills. No implementation edits, public deployment or public financial mutation.

### Frozen candidate

- App.tsx `254D1DE5226DAA751FD4D8EFC1257D3313883E280796AE2BC27FB0C2E117B6D2`.
- styles.css `436C2B4FD537A48EBB001AD7FECF405021D4E3EF3D919117282EA72D2A0AC5EB`.
- yellow-cashier-bill-window-allocation.test.ts `10E10AB3E9038C239A272AD9C2979F257A153EF01AC9CA9863853AC363EFB697`.
- yellow-next-finance-workspace.test.ts `184B18542D779C8F60424ECD59C3231E4B43F97E93B7C71E4B4F328341A717BA`.

All matched initial supplied hashes; App rechecked after executable proof, unchanged.

### Personally executed commands/results

Commands below run in serving source unless an absolute harness path is shown:

1. `bun test tests/yellow-cashier-bill-window-allocation.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-cashier-receivable-workbench.test.ts`: **13 passed,0 failed,172 assertions**.
2. `bunx tsc --project frontend/yellow/tsconfig.json`: exit0.
3. `bunx vite build --config frontend/yellow/vite.config.ts`: exit0,469 modules, index-BYjN0Mx5.js / index-NPwD1YbL.css.
4. `bun D:/Yellow/temp/astra573-db.ts`: reviewer-owned wrapper privately loads isolated authority, verifies loopback5442 PostgreSQL16.15/migration97 and absent Order188 fixture, then executes `bun test tests/financial-folio-transfers.integration.test.ts --timeout 120000` with `YELLOW_REQUIRE_FOLIO_TRANSFERS=1`, runtime and deploy URLs only in memory. **8 passed,0 failed,47 assertions,7.13s**. Real canonical service proof covers twenty concurrent gap-free windows; exact replay/changed-body conflict; whole corrected-pair routing; immutable balanced zero-net history; twenty-way same-group winner; publisher rollback of journal/lineage/fact/outbox/idempotency; transfer/correction arbitration; sealed/closed/hostile/raw-lineage denials. No public database used.
5. `bun D:/Yellow/temp/astra573-hostility.ts`: final exit0. Extracts/transpiles actual current helpers and handlers including actual shared `hasExactKeys`. Results: valid receipt rejected/uncertain; named sibling preview rejected;503→403 retry keeps identical body/key and parent lock; changed generation/revision produces0 writes, clears confirmation and presents refreshed preview.
6. `node D:/Yellow/temp/astra573-render.cjs`: exit0. Actual mounted React parent/child with candidate assets substituted locally and financial target/preview/command responses fulfilled in the browser.375/375 and1440/1440 containment, measured labelled controls minimum44px, unchecked commit disabled. Simulated503 recovery:2 previews,2 intercepted command requests, identical body/key, parent Show arrivals blocked; page errors0, unexpected operational requests0.
7. `$env:REVIEW_MODE='existing'; node D:/Yellow/temp/astra573-render.cjs`: exit0, actual existing named-window rejection,1 preview/0 commands.
8. `$env:REVIEW_MODE='valid'; node D:/Yellow/temp/astra573-valid-render.cjs`: exit0, two structurally valid success receipts both enter retained recovery;2 previews/2 identical command attempts, component remains locked. No success statement reconciliation reached.

Browser commands never reached the public financial server. Every preview/transfer POST was locally fulfilled, other operational writes blocked; automatic demo session and ordinary GETs only. This is candidate integration proof, not published-app acceptance.

### P1 — every valid success receipt is rejected; recovery cannot complete

`FOLIO_TRANSFER_RECEIPT_KEYS` appends businessDate/journalId/replayed to the already ordered preview keys. Shared `hasExactKeys` sorts actual keys but compares them to the expected array **without sorting expected**. Consequently even the valid canonical receipt always fails before validating its contents. Both actual extracted helper and mounted browser reproduce this: valid receipt => uncertain; identical retry => same rejection, parent remains locked. A successfully committed transfer cannot reach authoritative reconciliation or release its recovery lock.

Correct the exact-key contract and add executable actual-helper tests for a valid canonical preview and receipt, not only source-string assertions. Re-run valid first commit plus replay through the mounted UI and prove both statements reconcile and the parent unlocks.

### P2 — named existing sibling windows cannot be previewed

The initial preview handler unconditionally compares `preview.destinationName !== draft.newWindowName`. For existing windows the draft correctly has newWindowName=null, but canonical `transfers.ts` returns `destination?.name ?? input.newWindowName ?? null`. Thus an existing named Business window correctly returns Business and is refused. Actual mounted browser and extracted handler both reproduce the rejection before mutation. Bind existing-window identity/name to the selected canonical sibling; reserve newWindowName comparison for creation. Test both named and unnamed existing siblings and a new window.

### Required success-parser hardening when fixing P1

`validateFolioTransferReceipt` invokes the preview validator, whose malformed-field/duplicate-member errors are `FolioTransferRequestError(..., false)`. `submitFolioTransfer` rethrows this class unchanged and the handler consequently treats it as a definitive no-write error. Once P1's key-order defect is repaired, malformed successful receipts can therefore release the unresolved attempt. Normalize **all** successful-response parse/validation failures to uncertain, preserving the exact attempt and parent lock. Test malformed currency/amount, duplicate members and malformed JSON after an HTTP200, as well as later4xx after an earlier uncertain response.

Evidence correction: the first external helper harness substituted a key comparator that sorted expected keys, inadvertently bypassing P1 and exposing that downstream issue. It initially reported malformed200 unlocked. The harness was corrected to execute the actual shared comparator; the current frozen candidate in fact rejects every receipt at the earlier gate and keeps the lock. Two exploratory malformed-browser runs timed out waiting for the initially predicted unlocked message; the displayed actual state was retained recovery. Those failed exploratory expectations are not candidate success evidence. The final evidence above supersedes the preliminary report and distinguishes the presently reproduced blocker from the masked source defect.

### Positive boundaries and remaining review limits

The inspected draft contains only canonical source/destination/groups/reason/generation/revision; no client money/quantity allocation or direct SQL. Bearer auth and idempotency remain in the canonical command. Initial UI separate confirmation, complete-group eligibility, pre-submit source+preview drift refusal, uncertain same-key retry, parent navigation lock and mobile containment passed the bounded tests. Financial service integrity passes independently in real isolated PostgreSQL. However authored UI tests are mostly source assertions and missed both functional blockers. Full successful statement reconciliation cannot be accepted until valid receipts are consumable; retained helper/browser hostile cases must be rerun on corrected frozen bytes.

**CHANGES REQUIRED.** Do not promote this candidate. No claim of whole-PMS readiness, complete repository-wide typecheck or public operational acceptance. Reviewer changed only this review and external proof artifacts.

---

## R2 — ACCEPT (bounded candidate) — 2026-09-21

Independent reviewer `/root/astra_review`; R1 preserved. All supplied hashes personally matched before and after proof:

- App `96129B47CAD39839765588DC30ED67B9C94921643483A66C7608C438C489CFE0`.
- CSS `436C2B4FD537A48EBB001AD7FECF405021D4E3EF3D919117282EA72D2A0AC5EB`.
- Allocation test `F90490FA978201AE1DB7AFD30FEBD6FA3379DD43FAE4F969822B142D18E96CB8`.
- Finance test `184B18542D779C8F60424ECD59C3231E4B43F97E93B7C71E4B4F328341A717BA`.

### Personally executed R2 evidence

1. `bun test tests/yellow-cashier-bill-window-allocation.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-cashier-receivable-workbench.test.ts`: **16 passed,0 failed,189 assertions**. New tests execute actual receipt/name-matching helpers rather than only source-string markers.
2. `bunx tsc --project frontend/yellow/tsconfig.json`: exit0.
3. `bunx vite build --config frontend/yellow/vite.config.ts`: exit0,469 modules; **index-C8aUx2B_.js / index-NPwD1YbL.css**.
4. `bun D:/Yellow/temp/astra573-db.ts`: protected isolated loopback5442 PostgreSQL16.15/migration97, fixture absent initially. Actual `bun test tests/financial-folio-transfers.integration.test.ts --timeout 120000`, required flag enabled: **8 passed,0 failed,47 assertions,7.74s**. Canonical immutable/balance/concurrency/replay/rollback/hostile-boundary cases listed in R1 personally rerun. No public DB.
5. `bun D:/Yellow/temp/astra573-r2-hostility.ts`: final exit0, current extracted actual helper/handler proof. Valid receipt accepted. Malformed currency/amount and duplicate member success receipts rejected with uncertain=true. Named existing-window preview accepted. Malformed success retains exact attempt/parent lock.503→403 retry remains same body/key and locked. Generation/revision drift produces0 writes and clears consent. External harness was adapted for newly exported functions and the new destinationWindow dependency; two export-syntax attempts and an omitted dependency were harness adaptation errors, not candidate findings. Final run includes both corrections and actual shared key comparator.
6. Mounted candidate browser command `node D:/Yellow/temp/astra573-r2-render.cjs` personally run four times with process-local `REVIEW_MODE` values `existing`, `new`, `malformed`, and `retry`:
   - Existing named Business window and new Business window each: **2 previews,1 locally intercepted command**, valid receipt followed by matching source/destination statement responses reaches explicit reconciled success. Parent Show arrivals then works and unmounts cashier, proving lock release.
   - Malformed200 and503 modes each: **2 previews,2 locally intercepted command attempts**, identical body/key, no new preview on retry; unrelated parent Show arrivals remains blocked and retained attempt stays visible.
   - All four runs exit0; initial confirmation unchecked/commit disabled;375/375 and1440/1440 containment; measured labels/buttons minimum44px; zero page errors and zero unexpected operational requests.

R1's key-order defect is closed: the receipt key list is now sorted for the exact shared validator. The complete receipt validation is wrapped so all success-payload validation failures become uncertain, closing the downstream masked error-classification gap. Initial preview matching now uses the selected existing sibling's canonical name, or exact new-window name for creation; both mounted paths pass. Existing canonical source/destination/group/generation/revision body, bearer/idempotency transport and no-partial-allocation boundary remain intact.

**ACCEPT these exact Order573 source bytes.** No outstanding blocking finding in the bounded reviewed slice. This is not deployment or public financial-operation authorization: candidate assets and synthetic financial responses were substituted only inside the reviewer browser. No preview/transfer command reached the public financial server; other operational writes were blocked, with ordinary public GETs/automatic demo session only. Real mutation proof used isolated5442. No implementation, schema or public data changed. Repository-wide green/whole-PMS readiness is not asserted; any promotion still needs its target-bound deployment/read-only postflight. Reviewer edited only review and external proof artifacts.
