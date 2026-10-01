# Invitation-bound guest booking contract

Input: reviewed backend444072. Laptop owns restored shell/auth/public hosting.
No anonymous storefront, new guest account, external payment or provider claim.

Staff POST `/api/v1/properties/:property/booking-invitations` with an
Idempotency-Key and exact JSON `{primaryPartyId, channelCode, ratePlanIds}`.
The active Party must already exist; at most16 distinct active property rate
plans. All five issuer permissions are live-property checked: availability read,
rates configuration read, holds write, reservation booking write, parties read.
Issuance returns an expiring bearer only to that authenticated caller; delivery
is outside this order. The raw bearer is neither stored nor placed in a URL.

Public POST `/api/public/booking/offers` takes exact
`{stayStart,stayEnd,adults,childAges}`. POST `/quotes` adds
`sellableUnitId,ratePlanId`. Dates use canonical ISO UTC instants; local nights
are still determined by the canonical property-timezone services. Stay <=366
days; adults1..99, <=30 child ages0..17. Channel, property, Party and allowlist
are always invitation derived. No guest-supplied commercial override/promotions.

The quoted response preserves canonical full bigint-as-decimal quote evidence,
including tax state and explicit pre-tax basis; it includes a purpose-bound
quoteToken expiring within5 minutes/session. POST `/holds` takes only
`{quoteToken}` and creates at most one exact hold choice per session. A canonical
fresh quote under the rate publication lock must retain the selected financial,
policy and release terms. Complete calculated tax attribution is required by
existing QuotedTaxHoldBindingService. Response supplies actual hold expiry and
purpose-bound holdToken, with no payment/confirmation claim.

POST `/reservations` takes only `{holdToken}`. One exact commit per invitation
is enforced through a server-derived, session-specific canonical command key;
caller keys cannot make another booking. Quote/hold tokens must match the exact
session; commit never accepts guest Party/property/channel/rate/unit/hold IDs.
Active release and rate-plan policy terms are rechecked, then existing commitHeld
arbitrates the active unexpired hold, occupancy, reservation, tax lineage and
events in one transaction. Exact retry returns canonical result; altered request
conflicts. Expired tokens do not regain authority through replay.

The existing24-hour idempotency retention exceeds sessionTTL15 minutes. This
uses command replay/conflict storage, not a new capability ledger. Issuer
deactivation or required grant revocation invalidates invitations on the next
command. Individual invitation revocation is not available in this schema-free
slice. No new staff/guest permissions are minted into an ordinary API token.

Additional audit events, emitted with their facts in the command transaction:

| Event | Aggregate | Nonsecret evidence |
| --- | --- | --- |
| guest_booking.invitation_issued | party | sessionId, issuer, property, Party, channel, allowlist, expiry |
| guest_booking.hold_accepted | hold | sessionId, bound Party, canonical hold/binding IDs, terms fingerprint |
| guest_booking.reservation_confirmed | reservation | sessionId, bound Party, canonical reservation/hold IDs |

`actorId` is the live staff issuer whose narrowly delegated authority enabled the
operation; sessionId/Party evidence attributes the guest invitation. Existing
canonical hold/tax/reservation events remain authoritative. Bearers, HMAC keys,
raw provider payloads, PAN/CVV and guest contact details are absent from events.

Requests are bounded UTF8 JSON/no query drift. Guest tokens use distinct purpose
and derived signing domain, expire strictly, cannot authorize staff routes and
are verified before selecting a tenant transaction. Every operation rechecks
live issuer permissions and locks authority rows until settlement. Responses
are no-store; generic errors contain no raw database/token evidence. Authentication
and guest-specific response budgets must be enforced before a response containing
data or a mutation is committed. No cross-origin wildcard/autologin is introduced.

Forward migration0104 adds only the owner assertion. Its schema-qualified fixed
permission checks lock tenant/actor/membership/role/grants/property/active Party,
and optionally the selected plan/policies. Runtime table privileges are unchanged.
Clock expiry is checked after blocking I/O and immediately before command return.
New holds retain the canonical600-second duration; a session with less than600
seconds remaining must be renewed before creating a hold. No canonical duration
or tax eligibility gate is weakened.
