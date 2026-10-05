# Order 544 — independent conversational guest-allocation review

Reviewer: Codex Astra independent agent `/root/astra_review`, non-implementer. Date: 2026-09-21.

**ACCEPT — bounded source and isolated canonical-command proof for the exact bytes below.** Required desktop/375px conversational browser proof and target-bound release remain the implementation owner's separate gates. No public database, public app, provider or deployment was touched by this reviewer.

## Authority and frozen source

Read PROJECT.md, Order544 and applicable decisions D-298/D-300/D-301/D-304. Applied the code-review and Yellow entity/Postgres review guidance. Runtime source root: `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

| File | SHA-256 |
| --- | --- |
| frontend/yellow/src/App.tsx | `35C10C150257AD4DB583F25DDB734CAE5E15E3EA8A44FB4EACCF4983650008C5` |
| frontend/yellow/src/voice.ts | `4375EF4C6834C262E2CDEF82DCE5E93019A27FCB44D7DBC9AC96DB5565DB7C67` |
| frontend/yellow/src/styles.css (unchanged adjacent surface) | `0FB32770EF42C444FCCC305F89F512217DD32B1437DE8497EB55A7631B370CD1` |
| tests/yellow-conversational-guest-allocation.test.ts | `7359BFA43EDD61C0E2E21EEBCFD4E4996F124633644F28E12DA737ABB3FB393D` |
| tests/yellow-voice-routing.test.ts | `862F810041413FAA460119A5F58DA75DBF4F5EC29070CCA2DE9A72C37E77AB05` |

## Findings and disposition

Initial source inspection identified five blockers: pending lookup could resurrect cancelled/superseded proposals; failed replacement commands retained old confirmation authority; committed-but-unreadable outcomes were not recognized on retry; filtering out the primary before name matching could select a same-name secondary; filtering inactive exact matches before fallback could select a different active Party. All five are corrected in the frozen source and exercised below. These initial findings are source-inspection findings, not a claim that an old-byte executable reproduction passed: an early old-behaviour assertion encountered an already-repaired candidate.

Current source uses finite affirmative/cancel grammar and an exact visible reservation/allocation proposal. The proposal includes the primary and complete retained non-primary allocation; sharer totals use integer basis points. Identity is resolved before eligibility filtering. A bare yes has no write authority. New resolutions clear old proposals, and post-await generation checks discard superseded work.

Confirmation acquires the synchronous shared reservation mutation lock, stops recognition through the existing lifecycle-flight mechanism, refetches canonical detail, and either recognizes the already-applied desired allocation, refuses a changed baseline, or calls only the existing authenticated/idempotent reservation guest replacement PUT. The unchanged proposal retains its key. Success requires canonical desired-state matching and detail/board/index invalidation. Primary identity/role is not editable; no Party identity creation, financial split, folio routing, schema/event/endpoint or server authority change was added.

The stale check is a client preflight, not a new atomic server compare-and-swap protocol. This review does not claim protection against an arbitrary external mutation inserted between that read and the existing locked server command; the order deliberately reuses the canonical endpoint and does not add CAS semantics.

## Personally executed final-byte frontend proof

Commands from the runtime source root, all exit 0:

```powershell
bun test tests/yellow-conversational-guest-allocation.test.ts tests/yellow-reservation-guests.test.ts tests/yellow-voice-routing.test.ts tests/yellow-reservation-lifecycle-actions.test.ts tests/yellow-next-checkout-confirmation.test.ts tests/yellow-native-reservation-creation.test.ts
bunx tsc --project frontend/yellow/tsconfig.json
bun run typecheck
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/astra-order544-reviewed-build
bun D:/Yellow/temp/astra-order544-conversation-proof.ts
bun D:/Yellow/temp/astra-order544-evidence.ts
```

- Focused/adjacent suite: **45 pass, 0 fail, 330 assertions**, six files.
- Strict frontend and root TypeScript: clean, no diagnostics.
- Production build: 469 modules; reviewer-owned output only. Main JS `index-DbtFI9QR.js`; CSS `index-Dl8Wzuow.css`. No deployment.
- Reviewer-owned controlled harness transpiles the actual current `ask` function and matching/share helpers, imports the actual voice parser, and prints the bound App hash. Ten groups pass: failed-new-proposal clearing; cancelled pending search; already-committed uncertain retry with no second write; unrelated stale-baseline refusal; bare yes; same-name primary/secondary removal ambiguity; inactive exact identity refusal; six compound/negated affirmative refusals; uncommitted retry with identical body/key; synchronous exclusion of duplicate yes and cancellation during an in-flight write.
- Extracted integer-share parser: all 10,000 legal basis-point values and 12 malformed/noncanonical forms pass.

These are actual extracted-function controlled executions, not a rendered-browser simulation. No independent mobile browser acceptance is asserted here.

## Fresh non-public API/Postgres proof

Personally reused only the reviewer-owned PG16 container infrastructure, not the earlier proof database. Inspected `yellow-astra-order543-pg`: `postgres:16-alpine`, host binding exactly `127.0.0.1:55643`. Created a fresh database `yellow_astra_order544`, applied migrations 0001–0095 through `runMigrations`, and ran the reviewer-owned authenticated API harness. No public credentials or public database were used.

Commands:

```powershell
docker start yellow-astra-order543-pg
```

An immediate connection attempt returned startup `57P03`; no DDL ran in that attempt. After `pg_isready` reported accepting connections, the following succeeded from the runtime root:

```powershell
bun -e "import{SQL}from'bun';import{runMigrations}from'./scripts/migrate.ts';const s=new SQL('postgres://yellow_deploy@127.0.0.1:55643/postgres');await s.unsafe('CREATE DATABASE yellow_astra_order544 OWNER yellow_deploy');await s.close();const r=await runMigrations({databaseUrl:'postgres://yellow_deploy@127.0.0.1:55643/yellow_astra_order544',logger:()=>{}});console.log(JSON.stringify({applied:r.appliedFiles.length,discovered:r.discoveredFiles}));"
bun D:/Yellow/temp/astra-order544-api-proof.ts
bun D:/Yellow/temp/astra-order544-evidence.ts
```

Results: 95 migrations applied/discovered; ledger independently checked count95/min1/max95. API harness exit0. It uses the actual `createApp.handle(Request)` authenticated HTTP adapter, LocalLoginService, Bearer resolver, service, idempotency and outbox against real PG16; it does not merely call a domain helper. Runtime connections are `yellow_runtime` with effective `app_role` and exact tenant transaction context, independently asserted. Admin authority is restricted to isolated fictional fixture setup/read-only evidence.

Dedicated future reservation has a real segment and one nonempty occupancy claim for 2035-03-01 through 2035-03-02; occupancy fixture was created only through `record_occupancy()`.

| Probe | Result |
| --- | --- |
| Replace with primary60.00/sharer40.00 | HTTP200, replay flag false |
| Identical same-key/body replay | HTTP200, replay flag true; identical response/full snapshot |
| Total99.99 | HTTP400; exact complete snapshot unchanged |
| Changed body with consumed key | HTTP409; exact complete snapshot unchanged |
| Primary supplied as accompanying | HTTP409; exact complete snapshot unchanged |
| Read-only actor attempts write | HTTP403; exact complete snapshot unchanged |

Primary Party/role row is preserved except the explicitly permitted primary share; exactly two target guest rows remain. Exactly one `reservation.modified` fact, one matching outbox event and one completed `reservation.guests.replace` idempotency record are produced. Actor, property, reservation and correlation bindings are checked. A supplemental read-only transaction asserts the exact before/after `payload.diff.guests` arrays in both fact and event, the SHA-256 key binding, completed timestamp and status200 (rather than relying on the harness's incidental absent `payload.guests` equality).

Full tenant-scoped rows of reservation, reservation_segment, nonempty space_occupancy, journal, posting_line, payment_operation, document, account, folio and Party are unchanged across replacement. Replay and every denial preserve complete snapshots including reservation_guest, facts, outbox and idempotency. This is row-content evidence, not count-only preservation. Read-only evidence transactions explicitly set `SET TRANSACTION READ ONLY` and tenant context.

## Retained reviewer artifacts and limitations

| Artifact | SHA-256 |
| --- | --- |
| D:/Yellow/temp/astra-order544-conversation-proof.ts | `3B145A42FBD554A54AAC57844BA70785DF4C6037773D3E26688462E046BCB19E` |
| D:/Yellow/temp/astra-order544-api-proof.ts | `4F2FFEDF5419175138A29976037F844C76B49A0E242387ED8A8DEF34F17A5FFC` |
| D:/Yellow/temp/astra-order544-evidence.ts | `2577F43988C510B549F1279A971ED1DE17EA09F6CDEFC23A5BCF6BB6A7177A7C` |

After verification, personally ran `docker stop yellow-astra-order543-pg`, exit0. Reviewer container/data are retained stopped; nothing deleted. `bash ./state.sh` remains unavailable because WSL `/bin/bash` is absent; no referee11/11 claim is made. No implementation file was edited. The accepted scope is conversational authority and the existing isolated canonical guest-allocation command, not financial allocation, whole-PMS readiness or target deployment acceptance.
