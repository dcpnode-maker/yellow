# PriceLabs authorized exports and API findings — 25 September 2026

## Observed account UI (read-only)

Existing dashboard187188 is Abu Dhabi, UAE, currency AED, Airbnb Whole Market.
Initial stale tab: refresh24September02:25AM,2532 active listings. After normal
reload: refresh25September02:12AM,2528/2528 active listings matching criteria,
253 pages. These are provider-defined counts, not independently verified supply.
Market map explicitly uses approximate locations and next-year average prices.

View Compset Listings has a Download CSV control. Visible table columns: listing
ID, channel link, listing name, bedrooms, star rating, reviews, price, estimated
active nights, minimum stay, dynamic-pricing category, estimated rental revenue
range. A listing title containing1BR was classified Studio by the provider; keep
raw fields and flag conflicts, do not infer a replacement silently.

Future Prices has its own CSV control, daily chart range25September2026 through
19September2027,25th/50th/75th/90th percentile series, optional median booked price.
The chart explicitly says nightly rates exclude fees. These are regional series,
not every individual listing's October calendar or confirmed booking quotes.

## Initial Order719 export outcome (superseded by successful722 retrieval below)

Initial export displayed session-not-initialized notice. Reload succeeded and the
updated market count/refreshed date above appeared. Normal CSV clicks then produced
no captured download; a download-event waiter was armed before the listing export
and timed out after20seconds. No CSV was found in the normal Downloads folder or
the scoped artifact folder. The chart's accessible data-table control also did not
produce an HTML data table. Do not claim export success, a CSV schema validation,
October31-row completeness, or a PriceLabs dataset saved locally/Drive.

Founder asked to use laptop Chrome. Browser control reported Chrome unavailable;
inventory contains only Codex In-app Browser. No fallback stole browser cookies,
read profile secrets, used private APIs, or launched a debugging Chrome instance.
Requested founder attach the existing CSV exports if normal Chrome downloads work.

Subsequent normal Account Settings navigation personally confirmed both API Details
and AI Connector (MCP) Beta in this account. The connector screen visibly shows
Claude, Grok and ChatGPT integrations all Disconnected; ChatGPT has a Connect
button. No Connect action was taken, and no credentials or permissions changed.

## Official API findings

