# Yellow-owned market pipeline — Order736

No Browse AI dependency. Python standard library; existing Order726 transport and
normalizers are reused. This is bounded collection tooling plus a real small
two-source Dubai-search pilot, not a complete-market scraper or daily service.

## Actual pilot

Three ordinary Airbnb result pages were visited through the available browser.
Sixty factual cards were retained, representing58 distinct listing IDs. Cards
included six alternative stays beginning30September and one explicit Sharjah
listing. Search headings/map counts are not saved-row counts: only cards actually
read are claimed. One normal Booking.com search connector returned10 Dubai hotels
with prices and provider-reported coordinates. No bookings were made.

The combined output has68 source-qualified IDs,70 captured observations and61
exact-date Dubai candidates for1–2October2026, two adults, AED. Two repeated Airbnb
identities are deduplicated for the candidate table; all source captures remain.
These are NOT automatically equivalent room products or matched cross-OTA entities.
Taxes/fees, room/rate conditions and audience can differ. Missing calendar dates
are unknown, not sold out. Neither58Airbnb IDs nor68source IDs means whole Dubai.

Airbnb cards came from
[the actual selected-date search](https://www.airbnb.co.in/s/Dubai--United-Arab-Emirates/homes?checkin=2026-10-01&checkout=2026-10-02&adults=2&currency=AED&locale=en).
Only name, exact string ID, displayed locality/room facts, rating/count, dated
current price and applicable card labels were retained. No photos, descriptions,
guest/reviewer contacts or account data. NBSP whitespace was normalized in the
saved factual tables. Timestamps denote local evidence recording, not a provider's
quote-generation clock; the factual evidence is a DOM transcription, not raw HTML.
The first page initially reported20 map stays; later DOM extraction captured24
cards including suggestions. Final counts come from saved evidence, not that badge.

Airbnb exact coordinates are absent. Booking coordinates are provider-reported,
not independently surveyed entrances. Neither source proves continuously active
inventory, bookability at checkout, or public redistribution rights. User intent
is internal research; no public Yellow data publication occurs here.

## Program1: durable multi-source requests

`scripts/market-prototype/market_pipeline.py` reads a strict manifest:

```json
{
  "schema": "yellow.market-pipeline-manifest.v1",
  "daily_request_limit": 40,
  "max_requests": 8,
  "sources": [
    {
      "origin": "https://hotel.example",
      "daily_request_limit": 20,
      "urls": ["https://hotel.example/rooms"]
    },
    {
      "origin": "https://another-hotel.example",
      "daily_request_limit": 20,
      "urls": ["https://another-hotel.example/stays"]
    }
  ]
}
```

Those are placeholders, NOT verified live feeds. Supply reviewed explicit public
URLs. Up to5 canonical origins and200 URLs per manifest; request ceilings1–100.
One connection at a time with the existing ≥5second origin pacing plus publisher
hints. Each origin gets a turn before the next source batch. Robots requests count
toward the global and origin budgets. Finite invocation; no daemon or scheduler.

```powershell
python scripts/market-prototype/market_pipeline.py --manifest manifest.json --state-dir D:/Yellow/temp/market-pipeline-state --output D:/Yellow/temp/report-001.json
```

Use the SAME state directory on every invocation. Daily ceilings are fixed once
registered. The UTC day resets counters, not source checkpoints/blocks. Up to5
origins can exist in that registry. Reserved request allowance is written before
dispatch; unused allowance is refunded only after a normal return. Interrupted
reservations remain charged and stopped pending inspection, even across midnight.
Exclusive locks prevent competing runners. Corrupt state/checkpoints fail closed.

Previously fetched pages reuse retained candidates and matching source hashes.
A fetch receipt without parsed output is explicitly missing, not recovered data.
Successful URLs do NOT refresh automatically. Long-running rate refresh and
automatic month planning require additional implementation preserving origin stops.

This transport extracts public Hotel/Accommodation JSON-LD **undated price
candidates**, not a universal JavaScript OTA/calendar adapter. No hidden/mobile
API, cookie/auth support, proxy rotation, simulated-human behavior, CAPTCHA bypass,
paid fallback or identity concealment exists. A blocked source does not prevent
an independent permitted source from completing. Do not rotate state directories,
domains or tools to retry a denied source. Historical Google/bnbme denials remain
out of live scope; unrelated old checkpoints are not auto-discovered or migrated.

The existing socket timeout is not a hard whole-request deadline; DNS/slow-drip
responses can take longer. Request/body ceilings remain enforced. Limits are load
controls, not a guarantee of source permission or market completeness.

## Program2: factual observations and comparison exports

`search_card_intake.py` is an OFFLINE normalizer for the verified Dubai UI capture
shape and optional Booking connector capture. It does not drive the browser or
call Booking itself. It validates current-price currency, exact digit-string IDs,
actual card dates/night counts, metadata ranges and conflicts, and uses Order726
quote normalization. Generic permitted quote files from other sources can enter
through existing `rate_observations.py import-quotes` (see guide726).

```powershell
python scripts/market-prototype/search_card_intake.py --compile --input D:/Yellow/temp/order736/airbnb-dubai-page1-cards.json D:/Yellow/temp/order736/airbnb-dubai-page2-cards.json D:/Yellow/temp/order736/airbnb-dubai-page3-cards.json --booking D:/Yellow/temp/order736/booking-dubai-connector-capture.json --output D:/Yellow/temp/order736/another-new-export
```

Outputs: listings, allobservations, exact-datecandidate table, normalizedquotes,
Octobercoverage and receipt JSON; candidate CSV. Prices are exact integer minor
units, never inferred per-night averages. CSV IDs have an apostrophe prefix to
discourage Excel rounding; canonical JSON retains unmodified strings. Text formula
prefixes are neutralized. Output paths are exclusive: existing reports are not
overwritten. Different sources retain separate IDs; no fuzzy merge is invented.
All captures supporting a quote are kept in observations; identical same-time
quotes deduplicate, conflicting same-time values reject before export.

## Verification and operational boundary

Run `python -m unittest discover -s tests/market-prototype -p 'test_*.py' -v`.
Mocked transport proofs are synthetic, not real OTA collection. Actual browser
and connector records are separately accounted above. Independent review736 records
its own commands/results and repaired findings. No DB, app, live tunnel, credential,
subscription or security-policy change. Public tunnel staysOFF. No claim of
entire ecosystem completion, all October prices or unattended harvesting.
