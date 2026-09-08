# Live market acquisition — 8 September 2026

Order RMS-20260908B extends the reviewed `phase-9/market-pipelines` foundation with actual provider-response ingestion, an explicit Google HTTP reader and a runnable bounded research CLI. The receiving development lane is PR92. No current Yellow production collector or production cost baseline was verified.

## What was actually observed

The public research search was Dubai, arrival 15 September 2026, departure 16 September, two adults, one room, AED. Counts are provider results, not distinct physical hotels across sources, market supply or bookings.

| Route | Actual observation | Executable result | Freshness limitation |
| --- | --- | --- | --- |
| Connected Booking.com MCP search | 10 accommodation offers; successful probe on 8 September | Actual response ingested into 10 search candidates | Source inventory update time, full room/meal/refund/fee basis absent |
| Connected trivago MCP search | 25 accommodation offers; successful probe on 8 September | Actual response ingested into 25 search candidates | Collection time is known; upstream refresh time and complete rate conditions are not |
| Google Hotels public browser panel | Six advertiser rows for one selected property | Raw evidence retained; zero candidates accepted because complete query context was not recorded | Exact capture time/URL and per-row price basis are unknown; outer header and selected panel differed |
| SerpApi Google Hotels HTTP | Reader implemented from official documentation; mocked transport tested | Requires explicit selected source and API key; missing-key run performs zero HTTP requests | No credentialed live API call was made; cached Google results and current OTA inventory are different concepts |

These are individual successful probes, not latency percentiles, comparative benchmarks or availability guarantees; exact times remain in the private evidence. Booking's initial uppercase country input failed local tool validation; the successful request used lowercase `ae`. Canonical Yellow query context uses `AE` and BCP47 language tags; original Booking `en-gb` and trivago `EN_GB` request codes are preserved in private evidence. No provider response was changed to manufacture freshness or rate conditions.

MCP can return dated offers here: the Booking and trivago probes establish that. They do not establish a public vendor MCP URL, Yellow service credentials, autonomous bulk entitlement, retention rights or a production SLA. Other exposed Expedia/MakeMyTrip tools were not live-tested in this batch. An official usable Airbnb MCP endpoint was not found in the checked registry/documentation. PriceLabs MCP remains unconnected per the founder's instruction.

## Client coverage and load

The latest founder instruction supersedes full-year/unbounded shopping: clients must explicitly select sources and either three or four calendar months of future arrivals. The half-open interval is `[property-local today, addMonths(today, selectedMonths))`, with month-end clamping. Length of stay is independent, so an admitted arrival may check out beyond that boundary. No selected sources means no queries.

| Days ahead inside the selected window | Collection interval |
| --- | --- |
| 0–7 | 1 hour |
| 8–20 | 2 hours |
| 21–30 | 3 hours |
| 31–45 | 4 hours |
| 46–90 | 5 hours |
| 91 to the selected window's end | 6 hours |

At 8 September 2026, three months contains 91 arrival dates, through 7 December; four contains 122, through 7 January 2027. The cadence weights imply approximately 734 or 858 logical date checks per day for one source/search context, respectively, before caching or supported batching. This is derived arithmetic, not actual requests or a bill. A destination search may return multiple competitors, while property-detail requests add calls. Additional stay lengths, parties, currencies and markets multiply distinct contexts. A narrower horizon reduces load but does not by itself make continuous high-frequency collection free.

`buildMarketSourcePlan` groups an exact tenant/property/permission/entitlement/compset/destination/stay/party/currency/market/language identity. Competitor IDs remain part of the scope without multiplying identical destination queries. It sorts urgency before source and stay length, respects the explicit run budget and exposes deferred work and the next due time. The caller supplies successful collection history; history is not proof of upstream freshness. The existing single-process `MarketShoppingRunner` supplies comparison-route failover and shared upstream cooldown. Durable multi-worker scheduling, leases and authenticated service wiring are still integration work.

## Implemented contracts

- `market-source-adapters.ts` normalizes the observed Booking/trivago shapes and fully contextualized Google visible captures. Amounts use exact integer minor units where unambiguous; raw values and price basis remain visible. Google is the aggregator; the advertised OTA is a separate field.
- `readSerpApiGoogleHotels` performs a fixed HTTPS search and optional bounded property-detail reads. It checks echoed query, detail property token, content type, response status, timeout and byte limits. Redirects are refused. Missing credentials fail before transport. Error bodies and credential-bearing URLs are not retained. The current reader supports one room only because the documented Google API parameters do not provide an equivalent multi-room search contract.
- `market-source-batch.ts` offers `plan`, `ingest` and `google-live`. Google live mode plans only the executable selected Google source before applying its run budget. Requests are sequential, every failure stops that invocation, and the receipt counts actual HTTP calls including details. It is a bounded single-process command, not an always-on daemon or a global quota across CLI processes.
- Every candidate retains `automaticPricingEligible: false` and `comparisonAuthority: "search-candidate-only"`. Missing context or refused payloads produce issues and held/partial receipts. A successful search is not automatically a comparable quote or pricing authority. Unknown sold-out reasons cannot create occupancy or unconstrained demand.

The CLI reads a bounded input, writes only normalized observations plus plan/receipt into a new POSIX-private directory (0700/0600), refuses existing outputs and uses sanitized errors. Raw research captures stay separately private. Native Windows fails before output until an appropriate ACL writer is implemented. Configuration labels isolate work but do not authenticate a tenant.

## Reproduce

From the repository root, with the existing Bun dependencies installed:

