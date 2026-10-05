# Order718 — listing-first Dubai market prototype, October2026

Founder requests another model generate and root verify/run a low-cost batching
script: Dubai listing catalogue first, October2026 date-specific quotes later;
focus first on areas in bnbme's public portfolio. Run within source permissions,
no evasion, impersonating human traffic, private/mobile endpoints, auth/CAPTCHA
bypass, credential sharing, paid API activation or purchasing datasets.

## Scope

- scripts/market-prototype/public_listing_collector.py
- tests/market-prototype/test_public_listing_collector.py
- docs/research/DUBAI-MARKET-PROTOTYPE-20260925.md
- this order; handoff/receipts/718-market-prototype.md;
  handoff/reviews/718-market-prototype.md; docs/PROJECT-STATUS.md; handoff/LEDGER.md
- Small data artifacts ONLY in D:/Yellow/temp/dubai-market-prototype-20260925/
- Bounded sanitized Antigravity code-generation task in its existing isolated
  D:/Yellow/temp/antigravity-quota-check-20260925 workspace. No Yellow/guest files,
  credentials or private history sent. Included quota only; no paid fallback.

## Contract

Use an explicit source allowlist and reviewed public/authorized feeds. Public
bnbme homepage/terms/robots observed25September: public crawl allowed, /api/ and
account paths disallowed. A robots Allow is NOT a licence for photos/descriptions;
collect factual metadata/URLs only, no guest/owner personal data or images.
No whole-market coverage claim from one operator or unknown denominator.

Collector: Python standard library, explicit seed URLs/source domains, transparent
User-Agent, sequential bounded requests, timeout, response byte limit, robots
checks, no automatic cross-origin redirects, halt host on401/403/429, no proxy/
fingerprint rotation, cache/checkpoint with no duplicate fetch on resume.
Parse public HTML links and JSON-LD only; never script internals or hidden APIs.
No automatic crawling until source scope and returned script reviewed by root.
Outputs listing observations (source URL/id/title/locality/property type/bedrooms/
capacity/public coordinates only when supplied; location precision explicit),
source hashes/fetched timestamps and honest errors/coverage. SQLite/JSONL/CSV are
small local prototype artifacts, not production import. No hotel database writes.

Quote data are separate observations: checkin/checkout, adults/children, currency,
total/taxes/fees/inclusion status, quote time and source. No invented prices,
availability from blank dates, October rates from undated marketing cards, or
active=available. Stage2 only when a permitted date-specific source is established.

Test parsing, source isolation, redirects,robots denies/errors,429 stop,limits,
cache/resume,dedup,corrupt data. Python compile + offline tests before small live
run. Record actual model/quota evidence and dataset counts, not promises.
