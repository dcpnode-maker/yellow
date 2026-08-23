# Order 084 — Complete availability offer search

**Phase:** 4 · Reservations  
**Branch:** `phase-4/complete-availability-offer-search`  
**Tier:** 3 — public availability/rate evidence, truth sellability and future hold handoff  
**Written by:** OpenAI Codex, autonomous architect/builder under D-95/D-115/D-221

## Outcome

Complete `POST /api/v1/properties/{property}/availability:search` as the bounded read-only
reservation-offer contract. A canonical request composes live PostgreSQL availability,
restrictions and operational blocks with one active immutable rate release, exact property-local
night prices, policy references, channel targeting and tax-assignment evidence. Bookable choices
carry a non-authoritative `option_ref`; blocked/unpriced/conflicted choices remain visible for
operator diagnosis but never pretend to be prices or inventory promises.

The search is evidence, not arbitration. It creates no hold, occupancy, reservation, audit,
outbox or idempotency row. Existing held/direct commit paths ignore browser or option authority and
re-run PostgreSQL truth inside their transaction. Orders 045 onward remain explicit independent
review debt; green builder evidence records this order as `UNVERIFIED` only.

## Natural-Solution Test

- Reuse `AvailabilityService` for the initial deterministic candidate set and
  `RateQuoteService.resolve` for each exact sellable/rate pair. The quote service already binds
  active release, live restriction/OOO/OOS evidence, policy references, property-local nights,
  channel mapping, attributable occupancy-pricing projection and tax-assignment evidence.
- Extend exact quote availability reads with a sellable predicate. One broad truth read followed by
  one constant-scope truth read per candidate keeps work linear in evaluated pairs; repeatedly
  scanning every property sellable for every quote would be a hidden quadratic regression.
- Preserve D-140: blocked inventory remains visible with physical `available_count` and deterministic
  causes. Only `state=bookable` receives per-night money and a pre-tax total. Missing publication or
  pricing evidence becomes bounded stable diagnostics, never silent authorization.
- Preserve the old flat operator request/response during this order so inherited hold, restriction,
  operational-block and review-seed proofs keep inspecting raw truth availability. The canonical
  nested request is a disjoint shape and returns the completed offer contract. The founder client
  moves to the canonical shape now; removal of the compatibility path requires its own order.
- Correct `CONTRACTS.md` drift: projection/Valkey may supply attributable occupancy pricing input,
  but live PostgreSQL availability/restriction/OOO/OOS evidence is the independent sellability
  authority. No cache or projection can authorize hold or commit.

## Scope

- `handoff/orders/084-complete-availability-offer-search.md`
- `src/contexts/inventory/availability.ts`
- `src/contexts/rates/quote.ts` only to pass the exact sellable predicate and bind the exact
  returned availability option into the existing quote hash/output
- `src/contexts/reservations/offers.ts`
- `src/contexts/reservations/index.ts`
- `src/http/operator.ts`
- `src/http/operator/operator.js`
- `src/app.ts` only if route wiring requires an exact adapter change
- `src/server.ts`
- `docs/CONTRACTS.md`
- `tests/reservation-offers.integration.test.ts`
- `src/project-status.ts` only after green proof
- `tests/founder-status.integration.test.ts` only for the exact counter change
- `handoff/PHASE-4-PLAN.md` only for completion/status text, not deliverable expansion
- `handoff/GATE-3-MANIFEST.md` only after all proofs are green
- `handoff/LEDGER.md`
- `DECISIONS.log`
- `handoff/questions/` only if a D-92 hard-floor condition occurs

## Required work

1. Add a typed `ReservationOfferSearchService.search(tx,input)` with exact property, UTC
   `[stayStart,stayEnd)`, adults/child ages, optional unit-type/rate-plan code filters, optional
   exact hot `genderPolicy`, channel, optional currency, selected promotions and the existing nine
   typed commercial target dimensions. Reject unknown/duplicate/unbounded/mismatched input before
   database work.
2. Read one deterministic raw availability set using total party size and the exact hot predicate.
   `AvailabilityService` may add only optional exact `sellableUnitId` and `genderPolicy` filters;
   physical arithmetic, restriction rules, OOS policy and ordering remain PostgreSQL-owned and
   unchanged when filters are absent. Every mapped space must satisfy a requested gender policy.
3. List same-property active rate plans through `RateConfigurationService`, apply exact code/currency
   filters, pair them with matching inventory candidates and refuse more than 1,000 pairs with a
   stable too-broad error. Never truncate. Evaluate deterministically and sequentially inside the
   caller's transaction.
