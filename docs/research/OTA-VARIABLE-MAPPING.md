# OTA and RMS variable mapping proposal

**Status:** DOCUMENTARY PROPOSAL for future distribution work. This is not a schema,
runtime mapping table, provider certification, contract, enabled connector, or external
write authority. Evidence was checked against eight official sources on 2026-09-08.

## Boundary

Yellow needs one semantic dictionary and versioned provider mappings around it. It
must not create a supposedly universal OTA payload that erases provider meaning.
Booking.com and Airbnb are distribution channels; **PriceLabs is an RMS** that can
recommend and, when separately enabled, publish rates or minimum stays through a PMS
or channel integration. PriceLabs does not become reservation, inventory, occupancy,
or sellability authority.

Public Airbnb help establishes host-facing concepts but does not publish the complete
partner wire schema. Exact paths, enums, limits, event behavior, and writable scopes
therefore remain `unknown_until_contract`, even where the concept is visible in the
host product.

The 53-key dictionary below is a bounded first slice around ARI, restrictions,
reservation identity, and RMS recommendations. It is not an exhaustive OTA inventory,
and the eight current sources are bounded evidence for the three named providers—not
a claim of complete OTA research or coverage.

## Canonical semantic dictionary

Every canonical key is defined once below. Provider tables later in this document
reference these keys; they do not redefine them.

