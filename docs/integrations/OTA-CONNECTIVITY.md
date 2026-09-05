# OTA connectivity, rate intelligence, and owned-extranet operations

- **Status:** PROPOSED / DISCOVERY — no integration described here is built, certified,
  contracted, or production-ready.
- **Evidence checked:** 2026-09-05. Provider terms, partner programs, scopes, schemas,
  limits, and prices can change; re-verify primary sources before each adoption.
- **Order:** [433](../../handoff/orders/433-staff-str-journey-research-and-design.md).
- **Related direction:** [Feature register](../FEATURE-REGISTER.md) ·
  [Regional packs](../architecture/REGIONAL-PACKS.md).

This document defines an evidence-bound direction for hotel and short-term-rental
(STR) distribution. It does not claim market share, complete channel coverage, access
to non-public inventory, or permission to automate a website. Research completion is
not feature completion.

## 1. Non-negotiable boundaries

- Prefer an official supplier/connectivity API. An affiliate or demand API sells an
  OTA's inventory; it does not let Yellow manage a property's listing.
- Partner, contract, property, scope, certification, PCI/PII, and feature gates are
  runtime facts. A public documentation page is not access.
- PostgreSQL remains authoritative for sellability. A remote OTA calendar, webhook,
  vendor rate shop, cache, or iCal feed is never booking authority.
- Payment data is token-only. **PAN and CVV must never enter Yellow**, including the
  database, memory-level application payloads, logs, events, traces, dead letters,
  support exports, screenshots, or test fixtures. Do not request card-bearing fields.
  If a channel cannot suppress PAN delivery, it cannot go live until a
  provider-approved hosted or tokenizing boundary ensures Yellow receives only a
  PSP/network token and safe metadata.
- Do not persist raw provider payloads containing guest, payment, identity, message,
  or credential data. Normalize an allowlisted minimum into tenant-scoped records;
  retain provider event IDs, hashes, safe status/error codes, and redacted audit
  evidence only. Retention and erasure follow separately sourced, versioned rules.
- No unauthorized scraping, stealth browser control, CAPTCHA bypass, identity masking, fingerprint
  manipulation, proxy rotation, or attempts to evade rate limits or access controls.
- iCal is a degraded availability-block exchange, not a rates, restrictions,
  reservation-detail, message, payment, or real-time channel-manager contract.

## 2. Supply versus demand and access truth

`ARI` means availability, rates, and inventory. Capabilities below are documented
public surfaces, not enabled Yellow capabilities.

