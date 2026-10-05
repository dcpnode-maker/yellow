# Order565 independent review

Reviewer: independent Astra agent, 2026-09-21. I did not implement the candidate. Read PROJECT.md, Order565, Yellow compliance/entity/PostgreSQL skills and relevant existing financial code. `bash ./state.sh` failed because WSL `/bin/bash` is unavailable. Skills enforce reuse of canonical charge/journal authority, exact money, same-Tx evidence and no fiscal/payment expansion. No public charge, implementation edit or public deployment was performed.

## Initial review cycle — CHANGES REQUIRED (history retained)

Source was being repaired during this review, so findings below are attributed to the inspected/reproduced state, not automatically to later hashes.

1. Initial parser accepted arbitrary three-letter currency and always multiplied decimal amount by100. Unsupported zero/three-decimal currencies would be misinterpreted. Later actual probes on voice hash `4E943795D57C173A381200F525449C6F13A40EEE136E982DB8FB7CA46CB6A838` returned null for JPY/XYZ/KWD; initial issue then appeared closed by bounded supported currency allowlist.
2. Initial proposal cancellation always said “Nothing was posted”, including after uncertain response or failed statement reconciliation. Adding postingAttempted fixed that direct cancellation case but initially left unrelated-command supersession free to discard the key. Actual extracted `ask` proof on App hash `172610CBC8159EC4F223EDCDC9CFC66947898EFBD99020E32C8EB11969A4187C` reproduced uncertain→no→show today→same charge producing a different idempotency key. This can duplicate an already committed journal and is blocking.
3. Same actual-effect run accepted hostile success receipts with invalid UUID journalId, invalid businessDate, or string `replayed`, when mocked statement echoed the journal. Receipt validation and exact refreshed statement identity/date/quantity/currency binding are mandatory before claiming success.
4. Initial preparation trusted cached board status and confirmation reread only folio, not current reservation eligibility. Fresh detail status and exact open-folio linkage now need executable tests. Manual cashier posting initially did not acquire the shared synchronous mutation lock; parent conversational actions could overlap it. Preparation catch also lacked supersession guard. These source findings were sent for repair, not silently accepted because static tests pass.
5. A later repair resets postingAttempted after a non-uncertain retry error. If an earlier request had an uncertain result, a later403/409 cannot prove that earlier request did not commit. Preserve the uncertainty latch and exact request/key until journal reconciliation; do not turn an earlier unknown into a cancellable “nothing posted” outcome.
6. Actual375px rendered preparation showed fixed Yellow-active chip obscuring the proposal's title/folio reference. Screenshot `D:/Yellow/temp/astra565-prepared-375.png` was personally inspected. Required exact financial identity must be unobscured before yes; an additional separately visible folio row is a bounded remedy.

## Personally executed proof already completed

### Fresh isolated PostgreSQL16 financial proof — PASS

`bun D:/Yellow/temp/astra565-db.ts` created a **fresh reviewer-owned** database `yellow_astra565_financial_fresh` on the existing reviewer-only cluster at127.0.0.1:55564. Protected deployment password was read locally from `.yellow/runtime-database-authority.env` and only used in process memory. No public database connection/copy was used. PostgreSQL reports16.15; canonical runner applied exactly1–97 (97 discovered/97 applied). The script ran:

`bun test tests/financial-postings.integration.test.ts tests/financial-statements.integration.test.ts --timeout 120000`

with both suite URLs bound to that fresh database and `YELLOW_REQUIRE_FINANCIAL_POSTINGS=1`, `YELLOW_REQUIRE_FINANCIAL_STATEMENTS=1`. Personally observed **22 pass, 0 fail, 159 assertions,68.76s**. Includes exact signs/balance/routes/minimized evidence, identical replay/body conflict, twenty concurrent same-key calls, injected failure after real outbox insertion with rollback/retry, charge-versus-seal latch, sealed/closed/invalid route denial, RLS/two-tenant concealment,500 charges/1000 balanced immutable lines and replay, statement keyset/running balances and10,000-line indexed query. Existing suite cleanup removes its fictional fixture from this isolated database only. This proves reused service behavior, not the new UI state machine or a live public posting.

