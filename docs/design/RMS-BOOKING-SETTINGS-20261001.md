# Yellow: profit RMS, booking conversion and operational configuration

1 October 2026 · RESOURCE-20261001-rms-booking-settings-design · design/receiving record.

This incorporates the founder's hotel/STR, online-market, MakeMyTrip, settings,
housekeeping and price-equalizer instructions. Current development remains Phase7.
It extends [existing RMS algorithm research](../research/RMS-ALGORITHMS-ASTRA-ULTRA.md),
[economics](../RMS-ECONOMICS.md) and [voice plan](../architecture/VOICE-RMS-PLAN.md);
it does not implement forecasting, channel connectivity, voice or a public booking engine.

## Product objective and economics

Optimize expected contribution over the SAME property/inventory/time horizon, with
downside and liquidity visible. Occupancy, ADR, headline commission and immediate
cash are diagnostics, not the objective. Protect valuable peak nights when forecast
uncertainty and displaced contribution support it; use longer stays to reduce
turnovers and fill weak nights when they contribute more over the whole horizon.
Corporate/group retention and ancillary margin are separately evidenced terms;
do not invent lifetime value or count ancillary revenue as room revenue.

Length-of-stay bands are configured in Setup/Settings per supported property or
group policy; do not hard-code short/medium/long stays or prices from apartment
bedroom count. Compare whole-stay contribution, peak-night displacement, turnover
cost and leftover gaps within one declared planning horizon. Reports distinguish
requested LOS from actually occupied LOS, cancellations and blocked nights, with
the cohort, as-of date and denominator visible. A long stay is selected only when
supported evidence makes it more valuable than the eligible alternatives.

Keep the existing exact, single-currency, tax-excluded room-economics contract.
A later versioned channel-cost adapter must supply actual commissions, payment
fees, hotel-funded promotions, cancellation/refund loss and servicing amounts.
Avoid subtracting an already-netted discount or cancellation loss twice. Use one
opportunity-cost method per comparison: displaced contribution OR a bid-price
threshold; never charge the same opportunity cost through both. The current
integer occupied-night denominator cannot represent fractional expected occupancy.
Aggregate probability-weighted scenarios through a separately specified estimator.
Contribution is distinct from recognized revenue, accounting profit and bank payout.

Channel evidence in Setup/Settings includes contractual calculation base, fixed/
percentage/tiered fee, currency, effective dates, tax inclusive/exclusive treatment,
invoice issuer, commission tax, payment tax, discounts and who funds them,
cancellation terms and payout schedule. Track tax charged separately from
finance-confirmed recoverability. Unknown recovery produces a sensitivity range,
not a silent zero. Preserve withholding/credit receivables separately from expenses;
cash deductions do not automatically equal profit loss. No universal tax rate or
tax-credit eligibility is inferred. Use distinct fields for guest-price display
inclusion, contractual commission calculation base, tax charged on each fee invoice,
and recoverability with finance evidence. One generic taxInclusive switch cannot
represent these four meanings. The current calculator accepts supplied exact fees;
it does not itself estimate tax or contract costs.