| Canonical key | Type and unit | One meaning |
| --- | --- | --- |
| `connection.provider` | versioned identifier | Contracted adapter, such as `booking-com`, `airbnb`, or `pricelabs-rms` |
| `connection.contract_version` | opaque string | Applicable commercial/API-program agreement version |
| `connection.schema_version` | opaque string | Wire/API/export version actually decoded or emitted |
| `connection.capability_version` | opaque string | Yellow capability snapshot including scopes, certification, and feature flags |
| `connection.sync_mode` | tagged enum | `full`, `pricing_availability`, `ari_only`, `recommendation_only`, `extranet_owned`, or preserved unknown/provider extension |
| `connection.field_owner` | enum per mapped field | `yellow`, `provider`, `shared`, or `unknown`; never inferred from connection alone, and unknown blocks outbound change |
| `connection.remote_revision` | opaque string | Provider revision/cursor/updated token for read-back and conflict handling |
| `connection.observed_at` | UTC instant | When Yellow obtained the provider value |
| `mapping.property` | provider ID ↔ Yellow ID | Exact property/listing mapping |
| `mapping.unit_type` | provider ID ↔ Yellow ID | Sellable room/listing category mapping, not a physical assigned room |
| `mapping.rate_plan` | provider ID ↔ Yellow ID | Commercial policy/rate-plan mapping |
| `mapping.product` | provider ID ↔ mapped tuple | Provider sellable product joining unit type, rate plan, and provider conditions |
| `inventory.stay_date` | property-local ISO date | Night whose inventory/rate/restriction is described |
| `inventory.available_units` | integer units | Count offered for the mapped unit type; never a cache-derived Yellow sellability decision |
| `inventory.sell_state` | enum | `open`, `closed`, or `unknown` for the stay date and mapped scope |
| `restriction.arrival_state` | enum | `open`, `closed`, or `unknown` for check-in on the local date |
| `restriction.departure_state` | enum | `open`, `closed`, or `unknown` for check-out on the local date |
| `restriction.min_los_arrival_nights` | positive integer nights | Minimum stay selected by arrival date |
| `restriction.max_los_arrival_nights` | positive integer nights | Maximum stay selected by arrival date |
| `restriction.min_los_through_nights` | positive integer nights | Minimum stay when the stay includes the restricted date |
| `restriction.max_los_through_nights` | positive integer nights | Maximum stay when the stay includes the restricted date |
| `restriction.exact_los_nights` | positive integer nights | Exact permitted stay length for an arrival date |
| `restriction.min_advance` | integer plus unit | Minimum interval from booking instant to property-local arrival |
| `restriction.max_advance` | integer plus unit | Furthest bookable arrival interval/window |
| `restriction.turnover_buffer` | before/after integer nights | Calendar nights blocked around a reservation for preparation; not a confirmed stay |
| `price.currency` | ISO 4217 code | Currency for every monetary value in the mapped price/fee group |
| `price.amount_minor` | bigint minor units | Absolute sell price for the exact mapped date/product/basis |
| `price.basis` | enum | `per_unit_per_night`, `per_occupancy_per_night`, `per_stay`, or an explicit provider extension |
| `price.occupancy` | positive integer persons | Occupancy tier to which the price applies; adult/child meaning stays separately mapped |
| `price.los_nights` | positive integer nights | Length-of-stay tier to which the price applies |
| `price.base_amount_minor` | bigint minor units | Explicit base used by a provider pricing model; not Yellow's final sell price |
| `price.adjustment` | tagged value | `amount_minor` or `basis_points` relative to an identified base |
| `price.tax_inclusion` | enum | `inclusive`, `exclusive`, or `unknown`; never guessed from display |
| `fee.kind` | versioned enum | Cleaning, pet, extra guest, resort, linen, management, community, or provider extension |
| `fee.amount_minor` | bigint minor units | Fee amount in `price.currency` |
| `fee.charge_basis` | enum | Per booking, night, guest, pet, guest-night, pet-night, or explicit provider extension |
| `fee.threshold_guest_count` | non-negative integer persons | Guests included before an extra-guest fee begins |
| `guest.adults` | non-negative integer persons | Adult search/booked count at the provider-defined boundary |
| `guest.child_ages` | ordered integer years | Exact ages supplied for a reservation/search; absence is not an empty list |
| `guest.child_age_bands` | ordered half-open ranges | Configuration bands `[min_age, max_age_exclusive)` plus provider band ID and version |
| `reservation.remote_id` | opaque string | Provider reservation identity, namespaced by provider and property |
| `reservation.revision` | opaque string | Provider lifecycle/version identity used for deduplication and ordering |
| `reservation.state` | enum | Provider-mapped requested, confirmed, modified, cancelled, or unknown lifecycle state |
| `reservation.stay` | local-date half-open interval | Arrival inclusive, departure exclusive, with property timezone retained |
| `reservation.booking_mode` | enum | `instant`, `request`, or `unknown`; not derived from confirmation state |
| `rms.recommended_amount_minor` | bigint minor units | Date-level RMS recommendation, never a published rate |
| `rms.floor_minor` | bigint minor units | Recommendation floor/guardrail with its override precedence version |
| `rms.base_minor` | bigint minor units | RMS baseline around which dated recommendations are calculated |
| `rms.ceiling_minor` | bigint minor units | Recommendation ceiling/guardrail with its override precedence version |
| `rms.recommended_min_los_nights` | positive integer nights | RMS minimum-stay recommendation for the date |
| `rms.factor` | named decimal/basis-points contribution | Versioned reason component such as seasonality, pace, orphan gap, or custom rule |
| `rms.override` | tagged value plus scope | Fixed/relative dated override and whether it belongs to listing, group, or account |
| `rms.sync_enabled` | boolean with observed instant | Provider publication toggle; `false` recommendation data cannot imply remote application |

## Representation rules

| Concern | Canonical rule |
| --- | --- |
| Money | Parse provider decimal strings with the currency exponent into `bigint` minor units. Never use binary float. Preserve the provider lexical value only in safe, contract-permitted evidence. |
| Dates | ARI and stay dates are property-local ISO dates. Instants are UTC and retain the source timezone. A date and an instant are never interchangeable. |
| Duration | Preserve both value and unit. `48 hours`, `2 days`, and `2 nights before/after` are not silently equivalent. LOS is integer nights. |
| Percent | Canonical relative adjustments use signed integer basis points. The mapped record retains whether the provider applies the adjustment before or after another rule. |
| Age bands | Canonical ranges are half-open. A provider inclusive maximum `17` maps to exclusive `18` only with a recorded transform. Exact reservation ages and configured price bands remain separate. |
| Cardinality | Store the provider cardinality and scope with each mapping. One property can have many unit/rate/product mappings; one product must not be assumed to equal one Yellow rate plan. |
| Unknown | `unknown` differs from `null`, unbounded, zero, false, empty, and unsupported. Missing fields never receive provider defaults unless the exact schema version documents that default. |
| Safe evidence | Retain IDs, revisions, hashes, safe enums, mapping decisions, and redacted errors. Do not retain raw payloads containing guest, payment, identity, message, or credential data. |

