# Independent review — Order RMS-20260908B live market adapters

**Reviewer:** `/root/live_market_reviewer`, independent and non-implementing

**Review date:** 2026-09-08

**Order baseline:** `16d3bfa8`, source-identical to published `dbc249f6`, based on main `3503b0c0`

**Reviewed working-tree base:** `5e06d6bb` on `phase-9/live-market-adapters`

**Disposition:** **APPROVED for the bounded research adapter, client-selected three/four-calendar-month planner and private POSIX CLI scope.** The source is not approved as an authenticated production collector, an operational rate writer or a completed Phase 14 RMS integration. Canonical database acceptance remains unavailable and is still a receiving-build gate.

## Final reviewed source

| File | SHA-256 |
| --- | --- |
| `src/contexts/distribution/market-batches.ts` | `a7cd6beb44409847a3a6ec00da0b55e9c3e76abdbca30a51367ec6a84f90ab7c` |
| `tests/market-batches.test.ts` | `c733dd0826847fa746dfb54c9253cc3a550a11a4476448da099fc9ee1b417c2b` |
| `src/contexts/distribution/market-source-adapters.ts` | `ab21364e3dee682755e85801a6e9239da07e78c3b53f0f6e698642198f65b426` |
| `tests/market-source-adapters.test.ts` | `d4d1b00e92878a0e802124904dc3bcbe7e333092d30021fedd76d46fdfe4636a` |
| `scripts/research/market-source-batch.ts` | `9876e1c7491cb35262b39c04daabcd0f0378d3e62271cb26c2f412813cd03e03` |
| `tests/market-source-batch.test.ts` | `792c807a9fe476bc0aec13530fb3c117410e86891d99facfcc6cd88b9021e220` |
| `scripts/research/market-source-example.json` | `c39ed166b11a5ac99cb4cee47f32876f60f8315bedf44c5115df908801bf120e` |
| `src/contexts/distribution/index.ts` | `47f538a501743ac757cb11dcdf152be1bd850383b95d6dda8db3397f2611027b` |

The index exports the planner and adapter surfaces through the distribution context. The reviewed implementation adds no dependency, migration, table, database access, scheduler, operational writer, booking action, rate/inventory mutation or production provider registration.

## Reviewer-executed proof

The reviewer used the order-provided Bun 1.3.14 executable.

```text
bun test tests/market-batches.test.ts tests/market-source-adapters.test.ts tests/market-source-batch.test.ts
33 pass, 0 fail, 191 assertions
  planner: 10 pass
  source adapters and HTTP reader: 14 pass
  private batch CLI: 9 pass

tsc --noEmit
pass

bun scripts/check-import-boundaries.ts
Import boundaries OK: 186 TypeScript files scanned

git diff --check
pass
```

The review's first combined focused run was not green: 20 tests passed and 5 failed. Planner policy accepted lower-case `ae`, while the adapter required upper-case `AE`; ingestion failed as `invalid_capture` and Google live returned `invalid-query` before transport. The planner now canonicalizes two-letter markets to uppercase and supported BCP47 language tags to one adapter-compatible form. The CLI fixtures and actual replay use the canonical query. The final proof above supersedes, but does not erase, that failure.

## Material findings and repairs

Every material finding raised during this independent review was repaired and covered permanently before the final proof.

- Exact money initially treated a one-digit AED fraction as a thousands grouping. A Booking value of `109.2` became `109200` minor units instead of `10920`. Parsing now handles shortened fractions by currency scale without floating-point arithmetic, retains raw text, and returns null minor units for ambiguous or malformed separators/currency placement.
- Google visible normalization initially treated absent or partial `captureContext` as an exact match. A held offer could therefore acquire caller-supplied destination, dates and party fields that the evidence did not establish. Every query dimension is now required and compared exactly; incomplete evidence yields `query-mismatch` and no candidate. Unknown collection time and unknown price basis remain explicit rather than becoming fresh/nightly claims.
- SerpApi property-detail responses initially were not bound to the requested `property_token`. A wrong-token detail with otherwise matching dates and party was accepted as an unrelated candidate. The reader now carries the selected token internally, requires the response to echo it exactly and excludes the token from normalized output. Wrong, missing and standalone uncorrelated detail responses fail closed.
- HTTP accepted responses could be larger than the normalization cap. A valid 2.1 MiB response under a configured 4 MiB transport limit returned `ok: true` with only a `payload-too-large` issue. Individual and combined search/detail payloads that normalization refuses now return `response-too-large`; invalid payloads return `invalid-response`.
- `google-live` initially applied its run budget across all selected sources and filtered for Google only afterward. With Booking and Google selected and a budget of one, it reported `completed` with one selected query, zero Google requests and zero fetch calls. The complete policy is validated first, then live planning narrows to the explicitly selected executable Google source before budgeting. The permanent mixed-source case makes one bounded Google attempt and stops on its first failure.
- Successful collection history initially had no entry-count or key-length bound. It is now capped at 4,000 entries and at the maximum generated scoped-key size, with tests for both rejection and admission of the largest planner-produced identity.
- The exported normalizer initially accepted an unsupported runtime source value and returned a clean empty result. Runtime source membership is now explicit and fail-closed.