Airbnb supports hotels, but its current guidance generally requires single fees for
traditional hospitality/PMS hosts; most single-fee hosts pay15.5%, and applicable
VAT may already be included. Its actual agreement/payout governs the property;
do not assume a3% cost or add tax twice. [Airbnb fees](https://www.airbnb.com/help/article/1857),
[hotel standards](https://www.airbnb.com/help/article/1526).
Booking.com exposes the property's commission at agreement registration, rather
than one universal rate. [Booking partner FAQ](https://join.booking.com/faq.html).

For India, prioritize MakeMyTrip and Goibibo approved connectivity alongside
Booking.com, Airbnb and direct business. Preserve their booking-brand attribution,
meal/occupancy/rate mappings and settlement evidence. MMT supports hotel and
alternative-accommodation onboarding; listing is distinct from approved activation.
[MMT onboarding](https://www.makemytrip.com/hotels/hotelier-register.htm).
The artifact India addendum retains official Go-MMT mapping/approval instructions
and the dated commission-GST guidance; actual current contracts/invoices remain required.

## Forecast ribbon and online-market strategy

The RMS sub-ribbon compares actual model adapters: Seasonal baseline, Booking Pace,
ETS/ARIMA challenger, Event/feature challenger, Validated Ensemble and Manual scenario.
Display the precise model/version under the friendly name, training cutoff, eligible
dates, freshness, error/bias, prediction interval and champion/challenger status.
Unimplemented or data-ineligible models cannot masquerade as working selections.
Saved defaults/training options belong Settings; ribbon selection changes the current
preview and does not publish rates.

Use historical as-of bookings plus current on-the-books inventory, recent pickup,
cancellations, lead time, LOS and authorized market/event signals. Sold-out/blocked
dates are censored observations, not proof of no demand. Keep hotel room-type and
individual STR capability differences. Validate forecasts with rolling historical
cutoffs and untouched future horizons1/7/28/90 days, seasonal baseline, zero-safe
MAE/WAPE, bias and interval coverage. No future realized cancellations or revised
signals may leak into training. [Time-series cross-validation](https://otexts.com/fpp3/tscv.html).
Forecast accuracy alone does not establish pricing uplift: use shadow evaluation,
contribution/downside/stability metrics and later governed experiments.

Win marketplace bookings through accurate room/listing content, clear total price,
quality photos, real guest experience/reviews, useful availability/LOS and prompt
supported response/instant-book workflows. Measure impressions → listing views →
bookings → realized contribution separately by channel/cohort. Price reductions can
increase conversion while reducing profit; test contribution per eligible visitor
alongside conversion. No ranking guarantee, invented occupancy or off-platform
diversion of an OTA booking. [Airbnb search](https://www.airbnb.com/resources/hosting-homes/a/how-search-works-on-airbnb-460).

## Why this price? and equalizer overrides

One button opens a visual explanation bound to exact quote/model/input versions:
base/reference price → applied rule stages → floors/ceilings/rounding → room price;
then a separate channel/servicing contribution waterfall. Show measured inputs,
modelled estimates, freshness, uncertainty and each affected KPI distinctly.
Demand-model attribution is explanatory, not automatically causal or additive;
retain interactions/residuals and never invent factor contributions to fit a chart.

An equalizer-style panel provides bounded scenario controls for forecast pickup,
event assumptions, lead-time/LOS strategy, campaign choice and explicit price override.
Historical occupancy, actual reviews, invoices and measured KPIs remain immutable.
Each control identifies units, scope, default, permitted range, source and expiry;
unsupported factors are explanatory readouts. Display before/after price, expected
contribution, booking probability where validated, displaced peak nights, gaps,
downside, confidence and affected channels/stays. Correlated factors must not be
counted twice. Re-run the same versioned optimizer after a scenario change only
when its explicit input contract supports that control. The current recommendation
seam does not accept every channel/LOS/campaign/risk control above: a versioned
optimizer-input extension and data-readiness/abstention proof must precede enabling
those controls. The exact economics calculator is arithmetic, not that optimizer.

Guidance explains tradeoffs and flags minimum-contribution/policy/data/authority
breaches. It cannot promise no negative impact. Applying an override requires
role authority, reason, effective range, expiry and existing preview/approval/
publication commands; uncertain writes retain the same command identity. Undo is
a new governed version. Permanent sensitivity limits, policy floors and model
defaults are editable only in Setup/Settings. LLMs may explain approved evidence;
they do not calculate money, invent demand or autonomously approve/publish prices.

## Booking engine: short guest flow, one booking authority

Representative official benchmark covers SiteMinder, Cloudbeds, Lodgify and Guesty
(artifact notes), plus [Mews](https://help.mews.com/s/article/payments-through-the-mews-booking-engine?language=en_US),
[SynXis retailing](https://developer.synxis.com/retailing/synxis_retailing),
[D-EDGE](https://www.d-edge.com/product/booking-engine/),
[STAAH SwiftBook](https://go.staah.com/products/booking-engine/max),
[Amadeus iHotelier](https://www.amadeus-hospitality.com/solutions/reservations-and-guest-management/ihotelier-suite/)
and [HotelRunner](https://hotelrunner.com/solutions/hotels/). Vendor-described
features are not measured conversion/uptime comparisons; this is not all engines
worldwide or a claim that Yellow has their features already.

Target flow: dates/party/property → comparable room/unit/rate with complete price
and policy → guest/payment review → authoritative confirmation. Use a lightweight
mobile shell, optimized images, progressive disclosure, guest checkout, locale
formatting, authorized PSP wallets/local methods, explicit optional upsells and
due-now/later totals. Show alternative dates/properties when genuinely available.
Respect room suitability and policy/capability differences for hotels and STR.

Reuse server quotes, timed holds and PostgreSQL commit arbitration. Quotes need
tax/mandatory-fee/policy versions and expiry; current staff offers are pre-tax, not
a guest grand total. Group results retain property/currency/timezone identity.
Cache safe discovery/static content, never use it as booking authority. Precompute
forecast candidates outside the quote path; no per-request model fitting or LLM.
Fence stale responses and revalidate exact price/inventory at hold/commit. PSP
webhooks, idempotency and reconciliation resolve payment/commit uncertainty;
neither a browser success screen nor PSP authorization alone proves a confirmed stay.
Never accept PAN/CVV into Yellow.

Measure mobile search/checkout latency, funnel abandonment, payment success,
duplicate callbacks, uncertain writes, concurrent last-room attempts and restart
recovery. Target Core Web Vitals p75 LCP≤2.5s, INP≤200ms and CLS≤0.1 on declared
device/network populations; these are acceptance goals, not measured Yellow claims.
[Threshold definitions](https://web.dev/articles/defining-core-web-vitals-thresholds).
Set backend/uptime SLOs after representative load and dependency-failure measurements.

## Setup/Settings and housekeeping

### CRM group enquiry, revenue approval and escalation

Sales, reservations and front office can create the same authorized CRM group
enquiry: requested dates/flexibility, rooms or units by type, party/LOS, meals/
services, budget/requested discount, company/contact and owner. One enquiry links
tasks, quote revisions and the eventual group block/reservations; do not create
separate sales and reservations sources of truth. An enquiry or draft quote is not
an inventory hold or confirmed booking.

When supported evidence is ready, generate a proposed group rate and whole-stay
displacement analysis for the sales owner and route a revenue-review task to the
revenue manager. Otherwise show missing cost/demand/capability evidence and require
review; never invent an automatic profitable rate. Include contribution, peak-night
opportunity cost, wash/cancellation assumptions, room/ancillary margin separately,
alternative dates or stay patterns, validity and inventory/data/model versions.

Revenue can approve the exact quote revision, propose an alternative or deny with
reason. Sales can explicitly escalate the denied revision/requested exception to
a higher authorized commercial approver; retain the original denial and every
decision, rather than replacing them. Higher approval can authorize configured
commercial exceptions within its scope; it cannot waive tenant/RBAC, availability,
money, payment, fiscal or other hard invariants. A material price/date/inventory/
policy revision invalidates the old approval and follows the configured review path.

All appropriate roles see the shared enquiry timeline, task owner/due status,
quote revisions, analysis and decision/escalation state through their real grants.
"Visible to everyone" means authorized enquiry participants and scoped management,
not every tenant or staff member; sensitive guest/financial fields retain their
independent permissions. Approval/escalation routing, discount/contribution bands,
review SLAs, delegates and notification preferences live in Setup/Settings.

Reuse existing CRM/task/group/reservation and rate approval boundaries. Proposed
state flow: enquiry → evidence-bound draft → revenue review → approved / changes
requested / denied → optional escalation → higher decision → guest acceptance →
governed hold/block/commit. Exact states/events/atomic links require a separate
implementation order after inspecting existing linked-group contracts. Task delivery
uses canonical outbox/idempotent consumption; stale/duplicate approvals and
uncertain submission cannot create duplicate groups or mutate a different revision.

Setup is initial guided configuration; Settings edits the same versioned records.
Persistent controls live there: OTA mappings/credentials references, fees/taxes/
promotions/restrictions, model defaults/sensitivity/approval, booking-engine branding/
payments/policies/locales, floor/room assignments, inspection/voice workflow and
staff visibility. Support tenant/group/property defaults with explicit supported
inheritance/overrides and an effective-values preview. Configuration does not grant
permissions, change sellability or license a channel. Secrets stay in the secret
store. Operational screens link to Settings instead of creating duplicate controls.

Housekeeping shows genuine floors containing selectable room-number cubes, with
a list alternative for accessibility/small screens. Missing floor remains unassigned;
do not infer geometry from room numbers. Show room condition, authorized current
stay/preferences and pending work. Commands use existing dirty/clean/pickup/inspected
transitions and live staff permissions. Reception sees source/time-labelled progress,
ETA and comments, separate from actual inspection/check-in blockers.

Voice example: "Room204, cleaning70% complete, about12 minutes left; towels pending."
Resolve property/room/speaker and ambiguity before submitting a typed progress
observation through the same authenticated command pipeline. Record author/time,
percent, remaining-time estimate, comment, expiry and revisions. No automatic room
inspection at100%, no ETA-based check-in permission, no false guarantee of readiness.
Reception receives updates through canonical event/projection boundaries; offline
retry preserves identity and flags stale/conflicting observations. Exact new fields,
events, permissions, transcript/audio retention and local/provider speech policy
need a later implementation order; they are not delivered by this design record.

## Execution sequence and outstanding inputs

1. Finish current operating-mode/security/independent proof and source checkpoint.
2. Establish channel-cost and time-safe RMS data readiness from authorized evidence.
3. Build read-only forecast comparison/business-mix preview and explanation scenarios.
4. Prove governed overrides, approved distribution/reconciliation and guest quote totals.
5. Build/measure the public booking flow and floor/voice operational slices under
   separate disjoint implementation orders; integrate against one canonical history.

Optional pilot inputs: actual OTA commission/settlement invoices, room-servicing/
turnover costs, historical booking/pickup/cancellation exports and business-approved
contribution/discount limits. Aketa and bnbme remain intended pilot subjects; no
synthetic benchmark is their actual forecast or profit. Missing inputs stay unknown
and do not block unrelated authorized construction. Laptop controls source; cloud
owns release/hosting; phone builds/validates immutable compute jobs, not a second
production inventory/pricing database. Account credits remain emergency-only.
