# PriceLabs and resilient market collection — 8 September 2026

Founder priority: bring the market research, multiple acquisition methods and private PriceLabs snapshot into the active Yellow build. This document belongs to Order RMS-20260908, based on fetched main `3503b0c01f336637d2583963c17b792f6ad59efe`. PR92 (`phase-7/operator-invoice-workflow`) is the verified current development handoff. Prior research remains in PR86. Publication to either thread is a handoff receipt, not proof that a desktop agent has executed it.

## Preserve one Yellow

The verified implementation stack remains strict TypeScript, Bun 1.3.14, Elysia and PostgreSQL. Market collection belongs behind the distribution context, with Phase14 RMS consuming evidence through governed services. Existing rate economics, rate publication, inventory authority, finance, authentication and app UI are preserved. The archive is research staging: it does not supply authority to create occupancy or financial history.

Supported collection methods share one contract: official API, licensed provider, permitted browser observation, confirmed client capture and imported archive. A configured adapter may perform its read; no provider account, paid entitlement, credentials or live collector is implied by a method name. Provider search tools available in ChatGPT are not automatically deployable Yellow APIs.

One logical request carries the complete comparison identity: tenant/scope, property, original channel/source, stay dates, room or product, occupancy, currency, meal/refund/tax/fee basis, eligibility and device/market conditions. Failover changes the acquisition route, not those comparison conditions. An alternative must not silently turn a public room-only quote into a member package or change geography.

`MarketShoppingRunner` is exported from `src/contexts/distribution/index.ts`. Install explicit `routes` with `read` callbacks and matching `upstreams`, then call `run([{ id, context }], { signal })`. All five method defaults are disabled. Context includes both `managedPropertyId` and `comparatorPropertyId`, `permissionScope`, `entitlement`, `pointOfSaleMarket` and `roomProduct` alongside the stay and price conditions. These labels isolate comparison work; the calling service must authenticate them. `actionable` means usable comparison evidence only: every result has `pricingAuthority: "comparison-only"`.

## Collection and price evidence

| Horizon in property-local dates | Requested cadence |
| --- | --- |
| 0–7 inclusive | Every hour |
| 8–20 | Every 2 hours |
| 21–30 | Every 3 hours |
| 31–45 | Every 4 hours |
| 46–90 | Every 5 hours |
| 91–180 | Every 6 hours |
| 181+ | 1, 2, 7 or 15 days, or calendar month |

This implies about 1,094 date observations/day for one competitor × original channel × room/search configuration through day180, before cache, supported batching or source cadence limits. Ten competitors on three channels would imply about 32,820 such observations/day. These are arithmetic planning counts, not HTTP requests, performance benchmarks or a bill. Five-hour intervals average 4.8 checks/day; an individual calendar day has a different integer count.

Use a shared request and concurrency budget for all methods touching one upstream, plus exact-context deduplication, bounded caching, cooldown and independent provider failover. Alternative routes remain available without duplicated polling. A denial/cooldown is shared across routes to that upstream. Proxies can route authorised traffic or isolate infrastructure; they must not reset those upstream controls. Durable scheduling and multi-worker leases need a persistent coordination implementation before scaling beyond the bounded single-process runner.

Overlapping `run()` calls share a finite request budget until the active run window drains; it is not an hourly/daily quota. An adapter that ignores cancellation retains its upstream concurrency lease and is quarantined until its actual promise settles. Independent providers can still handle failover. Cached context, money, timestamps and route/method/upstream provenance are revalidated. `nextMarketShoppingCollectionLocal` handles calendar arithmetic including month-end clamping; the scheduling service must resolve property-local times to real instants, including daylight-saving ambiguities.

Retain collection time, source update time, model as-of and unknown timezone distinctly. Re-reading an old estimate does not refresh it. An unavailable date does not prove a booking, and a present snapshot cannot recreate historical reservation pickup events. Unknown source age or incomplete rate conditions must remain non-actionable for automatic pricing.

