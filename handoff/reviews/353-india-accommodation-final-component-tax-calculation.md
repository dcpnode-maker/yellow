# Order 353 fresh independent Tier-3 review

**Disposition:** WITHHOLD  
**Candidate:** `15a1a06`; governance `1adc277`  
**Reviewer:** `/root/order350_builder`, independent and non-implementing

## P1 — caller-authored taxable value

`IndiaGstAccommodationFinalComponentTaxService.calculate()` does not read the
persisted Order350 final valuation or its room-night rows. It accepts valuation id,
generation, disposition, total, evidence hash, a `replayed: true` literal and every
room-night value from the caller. Its only database read is the unrelated Order341
quoted-rate replay. Internally consistent caller values therefore produce
authoritative-looking tax and a new evidence hash without any matching current
valuation row. Nonexistent, superseded, foreign-property/tenant and manual valuation
state is not independently rejected by PostgreSQL.

This violates the server-authoritative final-valuation, stale, tenant and bounded
PostgreSQL proof contract. The focused suite tests internally consistent caller
objects only and contains no PostgreSQL valuation-table proof.

## Reviewer evidence

- Order353 plus approved Order310/337/340/341 suites: `30/0`, 947 assertions.
- Import boundaries: 139 files, green.
- Source inspection: no query/reference to
  `india_gst_accommodation_final_valuation` or
  `india_gst_accommodation_valuation_room_night`; only the Order341 resolver runs.
- Broader catalogue/referee gates stopped after decisive authority failure because
  they cannot make caller-authored statutory value safe.

The disposable checkout was removed; no PostgreSQL/container/local resource was
created or changed.

## Required repair

Within the tenant transaction, select exactly one current ordinary-final Order350
head for the exact property/reservation/folio and its complete ordered room nights.
Derive id, generation, disposition, values, currency and evidence hashes from those
rows; reject missing, duplicate, superseded, manual, foreign or incomplete evidence.
Remove caller authority over those facts. Add real PostgreSQL hostility and zero-write
proof, then require a different fresh Tier-3 complete review.

No tax calculation, posting, document, IRP, UI or Phase7 approval is granted.