### First source/type/build proof — PASS, bounded to that run

`bun test tests/yellow-voice-routing.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-reservation-lifecycle-actions.test.ts`:43pass/0fail/363assertions. `bunx tsc --project frontend/yellow/tsconfig.json` and `bun run typecheck`:exit0. Most authored frontend assertions are source contracts/pure parser tests, not rendered React effects; they did not detect the above failures.

`bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra565-build`:exit0,469 modules, initial candidate asset index-vIv2OIoh.js. Output is reviewer temp only; no public build/deploy.

### Personally executed controlled effects and rendered preparation/cancel

`bun D:/Yellow/temp/astra565-effects.ts` transpiles the actual current App ask body and injects controlled read/POST dependencies, with no network/DB effects. It executes preparation, no/cancel, bare yes, stale checked_out rejection and success-after-statement, then the uncertain-key and hostile-receipt reproductions listed above. This is actual extracted candidate logic, not a reimplementation of its decision flow; service mocks do not replace the real-PG proof.

`bun D:/Yellow/temp/astra565-preview.ts` serves reviewer temp candidate on loopback31565. It forwards only read requests and automatic demo-session acquisition to existing loopback3010 and rejects all operational methods before forwarding. `node D:/Yellow/temp/astra565-render.cjs` adds a second browser interception guard. Actual installed Chrome at375×812 typed “post a SAR120 laundry charge to Omar Siddiqui” (with normal currency spacing in the script), saw exact class/amount/quantity/confirmation proposal and zero POSTs; then typed no, saw CHARGE CANCELLED, retained embedded cashier and SAR0 folio. Document width/scrollWidth375/375. **Zero operational requests attempted, zero browser errors.** Screenshots prepared/cancelled are retained in D:/Yellow/temp. Full exact folio visibility issue remains as above. No yes or financial checkbox was submitted in this rendered read-only journey.

**Interim verdict: CHANGES REQUIRED pending frozen remediation and independent rerun of the new UI uncertainty/receipt/concurrency/visibility cases.** Financial backend proof passes but does not waive UI defects. No migration, new financial semantics, public posting or whole-PMS completion is approved.

## Final frozen independent review — SOURCE / ISOLATED ACCEPT

Reviewer: independent Astra agent, 2026-09-21; not the implementer. This section supersedes the interim verdict for the exact bytes below, while preserving all failure history above. All results here were personally executed, not adopted from implementer output.

### Exact accepted source

| File | SHA-256 |
| --- | --- |
| frontend/yellow/src/App.tsx | CD0161E882A1C41E41900177529243CBC296F57241A5DD6DB87D3230FBE00849 |
| frontend/yellow/src/voice.ts | 4E943795D57C173A381200F525449C6F13A40EEE136E982DB8FB7CA46CB6A838 |
| tests/yellow-voice-routing.test.ts | 7D4BB61CBC1562BCC15FCAE67EDF7FF99C30B8C2A17CB584D985145031069297 |
| tests/yellow-next-finance-workspace.test.ts | 1708C89E267E2989DC192FE4824CD2EF264AB91E6EEF7C76FFD476233139F446 |

### Final personally executed commands and results

Working directory for Bun/frontend commands: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

- `bun D:/Yellow/temp/astra565-effects.ts`: PASS, controlled actual extracted ask/transport/manual-handler effects; no network or database writes.
- `bun test tests/yellow-voice-routing.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-reservation-lifecycle-actions.test.ts`: **43 pass, 0 fail, 374 assertions**.
- `bunx tsc --project frontend/yellow/tsconfig.json`: exit 0.
- `bun run typecheck`: exit 0.
- `bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra565-build`: exit 0, 469 modules; reviewer-only assets `index-DRHenqJQ.js` and `index-BnrIAmaB.css`.
- Fresh PostgreSQL16 proof described above remains applicable to unchanged canonical financial services: **22 pass, 0 fail, 159 assertions**, fresh migrations 1–97. No public database was used.
- `bun D:/Yellow/temp/astra565-preview.ts` followed by `node D:/Yellow/temp/astra565-render.cjs`: actual Chrome 375×812 preparation then cancellation PASS. The reviewer-owned preview was stopped after proof; no public process was restarted.

