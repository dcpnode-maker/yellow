# Receipt736 — reviewed own pipeline and real Dubai-search pilot

25 September 2026. Order736; Phase7 supporting market tooling. Existing checkout
`D:/Yellow/git-live-order611-source-v2`, branch `codex/live-order611-source-v2`,
HEAD `e06e400a`; unrelated dirty work preserved. No commit, PR, merge, database
change, live app promotion or public tunnel activation in this order.

## Delivered

- Root captured three ordinary public Airbnb search pages: 60 card observations,
  58 distinct Airbnb IDs. One ordinary Booking.com connector search supplied
  10 Dubai hotel IDs. Requested stay: 1–2 October2026, two adults, AED; Booking
  additionally uses one room and India point of sale.
- Combined evidence: 70 raw observations, 68 source-qualified listing IDs and
  distinct source/stay combinations, 69 unique timestamped quote identities.
  The exact-date Dubai candidate table has 61 rows. Six alternative-date Airbnb
  stays and one Sharjah listing returned in the Dubai search are retained in
  evidence but excluded from that table. No cross-OTA property matching.
- Prices remain displayed stay totals in integer minor units with source fee
  qualifiers. Airbnb coordinates are null; Booking coordinates are only
  provider-reported. Recording times are local evidence capture times, not
  provider quote-generation times. The other 30 October nights remain unknown.
- `search_card_intake.py` compiles the factual captures offline with validation,
  deduplication, evidence hashes, coverage reporting and spreadsheet-safe IDs.
  `market_pipeline.py` adds a finite sequential runner over the unchanged
  Order726 transport, persistent request budgets/stops, crash accounting,
  locks, origin pacing and retained candidate evidence. No scheduler or automatic
  successful-URL refresh; generic JSON-LD candidates are not dated OTA calendars.

No new Python runner request was made to an actual OTA. The actual pilot data
came from the three browser pages and one normal Booking connector call. Existing
Google robots and bnbme access denials were not retried or bypassed. No stealth,
proxy rotation, challenge bypass, hidden/mobile endpoint, paid service or Windows
executable is claimed.

## Independent executable verification

Root final full suite: 129 passed, 0 failed in15.955s. Nonimplementing reviewer
`browseai_check` personally ran intake12/12, runner27/27 and full129/129 in16.006s.
Reviewer reproduced and verified repairs for conflicting same-capture quotes and
unvalidated Booking rating metadata, and checked the final checkpoint guard.
The reviewer independently recompiled all seven generated files byte-for-byte
and reconciled every70 raw observation against retained source facts. Approval
and exact source/artifact hashes: `handoff/reviews/736-market-pipeline.md`.

Command: `python -m unittest discover -s tests/market-prototype -p 'test_*.py' -q`.
No database gate or whole-checkout acceptance is claimed for this file-only order.

## Actual private delivery

Founder-selected account: ankitg.owa@gmail.com, connector profile104060173750480040625.
Folder: https://drive.google.com/drive/folders/1a23_jusYc1Ma2OuVeaVzg7lJFmPPq2UU

- ZIP: https://drive.google.com/file/d/1nMfof4tLHbvItWK05c-GvWMbn7B-7qDZ/view
  — 71,003 bytes. Contains reviewed JSON/CSV/README, four factual evidence files
  and the reusable Python tools. Local SHA256:
  `d5ee9eb9c41a6deade1c477b98d43d0ff0031daae892501fb91efca3e1df1e2b`.
- CSV: https://drive.google.com/file/d/1MzgJcIfdfBQxvXe8Lsixk0RMdjdSCzTp/view
  — 16,150 bytes, 61 candidate rows.
- README: https://drive.google.com/file/d/1t1ZBSQKX4uc9bzpKrInCTYXAHRltQlHx/view
  — 2,905 bytes, source/date/price/coverage limitations.

Each upload returned success. Separate Drive metadata reads confirmed the parent
folder, exact sizes and `shared:false` for all three files and the folder. No
sharing permissions changed. Reviewed local artifacts remain under
`D:/Yellow/temp/order736/dubai-multi-source-pilot-reviewed/`; ZIP at
`D:/Yellow/temp/order736/Yellow-Dubai-market-pilot-20260925.zip`.

## New founder-selected Parse.bot follow-up

Founder subsequently requested https://parse.bot/. Root read official pricing,
authentication and the Airbnb marketplace listing. Free plan advertises200
credits/5 requests per minute; API execution needs Parse sign-in/API key. Catalog
advertises search_listings3 credits and availability calendar2 credits per call.
This is a third-party wrapper, not an official Airbnb API or verified execution.

The Parse sign-in page is opened as a browser handoff; founder was asked to sign
in without posting credentials in chat or buying credits. No account creation,
subscription, paid build, API request or Parse dataset has occurred. A later
scoped integration must first verify actual returned fields, date overrides,
rate semantics, credit balance and permissions. No prior block may be bypassed
by changing vendors. This delivery is a pilot, not full Dubai inventory, a full
October calendar, a persistent Yellow market feed or the completed ecosystem.