| Channel | Surface and focus | Publicly documented supplier capability | Access and delivery truth | Yellow status |
|---|---|---|---|---|
| Booking.com | **Supply:** Connectivity APIs for hotels and homes. Separate **Demand API** is for managed affiliates distributing Booking.com inventory. | Reservations; ARI and restrictions; rooms/rate plans; property content/photos; messaging, reviews, promotions, reporting, and payment/payout-related connection types. | Connectivity Partner, machine-account, property permission, and per-feature gates. Reservations use retrieve/acknowledge queues with fallback email. Delta ARI and at least 12 months forward are recommended. Pricing modes and messaging can require certification. | **PROPOSED / DISCOVERY.** Apply only through partner onboarding; this research did not verify partner credentials, access or commercial terms. |
| Expedia Group hotels | **Supply:** Connectivity Hub / Lodging Supply. **Rapid** is demand-side distribution and is not the property adapter. | Required core: Availability & Rates, Reservation Management, and Product Management. Additional messaging, reviews, deposits, images, promotions, compliance/status surfaces are documented. | New providers contact Expedia, accept a licence, meet PCI requirements, test, certify, and soft-launch. Individual properties are not accepted for direct connections. Current reservation management supports notifications/retrieval/update; legacy Booking Notification is not open to new adoption. | **PROPOSED / DISCOVERY.** |
| Vrbo | Public **Rapid + Vrbo** documentation is demand-side. A property-manager supply route is referenced as Integration Central, but no sufficient public supply specification was found. | Rapid exposes content, shop, booking, itinerary, and servicing to resellers; these do not prove a Yellow-to-Vrbo listing feed. | Supply schemas, minimum portfolio, reservation transport, content, messaging, payments, certification, and price remain unresolved. iCal may be a property-selected degraded fallback only. | **DISCOVERY BLOCKED ON PARTNER EVIDENCE.** Do not build supply against Rapid. |
| Airbnb | Scoped API Programs for PMS/channel-management; hotel and STR software connections. Public schema/reference is gated. | Host documentation confirms full sync or pricing-and-availability-only sync. It does not establish every reservation, message, review, or payment scope for Yellow. | Requires API Program admission, partner terms, security review, granted scopes, and mandatory features. iCal refresh is periodic and can double-book; it is not an API substitute. | **PROPOSED / DISCOVERY.** No capability may be promised before scopes are granted. |
| Agoda | **Supply:** YCS API for channel managers, OTA API for direct integrations, Content Push for onboarding/content. | Set/get ARI, occupancy prices, allotment, CTA/CTD/LOS, products, booking list/detail; content supports properties, rooms, rate plans, product mapping, photos, and contract flow. | Account-manager/Connectivity Support onboarding and certification. Booking Hint is a near-real-time hint followed by booking-detail retrieval, with retries and poll recovery. OAuth/IP allowlisting is documented. | **PROPOSED / DISCOVERY.** Payment and messaging scope must be proven during certification. |
| MakeMyTrip + Goibibo | Inbound supply through approved channel managers and the InGo-MMT extranet. | Official partner help confirms channel-manager management of ARI using a hotel code and generated access token; products are created in the extranet before mapping. | No sufficient public schema for reservations, retries, restrictions, content, messaging, or payment. Provider admission and private specification are required. | **DISCOVERY BLOCKED ON PRIVATE SPECIFICATION.** |
| Trip.com | **Supply:** Trip.com Connectivity Open Platform. Separate Trip partner availability APIs distribute Trip inventory. | Public connectivity material lists content/products/images, ARI/restrictions, availability check, reservation confirm/cancel/modify/sync, promotions, merchant support, and IM. | Contact, PCI/PII review, documents, testing, and approval are required. Event/poll/retry/idempotency and commercial terms are not public. | **PROPOSED / DISCOVERY.** |
| Google Hotel Center / Vacation Rentals | Supply to metasearch/direct referral, not an OTA reservation inbox. | Hotel content, nightly ARI, restrictions, landing pages, diagnostics and reports; VR content and rates/availability lead to the partner's booking site. | Eligibility, terms, Hotel Center, testing, and certification. Travel Partner API is visible only to trusted partners. Google documents free VR referral participation; ads are optional. Booking, payment, and guest messaging remain Yellow/direct-site responsibilities. | **PROPOSED / DISCOVERY.** |
| Gathern (`جاذر إن`) | Saudi peer-to-peer vacation-rental platform: villas, apartments, farms, chalets, resorts, and camps; not primarily a conventional hotel OTA. | Official Gathern Business material documents host registration, listing/photos, bookings, payouts, and account-manager support. | No public channel-manager API, ARI schema, webhook contract, developer portal, or B2B connectivity program was found. | **DISCOVERY / MANUAL-FIRST.** Direct API is unverified and must not be promised. |
| Almosafer | Hotels plus Saudi alternative accommodation. Its Online Distribution API gives agents/platforms access to Almosafer-sourced Saudi inventory. | Corporate material describes B2B portals, embedded B2B2C, direct hotel connectivity, and a hotel-content API. That is evidence of a demand/distribution product, not a public property-supply contract. | No public inbound ARI/reservation API, schema, webhook/poll contract, credentials, or certification path was found. Demand and property-supply routes must remain separate. | **DISCOVERY BLOCKED ON DIRECTION AND PRIVATE SPECIFICATION.** |

Initial onboarding order is based on product/geographic coverage and public supplier
contract maturity, not fabricated market share: (1) Booking.com, Expedia hotels, and
Agoda; (2) MakeMyTrip/Goibibo partner discovery in parallel for India; (3) Airbnb and
Vrbo for STR; (4) Trip.com; (5) Google after Yellow's direct booking path is stable;
(6) small regional packs such as Gathern and Almosafer discovery.

