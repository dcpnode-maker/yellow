# Independent review736 — bounded pipeline and observed OTA pilot

25 September 2026. Reviewer: Codex `browseai_check`, nonimplementer. Scope is
Order736. Root implemented intake; `pipeline736` implemented coordinator. Reviewer
edited no implementation or permanent test file and performed no network/UI
collection, credential access, database action, deployment or upload.

## Verdict

APPROVED for the bounded local tooling and factual pilot export at the hashes
below. Two independently reproduced intake findings were repaired by root and
personally rechecked. Final full offline suite: **129 passed, 0 failed** in 16.006s.
This is not approval of exhaustive market coverage, an unattended crawler, calendar
refresh, source permission, automatic price changes or public redistribution.

## Reviewed source identity

Checkout: `D:/Yellow/git-live-order611-source-v2`, branch
`codex/live-order611-source-v2`, recorded HEAD `e06e400a`; existing dirty work retained.
`PROJECT.md`, current status, Phase7 context and Orders718/726/736 were read.
`state.ps1` ran successfully. Approval binds these file SHA-256 values, not the
uncommitted checkout as a whole:

| File | SHA-256 |
| --- | --- |
| scripts/market-prototype/market_pipeline.py | c5f80837cff163cabb2951abba6a085c84d315b6c73c43e982bb8ca530990640 |
| tests/market-prototype/test_market_pipeline.py | 682e323f8ba673473633208273130cba5a9ce76487840320a064c51b5c9f896a |
| scripts/market-prototype/search_card_intake.py | e5faaacb89ccf287ff9871ce33b23b38f812112d0502b3e163e99a75d1cbf8a0 |
| tests/market-prototype/test_search_card_intake.py | 75c29cb53cb3a080b1d1a963fff201d9313ffd96794bf2217514f981085564d8 |

Existing Order726 transport and normalizers remain unchanged. New collection uses
the public `Fetcher` API; the older collector's in-memory host stops are not used
as the new transport authority.

## Findings and closure

1. **Cross-file same-capture conflict — fixed.** Reviewer supplied two offline
   captures of the same listing/stay/time, with 69500 and 99900 minor units. Both
   originally survived under identical `observation_id`; last-input selection
   silently chose 99900. The compiler now checks the combined quote identities
   before output, rejects differing same-capture price/fee values, and deduplicates
   equal captures while retaining supporting raw observations. Permanent regression
   and reviewer rerun pass. Legitimate later observations remain separate.
2. **Unvalidated Booking rating payload — fixed.** A reviewer-injected rating with
   score 999, review count -12 and an extra synthetic contact field was originally
   copied to output. Range validation and explicit field projection now reject the
   invalid numbers and omit arbitrary extra fields. District metadata is validated
   text. Both invalid-range and extra-field regression cases pass.
3. **Listing snapshot order — fixed.** Root also changed listing metadata selection
   to use observation time, while preserving locality observations. Reversed input
   order retains the newer listing title in the permanent regression.
4. **Inconsistent uncreated-checkpoint flag — hardened.** Builder identified a
   valid-shaped false flag coexisting with prior source activity. Reviewer agreed
   the state is impossible during legitimate initialization. Final validation rejects
   false `checkpoint_created` with pages/counters/pending/stop; negative proof passes.

No unresolved blocking finding remains within this order.

## Personally executed proof

Commands ran from the checkout above:

```powershell
python -m unittest discover -s tests/market-prototype -p test_search_card_intake.py -v
python -m unittest discover -s tests/market-prototype -p test_market_pipeline.py -q
python -m unittest discover -s tests/market-prototype -p 'test_*.py' -q
```

Final results: intake 12/12; coordinator 27/27 in 10.968s; full 129/129 in 16.006s.
The two printed output-path errors are expected negative CLI tests. Reviewer also
ran the original independent conflict/rating probes, then inspected their repaired
regressions. This is reviewer-executed evidence, not pasted builder results.

Coordinator proofs include request reservation before dispatch, robots accounting,
global/per-origin/invocation budgets, 100 mocked requests across 5 origins, sequential
fair turns, publisher pacing, persisted blocks and origin registry, crash charging,
missing output, retained-evidence/checkpoint mismatch, midnight/clock reversal,
corrupt state, locks and a real separate-process budget/lock check with DNS denied.
All transport responses are synthetic/injected; no real source success is implied.

