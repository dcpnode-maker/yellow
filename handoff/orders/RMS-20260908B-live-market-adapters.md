# Order RMS-20260908B — live market sources and client-selected horizon

Author: Codex, from the founder's explicit parallel OTA/Google implementation directive and subsequent three/four-month coverage correction on 8 September 2026.

Baseline: tested local `16d3bfa8`, source-identical to published `dbc249f6` (tree `d04f7dd92ec3ac7558f0fc2240ac700df06cf36c`), based on main `3503b0c0`. Work stays isolated from current fiscal/UI PR92.

Phase: 9 read acquisition for Phase14 RMS. Status: admitted before code.

## Scope

- `src/contexts/distribution/market-source-adapters.ts` and `tests/market-source-adapters.test.ts`: provider-specific Booking.com/trivago MCP response ingestion and a documented SerpApi Google Hotels search/detail HTTP reader; strict public-field normalization and redacted bounded transport errors.
- `src/contexts/distribution/market-batches.ts` and `tests/market-batches.test.ts`: deterministic client-selected sources, three/four-calendar-month look-ahead, exact search-context grouping, due-date cadence and bounded batches/cost planning. No background daemon.
- `scripts/research/market-source-batch.ts` and `tests/market-source-batch.test.ts`: runnable private source-capture ingestion, configured Google read mode, deterministic output/receipt and a synthetic example configuration.
- `src/contexts/distribution/index.ts`: export the new source acquisition surfaces alongside the reviewed comparison runner.
- `docs/research/LIVE-MARKET-PIPELINES-20260908.md`, `docs/research/PRICELABS-MARKET-INTEGRATION-20260908.md`, this order, `handoff/reviews/RMS-20260908B-live-market-adapters.md`, append-only `handoff/LEDGER.md` and `DECISIONS.log`: supersession, source evidence, actual commands/results and main-build handoff.
- Optional `scripts/research/market-source-example.json`: anonymous runnable input only, never real account data or a secret.

## Product decision and natural solution

This extends acquisition tools, not the hotel authority model. No new table/event, operational write or cross-context mutation is needed. Source search candidates remain comparison research with explicit missing fields and `automaticPricingEligible: false`; enrichment/matching and existing governed pricing commands decide later. A search list is not automatically an exact room/meal/refund/tax quote. A tool completing now does not establish when the provider last refreshed its inventory.

The founder's latest strategy supersedes unattended full-horizon collection: each client explicitly selects sources and a rolling three- or four-calendar-month future-arrival window. Default planning uses three months only when explicitly building an example; production configuration must state the choice. Preserve the previous lead-time cadence within that window, clamp month-end dates, and do not collect beyond it. Length of stay is separate; an allowed arrival can end after the arrival horizon. Existing 180+ cadence helpers remain available to other callers but this planner does not admit those dates.

Keep search grouping exact in tenant/property authority, destination/compset selection, stay dates, party, currency, point of sale and language. A single destination search can cover several client-selected competitors; do not issue one identical query per returned hotel. Results are not whole-market supply or unconstrained demand. PriceLabs remains a historical/contextual source, not the sole current-rate input.

Live hosted Booking.com and trivago MCP searches are explicitly authorised research probes. Their successful calls do not establish a portable vendor MCP endpoint or production bulk entitlement. Build normalizers against actually observed public responses. Add a real fixed-endpoint SerpApi HTTP transport from current official documentation, but require an explicit supplied API key and selected source; no sign-up, purchase or hidden activation. Missing credentials are a typed blocker before a network call. Preserve Google's aggregator and the actual advertised OTA as separate provenance fields.

## Proof and boundaries

Retain complete observed public probe requests, exact times, raw responses and failure details outside public git; only synthetic fixtures enter tests. Non-sensitive aggregate counts, dates, status and test results may be recorded in the research/review handoff. This clarifies evidence placement without admitting publication of raw rate rows. Test money parsing without float arithmetic, stale/unknown freshness, request/response mismatch, URL and credential redaction, bounded size/time/status handling, no retry on access blocks, source/horizon opt-in, month-end/LOS boundaries, duplicate grouping, inactive configuration and private output refusal. Independently execute final focused proof and real captured-response ingestion. No claimed live Google result without an actual successful call/capture.

Read-only public rates may be collected in a small batch; no bookings, live rate/inventory updates, guest/account extraction, secret uploads, purchases, new persistent MCP registration, access-block bypass, proxy rotation, login installation, WSL restart, schema/referee edits, self-merge or deployment. PriceLabs MCP remains reserved for later founder confirmation. Caller configuration is not authentication; production tenant identity must come from existing auth.

Use deterministic parsing/planning and zero new dependencies. Source-specific adapters and planner run in parallel, then receive a non-implementing review. Typecheck, boundaries and full new-change diff checks must pass. The canonical database gate remains unavailable until Docker or a separately admitted native test target is present; do not reopen a merge-ready PR on synthetic-only proof.