## 3. Capability-negotiated adapter contract

Every connection is property-scoped and declares a versioned `ChannelCapabilities`
rather than one `connected` boolean:

1. Reservation create/modify/cancel, request-to-book, delivery mode
   (`push`, `hint_then_fetch`, `poll`), acknowledgement deadline, replay horizon, and
   reconciliation cursor.
2. ARI horizon, batch/rate limits, occupancy pricing, derived/LOS pricing, and each
   restriction independently: closed, CTA, CTD, min/max LOS, stay-through, and advance
   purchase.
3. Content facets independently: property, unit, rate plan, product, policy, fee/tax,
   photo, promotion, review, message, and onboarding/status.
4. Payment model as safe metadata only: property/OTA collect, currency, tokenized VCC
   indicator, payout/reconciliation reference, and token provider. Never PAN/CVV.
5. External mapping for tenant/property/unit/rate-plan/product/occupancy IDs, remote
   revision, mapping state, field ownership (`yellow`, `channel`, `shared`), sync mode
   (`full`, `ari_only`, `extranet_owned`), and effective time.
6. A durable outbound ledger with idempotency key, canonical safe request hash,
   attempts, redacted response status, retry class, partial success, and read-back
   result. Never retain the raw sensitive body.
7. An inbound event identity and lifecycle version for deduplication. Applying a
   reservation still uses Yellow's normal tenant transaction, PostgreSQL occupancy
   choke point, facts, and outbox; channel acknowledgement follows committed local
   truth.
8. Explicit health: last success, observed lag, stale horizon, unmapped products,
   rejected cells, reconciliation drift, fallback-email/manual exception, certification,
   scope, and permission expiry.

Unknown capability is `unsupported`, never assumed. Changes to partner scopes or
schemas require a new capability version and compatibility evidence.

## 4. Reconciliation and failure behavior

- Process push/hints promptly, but fetch full details only from the official API and
  acknowledge only after the local transaction commits.
- Persist cursors/watermarks and periodically backfill the documented replay window.
  Reconciliation compares remote safe identifiers/statuses with local mappings; it
  does not overwrite PostgreSQL sellability from a cache.
- Retry only documented transient failures with bounded exponential backoff and jitter.
  Permanent validation, permission, mapping, and certification errors stop and surface
  an operator action. An indeterminate write is read back before any retry.
- A real-time availability/offer recheck is required immediately before accepting a
  request-to-book or downstream booking wherever the provider supports it.
- iCal imports create provisional external blocks with source/freshness. Stale feeds,
  collisions, cancellation ambiguity, or refresh failure alert an operator; they do
  not silently release or confirm inventory.

## 5. Compset and market-rate intelligence

### Truth classes

| Class | Permitted use | What it cannot prove |
|---|---|---|
| Property-owned API/export | The connected property's own ARI, bookings, performance, payouts, and reports under granted scopes. | Competitors' bookings, private inventory, impressions, or conversion. |
| OTA aggregate benchmark | Provider-authorized market/peer/compset indices. Booking.com explicitly asks that Market Insights be retrieved on demand and not prefetched/cached for every property. | Named competitors' exact inventory or offer truth. |
| Licensed public-offer observation | Comparable public rates/availability supplied by a contracted rate-intelligence vendor with channel/POS dimensions. | Actual rooms remaining, bookings, revenue, or universal rate coverage. |
| Licensed market model | Aggregated/modelled STR ADR, occupancy, RevPAR, pace, and forward percentiles. | OTA ledger truth or truly real-time market state. |

Use provider-owned feeds and exports first. Direct page collection is a candidate only
where the source's applicable permission/contract explicitly allows that operation;
it must use the same bounded, auditable adapter contract. It is not currently enabled.
A vendor contract must state permitted sources, countries/channels, API/export rights,
redistribution, retention/cache limits, attribution, update SLA, personal-data content,
and deletion/termination duties before ingestion.

Publicly documented candidates are discovery inputs only:

