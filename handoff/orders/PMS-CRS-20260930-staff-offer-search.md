# ORDER PMS-CRS-20260930 — Staff multi-property offer search

**Phase:** 7 source lifecycle; Phase 15 CRS foundation
**Branch:** `phase-7/pms-crs-staff-offer-search-20260930`
**Owner:** cloud Yellow coordinator
**Date:** 2026-09-30
**Source basis:** `e06e400a57485cc10a8a35c21dcb1e01b5a667d1`
**Status:** SCOPED PROOF COMPLETE / LAPTOP INTEGRATION AND BASELINE RELEASE GATES OPEN

## Goal

Let authenticated staff request canonical offers for one to four explicitly selected, currently authorized properties through the existing tenant boundary and offer engine.

## Authority and why now

The human assigned Yellow PMS/CRS completion to the cloud worker and CompSet Studio to the laptop. The laptop coordinator explicitly authorized this finite slice and supplied current integration semantics. `BUILD-PLAN.md` Phase 15 names multi-property CRS search; the existing offer service and operator endpoint search one property. This slice supplies the staff query foundation, not a completed public booking engine or CRS.

The canonical laptop checkout contains uncommitted source absent from GitHub. Protected `src/app.ts` and `src/http/operator.ts` wiring is therefore a separate review patch. No laptop integration is implied by tests in this isolated branch.

## Scope — exact allowlist

- NEW `src/http/crs-search.ts`: bounded request reader, strict batch envelope, authorization-before-search orchestration and unchanged per-property serialization.
- `src/http/operator.ts`: only the new import and staff CRS method using existing scope/grant/parser/serializer/offer dependencies; supplied as a separate wiring patch.
- `src/app.ts`: only the staff route under the existing `options.operatorApi`/`withOperatorTenant` boundary; supplied as a separate wiring patch.
- NEW `tests/pms-crs-20260930-staff-search.test.ts`: independent bounded helper/stream and hostile-input proofs.
- NEW `tests/pms-crs-20260930-staff-search.http.test.ts`: mounted HTTP contract, authentication, body and error proofs.
- NEW `tests/pms-crs-20260930-staff-search.integration.test.ts`: required synthetic PostgreSQL authorization, tenant isolation, canonical offer parity and no-write proof.
- `docs/CONTRACTS.md`: append the bounded staff CRS query contract only.
- This order and NEW `handoff/reviews/PMS-CRS-20260930-staff-offer-search.md`.
- `DECISIONS.log` and `handoff/LEDGER.md`: append dated coordination/proof records only.

Do not silently widen this allowlist. No reservations index export or protected frontend change is needed.

## Contracts and implementation requirements

- `PROJECT.md`, `AGENTS.md`, `docs/CODEX.md`, `docs/TOOLING.md`, `docs/WORKFLOW.md` and `handoff/ROSTER.md` govern the work.
- Use `POST /api/v1/crs/availability:search`, authenticated by the existing operator tenant wrapper. Preserve the scope `inventory.availability:read`, live role/property grants and transaction-local tenant context.
- The body has exactly `searches`; each of 1–4 entries has exactly `property_id` and `search`. Property identifiers must be valid, distinct UUIDs. `search` is the existing canonical offer-search payload, parsed with the existing parser, not the legacy availability payload.
- Require explicit offset-aware stay instants for each property. Preserve the offer engine's property-local dates, rate/policy/publication evaluation, commercial eligibility and work limits. Do not invent check-in/out times or expand one civil-date range across timezones.
- Validate and snapshot all requests before asynchronous authorization. Authorize every selected property before invoking the offer service for any property. A missing, unknown, foreign or ungranted property fails the entire request with the same generic forbidden response and zero offer calls.
- Evaluate serially through the caller's existing tenant transaction and existing `ReservationOfferOperations`. No new constructor dependency, domain mutation or SQL authority is introduced.
- Return authorized property identity/name/timezone and unchanged serialized canonical offer results. Preserve quote, availability, policy and price/currency evidence; money stays decimal bigint strings. No cross-currency aggregation, synthetic pricing, result truncation or availability promise is introduced.
- Bound the new route's raw UTF-8 JSON body to 64 KiB using a bounded reader and `parse: "none"`; do not alter global body policy. The route-local reader has a hard 10-second deadline, including monotonic checks around synchronous reads, and handles abort/cancellation without retaining the tenant transaction indefinitely. Empty chunks are not retained; more than 1,024 consecutive no-progress chunks fail. An internal test deadline may only shorten that bound; the HTTP body cannot override it. Bound the serialized response to 1 MiB. Oversize searches return a narrowing error and no partial offers. Four properties and the existing 1,000-pair per-property cap imply at most 4,000 candidate pairs; this is a work bound, not a latency guarantee.
- Preserve existing semantics: invalid input/offer validation/too-broad searches are 400; missing scope/property grant is 403; missing capability or unexpected service failure is 503; the existing property-local 0–730-day booking-window error remains 400. A failure never returns partial property results.

