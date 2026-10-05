# Order722 — deliver real PriceLabs market exports

25 September 2026. Founder priority: deliver usable market data rather than stop
at tooling/research milestones. Order719's normal export has now produced actual
Abu Dhabi dashboard187188 listing and future-price CSVs. This order packages and
validates those exact files, without claiming Dubai/full-market global coverage.

## Scope

- This order; handoff/receipts/722-market-data.md;
  handoff/reviews/722-market-data.md; handoff/questions/722.md;
  docs/research/PRICELABS-EXPORT-SCHEMA-20260925.md;
  docs/PROJECT-STATUS.md; handoff/LEDGER.md.
- scripts/research/pricelabs-dashboard-export.ts (new offline validator/packager)
  and tests/order722-pricelabs-dashboard-export.test.ts.
- Read/reuse the existing parsePriceLabsCsv implementation; do not alter it.
- Read exact ordinary UI downloads from C:/Users/astha/Downloads, copy unchanged
  files and derive small CSV/JSON/README artifacts only under
  D:/Yellow/temp/pricelabs-authorized-exports-20260925/.
- Ordinary existing dashboard UI CSV export/DOM verification (719), no hidden
  endpoints, account changes, purchased credits, OAuth or automated scraping.
- Upload verified files to the user's Google Drive only after their answer
  selects one of the two connected accounts; keep default private permissions.
  No public redistribution. Do not commit provider rows or credentials into Git.

## Requirements and gates

- Listing IDs remain strings (many exceed JS safe integers). Raw files immutable;
  SHA256/bytes/rows and exact columns recorded, CSV quoted-newline support retained.
- Explicit market Abu Dhabi, source dashboard187188, AED, source refreshed
  25September2026 02:12AM (UI timezone unspecified), actual acquisition timestamp.
- Coordinate bounds, duplicates, nulls and malformed values checked; coordinates
  explicitly approximate, not verified property entrance/rooftop pins.
- Future-price percentiles are regional advertised nightly rates excluding fees,
  never listing calendars, confirmed availability, or transaction prices.
- Extract October2026 only from rows present, preserving date/series meanings;
  no interpolation, invented zero, or attribution to individual listings.
- Deterministic CLI, bounded input sizes/rows; no HTTP/DB/worker side effects.
  Existing output files must not silently overwrite.
- Tests use synthetic rows only and exercise long IDs, hostile CSV/text, nulls,
  duplicates, dates, coordinate bounds and October completeness. A nonimplementer
  personally checks actual files/counts and executes focused tests.
- No hotel DB, public bundle, deployment, Martin installation, Overture data,
  financial commands or worldwide coverage claims.

Completion here means a verified downloadable data package with honest scope.
Dubai listings, all October per-listing quotes, ingestion into Yellow's live map
and the wider ecosystem remain separate unfinished work.

## Outcome — 25 September 2026

Local data package complete and independently verified (receipt/review722):
2,528 Abu Dhabi listings, original daily regional price/occupancy exports, and
31-day October price extraction. Private ZIP is 282075 bytes; original and derived
member hashes verified. Root final suite26pass/6platformskips/0fail; independent
final focused7pass/48assertions plus full typecheck. Optional Drive upload awaits
the user's account choice at the local handoff. Subsequent founder selection of
ankitg.owa@gmail.com completed private Drive upload/readback; see receipt722 for
exact IDs, links, ownership and size verification. No app/map deployment here.
