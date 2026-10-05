# Order 578 — independent review

## R1 — REJECT / CHANGES REQUIRED (2026-09-21)

Reviewer: independent Codex Astra agent `/root/astra_review`, not the implementer. Read PROJECT.md, Order578, relevant hosted-deposit decisions and the mandatory Yellow compliance/entity/PostgreSQL skills; ran `./state.ps1`. No implementation edits, public database access, deployment, provider call or public financial operation occurred. All synthetic writes/tests were confined to reviewer-owned database `yellow_astra578_review` on the existing isolated reviewer PostgreSQL16.15 cluster at loopback55564.

### Blocking findings

1. **P1: operator HTTP router fails to compose.** `src/app.ts:459` registers GET `/api/v1/properties/:property/folios/:folioId/hosted-deposits`, while the existing GET statement route at line406 uses `:reference` in the same parameter position. Personally constructing the actual `createApp({operatorApi,database,tenantResolver})` and invoking `app.handle` throws from Memoirist: `Cannot create route "/api/v1/properties/:property/folios/:folioId/hosted-deposits" with parameter "folioId" because a route already exists with a different parameter name ("reference") in the same location`. This prevents compilation of the mounted operator router; it is not a domain404. The authored new route test checks source text only, and its method tests call OperatorHttpApi directly, so all authored tests pass despite this failure. Use a consistent parameter name at this GET radix position and add a real composed-app test exercising the new GET and existing statement route.

2. **P2: instrument eligibility includes non-tokenized/unsupported-provider rows.** `hosted-deposits.ts:333–341` filters owner/kind/status but does not require a token or usable PSP. The schema explicitly allows `token=NULL` and `psp=NULL`. A reviewer-owned live database fixture with (a) active card_network_token/tokenNULL/pspLocal and (b) active upi_vpa/validSyntheticToken/pspNULL returned both in `instruments`, beside the valid card. The canonical PaymentService at `payments.ts:338–346` refuses missing token, invalid token shape and missing/invalid PSP. This violates Order578's safe active tokenized instrument choice contract even though no token value leaks. Exclude non-tokenized and invalid-provider instruments using the canonical eligibility constraints without selecting/serializing the token; add null/invalid-provider/token boundary regressions. Inactive and unsupported bank rows were correctly excluded.

### Personally executed proof

`bun D:/Yellow/temp/astra578-proof.ts` created the fresh database, applied all97 migrations through the production `runMigrations` runner, and observed PostgreSQL16.15. It then ran:

```text
bun test tests/hosted-deposit-workbench.integration.test.ts tests/hosted-deposits.integration.test.ts tests/hosted-deposit-http.integration.test.ts --timeout 120000
```

Required workbench/deposit flags were1; runtime and admin URLs were supplied only in process memory from the protected local authority file, never printed. Result: **30 pass, 0 fail, 158 assertions, 28.85s**, no skipped database tests. This personally covers empty state; fixed50/50 caps; generation-descending deterministic statuses; exact captured5000/applied2000/remaining3000 strings; inactive/unsupported/other-Party exclusion; tenant/property/folio/Party incoherence; capture/application/regeneration/expiry;20 application racers; composite lineage/RLS; and injected outbox rollback. Existing provider/HTTP regressions also passed.

`bun D:/Yellow/temp/astra578-hostility.ts` independently reproduced the real composed-router failure above. After retaining that failure, the harness directly exercised the unchanged OperatorHttpApi method with real tenant transactions and real hosted service to finish domain/read-only checks; those direct calls are **not** claimed as mounted HTTP success. Results:

- Scope denial403; ungranted property403; foreign tenant had no property grant403; missing folio404; `tenantId`, `partyId`, and `limit` query widening each400.
- Direct real service refused foreign tenant and wrong property; valid read returned no-store and did not serialize the synthetic token marker.
- Valid active card plus the two invalid eligibility rows returned; inactive card and bank excluded. This independently establishes finding2.
- Full129-table count/ordered-full-row fingerprints, each captured in a `REPEATABLE READ READ ONLY` transaction before and after reads, were byte-identical. This includes financial, occupancy, instrument, idempotency, fact and outbox tables. Setup inserts precede the baseline; no read-side mutation occurred. No zero-write claim is made about the isolated synthetic fixture setup or deposit regression tests themselves.