## Definition of done and proof

- Unit and mounted HTTP proofs pass for scope, exact envelope, invalid/duplicate properties, full authorization before any search, body bounds, snapshot stability, serial calls, identical canonical evidence, response bounds and failure without partial success.
- Required PostgreSQL integration mode fails when its disposable database/runtime authority is missing or incorrect; database skips are not acceptance.
- Synthetic real-database proof uses two tenants, at least two properties in one tenant, ancestor/exact grants, post-token grant revocation and a foreign property. Requests demonstrate real transaction-local runtime authorization and pool reuse across tenants.
- Each batch property result equals the existing single-property endpoint's canonical result. Offer, inventory, reservation, financial, fact/outbox/idempotency and relevant sequence fingerprints are unchanged by successful or denied searches.
- An independent non-implementer inspects the final diff and personally executes the high-risk authorization/database proof, recording exact source and results.
- Run `bun run typecheck`, `bun run boundaries`, proportionate existing offer/workbench regressions and `git diff --check`.
- Before any reviewable PR, use the accepted current source's canonical schema and `./setup.sh --db-only` referee gate: `11 passed, 0 failed of 11`. Its stale migrations1–99 prose differs from the executed100-migration source; the unmodified gate is required. Published d708 repairs remain a separate source reconciliation, not permission to edit setup/migrations in this order.
- Show finite scope and validation before commit/push. Keep the protected wiring patch separate from new module/tests/governance. No merge or deployment authority is granted.

Primary commands:

```sh
bun test tests/pms-crs-20260930-staff-search.test.ts tests/pms-crs-20260930-staff-search.http.test.ts
YELLOW_REQUIRE_PMS_CRS_SEARCH=1 bun test tests/pms-crs-20260930-staff-search.integration.test.ts
bun run typecheck
bun run boundaries
git diff --check
```

## Forbidden

No new migration/table/event/permission; no availability, occupancy, rate, booking, reservation lifecycle, journal, payment, provider or guest-auth mutation. Never edit applied migrations or weaken standing proof. No desktop credentials/global settings/tunnel, real hotel/guest/payment data, CompSet work, history rewrite, self-merge or deployment. A tested foundation is not whole-PMS/CRS completion.

## Executed checkpoint — 2026-09-30

- New helper and mounted HTTP:27 passed,0 failed,163 assertions. Required PostgreSQL:6 passed,0 failed,66 assertions; the independent non-implementer personally executed the tenant/auth proof and all four failing authority controls.
- Existing reservation state-machine, Order610 transitions and Order611 operational timeline plus the new helper/HTTP tests:41 passed,0 failed,360 assertions. Combined with required PostgreSQL:47 passed,0 failed,426 assertions.
- `bun run typecheck`, `bun run boundaries` (205 TypeScript files) and `git diff --check` pass. Unmodified `./setup.sh --db-only` on fresh task-owned PostgreSQL18.6/Valkey with the repository's exact pinned image digests:11 passed,0 failed of11;100 migrations and130 public tables observed. Its1–99 log prose is stale.
- Broader baseline gates remain red: `license-check` rejects `tslib@2.8.1`'s0BSD declaration; unchanged baseline checker/package/lock reproduce it. Required existing `reservation-offers.integration.test.ts`:1 pass,5 failures,16 assertions in both this candidate and a tracked-pristine e06 worktree with fresh independent fixtures. Legacy expected5-option fixtures receive2; no assertion, seed, domain or license-policy change was made here.
- Retained review repairs: mutable grant rows now snapshot before offer awaits; synchronous empty-chunk streams can no longer starve the deadline or grow retained chunks; database proof now binds deployment/runtime to the same live target before seed. Initial unit/HTTP fixture and fixture-generic typecheck reds were repaired without weakening domain behavior. The first ancillary regression setup omitted the launch seed; the runner was corrected outside application source before baseline comparison.
- The Kathmandu peer has no rate/inventory candidate; proof covers its identity/timezone and empty-result parity, plus genuine priced offers at the seeded USD property. It does not attest two bookable properties/currencies. Inherited bearer/grant checks do not recheck app_user.status after token issuance; no live actor-status revocation claim is made.
- New-module/tests/governance and the two protected wiring files are separate handoff patches. No laptop integration, PR, push, merge, deployment or complete PMS/CRS claim follows from this checkpoint. Published d708 repairs and the dirty laptop source still require reviewed reconciliation.
