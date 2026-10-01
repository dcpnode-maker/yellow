# Explicitly published property booking

Source basis: reviewed invitation/context7b64ede37a4ded1ffe2e77295f2d3e95b30442be.
Status: independently reviewed private backend candidate; canonical migration0105
admitted/proved ONLY in owned disposable databases, strict schema and11/11 green.
Laptop route/UI integration and public feature acceptance remain pending.

## Files and controller boundaries

New identity/public-booking-site.ts, reservations/public-booking.ts and
http/public-booking.ts, their context index exports, token-purpose extension and
focused tests. CanonicalSQL migrations/0105_public_booking_site.sql; controller reserved0105
solely for this capability. Original reviewed proposal retained at
handoff/proposals/BOOKING-20261002-public-site-authority.sql. Migration0104
is immutable. App/server composition is delivered separately for narrow laptop
integration against its current authenticated/restored source; no frontend edits.

## Staff publication

Proposed POST /api/v1/properties/:property/booking-site under the EXISTING operator
identity/tenant transaction. Exact body:
`{expectedVersion,active,ratePlanIds,channelCode}`. Six live property permissions:
inventory.availability:read, rates.configuration:read, inventory.holds:write,
reservations.booking:write, crm.parties:read, crm.parties:write. Never auto-grant.

The SQL command locks the property before current issuer/grant validation and
uses optimistic versioning. One opaque site UUID per property; each publish or
withdraw increments version, retains unrelated configuration, and writes its
fact/outbox atomically. Raw runtime changes to the reserved configuration key
are denied. Active publication requires 1–16 active property plans; withdrawal
can deactivate a site even if a formerly allowed plan was deactivated.

Safe staff reply: `{siteId,version,active,channelCode,ratePlanIds}`. No publisher,
tenant or guest profile metadata. Guest publishing is impossible.

## Anonymous entry and commands

Proposed POST /api/public/booking/sites/:site/sessions accepts exact `{}`. This
opaque published site ID is the only unauthenticated routing capability. A narrow
runtime-directory function resolves only active, explicitly published properties;
unpublished IDs return generic 404. The resolved tenant is then checked again in
its normal tenant transaction under live publication and all publisher grants
before issuing a short public-session token and authoritative property
`{id,name,timeZone}`. No global property browse or raw directory response.

Bearer commands under /api/public/booking/storefront/:

| POST suffix | Exact request | Reply |
|---|---|---|
| offers | stayStart, stayEnd, adults, childAges | Canonical full offer evidence |
| quotes | same + sellableUnitId, ratePlanId | quote, quoteToken, expiresAt, paymentAccepted:false |
| holds | quoteToken | hold, holdToken, expiresAt, replayed |
| details | holdToken, displayName, email, phone | detailsToken, expiresAt, replayed |
| reservations | holdToken, detailsToken | reservation, replayed, paymentAccepted:false |

Stay instants remain exact canonical UTC ISO strings; use the returned property
IANA timezone to construct local stay choices. Property check-in/out clock values
are not established in this bounded schema and are not guessed. offers provides
canonical unit/type/plan display names. New profiles require at least one email
or phone; unused contact is null. Existing profiles are NEVER adopted from
self-asserted contacts. The canonical duplicate-review gate returns only generic
booking/guest_review_required without candidate identities or contact hints;
staff-assisted approved identity resolution remains necessary for repeat/duplicate
profiles. No Party is created while shopping, quoting or holding.

Tokens are distinct public-session/public-quote/public-hold/public-details HMAC
purposes. They cannot authorize invitation/staff routes. Sessions last at most900s;
quotes at most300s; canonical quoted tax holds are exactly600s and require enough
session lifetime. Signed envelope expiry and payload/session deadlines all bind
commands after I/O. Session-derived command keys enforce exact retries and reject
changed choices; details/hold/session identities must all match before commit.

## Authority and money

Every command rechecks active site/version/issuer/current grants and keeps the
property, issuer and grant locks through settlement. Withdrawal, publication
revision and revoked staff authority invalidate prior sessions. Canonical offer,
rate quote/publication/policy, complete tax binding, holds, PartyProfileService,
ReservationCommitService, occupancy choke points, facts and outbox remain sole
operational writers. The existing0104 authority additionally locks the actual
new Party before reservation commit. No new inventory arithmetic, guest role,
raw guest DB writes, money engine, payment/PAN/provider activation or business data.

All routes require JSON, reject any query marker and foreign/null supplied Origin,
use no-store, bound request/response sizes, and maintain finite30/min per-site or
session request budgets with4096 live entries. These process-local initial budgets
are not a claim of distributed abuse protection or throughput at portfolio scale.

Real PostgreSQL proof uses ONLY owned synthetic databases. Controlled availability,
publication and tax-jurisdiction fixture ports are not provider or production proof.
Laptop owns mounted routes, guest page, acceptance, dataset, hosting and recovery.