Strict scoped TypeScript passed exit0:

```text
bunx tsc --ignoreConfig --noEmit --strict --noUncheckedIndexedAccess --skipLibCheck --target ESNext --module Preserve --moduleResolution Bundler --lib ESNext,DOM --types bun src/contexts/financials/hosted-deposits.ts src/contexts/financials/index.ts src/http/operator.ts src/app.ts tests/hosted-deposit-workbench.integration.test.ts tests/hosted-deposit-http.integration.test.ts
```

`bun run boundaries`: exit0,202 TypeScript files scanned. `bun run typecheck`: **failed**, two pre-existing/out-of-scope TS6142 JSX-import diagnostics at `tests/yellow-cashier-bill-window-allocation.test.ts:11:16` and `tests/yellow-voice-bill-window-allocation.test.ts:14:53`; root tsconfig does not set JSX for their App.tsx imports. These are distinguished from the passing Order578 scoped strict check, not relabelled as a green repository gate.

### Source inspection and limits

The service uses the existing `materializeStatus`, exact bigint decimal strings, fixed bounded arrays and explicit safe-field projection; no second balance/status authority or new write is introduced. Exact folio→guest account→Party→property joins and tenant-local app_role/RLS are present. Existing composite foreign keys bind hosted requests to their operation/folio/account/property/currency. The operator requires the existing payment-read scope and database-derived property grant, rejects query parameters, emits canonical JSON/no-store, and retains503 when the hosted service is absent. It adds no create/apply/refund/capture grant.

The D: source is a packaged runtime directory, not a usable Git checkout; a scoped `git diff --stat` attempt failed with Git's no-index usage. No whole-repository diff claim is made. The six frozen hashes were personally checked both before and after execution and remained exact:

| File | SHA-256 |
| --- | --- |
| src/contexts/financials/hosted-deposits.ts | 94E769087FFBC3904565F820AADD150DA924C1E505AEF6FD0D2FBFB24E139F34 |
| src/contexts/financials/index.ts | 301489398E40553AC855F5505CBF167BE03C3720DEF1BF169E0936EFB7B5EC89 |
| src/http/operator.ts | 53E435CA4244A0BAA3D7AEC05875C49D28B4044E01F3B959CD7AB13DB82E2C32 |
| src/app.ts | A1ADCD475D8287B65CD4D499E3B821F52B6D66EDC5E3A889FE320ED2712420F8 |
| tests/hosted-deposit-workbench.integration.test.ts | 5BB510E2210B7F5A15D183661B410C1B1F9AF7565C5E010414715E98F25E498F |
| tests/hosted-deposit-http.integration.test.ts | 0571DC120E750B181D7BDE3E92F5294DA0F36578887C84F82BAD1D67AFAB6A5B |

### Required next gate

Correct both findings, retain this R1 record, freeze new hashes, and rerun independent real router composition plus hostile token/provider eligibility and all relevant isolated deposit proofs. Resolve or explicitly govern the unrelated repository typecheck debt separately. No deployment/public enablement is accepted by this review.

## R2 — REJECT / CHANGES REQUIRED (2026-09-21)

Same independent reviewer; R1 above is retained. No implementation changes or public/database deployment/access. New execution database `yellow_astra578_r2_review` was created from empty on reviewer-owned loopback55564 PostgreSQL16.15, and all97 canonical migrations applied.

### R1 findings closed; one residual

- **R1 router failure fixed.** The new GET uses the same `:reference` parameter as the existing statement GET. Personally executing actual `createApp` with OperatorHttpApi, real runtime-role database and hosted service successfully dispatched the new read200. The existing statement route composed and dispatched its normal403 under the deliberately payment-read-only identity. The authored composed-app test additionally verified both GET parameter bindings and200 responses with controlled handlers. No Memoirist collision remains.
- **R1 token/provider eligibility fixed.** Real PostgreSQL controls prove null token, null PSP, invalid PSP and201-character token are excluded, while a valid active card and UPI remain. A synthetic all-zero16-digit token was rejected by the existing token-shape constraint (23514); no real PAN was supplied. Tokens are checked in SQL but absent from SELECT/serialization.
- **Remaining P2: closed guest account/folio still advertises eligible instruments.** With exact valid card/UPI and governed clearing/deposit routes, closing the exact guest account returned instrument count2; restoring it and closing the folio also returned2. Canonical PaymentService requires both folio.status and guest-account.status=`open` at `payments.ts:336–338`. The read-model owner query checks guest role/property currency but does not carry either status into instrument eligibility. Current Order578 calls these safe eligible choices, not merely historical instrument metadata. Keep historical deposit statuses readable if appropriate, but return no usable choices when that canonical context is closed; add both regressions. Coordinator confirmed this interpretation before the R2 record was finalized. No financial authority bypass is claimed—the server still rejects the command—but the new eligibility contract is false for these states.

