# Order719 — existing PriceLabs market dashboard exports

Founder previously requested Abu Dhabi PriceLabs data and internal market/RMS
analysis. Existing signed-in dashboard187188 visibly exposes Abu Dhabi, UAE,
Whole Market, refreshed24September2026. Root may download its existing CSV exports
through ordinary UI and validate small files; no purchase, new market subscription,
new comp set, undocumented API, account change, or external data transmission.

## Scope

- This order; handoff/receipts/719-pricelabs-market-exports.md;
  handoff/reviews/719-market-export-validation.md;
  docs/research/PRICELABS-EXPORT-SCHEMA-20260925.md;
  docs/PROJECT-STATUS.md; handoff/LEDGER.md.
- Existing PriceLabs browser dashboard export controls, browser download folder
  discovery for the resulting files only, small copied/derived data artifacts in
  D:/Yellow/temp/pricelabs-authorized-exports-20260925/.
- No operational DB writes, schema/code changes, Drive upload or public release.

## Contract

Keep source files unchanged. Record exact source/dashboard/market/currency,
refresh time, export time, row count, SHA256, date range, columns, and missingness.
Extract October2026 only if present and identify regional percentiles separately
from listing-specific quotes. PriceLabs chart says nightly rates exclude fees;
do not label these all-inclusive prices or confirmed availability. The source's
active listing count is its definition, not independently verified operation.
No claim Abu Dhabi covers Dubai or that aggregate data are full listing calendars.
No private provider data/guest data sent to other models or committed into Git.
Metadata/schema documentation only in repo. Existing exports may be used for
founder-requested internal analysis, not republished as public listings.

Independent reviewer can validate the downloaded data locally without copying
full provider records into the review. If export requires a new paid entitlement,
stop and report the exact requirement rather than activate it.
