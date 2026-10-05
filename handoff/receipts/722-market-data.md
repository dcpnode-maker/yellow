# Order722 — real market-data delivery

## Actual retrieval (root, 25 September 2026)

Authorized PriceLabs dashboard187188 was opened from the previously visited URL
through the ordinary signed-in browser. Its View Compset Listings, Future Prices
and Future Occupancy Download CSV controls produced files in Windows Downloads.
The browser download-event waiter timed out; that was NOT treated as the final
filesystem result. Root checked creation times, bytes, headers, counts and hashes,
and matched the first listing records to the visible table.

Package root: D:/Yellow/temp/pricelabs-authorized-exports-20260925/.
Original CSVs were copied byte-for-byte, not reconstructed from browser text.

| Original | Bytes | SHA256 |
|---|---:|---|
| abudhabi-listings-20260925-original.csv |396315|03994f1526595832fc2f2db0f16b1df40fc654854713e1d683574cbf03e70130|
| abudhabi-prices-20260925-original.csv |54140|1a358d0aa18c12fd58f061cb184fbebc841c1681147a2e2fa285efa2410f1ac8|
| abudhabi-occupancy-20260925-original.csv |53864|5476291e4a0b0cef9e60e901aea22d121f796c01e96ea07851ee5e756c409a91|

Listing export:2528 rows/14 columns. Prices:1114 daily rows,2024-09-01 through
2027-09-19, including all31 October2026 dates. Market: Abu Dhabi, UAE, Airbnb
Whole Market, AED. UI refresh25September02:12AM; timezone unspecified. Long IDs
remain strings. Coordinates are approximate. Listing average Price is not an
October quote; daily percentiles are regional nightly rates excluding fees.
Median booked prices/occupancy are estimates, not confirmed transactions.

Root restricted ONLY the newly created exact non-reparse export directory to
current user,SYSTEM,Administrators, and verified inherited CSV ACLs. No broad
drive/user-directory ACL change or original Downloads change occurred.

## Dubai access check (read-only)

Existing inventory including Show Archived contains only Abu Dhabi. Add Dashboard
location preview shows Dubai, UAE,31,060 listings,$159.99/month. Root closed the
dialog without creating a report, consuming a credit or activating a subscription.
Drive destination account selection was requested before any upload.

## Verification status

Builder review709 prepared the offline validator/packager and synthetic tests.
Root initial focused plus adjacent importer/NTFS suite:24pass/6explicit skips/
0fail/176assertions. After strict UTC-date and nullable-percentile corrections,
root reran `bun test tests/order722-pricelabs-dashboard-export.test.ts
tests/pricelabs-import.test.ts tests/pricelabs-windows-intake.test.ts`:
26pass/6explicit platform skips/0fail/189assertions,19.64seconds. Final independent
proof is recorded separately in review722. No provider dataset rows or credentials
are in Git.

## Delivered local artifacts

CLI completed against the exact original listings/prices with acquisition
`2026-09-25T10:52:56Z` (price file16:22:56 Asia/Kolkata), producing:

- normalized/listings.normalized.json:2528 unique records,1385044bytes.
- normalized/october-2026-prices.json:31 actual dates,7886bytes.
- normalized/october-2026-prices.csv:31 actual dates,1662bytes.
- normalized/validation-report.json:2402bytes,zero missing October dates,
  zero reported outlier warnings. This is not a guarantee of source accuracy.

Readback preserved all2495 listing IDs exceeding JS safe-integer range as text.
Full regional price source has79 NA estimated median-booked values, preserved as
null. Root calculated daily October50th-percentile minimum705.8/maximum1589.8AED;
these are daily regional medians excluding fees, not individual min/max quotes.
Occupancy remains the unchanged1114-row original;722 does not normalize it.

ZIP: D:/Yellow/temp/pricelabs-authorized-exports-20260925/yellow-abudhabi-market-20260925.zip

- 282075bytes;8entries (3originals,README,4normalized files).
- SHA256:8370a435c400bd5c0d7c55f84efc02f85fe0b80c68e19abcc9f50cfd52421f69.
- No overwrite; root read back ZIP directory and inherited normalized-file ACLs,
  and compared all8 in-memory ZIP entry hashes against package files:0mismatches.
- Downloadable local delivery only; Drive upload awaits account selection.

Map-path audit by completion_queue709 confirms current market map is basemap-only,
market lab synthetic, research staging isolated. No operational observation store
or authorized private map read path exists. Subsequent integration needs a separate
order with dataset ownership/visibility, source rights and retention policy; do not
put these rows in frontend/public, a public tile endpoint or a compiled JS bundle.

## Independent final review

Nonimplementer guest_contract709 personally ran final focused proof7pass/0fail/
48assertions and `bun run typecheck` (`tsc --noEmit` plus the frontend project).
The reviewer independently checked all2528
listing IDs/source-row IDs and coordinates against raw rows (0mismatches), raw
hashes, normalized counts, the exact8 ZIP entries and their hashes, package
size/hash and private NTFS ACLs. Strict UTC-date and nullable-price findings were
fixed by builder review709, not by the reviewer, then re-executed. See review722.
Dataset delivery is complete locally; optional Drive upload remains unperformed
pending the founder's choice of connected account. Broader product and market
coverage limitations above remain; no inference of whole-ecosystem completion.

## Founder-selected Drive delivery — 25 September 2026

Founder selected ankitg.owa@gmail.com. Root used that explicit connected account
to create private folder `1Obe9leMBSn7YlF3Lt0Bgey7JKXPprWfM` and uploaded:

- ZIP `1Lew7IJ3ih-ElcdCLcgxnpyBpzkBj4hdB`,282075bytes.
- October CSV `1q7_EXq6CjnaDMQrborMEwBeZJ-Onf6Fo`,1662bytes.
- README `1rbDxbMT7T0HRT-b-niex2xpWgblIYaAi`,3814bytes.
- Direct map-import JSON `1MVcXQxcDIuMpFSyANISxM6g5V7gW0ahs`,1385044bytes.

Folder: https://drive.google.com/drive/folders/1Obe9leMBSn7YlF3Lt0Bgey7JKXPprWfM

Each upload completed, followed by separate metadata readback of exact ID, parent,
MIME type, size, owner ankitg.owa@gmail.com and `shared:false`. No permission change
or public sharing. The connector did not expose requested checksum fields, so
remote byte-for-byte rehash is NOT claimed; local original/ZIP hashes remain as
recorded above. Drive delivery is complete; prior pending-account notes are history.
User's claimed5TB quota was not independently inspected or changed.

## Not claimed

No hotel DB import, financial write, app replacement, public tunnel start, Martin
installation/benchmark, Overture download, API charge, OAuth grant or scraping.
Whole Dubai/global coverage, per-listing October calendars, map dataset integration
and wider ecosystem completion remain unfinished.
