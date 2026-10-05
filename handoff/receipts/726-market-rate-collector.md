# Order 726 — Python market-rate toolkit

25 September 2026. Root owns integration; rate_transport726 implements transport;
rate_review726 is the nonimplementing executable reviewer. No complete market
dataset, all-OTA adapter or ecosystem completion is claimed.

## Implemented

- Python stdlib-only `rate_fetch.py`: explicit public HTTPS origins, safe date and
  occupancy queries preserved, transparent user agent, no proxies/cookies/auth,
  public DNS validation and TLS hostname verification, no redirects. Five-second
  minimum pacing and publisher hints; 1–100 requests including robots; 2 MiB body
  limit, 4 MiB metadata-only checkpoint, 1,000 entries, exclusive checkpoint lock.
- Persistent host stops for 401/403/429/challenges/robots denial; transient failures
  have 60-second cooldown and two-attempt-per-URL ceiling across invocations.
  Existing bnbme configured denial is retained. No checkpoint rotation or alternate
  endpoint/model/tool was used to route around a block.
- `rate_observations.py collect`: Hotel/Accommodation JSON-LD offers only, explicitly
  undated candidates with source hash/time and unknown date/basis/availability.
- `import-quotes`: offline exact minor-unit price intake; explicit source, seller,
  occupancy, dates, fee treatment, timestamp, evidence hash, dedup/conflict guards
  and month coverage. Imported evidence is labelled supplied/not independently
  verified. A multiday quote does not fabricate daily rows.

No operational DB, schema, tenancy, finance, runtime/app or Drive change. No public
tunnel restart, new credentials, paid activation or scheduled/background collector.
Source remains in the existing dirty shared checkout; no unrelated staging, commit,
branch switch or PR. Existing Order 718 collector is unchanged.

## Executed proof

Root intentional red: missing module when running initial parser tests. Green
11/11 initially; independent adversarial review found duplicate JSON keys, coverage
combining distinct source origins, private/invalid evidence URLs and UTC overflow.
Root repaired them with regressions; malformed timestamp logging is generic.

Transport initial 26 tests passed. Independent reviewer personally demonstrated a
Unicode robots literal/encoded-query mismatch and hostile-wildcard regex hang in a
separate killed test subprocess. Root independently also raised regex and multicast
address concerns. Builder replaced regex matching with bounded glob matching,
normalized UTF-8 octets and rejected multicast/reserved peers, with regressions.

Root personally executed final combined command:

```text
python -m unittest discover -s tests/market-prototype -p test_*.py
Ran 72 tests in 4.610s — OK
```

This includes 29 unchanged listing-collector tests, 29 transport tests and 14
observation/CLI tests. `python -m py_compile` for both new scripts passed. The real
import subprocess smoke uses synthetic data only; mocked collector CLI proof
confirms requested dates do not promote an undated price. Independent final
acceptance is recorded separately in review 726.

Nonimplementer rate_review726 personally reran the final full suite: 72/72 in
4.777 seconds, plus compile/scoped checks. Its stronger injected real-Fetcher CLI
proof covers extraction, exact source hash, null requested-date promotion, no
HTML persistence, resume with zero calls, one-request robots-only budget and
durable 403. It also checked 15,246 small glob/regex equivalences and personally
verified the original hostile matcher case completes in 0.00126 seconds. These
are offline/synthetic proofs, not acquired OTA records.

Final SHA-256 bindings:

```text
rate_observations.py 41d5865521a5760922357202119ba9c9f959d1db1225bda21ef3892f854fc50b
rate_fetch.py 2611ff98dbd5c679797cb39b451555fd96d188f6661ca808f3f4ee42c8e3b908
test_rate_observations.py a69a865c1ecb6c7628faaa84e561945e2901ce83dd001f7d50712cfe68812859
test_rate_fetch.py dae9ea91512a13541f19f6543f3e35ef90690e671d2871ad135d5b41441f9f7a
```

## Actual external run

```text
python scripts/market-prototype/rate_observations.py collect
  --origin https://www.google.com
  --url "https://www.google.com/travel/search?q=Dubai&hl=en"
  --checkpoint D:/Yellow/temp/market-rates-726/google-checkpoint.json
  --max-requests 1
  --output D:/Yellow/temp/market-rates-726/google-probe-001.json
```

Completed exit 0 with a structured blocked result: **1 HTTP attempt (robots only),
0 hotel pages, 0 candidates, 0 dated quotes**, reason `robots_disallowed`.
Root read the actual report. A fresh CLI process using the same checkpoint and new
`google-resume-002.json` output returned the cached block with **0 HTTP attempts**.
No disallowed hotel-search/entity/RPC/calendar page was requested. Both actual
reports and the small robots-only checkpoint remain in the stated temporary folder.

## Antigravity actually used

Existing included-quota CLI, existing isolated workspace and sign-in; Flash Low,
low effort, plan/sandbox, 45-second print limit, no tools/files/network/private input.
Sanitized methodology critique conversation:
`6629843d-fd2f-4e35-9c0d-58370c436391`.
Actual result SUCCESS, 10.0153377 seconds, 13,981 input / 984 output / 14,965 total
reported tokens. This used Antigravity's existing quota, not a new paid API key;
no paid fallback or purchase. It was design critique, not scraping or executable
proof. Its price/currency/query/tax concerns informed verification. Root rejected
its rounding suggestion (invalid precision is rejected) and did not replace raw
source hashes with normalized hashes: exact-source provenance and dedup identity
are separate concerns.

## Remaining limits

Google official Hotel Center API is own-account/partner scoped, not public bulk
competitor calendars. Public detail/search/RPC robots restrictions apply. No new
Dubai listings, Google rates, full-month/calendar inventory or all-OTA coverage
was acquired. See research 726 for primary-source URLs and runnable instructions.

Socket timeout is inactivity, not hard wall-clock deadline; DNS/slow-drip may
exceed it. Evidence hashes are format-checked, not independently authenticated.
Child ages, member/device/point-of-sale context, provider-specific dated adapters,
permitted market feed, recurring refresh, persistent app/Drive ingest and fuller
ecosystem remain unbuilt. A crash between fetch receipt and report can lose parsed
candidates; resume truthfully reports already-fetched without storing page bodies.

`state.sh` failed because this host's WSL Bash is absent; `state.ps1` ran. Its default
Compose project lookup is not an uptime proof for the differently named running
stack. No application lifecycle operation occurred in this order.
