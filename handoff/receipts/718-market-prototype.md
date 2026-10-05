# Order718 receipt — reviewed collector and bounded public observation

Latest root outcome25September: independent review accepted the final HTTPS and
request-count guards; root personally repeated29/29 offline tests and compilation,
then ran exactly one reviewed public bnbme Dubai seed. Two HTTP attempts (robots
plus one page), one page fetched, zero errors, **zero JSON-LD listing records**.
The public page was previously inspected and showed no property results. This is
not evidence that Dubai has zero listings and is not a complete market dataset.
No hidden endpoint, browser cookie, third-party login or redirect was used.

Exact invocation:
`python scripts/market-prototype/public_listing_collector.py --origin https://bnbmehomes.com --seed https://bnbmehomes.com/city/dubai --max-pages 1 --timeout-seconds 10 --max-response-bytes 1048576 --cache D:/Yellow/temp/dubai-market-prototype-20260925/bnbme-public-cache-20260925.json --output-data D:/Yellow/temp/dubai-market-prototype-20260925/bnbme-public-observation-20260925.json`

Report SHA256 FBA81B707EED8EBBAA391C3B3481F6530CC29C37EE701303D118413341C4E19B;
metadata-only cache86F1B45A1ADC634D0DF1BB459585FF5C403B5044FD514319F648F98D85CEFBF7.
Separate10-row public-index candidate CSV
D3D4C681235F1D2E27CF52419A8EFDF2CE124ECB74BBE54E1C09617E96A97490 remains manual
research, not collector output or verified-active inventory. October quote count0.
No hotel DB write, Drive upload, publication or recurring collection was performed.

## Preserved builder checkpoint (before final review/run)

At the builder checkpoint, collector code and offline proof were ready for review. No
public collector request, market-data import, database write, publication,
October quote, or whole-market count was performed by the builder. Root separately
reports ten manual public-search candidates in
`D:/Yellow/temp/dubai-market-prototype-20260925/bnbme-indexed-candidates.csv`;
those are not collector output, active listings, or date-specific prices. Root's
bounded collector run and the independent review remain pending.

## Model/quota receipt

- The Antigravity CLI ran from the isolated empty directory
  `D:/Yellow/temp/antigravity-quota-check-20260925`, not from the Yellow repository.
  CLI version shown by the run was 1.2.11; the selected model was
  `gemini-3.8-flash-low`, with `--effort low --mode plan --sandbox`.
- The pre-job `/usage` panel showed included Gemini weekly remaining 99.99% and
  five-hour remaining 100.00%, with quota available. After an accidentally
  submitted `/usage` initial prompt was interrupted, the CLI status footer showed
  99.94% five-hour remaining. No paid API key, paid fallback, or auth change was
  used. The displayed quota was an observation at that time, not a current quota
  guarantee.
- An initial malformed CLI invocation was rejected before a turn. A subsequent
  `--prompt-interactive="/usage"` attempt treated `/usage` as an initial model
  prompt; generation began and was interrupted immediately. Its exact token use
  was not returned. This was not the quota check; the later actual `/usage`
  slash-command panel is the quota evidence above.
- The one bounded code-generation job completed with CLI status `SUCCESS`, one
  turn, duration 53.7379502 seconds, 14,130 input tokens and 6,818 output tokens
  (20,948 total). Conversation ID:
  `c4e302b4-2bb6-438c-87df-8338eb0804de`. It returned JSON containing the two
  requested file contents. The CLI tool result initially truncated those contents;
  they were recovered from this conversation's local transcript cache without
  another generation call. The prompt contained only the sanitized public-data
  contract—no Yellow source, private history, guest/owner data, or credentials.
- The generated draft was not used uncritically. It cached raw response HTML and
  had incomplete robots, URL, cache, and import-path guarantees. The final scoped
  implementation was corrected before review; see the research note and source.
- A separately authorized Google Hotels documentation query used the same
  Flash Low/plan/sandbox mode with an 80-second print limit. It timed out after
  72.3568 seconds with a turn still in progress and an empty response. CLI usage
  envelope: 66,822 input, 493 output, 0 thinking (67,315 total; 77,376 cache-read
  tokens reported). This produced **no verified research answer** and was not
  resumed or regenerated. Root later verified official-source facts separately;
  the incomplete model query is not evidence.

## Files and proof

Only these two implementation paths are in scope:

- `scripts/market-prototype/public_listing_collector.py`
- `tests/market-prototype/test_public_listing_collector.py`

The implementation uses only Python standard library and requires explicit exact
HTTPS origins/seeds and an output path. It never stores raw HTML; caps origins at
5, seeds at 50, pages at 200, total HTTP attempts at `max_pages + origin_count`
(including robots), response bodies at 5 MiB, and timeouts at 30 seconds. Requests
are sequential with conservative robots matching/rate pacing; redirects and
percent-encoded/dot-segment paths are rejected. Activity and availability remain
unknown. Cache format v2 resets v1 or incomplete cache entries.

Latest implementer proof:

```text
python -m unittest discover -s tests/market-prototype -p 'test_public_listing_collector.py' -v
Ran 29 tests — OK

python -m py_compile scripts/market-prototype/public_listing_collector.py tests/market-prototype/test_public_listing_collector.py
Passed

python scripts/market-prototype/public_listing_collector.py --help
Passed; requires explicit HTTPS --origin, --seed, --cache and --output-data
```

Every test HTTP path is mocked. No live listing URL was requested by this builder.
The independent reviewer should re-run these offline checks and inspect the
collector before root performs any bounded public fetch. Append reviewer/source
run evidence here before Order718 can be called complete.