### Executed R2 commands/results

1. `bun D:/Yellow/temp/astra578-r2-proof.ts`: fresh database and migrations1–97, followed by the same required-flag three-file suite listed in R1. **31 pass,0 fail,167 assertions,25.91s**, no database skips. Existing capture/application,20-racer cap, regeneration, RLS/composite lineage, provider and publish-rollback regressions remain green.
2. `bun D:/Yellow/temp/astra578-r2-hostility.ts`: actual composed-app200, anonymous401, missing scope403, foreign tenant/ungranted property403, missing folio404 and three query-widening400 cases. Full129-table ordered-row/count fingerprints captured in read-only repeatable-read transactions matched exactly before/after all read calls. No token marker appeared in JSON. Direct service tenant/property denial still passes.
3. Same harness independently closed deposit-liability account→0 choices; closed card-clearing account→only UPI; routed UPI to the wrong-role account→only card. Restoring the isolated fixture restored the exact full129-table baseline. Thus clearing/deposit-role/status and route predicates work; the guest-account/folio-open predicates remain missing.
4. The exact scoped strict TypeScript command listed in R1 passed exit0 again. `bun run boundaries`: exit0,202 files. `bun run typecheck`: exit1, the same two unrelated TS6142 JSX imports in the existing bill-window frontend tests; no green root-typecheck claim.

Harness correction retained for audit: its initial missing-route-side probe attempted to set the sole route side toNULL and PostgreSQL correctly rejected that fixture mutation with `tx_code_route_has_side_ck`/23514. The harness was corrected to use a structurally valid wrong-role account; that hostility and final exact-baseline restoration passed. Candidate implementation was not changed.

### R2 frozen source identity

Personally checked before and after execution:

| File | SHA-256 |
| --- | --- |
| src/contexts/financials/hosted-deposits.ts | DAE652A5B03DB22AE5EA72E68B933607DB61ED4BB6BD160ECF44B46B4410CA07 |
| src/contexts/financials/index.ts | 301489398E40553AC855F5505CBF167BE03C3720DEF1BF169E0936EFB7B5EC89 |
| src/http/operator.ts | 53E435CA4244A0BAA3D7AEC05875C49D28B4044E01F3B959CD7AB13DB82E2C32 |
| src/app.ts | 2B86F28C1F2AA2BABC5928C9E36689A3BE51A6C18E4FFC1C884AF97BCA45F639 |
| tests/hosted-deposit-workbench.integration.test.ts | 3E03478341F7BB3BA5EB195AFCF3C2B752146E569453E337DB82E901B737DCD3 |
| tests/hosted-deposit-http.integration.test.ts | 62DBE4088408FF514AB9A88D0F365AA792D9E4A965FC38FA190F2C3536AF558A |

No deployment or public enablement accepted. Preserve R1/R2 and request a fresh freeze after the remaining state-eligibility correction; rerun the actual closed-context probes and ordinary read/deposit regressions.

## R3 — ACCEPT, bounded Order578 source review (2026-09-21)

Independent reviewer `/root/astra_review`; did not implement or edit the candidate. R1/R2 are preserved above. This accepts the exact read-model implementation and its isolated proofs, not deployment, a production payment flow, or a green repository-wide quality gate.

### Personally executed final proof

`bun D:/Yellow/temp/astra578-r3-proof.ts` created another fresh reviewer database `yellow_astra578_r3_review` on isolated loopback55564/PostgreSQL16.15, applied migrations1–97, and ran:

```text
bun test tests/hosted-deposit-workbench.integration.test.ts tests/hosted-deposits.integration.test.ts tests/hosted-deposit-http.integration.test.ts --timeout 120000
```