```sh
bun scripts/research/market-source-batch.ts \
  --input scripts/research/market-source-example.json \
  --output /private/new-market-plan \
  --mode plan

bun scripts/research/market-source-batch.ts \
  --input /private/source-capture-input.json \
  --output /private/new-market-observations \
  --mode ingest
```

The synthetic example explicitly selects three months. Inputs use schema `yellow.market-source-batch/v1`, a complete `policy` and bounded `run`. An ingestion capture supplies `source`, canonical `query`, `collectedAt` and the provider `payload`. Google visible evidence additionally requires a complete matching `payload.captureContext`; its time may remain null and its price basis unknown. Incomplete raw evidence should remain in the research archive, as happened in the actual browser probe.

For an authorised Google API run, select `google-hotels-serpapi`, add `google: {"propertyDetailLimit":0,"noCache":false}`, supply `YELLOW_SERPAPI_KEY` through the service's secret mechanism and use `--mode google-live`. Never put a key in JSON, source or shell history. Google live derives today from the actual clock; offline modes use the recorded run time. The reader is implemented and tested with synthetic responses; a real-key acceptance probe remains required before claiming that deployable route live.

Outputs are `plan.json`, `observations.json` and `receipt.json`. Exit 0 means completed processing, exit 2 means blocked/partial evidence or read, and exit 1 means configuration/filesystem failure. Receipts distinguish normalized captures, held captures, candidates, source issues and attempted HTTP requests. Ingestion itself makes no network calls.

## Provider choices and costs

SerpApi documents hotel search plus property-detail advertiser offers. Search lists alone need not expose the entire advertiser matrix. Its identical-query cache expires after one hour; `no_cache` asks it to refetch Google and does not guarantee a newly refreshed OTA quote. Processing timestamps remain separate from upstream inventory time. [Search documentation](https://serpapi.com/google-hotels-api), [property details](https://serpapi.com/google-hotels-property-details).

On 8 September, published plans include 250 free searches/month with 50/hour throughput, and $25/month for 1,000 searches. The free allocation is suitable for a small trial, not the requested full cadence. Costs must include property-detail calls and engineering/compute; no plan was purchased. [Current provider pricing](https://serpapi.com/pricing).

| Candidate deployable route | Useful data and access | Status for Yellow |
| --- | --- | --- |
| Booking Demand v3.2 | Available accommodation products; managed affiliate onboarding, bearer token and affiliate ID | Documented successor to an interactive probe; credentials/contract not verified. [Prerequisites](https://developers.booking.com/demand/docs/getting-started/prerequisites), [availability](https://developers.booking.com/demand/docs/accommodations/search-for-available-properties) |
| Expedia Rapid | Shopping for up to 250 properties/request, followed by selected offer price check; signed partner access | Research only. Production access and commercial terms unknown. [Shopping](https://developers.expediagroup.com/rapid/lodging/shopping/about-shopping-api), [setup](https://developers.expediagroup.com/rapid/setup) |
| HBX/Hotelbeds | Availability and selected-rate recheck with API key/signature | Research only; evaluation quota and production certification are separate. [Getting started](https://developer.hotelbeds.com/documentation/getting-started/), [workflow](https://developer.hotelbeds.com/documentation/hotels/booking-api/workflow/) |
| DataForSEO Google Hotels | Async or live property search; useful alternate supplier, but an equivalent complete advertiser matrix was not documented | Research only; published standard task $0.0008 versus live $0.004, with different latency. These are vendor prices/claims, not tested costs. [Official product](https://dataforseo.com/apis/business-data-api/google-hotels-api), [task API](https://docs.dataforseo.com/v3/business_data/google/hotel_searches/task_post/) |
| Google Travel Partner priceViews | Account-scoped hotel price views with Travel Partner OAuth | Not a public arbitrary-compset shopping endpoint. [Official API](https://developers.google.com/hotels/hotel-prices/api-reference/rest/v3/accounts.priceViews/get) |
| Google Places | Property discovery, IDs, address and geography | Can support compset mapping; not dated bookable hotel rates. [Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search) |

Prefer deterministic parsing/planning over LLM page reading when structured responses are available. Use browser observations to fill gaps with complete search context, and use another provider only when it preserves the comparison conditions. Meter a customer's all-in supplier/compute/storage/review cost and apply the existing 30% gross-margin formula `ceil(costMinor * 100 / 70)`. Neither a 30% markup nor proxy expense alone describes that margin. Provider mix should be based on accepted comparable observations per unit cost, not headline price per request.

The founder's hiQ point is supported: the 18 April 2022 Ninth Circuit opinion's CFAA analysis concerned public no-login pages. It upheld a preliminary injunction and expressly left other possible claims open. This distinction supports evaluating public acquisition without calling it inherently hacking. [Court opinion](https://cdn.ca9.uscourts.gov/datastore/opinions/2022/04/18/17-16783.pdf).

## Evaluation and handoff

Actual private captured responses were replayed: Booking 10 accepted candidates, trivago 25, Google six raw rows held with zero accepted candidates. None is automatically pricing eligible. The first combined new-code test run failed 5 cases because of the POS contract mismatch; those failures and independent decimal/context/detail-token/size findings were repaired with regression cases. A separate Gemini public-claim critique was attempted once in Temporary Chat; after 25 seconds no response had rendered, so it was closed and provides no verification evidence.

Final proof and exact reviewed source hashes are recorded in `handoff/reviews/RMS-20260908B-live-market-adapters.md`. No credentials, real offer rows or client data belong in public git. No new dependency, booking, rate/inventory write, operational PriceLabs import or live system deployment is included. Canonical database acceptance remains blocked by missing Docker in this runtime; the receiving builder must run integrated-source gates and complete authenticated scheduling/enrichment before production use.
