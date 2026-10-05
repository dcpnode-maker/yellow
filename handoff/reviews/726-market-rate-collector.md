# Order 726 — independent market-rate collector review

Reviewer: Codex agent `/root/rate_review726`, 2026-09-25. The reviewer did not
implement or edit either Python module or their tests. Implementation findings
were sent to root/the transport author, who made the repairs. The reviewer
personally inspected the resulting code and executed the proof below.

**Disposition: approved for the bounded, local Python toolkit in Order 726.**
This is not approval of an all-OTA calendar scraper, an actual market dataset,
source reuse rights, an app integration, deployment, or database change.

## Reviewed source

Working directory: `D:/Yellow/git-live-order611-source-v2`. The existing dirty
checkout and branch were retained; no staging, commit, branch change or merge.
`PROJECT.md`, `AGENTS.md`, current status, Phase 7 context, product/architecture
instructions, relevant decisions and Order 726 were read. `state.sh` could not
run because an available Bash runtime was not found; the repository's native
`./state.ps1` completed successfully. Its Compose-project service listing is not
a separate live-service health claim.

Final inspected SHA-256 values:

| Path | SHA-256 |
| --- | --- |
| `scripts/market-prototype/rate_observations.py` | `41d5865521a5760922357202119ba9c9f959d1db1225bda21ef3892f854fc50b` |
| `scripts/market-prototype/rate_fetch.py` | `2611ff98dbd5c679797cb39b451555fd96d188f6661ca808f3f4ee42c8e3b908` |
| `tests/market-prototype/test_rate_observations.py` | `a69a865c1ecb6c7628faaa84e561945e2901ce83dd001f7d50712cfe68812859` |
| `tests/market-prototype/test_rate_fetch.py` | `dae9ea91512a13541f19f6543f3e35ef90690e671d2871ad135d5b41441f9f7a` |

## Findings found, repaired and personally rechecked

1. Duplicate JSON object keys silently selected the final amount. A synthetic
   document containing both `501.25` and `1.00` for `amount` produced 100 minor
   units. Import now rejects duplicate keys; malformed JSON-LD blocks are skipped.
2. Coverage could combine alternating source origins into a complete October
   group. The original 31-row alternating-origin fixture had one group and zero
   missing dates. Final output has two source-origin groups missing 15 and 16
   dates respectively. Dates in different query URLs on the same origin remain
   comparable within the other explicit context fields.
3. Imported evidence URLs accepted private literals and invalid ports. Final
   validation rejects the reviewed loopback/localhost/private-reference and bad
   port cases. Imports remain offline, so this was invalid provenance acceptance,
   not an executed SSRF request.
4. A timezone conversion near year 1 raised an uncaught `OverflowError`. It now
   produces a controlled validation error. Malformed timestamp parse errors also
   use a generic message instead of echoing the supplied timestamp.
5. A literal non-ASCII robots rule (`/hotel?q=Café`) failed to deny the equivalent
   encoded query (`/hotel?q=Caf%C3%A9`). Final UTF-8 octet normalization denies
   that URL and retains encoded/unreserved query matching.
6. A permitted robots pattern composed of `/`, twenty `*a` pairs and `z` caused
   exponential regex backtracking against 2,000 `a` characters. The initial
   isolated subprocess exceeded three seconds and was killed. The explicit
   wildcard matcher completes the same case in 0.001264 seconds on this host.

Permanent tests cover the repairs. Root separately identified multicast/reserved
address handling; the reviewer inspected that repair and personally executed its
permanent regressions as part of the final suite. Public DNS results and the
connected peer must both be public,
nonmulticast, nonreserved addresses, and the peer must match the pinned result.

## Reviewer-executed proof

All proof was offline with synthetic data. The reviewer performed **zero external
network requests**, including no Google calendar request, robots probe, bnbme
access, provider authentication, or retry of a denied source.

- `python -m unittest discover -s tests/market-prototype -v`:
  **72 passed, 0 failed**, 4.777 seconds. This includes 29 unchanged listing
  collector tests, 29 transport tests and 14 observation tests.
