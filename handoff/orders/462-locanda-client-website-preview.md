# Order 462 — Locanda Homes client website preview

## Objective

Provide a separate, mobile-responsive guest website preview for the Locanda Homes —
Jareed property. It is reached from Yellow only as a client website preview and
must never inherit operator-workspace styling or expose PMS data.

## Scope

- Add a property-specific preview control in Yellow’s operator header/property context.
- Serve an isolated public Locanda page with a blue-and-white client brand, a stay
  search interaction, home cards, Jareed location content and a non-authoritative
  booking enquiry confirmation state.
- Use only public Locanda positioning and publicly hosted media; no guest, rate,
  availability, login or PMS data crosses into the client page.
- Use an original travel-browsing interface. It may use familiar booking patterns,
  but must not copy third-party source code, trademarks or trade dress.
- Define the client-to-PMS contract for early check-in and late checkout requests:
  property-configured eligibility and price are authoritative; a request does not
  alter occupancy, room assignment or payment until the governed PMS confirmation.
- Define a future membership ledger boundary: eligible completed stays and explicitly
  configured ancillary products may accrue points; tier calculation, review policy,
  moderation, expiry, reversal and dispute handling need separate scoped authority
  before a live award, redemption or automatic tier action is exposed.
- Define reciprocal guest/property review records as moderated reputation signals.
  They are not an automatic source of pricing, inventory authority, payment action or
  financial posting.

## Exclusions

- No live booking, payments, OTA action, property publication, PII, PMS mutation,
  or claim of live availability.
- No loyalty points, tier change, review publication, payment collection, early
  check-in or late-checkout confirmation until their separate governed services and
  policy decisions are implemented and independently verified.

## Verification

- Static route returns the Locanda page independently of operator routes.
- Desktop and mobile browser rendering, accessible date/guest inputs, and a visible
  local-only enquiry state are proven before any readiness claim.