## Mapping quality and lifecycle

Every directional field mapping records:

`provider + contract_version + schema_version + capability_version + endpoint/event +
canonical_key + provider_path + direction + provider_unit + provider_cardinality +
transform_version + quality + unknown_policy + verified_at`.

`quality` is one of:

- `exact` — same semantic value and scope;
- `transform` — lossless conversion with a named version, such as inclusive to
  half-open age range;
- `lossy` — usable only after explicit operator acceptance, with discarded meaning
  listed;
- `provider_only` — retained as a namespaced extension and not forced into a canonical
  key;
- `unsupported` — the provider or granted scope explicitly cannot carry it;
- `unknown_until_contract` — public evidence is insufficient.

A lossy mapping never publishes automatically. An unknown enum is stored as an opaque
provider extension, surfaces a mapping exception, and cannot fall through to a default.
Provider enum additions, unit changes, cardinality changes, feature-flag changes, or
scope changes create a new capability/mapping version; they do not mutate old evidence.

## Provider depth

### Booking.com Connectivity

| Canonical keys | Provider depth and mapping requirement |
| --- | --- |
| `mapping.unit_type`, `mapping.rate_plan`, `mapping.product` | A Booking.com roomrate is a room-type + rate-plan + conditions product. Retain all three IDs. Inventory count belongs to room type, while price/restrictions can belong to roomrate. Flattening roomrate to rate plan is lossy. |
| `price.*` | Version the active pricing type: Standard, RLO/derived, OBP, or LOS. Standard has maximum/single-occupancy behavior; RLO carries relative occupancy offsets; OBP carries absolute occupancy prices; LOS adds occupancy × stay-length depth. OBP and LOS require capability/certification evidence. |
| `restriction.*` | Preserve on-arrival versus stay-through LOS and independent closed/CTA/CTD values. The provider warns overlapping restrictions may make inventory unavailable without a validation error, so Yellow must show conflicts rather than collapse them into `closed`. |
| `guest.child_age_bands`, `guest.child_ages` | Flexible child pricing uses property-level, ordered, non-overlapping inclusive age buckets, currently up to three in the cited API. Preserve bucket IDs and feature version. Convert inclusive maxima through a named transform; do not reuse bands as reservation ages. |
| All fields | Record endpoint family (B.XML/OTA/modular), feature flags, pricing-type certification, property currency, and deprecation/version status. A supported concept can still be unavailable for a specific connection. |

