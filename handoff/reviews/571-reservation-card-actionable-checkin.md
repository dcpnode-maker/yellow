# Order571 — independent actionable reservation review

## Final candidate verdict: ACCEPT, bounded source/UI — 2026-09-21

Reviewer `/root/astra_review`, not the implementer. Read PROJECT.md, Order571 and Order496; ran state.ps1 and decision lookup. Applied yellow entity/compliance/Postgres rules to preserve existing folio, numbering and occupancy authority; used frontend-testing-debugging for rendered evidence. No implementation file edits, deployment, DB access or operational public request by this reviewer.

## Findings retained and repaired

1. **P2, closed:** initial new folio handler unconditionally claimed refresh success after React Query refetches, which can resolve error results. First repair still accepted stale cached data in the error reconciliation path. Reviewer-owned extracted current handler reproduced the latter with POST network error plus `{isError:true,data:cachedOpenReady}`: it claimed reconciliation. Final source requires successful fresh results and binds the open detail folio to readiness.primaryFolioId; the same reproduction now reports the error, not success.
2. **P2, closed in candidate:** public inline reservation workspace displayed disabled Resolve with Yellow because its callback was absent. Final candidate shares the named-arrival callback at all three workspace instances. Actual rendered candidate click now opens the correct governed arrival flow.
3. **P2, closed in candidate:** public desktop inline edit targets measured 34px, below the order's44px rule. Final CSS and actual rendered candidate measure44px desktop and46.44px or greater at375px.

No remaining blocking finding on the frozen candidate. These repairs are **not** asserted deployed: the independent unmodified-public observation served index-DKRVrwlO.js, while final candidate build is index-BRRF7kpA.js / index-DHqcvjfR.css. A separate postpromotion identity/read-only smoke check is needed before public completion is claimed.

## Frozen SHA-256

- App.tsx: `C04EF1F1ADB5DB8BC554E363885EA179932C5A71F07194AB85BA2B16B724B919`.
- styles.css: `AA9101C7D003F0451BBCC5800C124D2255AEA093602C01BD1D8B6E936B05F772`.
- yellow-reservation-actionable-readiness.test.ts: `592DA24A67ADADCAE5B878BC3745FC1C6E0914D4E921E5877B351FF7BDA2A177`.
- yellow-reservation-operational-details.test.ts: `B4F73A9B194CE735083EFB170F0816D8A0F4E989AB49467D0313A053D4F2CB98`.

## Personally executed commands

Working directory: `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

- `bun test tests/yellow-reservation-actionable-readiness.test.ts tests/yellow-reservation-operational-details.test.ts tests/yellow-voice-routing.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-reservation-lifecycle-actions.test.ts` — **50 passed,0 failed,415 assertions** on final frozen bytes.
- `bunx tsc --project frontend/yellow/tsconfig.json` — exit0, no diagnostics.
- `bunx vite build --config frontend/yellow/vite.config.ts` — exit0,469 modules; final index-BRRF7kpA.js and index-DHqcvjfR.css. This generates candidate assets only, not a deployment.
- `bun D:/Yellow/temp/astra571-handler.ts` — exit0. Executes extracted actual new predicate/handler with controlled dependencies, no network. Sole primary-folio blocker + due_in + inspected + identity passes; not-due-in, clean, dirty, missing identity, extra blocker and existing primary reject. Unchecked/busy/ineligible invokes zero calls. Matching fresh canonical folio succeeds; wrong folio, failed/no-data and failed/stale-data refresh do not. Uncertain request with genuinely fresh matching evidence reconciles. Two denied retries use the identical stable key, and shared busy callback brackets work true→false.
- `node D:/Yellow/temp/astra571-public.cjs` — actual public read-only375/desktop observation; no operational requests and no page errors. Initial free-form name wording did not resolve within harness timeout; exact confirmation command did. This is recorded as a probe limitation, not a new natural-language coverage claim.
- `node D:/Yellow/temp/astra571-candidate.cjs` — final exit0; browser-only substitution of the two **local final built candidate assets** into the public page, with all public data reads unchanged. Every non-GET/HEAD/OPTIONS request except automatic demo session entry is blocked; observed blocked operational attempts0 and page errors0. No token is captured. This is candidate rendered proof, explicitly not proof those bytes are public.
- `Invoke-WebRequest http://127.0.0.1:3010/health` and external `/health` — both200. `docker inspect --format '{{.Id}} {{.Image}} {{.State.Health.Status}}' yellow-public-demo-app-1` — healthy; container `5aadfbd7e272ea46b01d1bcacf15561395b88b7067c34b067989e52ac5388b6d`, image `sha256:d3ab85273992399a2431725f24837d770bfa0958167a2ba4c9469ac86e86a608` at observation.

## Rendered checks

Browser plugin required by frontend-testing skill was unavailable; used the existing bundled Playwright and installed Chrome, with no dependency installation. Public host was editing-alto-artists-quilt.trycloudflare.com. Flow: Today → local read command `Open L3R-DI-0016` → inline reservation → displayed operational field → unchanged editor → Resolve with Yellow; also visited the exact standalone reservation route obtained from its GET response and repeated Resolve.

- At375x812 candidate document width/scrollWidth375/375; desktop1440/1440. Meaningful reservation content and no framework error overlay. Five inline edit controls46.44–63.83px mobile,44px desktop; Resolve45px.
- Selecting displayed Market opens the existing operational editor; unchanged Confirm and save details remains disabled. No data was entered or submitted.
- Both inline and standalone Resolve show the same named LIVE ARRIVAL FLOW and canonical dirty room/HK task truth. Dirty-room and missing-folio operator copy replaces raw blocker codes; `dirty_room_override_unauthorized` absent from rendered text. No primary-folio action is offered with these two blockers. Final check-in remains blocked; zero checked boxes.
- Screenshots retained and personally viewed: `D:/Yellow/temp/astra571-candidate-mobile.png`, `D:/Yellow/temp/astra571-candidate-route-flow.png`; original public evidence `astra571-mobile.png` and `astra571-route-flow.png`. Intermediate harness timeout used an overly exact Room readiness text locator including a status symbol; corrected locator then completes with no page error.

## Authority and limitations

The new action invokes only existing POST `/api/v1/properties/:property/reservations/:reservation/primary-folio`, bearer session, body `{}`, and per-mounted-reservation stable key. Confirmation starts unchecked and is separate from check-in. Due-in/inspected/identity/sole-blocker gate matches the current inspected Order496 flow. Shared synchronous parent lock is acquired before the first await; shell click/submit capture and assistant busy checks block overlapping UI work. Success is now canonical-read reconciled, not a local optimistic folio. Named continuation alone performs no task/room/folio/check-in action. Inline fields retain the existing exact-before comparison, explicit confirmation, retry and canonical refresh workflow.

No new PM, city-ledger, settlement, accounting, numbering, occupancy, schema or API semantics are introduced by this slice. This review does not rerun or claim new PostgreSQL atomicity/RLS proof: endpoint implementation is not changed or in scope. Runtime is exported source without a usable baseline Git history; evidence binds exact hashes and semantic inspection, not an asserted complete whole-file diff. Existing Overwatch manual-handler behavior outside the new action is not newly certified by its extracted proof. No whole-PMS, finance-complete or public-release acceptance is implied.
