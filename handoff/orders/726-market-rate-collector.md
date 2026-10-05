# Order 726 — bounded Python market-rate collection

Phase 7 founder-priority supporting tooling. Founder requests Python scraping
across OTAs, especially Google hotel calendar prices. Root builds working tools,
not stealth, evasion, or an unsupported claim of whole-market data.

## Scope and ownership

- Root: scripts/market-prototype/rate_observations.py;
  tests/market-prototype/test_rate_observations.py;
  docs/research/MARKET-RATE-COLLECTOR-726.md; this order;
  handoff/receipts/726-market-rate-collector.md;
  docs/PROJECT-STATUS.md; handoff/LEDGER.md.
- Transport implementer: scripts/market-prototype/rate_fetch.py;
  tests/market-prototype/test_rate_fetch.py only.
- Independent reviewer: handoff/reviews/726-market-rate-collector.md only;
  execute proofs personally; report source issues to root, no own implementation.
- Small generated local test/run artifacts: D:/Yellow/temp/market-rates-726/.
- One sanitized Antigravity included-quota design critique in existing isolated
  workspace permitted. No credentials, private data or repository contents sent.

## Contract

Preserve existing Order 718 listing collector unchanged. Python stdlib only.
Explicit HTTPS public origins/URLs, transparent agent, sequential pacing,
robots checks, no redirects/proxies/authentication/cookies, bounded requests and
response sizes, durable cache/checkpoint and host stop on 401/403/429 or challenge.
Existing bnbme configured denial is retained; do not use another mechanism to
reach that domain. No hidden/mobile endpoints or Google RPC access. Google
disallowed routes are not fetched. Cache/resume is scoped and no repeated requests
after a recorded block. No automatic scheduler, background endless run or spend.

Parse only public JSON-LD Hotel/Accommodation offers as price candidates, not
verified calendar quotes: requested dates cannot establish the page's rate dates.
Support strict explicit quote-observation imports for permitted exports/manual
evidence. Preserve exact decimal money as integer minor units, currency, checkin,
checkout, adults/children/rooms, tax/fee inclusion, seller, collection time, source
and evidence hash. Unknown remains unknown, not zero or sold out. October coverage
must distinguish candidate prices from dated observations and multi-night totals.
Do not infer full-month prices, exact location or all-active market inventory.

## Acceptance/proof

Tests with code: query preservation/source isolation, robots path+query matching,
request budgets/pacing, response limits, redirect/HTTP/challenge stops, persistent
stop/cache/resume, corrupt checkpoint fail-closed; price precision, dates,
occupancy, duplicate/conflicting evidence, missing prices and explicit coverage.
Offline tests plus real CLI synthetic fixture smoke. A bounded Google robots-only
probe may run (max 1 actual fetch); calendar details blocked by policy must not
be fetched. Record actual pages/records separately from synthetic proof.
No operational DB/schema/tenancy/finance changes, app build or public deployment.
Existing dirty shared checkout retained; no unrelated staging/commit/branch switch.

## Outcome

Bounded source toolkit accepted after independent executable review 726. Root and
nonimplementer each ran 72 passing tests, with matcher and CLI failure proofs.
Actual root Google probe fetched robots once and blocked the requested hotel-search
page; zero candidate prices/quotes. Fresh-process resume made zero requests.
Antigravity supplied a real sanitized methodology critique, not market data.
No all-OTA calendar feed or market dataset delivered; app/DB/public lifecycle unchanged.