- **Lighthouse:** subscription/API-scoped hotel and STR rates, compsets, room mapping,
  parity, ranking/reputation, demand, and gated live/raw rate shopping. Compsets are
  configured in its dashboard; production pricing is not public.
- **RateGain UNO:** scheduled competitor/parity shops parameterized by channel, LOS,
  day, and days-to-arrival; API/SLA and pricing are commercial.
- **AirDNA:** sales-gated Enterprise API/data feed for STR market, property comps,
  Airbnb/Vrbo/Booking.com listing data and future daily pricing; published feeds and
  comp data update daily, not universally in real time.
- **PriceLabs:** daily STR Market Dashboards/CSV with compsets and market metrics;
  published monthly entry price is USD 9.99 for up to 1,000 listings. Price and terms
  must be rechecked before purchase. It is an economical daily benchmark, not a hotel
  live-rate API.

### Cheap adaptive collection

Cache observations by source licence, compset/property, channel, POS, arrival, LOS,
occupancy/ages, currency, device/member class, refundable terms, meal, tax inclusion,
room mapping, and extraction time. Preserve both the raw **non-sensitive rate
observation fields** allowed by contract and a normalized comparable total; never
label an expired observation real time.

- Hot 0–14-day cells: 30–60 minutes only for a small licensed compset during active
  demand, or after an own-rate/booking/event trigger.
- Warm 15–60-day cells: 4–6 hours.
- Cold 61–365-day cells: daily or less.
- A human refresh triggers only the requested cells. Coalesce identical licensed
  requests only if the vendor permits multi-tenant reuse.
- Deduplicate in-flight shops; use stale-while-revalidate, bounded backoff, per-tenant
  call/spend budgets, and circuit breakers. Prefer aggregates for wide STR markets and
  reserve named live shops for narrow revenue decisions.

There is no anonymity guarantee. Yellow may keep the customer's identity out of its
own comparison presentation, but must not disguise collection from a provider or
vendor. It cannot promise a complete OTA database, every private/member/mobile or
geo-targeted offer, competitors' bookings, exact search rank, or real-time coverage in
all markets.

## 6. Owned-extranet copilot

Owning an OTA property account does not itself authorize automated browser access.
Public platform/website terms contain automation restrictions, but the applicable
property-supply agreement must be checked for the exact operation. Consumer, affiliate
or marketing-site terms alone do not establish every extranet permission. Owning a
hotel account is not an unrestricted extraction licence. Order of preference:

1. official scoped API;
2. provider-scheduled export;
3. human-downloaded CSV/PDF imported through an allowlisted parser;
4. guided copilot in which the user performs the UI actions;
5. authenticated browser execution **only when that OTA has given applicable written
   permission or partner terms explicitly authorize the workflow**.

An authorized browser connector must use a named least-privilege property user. The
human completes MFA interactively; Yellow does not store OTPs, recovery codes, or a
shared owner password. Before any write it shows property, action, affected dates and
the current-value preimage plus exact proposed diff. A human explicitly approves the
bounded operation, or an existing explicit scoped mandate must authorize it where the
domain and provider rules permit. A blanket approval never replaces a mandatory
action-time confirmation. Writes carry a Yellow idempotency key, execute once, reload the
authoritative page/API, and record `verified`, `rejected`, or `indeterminate`.
Indeterminate writes are never retried automatically.

Stop immediately on unexpected property/account, changed or ambiguous UI, new warning,
currency/price mismatch, reauthentication, MFA, CAPTCHA, rate limit, permission loss,
or missing confirmation. Use separate read/write roles, step-up approval for
cancellation, payment/bank/tax, broad ARI, and destructive content, plus per-channel
and global kill switches. Audit only redacted evidence: actor, tenant, property,
permission basis, preimage hash, approved diff, result, verification, and timestamps.

## 7. Regional packs

