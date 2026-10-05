# Bounded JSON compset intake

Order705 adds an offline, one-capture JSON intake for research. It accepts an
explicit capture envelope from stdin or one bounded regular local file, reuses
the public `normalizeMarketSourceCapture` distribution adapter, and prints only
the adapter’s allowlisted normalized result. It does not fetch data or create a
market database.

## Run

```powershell
# Read one explicitly prepared envelope from a local file
bun scripts/research/market-json-intake.ts --input .\capture.json

# Or pipe one JSON envelope through stdin
Get-Content -Raw .\capture.json | bun scripts/research/market-json-intake.ts
```

Stdout is exactly one JSON object plus a newline. Errors use a sanitized code on
stderr and exit status 1. The optional `--input` must identify a regular,
non-symlink file. The whole input envelope is bounded to 4 MiB; the existing
normalizer separately bounds capture payloads to 2 MiB and candidates to 500.
The tool does not write any files, and it never echoes its input or exception
details.

## Envelope contract

Top-level keys are exact: `schemaVersion`, `source`, `query`, `collectedAt`, and
`payload`. `schemaVersion` is `yellow.market-json-intake/v1`. `source` must be an
existing distribution source identifier. `query` must contain exactly:
`destination`, `checkInDate`, `checkOutDate`, `adults`, `rooms`, `childrenAges`,
`currency`, `pointOfSaleMarket`, and `language`. `collectedAt` is a UTC ISO
instant, or `null` only for adapters that explicitly allow an unknown collection
time. `payload` is passed to the source-specific distribution adapter; this
script intentionally does not define a second payload schema.

Example shape (replace illustrative values with an authorized capture):

```json
{
  "schemaVersion": "yellow.market-json-intake/v1",
  "source": "booking-mcp",
  "query": {
    "destination": "Dubai, United Arab Emirates",
    "checkInDate": "2026-10-05",
    "checkOutDate": "2026-10-08",
    "adults": 2,
    "rooms": 1,
    "childrenAges": [],
    "currency": "AED",
    "pointOfSaleMarket": "AE",
    "language": "en"
  },
  "collectedAt": "2026-10-04T13:15:10Z",
  "payload": { "accommodations": [] }
}
```

The JSON output contains `status`, `source`, `query`, `collectedAt`, normalized
`candidates`, and adapter `issues`, plus explicit `operationalWrites: false` and
`automaticPricingEligible: false`. `complete` means only that this one capture
normalized without adapter issues—it is **not** proof of comprehensive market
coverage, live availability or accurate rates. Every candidate remains
`search-candidate-only`; source currency, stay context, timestamps, money basis,
and unknown fee/cancellation fields remain as reported or unknown. Amounts are
exact minor-unit strings where derivable, never JavaScript money arithmetic.

Unknown top-level/query fields, source identifiers, invalid dates/times, invalid
JSON/UTF-8, oversized input, and malformed metadata fail closed. Source-specific
payload mismatches and bad prices remain explicit adapter issues rather than
being repaired or guessed. Unknown raw response fields, credentials, URL query
strings and fragments are not copied into normalized output.

## Safety and scope

This command accepts data already captured by a supported connector/user flow.
It has no network, browser, cookie, mobile endpoint, authentication, database,
filesystem output, API, scheduler, or pricing writer. It is not an Airbnb/Booking
scraper and does not establish a live mobile capture integration. Do not pass
guest contact data, access tokens, session cookies or other personal/secret data
in a capture. Store or share normalized outputs only under the source’s governing
terms and internal authorization. The separate market-source batch command has
different planning/ingest behavior and is not invoked by this CLI.
