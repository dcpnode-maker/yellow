# Market-rate Python tools — Order 726

## What is delivered, and what is not

Python standard-library scripts live in `scripts/market-prototype/`:

- Existing `public_listing_collector.py`: listing metadata from reviewed public
  HTML/JSON-LD; unchanged by this order.
- `rate_fetch.py`: scoped, paced HTTPS fetches with robots checks, request/byte
  budgets, persistent host stops, temporary-error cooldowns and resume receipts.
- `rate_observations.py collect`: extracts attached Hotel/Accommodation JSON-LD
  offers into **undated price candidates**. This is not an OTA-specific DOM scraper
  or a universal Google calendar adapter. Javascript-only prices are not invented.
- `rate_observations.py import-quotes`: validates explicit permitted dated quote
  evidence offline and reports one-night coverage for a chosen month. This is an
  importer, not an independent verification of user-supplied evidence.

There is no CAPTCHA bypass, browser fingerprint spoofing, human imitation, proxy
rotation, account rotation, private/mobile API, authentication or paid provider.
The scripts do not connect to Yellow's database, upload to Drive, start a recurring
job, change a configured denial or publish anything. No full-market or active-listing
coverage is claimed. Keep the existing PriceLabs listing/market-average exports
separate from per-listing calendar quotes.

## Google Hotels: verified source boundary (25 September 2026)