Official evidence: [pricing types, resources, and restrictions](https://developers.booking.com/connectivity/docs/understanding-pricing-types) and [children policy and age-bucket cardinality](https://developers.booking.com/connectivity/docs/flexible-children-rates/managing-a-children-policy).

### Airbnb software-connected listings

| Canonical keys | Provider depth and mapping requirement |
| --- | --- |
| `connection.sync_mode`, `connection.field_owner` | Distinguish `full` from `pricing_availability`. Under pricing-and-availability sync, listing content and booking settings may remain Airbnb-owned and hosts may override several fields. Capture last-authoritative source/revision; never overwrite an Airbnb-owned field because the listing is merely “connected.” |
| `restriction.min_los_arrival_nights`, `restriction.max_los_arrival_nights`, `restriction.min_advance`, `restriction.max_advance`, `restriction.turnover_buffer`, `restriction.arrival_state`, `restriction.departure_state` | Host-facing settings include arrival-based/custom trip length, same-day cutoff or advance notice, availability window, preparation nights, and disallowed check-in/out weekdays. Preserve their distinct units and provider ownership. Exact partner paths/cardinality remain `unknown_until_contract`. |
| `fee.*` | Cleaning is per booking, with a separate short-stay option; extra guest is per additional guest beyond a threshold; pet fees may be per booking, pet, night, or pet-night. Professional-host fees are provider extensions until the granted API defines writable shape. Never collapse these to a nightly room price. |
| `reservation.booking_mode` | Instant Book and request-to-book are distinct. Exact API event/state mapping requires the granted Airbnb program schema and cannot be inferred from help-centre labels. |
| All fields | Pin API Program scope, partner schema/version, sync mode, provider field ownership, and override provenance. Public help is product evidence, not a complete supply API contract. |

Official evidence: [software sync ownership](https://www.airbnb.com/help/article/2348), [availability and restriction units](https://www.airbnb.com/resources/hosting-homes/a/updating-your-availability-708), and [fee kinds and charge bases](https://www.airbnb.com/help/article/2385).

### PriceLabs RMS

| Canonical keys | Provider depth and mapping requirement |
| --- | --- |
| `mapping.property`, `mapping.unit_type` | Map an RMS listing to the exact Yellow sellable scope and currency. This mapping does not grant reservation or inventory authority. |
| `rms.recommended_amount_minor`, `rms.floor_minor`, `rms.base_minor`, `rms.ceiling_minor` | Preserve the recommendation, guardrails, and their effective dates separately. Fixed dated overrides and final offsets can supersede normal floor/ceiling behavior, so precedence needs a version rather than an assumed clamp. |
| `rms.recommended_min_los_nights`, `rms.factor`, `rms.override` | Preserve listing/group/account scope and the named minimum-stay rule/priority, including orphan, adjacent, date-specific, far-out, last-minute, and default logic when exposed. A final minimum stay without its scope/version is lossy evidence. |
| `rms.sync_enabled` | Recommendation review and publication are separate states. A listing import or visible recommendation does not mean synchronization is enabled or a value reached the OTA/PMS. Publication needs explicit authority and provider read-back. |
| OTA reservation/inventory keys | `unsupported` for PriceLabs unless a separately contracted non-RMS product proves otherwise. Never route bookings, guest data, or occupancy decisions through the RMS adapter. |

Official evidence: [minimum/base/maximum price semantics and override caveats](https://help.pricelabs.co/portal/en/kb/articles/what-are-minimum-base-and-maximum-prices-how-to-set-them-up), [minimum-stay rule depth](https://help.pricelabs.co/portal/en/kb/articles/understanding-min-nights), and [review versus enabled synchronization](https://help.pricelabs.co/portal/en/kb/articles/how-often-are-my-rates-sycned-to-my-pms-and-how-does-sync-now-work).

## Cross-provider examples

| Canonical key | Booking.com | Airbnb | PriceLabs | Mapping quality |
| --- | --- | --- | --- | --- |
| `mapping.product` | Explicit roomrate identity | Exact partner product shape unknown publicly | Not an OTA product | Booking exact; Airbnb `unknown_until_contract`; PriceLabs unsupported |
| `inventory.available_units` | Room-type inventory | Pricing/availability sync concept; wire shape gated | Not authoritative | Provider-scoped; never merged into Yellow truth without normal occupancy commands |
| `price.occupancy` | Standard/RLO/OBP/LOS semantics | Public partner cardinality unknown | Recommendation may be listing/date level | No cross-provider default; capability-specific |
| `restriction.min_los_arrival_nights` | Arrival restriction | Trip-length setting | RMS recommendation/rule | Same unit can have different authority; preserve source namespace |
| `guest.child_age_bands` | Up to three cited property buckets with inclusive maxima | Public partner schema unknown | Not a guest-policy authority | Transform only for Booking.com; otherwise unknown/unsupported |
| `fee.charge_basis` | Endpoint/version-specific charge rules | Multiple documented bases by fee kind | Not an OTA fee authority | Never coerce to one nightly amount |
| `connection.field_owner` | Determined by endpoint/granted capability | Essential under full versus pricing/availability sync | Recommendation versus publish authority | Must be explicit per field |
| `rms.recommended_amount_minor` | Not an OTA field | Not an OTA field | Date-level recommendation | Namespaced RMS-only value; publication creates separate evidence |

## Explicit coverage gaps

The following families are deliberately not normalized by this first dictionary.
They remain planned research with provider paths, units, enums, ownership,
cardinality, localization, versioning, and lossiness all `unknown_until_contract`.
No implementation may treat their absence here as unsupported provider capability.

| Uncatalogued family | Required future depth |
| --- | --- |
| Amenities and features | Property-, unit-, room-, and accessibility-feature catalogues; provider IDs; boolean versus counted values; paid/included state; inheritance; effective dates; and unknown codes |
| Location and geography | Postal address, locality/admin hierarchy, latitude/longitude precision, geocoding source, entrance/access instructions, landmarks, privacy/redaction, and provider display-versus-routing coordinates |
| Accessibility | Accessible entrances/routes, lift, parking, room/bath features, measurement units, assistance-animal policy, verified-versus-self-reported evidence, and guest-visible wording |
| Unit composition and capacity | Unit/room type, quantity, bedroom/bathroom counts, bed types and counts, shared/private semantics, maximum total/adult/child/infant/pet occupancy, and whether infants/pets consume capacity |
| Descriptions, photos, and localization | Field locale, source language, translated variants, length/markup limits, captions, media order, crop/aspect metadata, rights, moderation state, content ownership, and partial-update behavior |
| Cancellation and guarantee | Cancellation windows, timezone anchor, penalty unit/amount, no-show and early-departure rules, guarantee type, precedence, effective dates, and reservation-time policy snapshot |
| Payment, deposit, tax, and refund | Property/channel collect, safe token/VCC metadata only, deposit schedule, due events, tax/fee inclusion and jurisdiction, payout/reconciliation references, refund eligibility/status, and explicit prohibition on PAN/CVV |
| Messaging and reviews | Conversation/thread/message IDs, direction, channel, sender role, attachments, delivery/read state, reply windows, moderation, review/rating dimensions, PII allowlist, retention, and supported actions |
| Promotions and merchandising | Promotion identity/type, audience, eligibility, stacking/precedence, booking/stay windows, discount unit, mobile/member/geo targeting, badges, sponsored state, and provider approval |
| Channel availability metadata | Sell horizon, allotment, stop-sell reason, booking window, request/instant eligibility, closed source, last accepted update, rejected cells, stale horizon, read-back state, provider overbooking behavior, and reconciliation watermark |

Future expansion must add each semantic key once to the canonical dictionary and then
map providers to it. Provider-only values remain namespaced extensions; ambiguous or
lossy transforms stop publication until reviewed.

## Required evidence before implementation

For each provider and direction, obtain and pin:

1. Applicable partner contract, granted property/account scope, schema/API version,
   endpoint family, feature flags, certification, rate limits, and test environment.
2. Complete field list with enums, defaults, nullability, units, currency exponent,
   cardinality, ownership, update mode, acknowledgement, replay, and read-back behavior.
3. A reviewed mapping ledger using the quality states above, including hostile unknown
   enums, partial responses, overlapping restrictions, stale revisions, and lossy
   rejection.
4. Tokenized/safe payment boundaries and a redacted evidence allowlist. PAN/CVV and raw
   sensitive provider payloads remain prohibited.
5. Real provider sandbox round trips proving create/update/read-back or an explicit
   unsupported result. UI examples and public help pages alone cannot satisfy this.

Runtime tables, migrations, adapters, reconciliation workers, provider activation,
and external writes belong to future distribution orders.

## Official source register

Exactly eight primary provider sources were checked for this proposal:

1. Booking.com, [Understanding pricing types](https://developers.booking.com/connectivity/docs/understanding-pricing-types).
2. Booking.com, [Managing a children policy](https://developers.booking.com/connectivity/docs/flexible-children-rates/managing-a-children-policy).
3. Airbnb, [Software-connected listing sync choices](https://www.airbnb.com/help/article/2348).
4. Airbnb, [Updating availability](https://www.airbnb.com/resources/hosting-homes/a/updating-your-availability-708).
5. Airbnb, [Additional fees for home listings](https://www.airbnb.com/help/article/2385).
6. PriceLabs, [Minimum, base, and maximum prices](https://help.pricelabs.co/portal/en/kb/articles/what-are-minimum-base-and-maximum-prices-how-to-set-them-up).
7. PriceLabs, [Minimum-stay settings](https://help.pricelabs.co/portal/en/kb/articles/understanding-min-nights).
8. PriceLabs, [Synchronization behavior](https://help.pricelabs.co/portal/en/kb/articles/how-often-are-my-rates-sycned-to-my-pms-and-how-does-sync-now-work).
