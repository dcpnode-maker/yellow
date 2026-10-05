# Market dataset access findings — 25 September2026

Scope: internal Yellow RMS, Dubai first, Riyadh/London later, monthly observation
of the next30days. No claim of full market coverage or two-week completion.
Root plus free_street_map researched primary sources; findings are technical
access qualifications, not a substitute for source-specific permission.

| Source | What is actually available | Boundary / next step |
|---|---|---|
| PriceLabs Customer API | `/v1/listings`: listings in authenticated customer's account, not all competitor listings worldwide | Verify account entitlement and usage charges before API requests. No PriceLabs env key found by name-only check; no key values printed |
| PriceLabs Market Dashboards | Dubai Ready-to-View market and subscribed market analysis | Dashboard access is not a global dataset licence. Terms restrict systematic extraction/reuse; request written rights for Yellow market database / persistent Drive storage |
| Airbnb | User account functions and partner-scoped APIs | Standard terms prohibit automated scraping; API terms restrict database/pricing-analysis uses. Own login does not establish global feed entitlement. No scraper/mobile-endpoint bypass started |
| Dubai Land Department / DubaiPulse | Actual real-estate sales and Ejari tenancy contracts; CSV fields and API catalogue | Official DLD CSV UI has CAPTCHA; Pulse may require dataset approval/key and terms. Do not bypass. Ejari annual tenancy is not nightly STR bookings |
| Bayut Dubai Transactions | Bayut states source is DLD | Prefer authorized original DLD data rather than scraping a repackaged view |
| DXBInteract | Analyst-facing service | Focused search did not verify a bulk reuse licence or first-party full-feed provenance; unconfirmed, not an importer source yet |
| DET | Hotel/holiday-home operator registration/classification services | No all-unit public bulk registry verified; request permitted dataset access separately |
| Google Hotel Center / Places | Partner's own submitted hotel inventory; selected POI search/details | Not a free all-hotels export. Places caching/reuse restrictions apply, Place IDs have separate retention exception; not a replacement global Yellow listing database |
| Inside Airbnb | Published downloadable snapshots, CC BY4.0; current index includes London | No Dubai entry found in current index. Quarterly secondary snapshots, not live or full global coverage. Read data licence/limitations before reusing; not an Airbnb API entitlement |

## Source references

- https://developers.pricelabs.co/customer-api/api-reference/customer-api/listings/all-listings
- https://developers.pricelabs.co/customer-api/api-reference/enable-the-api
- https://developers.pricelabs.co/customer-api/api-reference/overview
- https://developers.pricelabs.co/rm-partner-api/overview
- https://hello.pricelabs.co/tandc/
- https://hello.pricelabs.co/ready-to-view-market-dashboard/
- https://help.pricelabs.co/portal/en/kb/articles/market-dashboard-billing-and-subscription
- https://www.airbnb.com/help/article/3418
- https://www.airbnb.com/help/article/2857
- https://dubailand.gov.ae/en/open-data/real-estate-data/
- https://gslb.dubaipulse.gov.ae/data/dld-registration/dld_rent_contracts-open?page=6
- https://www.dubaipulse.gov.ae/organisation/dld/service/dld-registration?dataset=dld_units-open-api&organisation=dld&page=1&service=dld-registration
- https://www.bayut.com/mybayut/dubai-transactions-feature-bayut/
- https://support.google.com/hotelprices/answer/9218458
- https://developers.google.com/maps/documentation/places/web-service/policies
- https://insideairbnb.com/get-the-data/
- https://insideairbnb.com/data-policies/

## Import contract to implement after source access is verified

Separate observations from unique listings. Key observations by source ID,
observation timestamp, market, arrival date, length of stay, guest count,
currency and fee/tax basis. Store quoted amount separately from mandatory fees,
taxes and total; missing fields remain unknown. Tag price_kind as nightly_ask,
signed_rent_contract, sale_transaction or achieved_revenue; never intermingle.
Retain source/update timestamps, licence, precision, coverage and raw-file hash.
Publicly visible is an observed state, not proof of available inventory; absence
from one fetch is not a verified inactive/deleted listing. Respect source deletion
and retention obligations. Do not ingest guest identities/private host contacts.

Once permitted, use incremental bounded batches, conditional downloads, source
Retry-After and hard rate/request/cost caps. Store dated compressed partitions and
manifest/current index in the designated private Drive folder. No huge persistent
laptop download. Drive is an archive, not the live application's query database.
Actual collector/schedule and uploaded files are NOT yet created.

## Actual access checks

Bounded ankitg.owa Drive metadata search for PriceLabs returned mirrored code/
handoff Markdown. Additional same-keyword search excluding Markdown/folders
returned no result; this does not prove exports are absent elsewhere. No raw
dataset downloaded, shared, moved or deleted. Existing local receiving code is
scripts/research/pricelabs-import.ts and related Windows/staging scripts; past
synthetic proof does not mean current customer data has been ingested.

Updated25September: founder supplied credentials and ordinary PriceLabs sign-in
succeeded. The authenticated multi-calendar displays143 connected listings and a
CSV download control. Market Dashboards displays one active Abu Dhabi dashboard;
its report displays about3.77K available listings, approximate map locations,
listing comparison rows and chart CSV controls. No Dubai dashboard was opened,
CSV downloaded, subscription purchased, credit spent or pricing/sync changed.
Credentials are not recorded here. Account access is now verified; exact export
schema, retention/reuse and a global feed are not established by dashboard access.

The existing Booking.com connector was personally exercised for Dubai,
2–3October2026, two adults/one room/AED. It returned10 property results with IDs,
names, quoted book prices, coordinates, ratings and facilities. This is a bounded
successful live comparison, not a complete Dubai catalogue or automatic feed.
Tax inclusions, cancellation and identical room products must not be inferred
from missing fields. No booking/purchase made; no raw payload committed.

The community openbnb-org/mcp-server-airbnb project exists and documents public
search/detail scraping with robots handling. It is not an official Airbnb feed,
has not been installed/tested here, and its optional robots-override mode is not
being used. MCP changes the interface, not the underlying access/reuse rules.
Official Booking Demand integration requires partner credentials; Expedia Rapid
documents partner-enabled Vrbo content/shopping. Neither direct partner feed has
been activated for Yellow. Useful references:
- https://github.com/openbnb-org/mcp-server-airbnb
- https://developers.booking.com/demand/docs/getting-started/try-out-the-api
- https://developers.expediagroup.com/rapid/lodging/vacation-rentals/vrbo-integration-guide

Need a verified direct endpoint/export contract before autonomous acquisition.
Order705 adds bounded JSON intake using existing adapters, not an endpoint guess
or a scheduler. One optional question remains: default comparable quote of
1night/2adults/AED, mandatory taxes/fees distinguished (not silently assumed).
