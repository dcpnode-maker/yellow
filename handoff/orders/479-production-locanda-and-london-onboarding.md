# Order 479 — Production Locanda and London property onboarding

## Objective

Onboard Locanda Homes (STR) and the identified London hotel as separate
production properties only from authorized channel exports or contracted
provider connections, with source provenance, reconciliation and privacy
controls before any operational reservation is created.

## Preconditions

- A private, non-public Yellow production tenant and audited operator access are
  provisioned; the anonymous synthetic showcase is never used.
- The founder supplies a written authorization plus a secure local intake path
  for each export or a provider-owned connection authorization. Credentials and
  raw guest records are never pasted into chat.
- Each source is enumerated with export time range, property/listing identity,
  owner, permitted purpose and data-retention terms.
- PriceLabs material is classified independently: rates/calendar/market data is
  not assumed to be a reservation or a guest identity source.

## Source mapping

| Source | Intended use | Required validation |
| --- | --- | --- |
| info.saudi Host | Locanda property/listing and reservation export | authorized account export, property-to-listing mapping |
| Airbnb, Booking.com, Agoda | inbound reservation/channel provenance | approved export or certified connection, immutable external reference and replay rules |
| PriceLabs | pricing/calendar/market evidence | authorized archive, explicit property mapping, no assumption of guest data |
| Lighthouse | London hotel market/compset evidence | approved export and property mapping; market data must not fabricate guest reservations |

## Required controls

- Stage source bytes in the isolated intake boundary first; preserve hashes,
  source metadata and import receipt before parsing.
- Map channels and properties explicitly. Do not infer rooms, rates, taxes,
  occupancy, cancellation status or contract terms from a listing title.
- Create/update canonical Party, Reservation, rate and channel records only
  through their existing governed services. Never directly mutate occupancy or
  journals.
- Exclude payment credentials, passport/identity document images and unnecessary
  contact fields. Hash or mask data in operational previews, logs and assistant
  prompts; enforce tenant RLS and an import audit trail.
- Dry-run with exact row counts, duplicate/conflict report, field completeness
  and financial/occupancy reconciliation. A separately authorized cutover is
  required before a write.

## Exclusions

- No scraping, portal login, credential storage, public-link exposure, real-data
  use in the anonymous demo, direct database import, or automated OTA action.
- No fabricated guest identities presented as sourced channel data.

## Independent review

Because this may create production reservations, parties, occupancy and financial
effects, an independent non-implementing reviewer must execute the dry-run,
reconciliation and target-tenant/RLS proof before any production write.