Reviewer independently executed the actual export CLI:

```powershell
python scripts/market-prototype/search_card_intake.py --compile --input D:/Yellow/temp/order736/airbnb-dubai-page1-cards.json D:/Yellow/temp/order736/airbnb-dubai-page2-cards.json D:/Yellow/temp/order736/airbnb-dubai-page3-cards.json --booking D:/Yellow/temp/order736/booking-dubai-connector-capture.json --output D:/Yellow/temp/order736/reviewer-recompiled-001
```

All seven generated data files are byte-identical to
`D:/Yellow/temp/order736/dubai-multi-source-pilot-reviewed/`. Its later README is
documentation, not generated compiler output. Earlier unreviewed export directories
remain history and are not the accepted delivery.

Independent reconciliation used raw UTF-8 factual rows, `Decimal` conversion and a
multiset of source/ID/time/date/amount/evidence tuples rather than trusting the
compiler receipt. Every one of the 70 observations maps exactly to retained evidence.
Reviewer verified 60 Airbnb cards → 58 distinct IDs plus 10 Booking IDs; 68 source-qualified
listing IDs/stays; 69 unique timestamped quote identities; 61 exact-date Dubai candidate
rows; 6 alternative stays and 1 Sharjah listing excluded from that candidate table.
One same-time quote deduplicates and one later repeated quote is retained, explaining
70 raw observations versus 69 normalized quotes versus 68 distinct source stays.

All amounts are integer minor units and stay totals. CSV has 61 rows and preserves
every exact ID via its documented apostrophe prefix; canonical JSON IDs are strings.
Airbnb coordinates are null. All 62 coverage groups have only 1 October one-night
coverage and 30 missing October dates. The six September-start alternatives never
fill October nightly cells. Provider-coordinate assertions remain qualified.

## Artifact identity

Raw factual capture file SHA-256 values:

| File | SHA-256 |
| --- | --- |
| airbnb-dubai-page1-cards.json | 449e56eb7c3a2f5468504a890c4b5702e26ca0132387767f0324fa98cb64cac0 |
| airbnb-dubai-page2-cards.json | feb54514316bc87efe289040b5a366368d5e95eb20b168041a8572db81154d9c |
| airbnb-dubai-page3-cards.json | 095d393c7739ea47ce5781e58e934f14439f3da4084b27d9048ee652ef841510 |
| booking-dubai-connector-capture.json | f7c83264711fb1fe0933c6f765141b9d3edad996aa128228d6160fe08cd920a7 |

Accepted generated files, each matched to the independent compilation:

| File | SHA-256 |
| --- | --- |
| comparables.csv | f7e5ee8db961359ba0c64ec915727d12d1ebe5cd26fd756890da1cf3aabad8ad |
| comparables.json | da2634dc9a81d85d08775de0650c125ee114c9ae380f5654fe03d52e4d06b07e |
| coverage.json | 9d3b9f036f3f3aa74ab2fa253cc90592219ef143f5539639af94d6824f336caf |
| listings.json | 636fe79ca78dbaedf97604f6f2b76b61359ef018d881521d0c7c22b126abaa6e |
| observations.json | a24a501b2d0d9b55dbca3b9e1cbf6ece0d75b824c9c88118ca23760f73e1f297 |
| quotes.json | b3c18cf3813b120b98fc18d0c8014317c6eefd81746a19a84b62f9f0623f8540 |
| receipt.json | 75ca7d0a7662784b9718d07c902990de569a18fed2861202c1301e2502bb297d |

## Limits retained

Review verifies faithful processing of saved factual evidence, not independent
recapture from Airbnb/Booking or an authenticity/licence guarantee. Recording times
are local capture timestamps, not source quote-generation times. Full inventory,
bookability, comparable room/fee policies, surveyed location, cross-OTA identity
matching and complete October calendars remain unverified. Successful transport
URLs do not automatically refresh; the finite runner has no scheduler. Existing
blocks must not be reset by changing checkpoint directories. No application,
database, financial or deployment behavior changed; no database gate is claimed.