4. Resolve every pair only through `RateQuoteService`. Its exact availability reread must carry the
   sellable filter and bind the exact returned raw option into the quote hash/output so the offer
   adapter never reuses a stale broad-read cause. Channel is server-bound into the commercial
   context. Do not accept release, price, policy, restriction, tax, availability, projection,
   target result or evidence from the caller.
5. Return deterministic offers containing sellable/unit-type and rate-plan identity, active release
   identity/version/content hash, exact stay and property-local dates, party, per-night exact minor
   units, pre-tax total, package/promotion/refund evidence, policy references, tax-assignment
   evidence, live restriction/operational causes, physical available count and evidence references.
   `option_ref` is derived from the server quote hash and is labelled `promise=false` and
   `commit_arbitration_required=true`.
6. Only a quote whose state is `quoted` and whose live availability evidence is bookable is returned
   as `state=bookable` with money. Blocked, unpriced or conflicted published pairs remain visible with
   `bookable=false`, null total and no per-night price. Missing publication or unavailable pricing
   evidence appears as bounded stable issues and summary counts without raw exception/SQL text.
7. Add the canonical exact HTTP body
   `{stay:{from,to},party:{adults,children:[{age}]},unit_types?,rate_plans?,attributes?:{gender_policy},channel,currency?,selected_promotion_codes?,commercial?}`.
   It derives tenant/actor from bearer context, requires the existing availability scope and exact
   property grant, returns the documented snake-case contract plus correlation/no-store headers,
   and leaks no tenant/actor/database detail. No idempotency key is required because search is read-only.
8. Retain the disjoint legacy `{from,to,partySize,ratePlanId?,channelCode?}` raw-truth adapter and
   response unchanged for inherited consumers. Move the founder browser search to the canonical
   request/offer response, show exact rate/pre-tax/policy state and preserve blocked diagnostics and
   existing hold/offline-capacity selection by exact sellable id.
9. Amend `CONTRACTS.md` §2 to the exact implemented request/response and authority statement. State
   that local-date conversion/check-in policy remains future work; this transitional authenticated
   surface accepts exact offset instants and returns property-local night dates. Do not invent a
   timezone conversion rule.
10. After all proofs pass, advance only builder status/manifest/ledger to 084, append the exact
    autonomous decision, quote both protected hashes, refresh the disposable Graphify code map,
    rebuild only the persistent localhost app without reseeding PostgreSQL, push a stacked draft PR
    on Order 083 and leave it unmerged.

## Forbidden

- Any edit under `migrations/`, `tests/run_invariants.py`, schema snapshots, package/lock files,
  Compose, Dockerfile, CI, permissions, review seed, reservation state machine, hold/commit service,
  occupancy claim/write logic, RLS, tenant context, audit/outbox, journal, payment, tax calculation,
  fiscal or statutory logic
- A new table, column, function, event, permission, state, transition, worker, dependency, cache,
  stored quote/option token, signing secret or network/provider call
- Projection/Valkey/browser/RMS authority over sellability or commit; accepting caller price,
  release, policy, availability, tax, target, evidence, tenant or actor; using `option_ref` to skip
  hold/direct commit arbitration
- Returning only bookable inventory and hiding D-140 blockers; pricing a blocked/unpriced/conflicted
  candidate as a valid total; fabricating tax; JavaScript-number money; silent candidate truncation;
  full-property availability rescans for every exact quote
- Removing or changing the legacy raw adapter assertions in this order; weakening inherited proofs;
  approval, independent-review claims, merge or self-review

## Pre-registered proof

### P0 — absent offer composer is red

Add `tests/reservation-offers.integration.test.ts` first. Against one fresh migrated database with
the canonical published review seed, it imports the absent `ReservationOfferSearchService` and
defines P1–P5. With `YELLOW_REQUIRE_RESERVATION_OFFERS=1`, the run must fail only because the public
offer module/export is absent. Commit this order and complete red proof before production changes.

### P1 — exact published offer and read-only evidence

The five founder sellables under one published FLEX release produce five deterministic bookable
two-night offers. Each binds the exact active release, two `12500` USD room nights, `25000` pre-tax
total, four policy references, explicit no-tax-assignment evidence, live availability reference,
`promise=false` and commit re-arbitration. Exact before/after snapshots prove zero hold,
occupancy, reservation, segment, guest, fact, outbox or idempotency writes.

### P2 — typed filters and bounded work

Unit type, rate plan, currency, party size, exact gender hot attribute and commercial/channel inputs
filter only the intended candidates. Duplicate/unknown/malformed fields and channel mismatch fail
closed. A deliberately lowered injected proof ceiling rejects the complete candidate set rather than
truncating it. One broad availability call plus one exact sellable-filtered call per evaluated pair
is observed; no quote performs a repeated full-property scan.