Both required database flags were1 and both runtime/admin URL pairs were loaded only in process memory. **32 pass,0 fail,175 assertions,29.81s; no skips.** Canonical statuses/caps, captured/applied/remainder, closed-history behavior, provider callbacks,20-way application concurrency, RLS/lineage and injected publication rollback all passed.

`bun D:/Yellow/temp/astra578-r3-hostility.ts` independently exercised the real mounted app and real database services. It created a separate synthetic ready deposit through the canonical service in the isolated fixture, then captured the read-side baseline. Results:

- New hosted-deposit GET200 with exact safe metadata; existing statement GET still composes and returns its normal403 for the payment-read-only fixture. Authored composed-handler proof separately passes200/exact parameters for both routes. R1 router failure closed.
- Valid card and UPI returned; null token/null PSP/invalid PSP/201-character token excluded; inactive and bank excluded; synthetic numeric PAN shape rejected by PostgreSQL23514. No token marker in output. R1 eligibility failure closed.
- Open guest account+folio returns2 choices and canonical ready deposit amount`1000`. Closed guest account returns0 choices with deposit array exactly unchanged. Restored account then closed folio returns0 choices with deposit array exactly unchanged. R2 residual closed.
- Closed deposit-liability account returns0 choices; closed card-clearing account leaves only UPI; UPI route bound to wrong-role account leaves only card. Restored fixture returns to the exact original baseline.
- Actual mounted authorization/hostility matrix: anonymous401, missing scope403, foreign tenant/ungranted property403, missing folio404, query widening through tenantId/partyId/limit400. Direct foreign-tenant/property service calls deny.
- All129 public-table count/ordered-full-row fingerprints matched exactly before/after read-side calls in read-only repeatable-read snapshots; final restored hostile fixture also matched the full baseline. This includes journals, postings, deposits, instruments, idempotency, occupancy, facts and outbox. Canonical synthetic setup and deliberate isolated hostile fixture mutations precede/are distinguished from the zero-write read proof.

The R1 scoped strict TypeScript command passed exit0 again; `bun run boundaries` passed202 files. The independently reproduced root `bun run typecheck` debt recorded in R2 remains: two unrelated existing TS6142 JSX imports in bill-window tests. This R3 did not repair or waive that debt, did not run a fresh11/11 referee, and makes no PR/deployment readiness claim. No schema/role/migration change is part of this candidate.

### Final inspection

`workbenchForFolio` carries folio/account open-state from its exact tenant/property/guest-account/Party query and gates only the safe instrument choices, not historical status materialization. It continues to reuse canonical `materializeStatus`, bigint decimal strings and deterministic fixed50-element caps. Instrument eligibility aligns with supported kinds, token/provider validity, governed routes and open clearing/deposit accounts without returning token/hash/bearer/provider-secret fields. The endpoint retains payment-read scope, property grant, fail-closed identity/query checks, canonical JSON/no-store and explicit absent-service503. No mutation authority or financial semantics were added.

### R3 frozen identity

Personally hashed before and after execution:

| File | SHA-256 |
| --- | --- |
| src/contexts/financials/hosted-deposits.ts | 7F852E1B140940290F634CE9FE31A257D9843EACF75B6A31D9CB37C2A14A1992 |
| src/contexts/financials/index.ts | 301489398E40553AC855F5505CBF167BE03C3720DEF1BF169E0936EFB7B5EC89 |
| src/http/operator.ts | 53E435CA4244A0BAA3D7AEC05875C49D28B4044E01F3B959CD7AB13DB82E2C32 |
| src/app.ts | 2B86F28C1F2AA2BABC5928C9E36689A3BE51A6C18E4FFC1C884AF97BCA45F639 |
| tests/hosted-deposit-workbench.integration.test.ts | 17333DAB990701DEF8A224087B74EB2568632A5B6461E690784C7A0064DADEB7 |
| tests/hosted-deposit-http.integration.test.ts | 62DBE4088408FF514AB9A88D0F365AA792D9E4A965FC38FA190F2C3536AF558A |

No remaining defect found within the bounded Order578 read-model scope. Public promotion requires its own accepted target-bound release order/checks and normal repository gates; none was performed here.