Final inspection also confirms that Google detail room attributes and inclusions come from the same priced room/rate row; values from a different rate are not joined into a candidate. Search and detail query parameters, detail token, currency and stay context remain checked before a candidate can be returned.

## Planner and CLI boundaries

The planner requires explicit source selection and a literal 3- or 4-calendar-month horizon. It derives the half-open arrival window from the property-local date, clamps month ends, admits checkout beyond the arrival boundary and generates no query when the source list is empty. It deduplicates and sorts source, competitor, child-age and stay-length selections. The request key isolates tenant, managed property, permission and entitlement labels, complete competitor scope, source, destination, party, currency, point of sale, language and stay dates. Those labels segregate work; they do not authenticate a tenant or prove supplier entitlement.

Collection history controls only Yellow's next due time. It does not populate source update time or imply provider freshness. Due work is ordered deterministically, bounded at 4,000 potential requests, sliced by the explicit run budget and emitted in bounded batches. Budget-deferred work remains due now, while cadence-deferred work exposes its exact next due instant.

The CLI accepts bounded input, refuses unknown configuration and existing output, performs no network in plan/ingest mode and writes only normalized observations, plan and receipt. On POSIX it creates a new `0700` directory and `0600` files. Google HTTP requires both explicit source selection and an external key; a missing key returns a typed blocker before fetch. Requests use a fixed SerpApi HTTPS origin, reject redirects, enforce one invocation deadline, validate content type/status/query, stream a bounded body and do not retain the key, credential-bearing URLs, provider error bodies or raw source payloads. One source read failure ends the invocation without retry.

Every retained candidate is `comparisonAuthority: "search-candidate-only"` and `automaticPricingEligible: false`. The CLI receipt declares `operationalWrites: false`; no configuration field authorizes a database or pricing action.

## Private actual-capture replay

The reviewer invoked the final CLI source against each retained private input into three new directories outside git. The result triplets were byte-identical to the coordinator's retained normalized outputs.

| Source | CLI exit/status | Captures | Held | Candidates | Issues | HTTP requests |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Booking MCP | `0` / completed | 1 | 0 | 10 | 0 | 0 |
| trivago MCP | `0` / completed | 1 | 0 | 25 | 0 | 0 |
| Google visible | `2` / blocked | 1 | 1 | 0 | 2 | 0 |

All replay directories were `0700` and all three generated files in each were `0600`. Standard output contained aggregate status/counts only and standard error was empty. Across the 35 accepted Booking/trivago candidates, every candidate remained comparison-only, automatically ineligible and carried null `sourceUpdatedAt`; every accepted amount had an unambiguous non-null minor-unit value. Retained property URLs had no query or fragment.

The Google browser evidence contained six raw advertiser rows, but its complete query context and exact collection time were not captured. The raw evidence remains private. The final adapter correctly retained one held normalization result with `query-mismatch` and `unknown-collection-time`, accepted zero candidates and reported the invocation blocked. This is evidence that a browser panel was observed, not a live Google rate result. No real SerpApi request was made because no authorised API key was available.

No real offer row, provider token, request URL, credential, client identifier or raw response is reproduced in this review.

## Explicit limits and receiving gates

- Booking and trivago MCP probes show that the connected research tools returned dated public results. They do not establish a portable vendor MCP endpoint, production authentication, bulk entitlement, retention right, SLA or provider contract.
- The SerpApi reader is implemented from documented parameters and tested with synthetic transport. A separately authorised real-key acceptance call is still required before calling that route live.
- Google visible evidence without complete context remains held and unusable for comparison candidates. The implementation does not manufacture its time, basis, room, meal, cancellation, tax or fee conditions.
- The CLI is a bounded single-process research invocation. Durable multi-worker scheduling, distributed leases, global/time-window quotas, authenticated tenant service wiring, competitor/property matching and governed RMS consumption remain integration work.
- Native Windows was unavailable. The CLI intentionally refuses Windows before output because an NTFS ACL writer is not implemented; this review proves POSIX privacy only.
- Docker and a canonical database target were unavailable. This source-only change performs no database access, but `setup.sh --db-only` and referee 11/11 remain mandatory receiving-build gates before a reviewable integration PR. No canonical database success is claimed.
- No PriceLabs operational import, live rate/inventory update, booking, deployment, local runtime promotion, PR merge or Phase 14 completion is approved by this review.