### P3 — stale projection cannot authorize or forbid fixed live truth

A favorable projection cannot make a live occupied or closed candidate bookable; the candidate
remains visible with zero physical capacity or exact restriction cause and null pricing. An
unfavorable projection cannot block the fixed published rate when live PostgreSQL truth is
bookable. Occupancy-responsive prices may change only as attributable pricing output and still obey
the independent live blocker. Search remains read-only.

### P4 — canonical HTTP, authorization and compatibility

The canonical authenticated body returns the exact snake-case offer contract and no tenant/actor
field. Missing scope, absent property grant, malformed/unknown input and cross-property attempts
return stable 403/400 outcomes without service execution or detail leaks. The legacy flat body still
returns its byte-shape-compatible raw options for inherited consumers.

### P5 — standing gate and localhost

From the top: frozen install; state; typecheck; import boundaries; complete default tests; focused
Order-084 fresh database proof; complete thirteen-suite isolated database gate; review coverage;
licence/dependency audits; schema drift; protected hashes; fresh isolated app-never-started
`./setup.sh --db-only` at 11/11. Refresh Graphify code-only and record parser limits. Rebuild only the
persistent app, authenticate, execute the canonical offer search, visually inspect Apple/Pixel
themes and narrow layout without console errors, confirm review through 044 and leave
app/PostgreSQL/Valkey healthy. Commit, push a stacked draft PR and do not merge.

## Definition of done

## Builder evidence — UNVERIFIED

- [x] P0 red evidence is preserved before production changes.
- [x] Canonical published offers, blocked diagnostics, exact money and read-only evidence pass.
- [x] Filters, work ceiling, exact-sellable rereads and stale-projection boundaries pass.
- [x] Canonical HTTP/auth plus legacy compatibility remain exact.
- [x] Standing checks, protected hashes, Graphify, localhost and remote CI are green. GitHub run
  `32609014055` passed quality, Windows state, container smoke and database at the evidence-input
  tip; the sealed final evidence commit requires replacement final-tip CI before handoff.
- [x] Independent review remains exactly through Order 044; Order 084 is not self-approved.

### Captured builder evidence

- Intentional red `b550c5d`: `ReservationOfferValidationError` was absent from the public module;
  `0 pass / 1 fail / 1 error`, with no product implementation present.
- Scope correction `4e11efd` / Question 130: exact sellable availability is quote-owned and bound
  into the quote hash/output; no repeated full-property quote scan or copied broad-read authority.
- Implementation `f038629`: fresh migrated/seeded Order-084 database `6/6`, `76` assertions;
  inherited quote `8/8`, `48` assertions; inherited availability `7/7`, `20` assertions including
  the unchanged 500-space catastrophic guard.
- Standing restart: frozen install unchanged; typecheck; 53-file import boundary; default
  `101 pass / 316 skip / 0 fail`, `1,374` assertions; independent-review derivation exact;
  13/13 isolated inherited database suites, `92` tests and `1,693` assertions; licence policy
  clean; `bun audit` no vulnerabilities; schema exact.
- Fresh isolated `yellow-order084-referee` ran app-never-started `./setup.sh --db-only` at
  `11 passed / 0 failed of 11`, then its disposable containers/network/volume were removed.
- Protected hashes: `migrations/0001_init.sql`
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923` and
  `tests/run_invariants.py`
  `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.
- Graphify code-only refresh cost no model tokens: 4,808 nodes, 8,519 edges, 524 communities,
  zero missing/dangling/duplicate/collapsed endpoints and ten inherited self-loops. Saved labels
  cover 517 communities; new communities use deterministic hub names until a supported LLM label
  refresh. Documentation and SQL semantic limitations remain advisory; executable sources win.
- Persistent localhost rebuilt app-only without seeding. PostgreSQL id/start remained
  `3bf0399634e9759351309124ef6be0c416bb557ea61f155b6e0b379dd967af87` /
  `2026-08-22T10:48:43.499382459Z`; Valkey id/start also remained exact. Authenticated live search
  returned seven FLEX offers, seven bookable, zero issues, exact USD `25000` pre-tax minor-unit
  totals, `promise=false` and commit re-arbitration. Status reports Order 084, review through 044,
  debt 40, app/database operational and tenant context true. Apple/Pixel phone-width layouts had
  no horizontal overflow and the browser console had zero warnings/errors.
- Codex Security preflight passed, but its Windows workbench could not resolve the authoritative
  WSL Git HEAD. A semantic diff review therefore ran directly against the WSL branch and found no
  authentication/property, tenant, SQL-injection, browser-XSS, secret, authority or unbounded-work
  path. This remains builder evidence, not an independent security review.