Regional presentation is `country -> admin1 (region/state/province) -> locality/city
-> property`, with local labels and aliases. Arabic packs support Arabic/English
content, RTL layout, bidirectional-safe identifiers, configurable digit/currency/date
display, and canonical ISO dates/timestamps internally. These are presentation and
verified configuration, not stereotypes or implicit law. Every tax, licence,
identity, invoice, reporting, or retention rule needs versioned primary-source
evidence, jurisdiction, effective dates, last verification, and review/expiry status.

## 8. Primary sources

Accessed 2026-09-05. Recheck before implementation.

- Booking.com: [Connectivity overview](https://developers.booking.com/connectivity/docs),
  [Reservations delivery](https://developers.booking.com/connectivity/docs/reservations-api/reservations-overview),
  [Market Insights](https://developers.booking.com/connectivity/docs/market-insights-api/managing-market-insights-demand-data),
  [Demand API prerequisites](https://developers.booking.com/demand/docs/getting-started/prerequisites),
  [customer platform automation terms](https://www.booking.com/content/terms.en-gb.html).
- Expedia Group: [Connectivity onboarding](https://developers.expediagroup.com/supply/lodging),
  [Lodging API overview](https://developers.expediagroup.com/supply/lodging/docs/booking_apis/reservations/getting_started/ui_guidelines/),
  [legacy notification gate](https://developers.expediagroup.com/supply/lodging/docs/booking_apis/booking_notification/getting_started/introduction/),
  [Partner Central/site terms](https://partner.expediagroup.com/en-us/partner-support/website-terms-of-use),
  [Vrbo on Rapid](https://developers.expediagroup.com/rapid/lodging/vacation-rentals/vrbo-integration-guide?locale=en_US).
- Airbnb: [software sync modes](https://www.airbnb.com/help/article/2348),
  [calendar limitations](https://www.airbnb.com/help/article/99),
  [API Terms](https://www.airbnb.com/help/article/3418),
  [platform terms](https://assets.airbnb.com/help/2026_Terms_of_Service_for_Users_Outside_of_the_EEA_UK_and_Australia_-_English.pdf),
  [earnings exports](https://www.airbnb.com/help/article/3632).
- Agoda: [YCS introduction](https://developer.agoda.com/supply/docs/introduction),
  [certification and limits](https://developer.agoda.com/supply/docs/certification),
  [ARI](https://developer.agoda.com/supply/docs/avaiability-and-rates),
  [Booking Hint](https://developer.agoda.com/supply/docs/booking-hint),
  [Content Push](https://developer.agoda.com/supply/docs/introduction-3),
  [OAuth](https://developer.agoda.com/supply/docs/authentication-2025),
  [platform automation terms](https://www.agoda.com/info/termsofuse.html).
- India/APAC: [InGo-MMT mapping](https://partners.go-mmt.com/support/solutions/articles/81000197192-how-can-i-map-my-property-s-channel-manager-with-ingo-mmt-extranet-),
  [Trip.com Connectivity](https://connect.trip.com/).
- Google: [Hotel Prices](https://developers.google.com/hotels/hotel-prices),
  [ARI](https://developers.google.com/hotels/hotel-prices/dev-guide/ari-overview),
  [trusted-partner authorization](https://developers.google.com/hotels/hotel-prices/dev-guide/api-auth),
  [VR connectivity guide](https://support.google.com/hotelprices/answer/12567939?hl=en).
- Saudi: [Gathern Business](https://business.gathern.co/),
  [Gathern scope](https://gathern.co/en/faqs/customer),
  [Almosafer corporate portfolio](https://corporate.almosafer.com/en),
  [Almosafer/Seera distribution models](https://www.seera.sa/wp-content/uploads/2025/05/SEERA-_Q2-2025_Investor-Presentation-1.pdf).
- Rate intelligence: [Lighthouse API](https://api.mylighthouse.com/),
  [RateGain UNO](https://uno.rategain.com/hotel-rate-intelligence/),
  [AirDNA Enterprise API](https://docs.airdna.co/),
  [AirDNA update cadence](https://help.airdna.co/en/articles/8062172-how-often-is-airdna-s-data-updated),
  [PriceLabs pricing/cadence](https://help.pricelabs.co/portal/en/kb/articles/market-dashboard-billing-and-subscription).