PriceLabs documents materially different update rates by surface: its STR Neighborhood prices and occupancy have multi-day cycles, Hotel Data describes a daily rate cycle, Market Dashboards refresh daily, and forecasts have a weekly schedule. Therefore, use PriceLabs snapshots for contextual comparison and obtain current comparable offers when a time-sensitive price decision requires them. [STR listing data](https://help.pricelabs.co/portal/en/kb/articles/listing-market-data), [hotel data](https://help.pricelabs.co/portal/en/kb/articles/listing-hotel-data), [Market Dashboard](https://help.pricelabs.co/portal/en/kb/articles/market-intel-dashboard), [forecasts](https://help.pricelabs.co/portal/en/kb/articles/forecasting-with-report-builder).

## PriceLabs compatibility

Start with customer-authorised exports and portfolio analytics. PriceLabs describes Portfolio Analytics as free; that does not include every market entitlement. Its Customer API has a separately published per-syncing-listing charge. Yellow's PMS partner route requires its documented integration/onboarding, with price retrieval following its sync trigger rather than independently scheduled polling of that endpoint. [Portfolio Analytics](https://hello.pricelabs.co/portfolio-analytics/), [Customer API](https://help.pricelabs.co/portal/en/kb/articles/pricelabs-api), [PMS integration guide](https://help.pricelabs.co/portal/en/kb/articles/building-an-integration-with-pricelabs).

MCP remains unconnected as requested. Custom OAuth clients have identifiable registration and scopes; unidentifiable access is not promised. [Custom client documentation](https://developers.pricelabs.co/mcp/connectors/custom-clients).

One pricing writer owns each property/channel scope. Where a channel supports derived rate plans, publish a validated parent rate and let configured inheritance apply. Availability, minimum stays, supplements and exceptions still need their own supported mapping. Publication requires the existing selling floor, policy/approval rules, idempotency, unknown-outcome reconciliation and read-back. The collection foundation introduces no price writer.

## Private data import

The separately saved archive includes host inventory, market memberships, daily occupancy/price-band/LOS tables, chart labels, a field dictionary and explicit export gaps. The source archive and populated staging files remain outside git. All source files are checked against size and SHA-256 before staging. This establishes integrity against the supplied manifest, not independent attestation by PriceLabs.

Preserve platform/listing IDs as strings and memberships independently of physical-unit mapping. Do not combine overlapping views as extra supply. Source monetary strings and missing-value markers remain exact: source Rental Revenue cannot become Yellow Net without a documented package, tax, commission and fee mapping. Booking-received dates and stay dates differ. Market geography must be matched to each host property explicitly. Staging should show unresolved mappings and source gaps rather than inventing room inventory or reservations.

The next operational import order must bind a verified tenant/property context, map physical inventory and timezones, preview duplicates and expected command effects, use existing governed creation commands and reconcile the result. Complete own booking/change history is still needed for genuine pickup forecasting; the partial archive must not be presented as that history.

Run the offline importer on a POSIX filesystem with:

```sh
bun scripts/research/pricelabs-import.ts \
  --archive /private/PriceLabs-Research-Archive-2026-09-08 \
  --output /private/Yellow-PriceLabs-Staging
```

It creates a new private directory with `staging.json`, a self-contained searchable `preview.html` and `receipt.json`; it refuses existing output directories. Directory/file modes are 0700/0600 on POSIX. Native Windows fails before writing with `unsupported_windows_acl`, pending an identity-bound NTFS ACL implementation. No runtime, database, network or operational import occurs. The preview paginates table results and preserves source market, unzoned refresh label, amount strings and unresolved mapping status.

## Costs and evaluations

Customer pre-tax price for the requested 30% gross margin is `ceil(all-in-cost-minor × 100 / 70)`. For cost100.00, that is142.86 in the same two-decimal currency. Quote vendor fees, collection CPU/network, storage, retries, review/support and tax separately. A failed attempt still consumes provider/compute budget. No customer charge or supplier purchase occurs in this order.

Use deterministic parsing, matching, arithmetic and scheduling first. Route ambiguous classification to a bounded small model; reserve stronger reasoning for difficult mappings and policy investigations. Cache permitted research context and re-run models only when source data or the task changes. No client information is submitted to public browser AI research.

Evaluation must distinguish source freshness, successful fields per request, p95 latency, retry rate and cost per accepted comparable observation. Inject a provider timeout, upstream cooldown, stale quote, conflicting meal/refund basis, duplicate request, late response and cache pressure. Forecast research should use seasonal-naive and suitable statistical baselines, rolling-origin evaluation and reservation-event histories with source-as-of controls. A prediction gain is unknown until tested against the same target and information set.

## Delivery evidence

Final root proof on Bun 1.3.14: `bun test tests/market-shopping.test.ts tests/pricelabs-import.test.ts tests/rms-economics.test.ts tests/rate-intent-provider.test.ts` passed **38/38 with 271 assertions**. `bun run typecheck` and import boundaries (184 TypeScript files) passed. The independent review records personally executed final tests, adversarial defects and repairs, exact source hashes, and two deterministic imports of the real private archive.

Live adapters, distributed persistence, operational import and UI/RMS integration remain separate from these tested collection/staging functions. The canonical database wrapper was attempted in the isolated worktree and stopped at `Missing docker`; no database or stable runtime was touched. The source branch may be handed off for integration, but canonical database acceptance and exact integrated-source gates are still required before a reviewable PR/merge. No production performance gain or continuous collection is claimed.