- [Customer API overview](https://developers.pricelabs.co/customer-api/api-reference/overview):
  account listing prices/settings, not an unauthenticated global listing catalogue.
- [Neighborhood Data](https://developers.pricelabs.co/customer-api/api-reference/customer-api/neighborhood-data/get-neighborhood-data-for-a-listing):
  GET /v1/neighborhood_data, X-API-Key, listing_id and pms. Returns the account
  listing's Neighborhood-tab market statistics: future price percentiles, market
  occupancy/new/cancelled activity and base-price context. Preserve response Labels
  and X_values associations; do not assume a Y_values order. Samples include empty
  arrays, so missing values must not become zero. Currency is explicit. This is a
  useful internal RMS benchmark input, not proof of whole-Dubai listing calendars.
- [Customer API charges](https://help.pricelabs.co/portal/en/kb/articles/pricelabs-api):
  $1 per syncing listing per billing month; key management is in Account Settings /
  API Details. No key was generated, API enabled, secret extracted or call charged.
- [AI Connector market insights](https://developers.pricelabs.co/mcp/tools/market-insights):
  neighborhood and regional tools, including optional price/occupancy payloads.
  Not connected in this session; tool discovery found no callable PriceLabs tool.
  The [official MCP overview](https://developers.pricelabs.co/mcp/overview) says
  access is complimentary for a limited beta period, unlike the paid Customer API.
  This is a potentially lower-cost route, not a permanent free entitlement or a
  complete Dubai listing feed. Questions may be stored/analyzed by PriceLabs.
  [Custom clients](https://developers.pricelabs.co/mcp/connectors/custom-clients)
  support local CLI agents through an admin-created OAuth client with selectable
  permissions. Creating credentials/granting access requires a separate explicit
  confirmation and secure client setup; neither occurred. Prefer read-only scope
  for market analysis, never grant rate-writing access merely to collect data.
- [Revenue Estimator](https://developers.pricelabs.co/revenue-estimator-api/api-reference/revenue-estimator-api/revenue-estimator-version-1/get-revenue-estimate-v-1):
  address or coordinates plus bedroom count/currency; estimated revenue/ADR/
  occupancy, optional monthly breakup. Separate API key, not individual calendars.
- [PMS integration](https://help.pricelabs.co/portal/en/kb/articles/building-an-integration-with-pricelabs):
  provider onboarding/certification, not a shortcut to competitor bulk ingestion.

## Supplied Market Dashboard endpoint check (25 September)

The founder supplied the exact authenticated route
`GET https://api.pricelabs.co/v1/market_dashboard/data?report_id=49132`.
Root made exactly one HTTPS request using the documented `X-API-Key` header,
with redirects disabled, a 25-second deadline and a 4 MiB response cap. The
server returned HTTP 404 and a 34-byte JSON error with keys `status` and `error`
(`error: "Not Found"`). No response file was saved, no retry or report-ID
enumeration occurred, and no credential was persisted. This does **not** prove
that the key is invalid: a 404 cannot distinguish a nonexistent/stale report,
an inaccessible report, or an undocumented route. It also produced no schema,
date range, or market rows. Do not equate `report_id=49132` with the visible
PriceLabs dashboard `187188` without provider confirmation.

I could not find this path in the public official PriceLabs Customer API
reference/changelog. The documented Customer API contract still supports
listing-scoped Neighborhood Data, not a documented global Market Dashboard data
route. Official UI documentation describes exportable dashboard reports and CSV
downloads, but does not document this endpoint's auth requirements, report-id
scope, payload structure, or October date filters. See [Customer API overview](https://developers.pricelabs.co/customer-api/api-reference/overview),
[Neighborhood Data API](https://developers.pricelabs.co/customer-api/api-reference/customer-api/neighborhood-data/get-neighborhood-data-for-a-listing),
[Market Dashboard overview](https://help.pricelabs.co/portal/en/kb/articles/introduction-to-market-dashboards),
and [Market Dashboard billing/entitlements](https://help.pricelabs.co/portal/en/kb/articles/market-dashboard-billing-and-subscription).

## Static review of five supplied attachments (not executed)

The five files in the Order720 attachment directory were reviewed as text only;
no program or dependency was run. The files are historical, account-specific
automation, not a supported Market Dashboard competitor-feed integration:

- `1-demo.py` drives a browser through generic popup-close and XPath/click
  helpers, then attempts a date-filtered CSV download. Its exception path prints
  a slice of page source, which could expose account content in logs.
- `2-AirbnbLogin.py` contains account-authentication material and is not safe to
  execute, forward, or quote without redaction.
- `3-script.txt` and `4-quickbooks-1-.py` contain account/financial automation
  patterns and sensitive configuration. Do not reuse their secrets or email,
  scheduling, and external-account actions as part of a market import.
- `5-dubai-beds-24-complete.py` calls Beds24 bookings/properties endpoints for
  the operator's own host data; it does not evidence a public competitor-market
  API. Its scheduled execution and floating-point financial calculations make
  it unsuitable as an ERP import path without a separately designed, reviewed
  adapter.

Across the attachments, credential literals, scheduler/email or external-account
side effects, broad popup interactions, and floating-point financial splitting
are reasons not to run or adopt them. No credential values or guest records are
reproduced here. See the Order720 receipt for the bounded static review and
limits.

Next safe intake: obtain the existing dashboard exports, validate unchanged bytes
and dates, then separately scope an adapter for an approved account API entitlement.
No operational database import or public redistribution is part of this research.

## Order722 — real normal-UI exports obtained

On25September root opened the known dashboard in a fresh normal browser tab and
downloaded the existing listing, future-price and occupancy CSVs. The download
event waiter again timed out, but actual fresh files were present in Downloads;
filesystem hashes/headers/counts and visible first listing records were verified.
This supersedes the earlier no-file outcome, not the separate API404 result.

- Listings:2528 records,396315bytes; fields ListingID,listing_link,lat,lng,
  Bedrooms,Star Rating,Reviews,Price,Active Nights,Min Stay,Dynamic Pricing,
  new_listing,listing_title,id. IDs remain text; coordinates approximate.
- Prices:1114 daily observations,54140bytes,2024-09-01 through2027-09-19;
  all31October2026 dates present. Fields Dates,25th Percentile,50th Percentile,
  75th Percentile,90th Percentile,Median Booked Price,No. Of Bookings. Regional
  rates, not listing calendars; excludes fees; median booked price is estimated.
- Occupancy:53864bytes; separate provider-estimated market occupancy/comparisons,
  booking activity and cancellations, not individual confirmed availability.

Original bytes and caveats are saved under the scoped local export folder; see
receipt722 for hashes, validation and upload status. No hotel DB import or map
integration occurred. No full Dubai/global data claim.

Read-only account inventory exposes only Abu Dhabi. Dubai ready-to-view preview
currently advertises31,060 listings at$159.99/month; no purchase/credit use or
subscription activation occurred. Abu Dhabi data must not be relabeled as Dubai.
Both account connections are available for Drive; destination selection requested
before any upload.