- `python -m py_compile scripts/market-prototype/rate_observations.py scripts/market-prototype/rate_fetch.py`:
  exit 0.
- `git diff --check -- scripts/market-prototype/rate_observations.py scripts/market-prototype/rate_fetch.py tests/market-prototype/test_rate_observations.py tests/market-prototype/test_rate_fetch.py`:
  exit 0. These files were new/untracked in the shared checkout; the command does
  not substitute for the source inspection and executable tests above.
- Seven separate adversarial parser assertions rechecked duplicate keys, IPv4
  and IPv6 loopback references, localhost, bad ports, UTC underflow and the
  full-month alternating-origin coverage reproduction.
- **15,246** exhaustive small wildcard comparisons passed: patterns of length
  zero through four over `a`, `b`, `*`; targets of length zero through five over
  `a`, `b`; both anchored and prefix semantics compared with the prior simple
  regex semantics on these safely bounded inputs.
- A stronger integration proof called the actual `main` CLI argument parser
  with the real `Fetcher`, a mocked `OpenerDirector.open`, a controlled clock,
  and DNS patched to raise if attempted. It proved:
  - robots plus a synthetic Hotel JSON-LD page require two counted requests;
  - `0.29 AED` becomes exactly 29 minor units and the raw-byte SHA-256 matches;
  - query check-in/check-out dates do not fill candidate dates or calendar counts;
  - the checkpoint contains no raw HTML/title;
  - reopening the same checkpoint returns `already_fetched`, with zero new
    requests and no invented reconstructed candidates;
  - a budget of one is entirely consumed by robots, with no page request;
  - a 403 persists across reopening and blocks another path with zero requests.
  The five HTTP opens in this proof were all injected responses, not real fetches.
  Temporary synthetic reports were created and cleaned by the test context under
  `D:/Yellow/temp/market-rates-726/`.

The permanent importer smoke test also invokes the actual Python subprocess,
verifies its normalized file and zero HTTP attempts, then verifies that a repeated
output path is rejected without changing the first report.

## Scope and practical limits

The implementation uses only the Python standard library and preserves the
existing listing collector. It requires explicit HTTPS origins and URLs, a
transparent agent, sequential pacing, robots approval, request and response-size
budgets, durable host stops, and a single-writer checkpoint. It disables redirects,
proxies, cookies and authentication, rejects private/internal routes, preserves
the existing bnbme denial, and pins an inspected public DNS address while checking
TLS for the original hostname. Corrupt checkpoint schema fails before networking.
401/403/429, redirect and challenge outcomes survive restart; the scripts contain
no reset/bypass option. Transient retries require a later invocation, cooldown,
and the persistent per-URL attempt limit; they are not automatic retries in a run.

Money remains exact integer minor units with explicit supported currency
exponents. Supplied evidence hashes are format-checked, not authenticated.
Observations retain provenance, collection time, seller, dates, occupancy,
room/rate context and tax/fee unknowns. Undated JSON-LD prices remain candidates;
multi-night prices do not fill one-night calendar cells. Missing prices/dates
never become zero, sold out or whole-market coverage.

The timeout is a socket inactivity timeout, **not a hard overall elapsed-time
deadline**; DNS resolution and a continuously trickling response may exceed it.
No slow-network wall-clock guarantee was proved. Robots/challenge handling is
bounded and conservative, not a claim to recognize every possible challenge or
prove a publisher's reuse license. Child ages and audience/device/point-of-sale
context remain absent, so observations are not guaranteed equivalent comparisons.

Checkpoints retain metadata and robots policy but no page bodies. Reports must
be retained separately. Interrupted work may leave a receipt without a candidate
report; resume does not invent missing observations. No recurring scheduler,
operational database write, new schema, tenant command, payment, journal, public
deployment or actual October market dataset was exercised or approved. External
research and any separately authorized root robots-only probe belong in the root
receipt; this review does not present them as reviewer-executed network proof.
