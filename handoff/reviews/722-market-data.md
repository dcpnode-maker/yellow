# Order722 independent market-data review

Reviewer: `/root/guest_contract709`, independent of the Order722 packager. Review
was offline and aggregate-only; no full listing records or credentials were
printed, transmitted or committed. No source files, provider account, hotel DB,
or external destination were modified.

## Verdict

**Ready within reviewed scope.** The two-input normalizer preserves provider
missingness and long listing IDs, and the generated October series is complete
for the dates actually present in the source. The separate occupancy export is
included unchanged in the delivery ZIP, not normalized by the packager. This is
an internal Abu Dhabi market-data package, not a Dubai feed, bookable inventory,
listing-calendar dataset or confirmed transaction-price source.

## Independent source and package checks

Used PowerShell `Get-Item`, `Get-FileHash`, and `Import-Csv -LiteralPath` on the
three exact Downloads originals, treating CSV fields as strings and reporting
aggregate results only. Also invoked the exported pure preparation function on
the exact listing and price paths; this reads and validates inputs without
writing package files. Results:

- Listings: 2,528 rows, 14 exact source columns. `ListingID` and source-row `id`
  are each unique; normalized row order preserves both IDs and coordinates with
  0 mismatches. All listing IDs are strings; 2,495 exceed JavaScript's safe
  integer range. Coordinates are paired and globally valid in all rows, with
  source bounds approx. latitude 24.295–24.567 and longitude 54.318–54.724.
  Coordinates remain approximate. Source `Star Rating` is missing for 1,113
  rows and is retained as null.
- Prices: 1,114 unique, gap-free daily rows from 2024-09-01 to 2027-09-19.
  October 2026 has all 31 dates; no quantile-order violations were found. The
  source's estimated median-booked-price field has 79 `NA` values, preserved as
  null. Across October's 31 daily regional 50th-percentile prices, the range is
  AED 705.80–1,589.80; this is not a per-listing price range.
- Occupancy: 1,114 unique, gap-free daily rows over the same date span. Current
  market occupancy is numeric and 0–91.9; both prior-year comparison fields
  contain 364 `NA` values each. Values are provider-estimated market occupancy,
  not confirmed occupancy or availability for any individual listing.
- The three original copies match their Downloads source hashes. The normalized
  validator reports 2,528 listings, 1,114 price rows, 31 October rows, no
  missing October dates and no warnings. It records the original input hashes;
  observed acquisition time is `2026-09-25T10:52:56Z`, while the provider's
  refresh timezone is unspecified.
- Read the ZIP directory without extracting it: 8 expected entries (three raw
  CSVs, README, four normalized files). All 8 entry hashes match their local
  counterparts. ZIP size is 282,075 bytes; SHA-256 is
  `8370a435c400bd5c0d7c55f84efc02f85fe0b80c68e19abcc9f50cfd52421f69`.
- Read-only ACL audit found the export root protected and its normalized
  directory, ZIP and original copies restricted through current-user,
  SYSTEM and Administrators allow rules; no other allow principals were found.

## Packager review and corrections

I found that `Date.parse` accepts normalized impossible UTC dates such as
`2026-02-30T12:00:00Z`; the packager was corrected to validate Gregorian date
components and clock bounds. I also found that percentile fields typed as
nullable were parsed as required decimals; these now accept empty/`NA`/`-NA` as
null, with no zero substitution. Synthetic regressions cover both cases. The
actual source has no missing percentile values, so this did not block its
current package.

Personally executed:

```text
bun test tests/order722-pricelabs-dashboard-export.test.ts
7 pass, 0 fail, 48 assertions

bun run typecheck
passed (`tsc --noEmit && tsc --noEmit -p frontend/yellow/tsconfig.json`)

bun run boundaries
Import boundaries OK: 208 TypeScript files scanned

PowerShell: Import-Csv aggregate checks of all three exact source CSVs; Get-FileHash
on source/copy pairs; line-order raw-to-normalized ID/coordinate comparison;
read-only ZIP stream hashing (no extraction); Get-Acl on export root, normalized
directory, ZIP and raw copies.
All aggregate comparisons passed; ZIP had 8/8 entries matching local files.
```

No provider rows were imported into the hotel DB or uploaded to Drive. Drive
account selection remains pending, so this review approves only the private
local package, not an upload or external publication.