### Remediation personally verified

The controlled proof executes the actual transpiled candidate logic with held/rejected reads and hostile receipts. It passes preparation/cancellation/bare yes, stale reservation rejection, success only after matching canonical statement, and all prior failure reproductions:

- An uncertain attempt survives no/cancel, unrelated-command supersession and reproposal without losing its exact key/body. A later 4xx does not clear earlier uncertainty.
- Invalid UUID/date/replayed receipt fields are refused. Refreshed statement currency, reservation, quantity and business-date mismatches cannot claim success.
- A known receipt with failed statement refresh retries the statement without a second POST.
- Synchronous financial flight blocks conflicting cancellation. Actual manual posting acquires the shared lock before the first await and retains it through refresh, excluding a parent financial command.
- A superseded preparation rejection remains silent. Existing Bearer session, canonical folio-charge endpoint, exact body and stable idempotency header are preserved; 5xx and malformed 200 remain uncertain.
- Fresh reservation detail must be eligible and match the proposal; the exact sole open folio and current server-provided charge option are revalidated. Supported money parsing remains bounded to explicitly supported two-decimal currencies and bigint arithmetic.

The final rendered read-only journey personally showed the separate unobscured `Folio L3R-FOL-1` row (left 19, right 135.5625, top 76.046875, bottom 98.046875; hit-test true), named reservation, Laundry, SAR 120.00 and quantity 1. Document/client width remained 375/375. Typing no produced CHARGE CANCELLED and retained the SAR 0 embedded cashier. Its posting checkbox remained unchecked and Post disabled. Browser recorded **zero operational requests attempted and zero page errors**. Proxy and browser independently prohibited operational writes. Screenshots: `D:/Yellow/temp/astra565-prepared-375.png` and `D:/Yellow/temp/astra565-cancelled-375.png`.

### Reviewer-owned reproducibility artifacts

| Artifact | SHA-256 |
| --- | --- |
| D:/Yellow/temp/astra565-db.ts | 9EE159D966DAFD69F907E49C4542EDB53245DE21AC55058A1DC64CD8B6CAE257 |
| D:/Yellow/temp/astra565-effects.ts | 91ED0CE2FE95B3B80DB36A1FFAA77482D177ECEFBCD26E71E9EC837FCFF10B99 |
| D:/Yellow/temp/astra565-preview.ts | FEFF2C36F18CD2189DF66EEC9D04EB5290A91C5D738D9ABDDB7AA06958FC9820 |
| D:/Yellow/temp/astra565-render.cjs | D60555B9193B09F092046D3547D89D5FE733232EA59F367A970435F1AEF64D65 |

### Decision and limitations

**ACCEPT the frozen Order565 source and isolated proof.** The six recorded blocking findings are resolved in the tested bytes. The Yellow skills shaped this review by requiring canonical posting reuse, exact money, balanced immutable journal/evidence verification, RLS and idempotent concurrency proof rather than frontend-only assurance.

This is not public deployment/posting authority or a claim of whole-cashier/PMS completion. No public charge was submitted. Actual rendered proof covers preparation/cancellation, while successful/hostile UI effects are controlled and the real financial writes occur only in the fresh isolated PostgreSQL fixture. Browser-reload durability of pending attempts and arbitrarily old journal discovery outside a statement page are not claimed. Some generic top instruction text still overlaps the fixed Yellow chip; the exact financial identity is separately visible and this is not a remaining financial confirmation blocker. State ritual remains limited by unavailable WSL as recorded above. No tax, fiscal issuance, payment, refund or settlement behavior is added or approved.