[Google's robots.txt](https://www.google.com/robots.txt) denies `/travel/entity`,
`/travel/search`, `/hotelfinder/rpc` and `/hotels/rpc`. This is **not** a blanket
denial of `/travel/hotels`. The fetcher checks actual path and query restrictions,
never follows redirects, and stops at disallowed pages or challenges. A robots
allowance does not independently grant data reuse rights.

The [Hotel Prices API resource](https://developers.google.com/hotels/hotel-prices/api-reference/rest/v3/accounts.priceViews)
is `accounts/{account_id}/priceViews/{partnerHotelId}`. Its dated itineraries include
prices, taxes, fees and update times. [Authorization](https://developers.google.com/hotels/hotel-prices/dev-guide/api-auth)
requires the relevant Hotel Center account grant; it is not a public all-competitor
calendar endpoint. No authorized Hotel Center connection is configured by this order.

[Google Travel help](https://support.google.com/travel/answer/6276008?hl=en) distinguishes
selected-date prices, customized prices and averages. Some averages use median
rates over the next 90 days. They must not be spread across October calendar cells.
No unconditional zero-cost official all-OTA competitor-calendar feed was verified.

## Collect public price candidates

Use only explicitly reviewed, permitted public source URLs. Example placeholders
below do not denote a tested provider. Output directory must already exist.

```powershell
python scripts/market-prototype/rate_observations.py collect `
  --origin https://hotel.example `
  --url 'https://hotel.example/rooms?checkin=2026-10-01&checkout=2026-10-02&adults=2' `
  --checkpoint D:/Yellow/temp/market-rates-726/checkpoint.json `
  --max-requests 5 `
  --output D:/Yellow/temp/market-rates-726/candidates-001.json
```

Repeat `--origin`/`--url` for a bounded multi-source batch. The quota includes
robots requests; concurrency is one. Resume with the same checkpoint and a new
output filename. Previously fetched URLs retain hash/time receipts but no HTML
bodies; they are skipped, so **retain previous report files**. This does not refresh
their rates. Stops survive process restart; do not rotate checkpoints to evade a
block. Existing bnbme domain denial remains enforced.

Query parameters are preserved only when admitted by the fetcher's explicit safe
parameter set; arbitrary endpoint/header/cookie configuration is not supported.
Checkpoints retain no HTML page bodies or credentials. A crash after a successful
fetch but before its report write can leave a receipt without parsed candidates;
this is reported as already-fetched, never silently claimed as collected data.
The configured timeout is socket inactivity, not a hard whole-request deadline:
DNS resolution or a slow-drip response can exceed it. Byte and request budgets
still apply. There is no automatic service/scheduler or production latency claim.

## Import actual dated observations

Prepare a JSON array using **every** field below. All rows are validated before
the report is created. Inputs are limited to 10 MiB / 10,000 rows. The fictional
example demonstrates schema only; it is not a real hotel or observed quote.

```json
[
  {
    "property_id": "SYNTHETIC-HOTEL-ONLY",
    "source": "google_hotels",
    "source_url": "https://www.google.com/travel/hotels",
    "source_kind": "manual_observation",
    "seller": "Synthetic seller",
    "checkin": "2026-10-01",
    "checkout": "2026-10-02",
    "adults": 2,
    "children": 0,
    "rooms": 1,
    "currency": "AED",
    "amount": "501.25",
    "amount_basis": "stay_total",
    "taxes_included": "unknown",
    "fees_included": "unknown",
    "room_type": null,
    "rate_plan": null,
    "observed_at": "2026-09-25T08:30:00Z",
    "evidence_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
]
```

Replace the placeholder hash with the SHA-256 of retained permitted source
evidence (for example an actual normal export or captured quote). Retain that
evidence privately outside this repository. The importer validates hash format,
not its existence, authenticity or license. Provider exports use
`source_kind: "provider_export"`. No secrets, cookies or guest data belong here.

```powershell
python scripts/market-prototype/rate_observations.py import-quotes `
  --input D:/Yellow/temp/market-rates-726/observed-quotes.json `
  --month 2026-10 `
  --output D:/Yellow/temp/market-rates-726/quotes-normalized-001.json
```

Amounts are plain decimal strings (no comma grouping, exponent or currency symbol).
`amount_basis` is `stay_total` or the displayed `nightly` amount for the selected
room count. It is never silently divided by nights or rooms. Tax/fee inclusion is
`included`, `excluded` or `unknown`. Missing room/rate plan is null, not inferred.
Context still lacks child ages and member/device/point-of-sale segmentation;
observations are not guaranteed apples-to-apples rate comparisons.

The normalizer uses exact minor units, rejects unsupported currency exponents,
deduplicates identical captures and rejects conflicting same-capture prices.
Observations at different timestamps stay separate. Coverage groups by property,
source origin, seller, occupancy, currency, room/rate and fee treatment. Duplicate
JSON object keys are rejected rather than silently replacing values. A three-night
quote does not fill three one-night cells. Missing dates mean unknown, not sold
out, zero or a calculated nightly rate. Reports are exclusively created and never
overwrite source files or prior observations.

## Test strategy and limits

Following the testing-strategy skill, prove pipeline inputs, normalization and
idempotency with fast offline tests, transport failures with injected HTTP/DNS,
and the actual CLI with small synthetic files. Coverage targets are each guard and
each status branch, not a fabricated percentage:

| Area | Proof |
| --- | --- |
| Money/context | 0/2/3-decimal currencies; reject float/rounding; strict dates/occupancy |
| Evidence | exact duplicates; conflicts; source hashes; no undated-to-calendar promotion |
| Transport | HTTPS origin/query/robots; redirect/401/403/429/challenge stop; pacing/budget |
| Resume | persisted blocks, no repeated fetch, corrupt checkpoint fail-closed, lock |
| CLI | actual subprocess import; no network; exclusive report output |

Run `python -m unittest discover -s tests/market-prototype -p 'test_*.py' -v`.
Actual run counts and independent results belong in receipt/review 726.

Root's live probe fetched only Google's robots file (one HTTP attempt), reported
`robots_disallowed` for the requested Dubai hotel-search URL and returned zero
price candidates/quotes. A fresh CLI process with the same checkpoint returned
the persisted block with zero HTTP attempts. This proves the guard, not market
data availability or a functioning Google calendar scrape.

Remaining: vetted OTA-specific dated-rate adapters; lawful market-wide source
access; actual Dubai listing/October quote coverage; persistent app/Drive pipeline;
child-age/audience semantics; month planning/scheduling; independent provider
evidence reconciliation. Those features are not delivered by this toolkit.
