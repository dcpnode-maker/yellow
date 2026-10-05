# PR93 repair receipt - 2026-09-29

Implementation verification, not independent runtime/security acceptance.
Orders PR-FIX-003 through PR-FIX-007. Original PR93 source:
cb178fc1e06ba7c91b5b0c273a765a077c663c91; stacked PR92 base:
75a2eba1cd34d0512d010bf3f91230ebed4720e7. No main merge or live promotion.

## Preserved contracts

Resolved all 15 actual base conflicts while retaining both the governed Market
evidence/Leaflet frame and the read-only public research map/MapLibre catalog.
Their existing HTTP authorization wrappers and APIs remain separate. Both complete
test contracts are retained; research tests have distinct overture-map filenames.
Navigation now includes both destinations, with exact icon/group vectors.

The catalog builder fsyncs its completed file before readonly publication. Windows
rename atomically refuses an existing destination; POSIX keeps exclusive hardlink
publication and directory fsync. Cleanup touches only its own temporary output.
Windows does not claim POSIX directory-fsync/crash-durability equivalence.

Windows fixtures select python rather than python3 and do not mask setup failure
with chmod of a nonexistent output. The PriceLabs fixture never resets the shared
approved parent's ACL: only its random child/archive are protected. The historical
count oracle preserves the established case-insensitive PowerShell and case-sensitive
Bash contracts; neither production status script nor timeout was changed.

## Executed evidence

- Clean frozen dependency install: 48 package licenses passed, audit no vulnerabilities.
  The extraneous old dependency tree is recoverable; no lockfile/allowlist exception.
- Types and import boundaries passed (203 TypeScript source files).
- Focused merged UI/source suite: 41 passed, 2 explicit DB skips, zero failures, 903 assertions.
- Original Leaflet and research-map browser contracts passed, including actual Chromium;
  workspace eight-composition proof separately passed, 1178 assertions.
- Catalog and map unit suite: 21 passed, zero failures, 159 assertions, including
  Unicode, strict provenance, domain deduplication and wrapped bounds.
- `python tests/place-catalog-import.test.py`: 13 tests OK, including readonly output,
  complete SQLite quick_check and a losing publication that preserves winner bytes.
- Actual signed HTTP property-isolation proof: 5 passed, zero failures, 19 assertions;
  tenant/sibling/anonymous/revoked/disabled/ancestor cases were executed, not mocked.
- Owned isolated Compose `yellow-pr93-referee-0929`: migrations 1-92, 129 public
  tables, native `setup.ps1 -DbOnly` referee: 11 passed, 0 failed of 11. Protected
  migration files are byte-identical to the stacked PR92 base. Owned PostgreSQL and
  Valkey containers stopped afterwards; volumes retained. Live stack untouched.
- Native supervisor/status proof after storage recovery: 29 passed, 4 expected
  non-Windows skips, zero failures, 205 assertions; no-survivor and cleanup checks kept.
- Final `bun test`: 2282 passed, 1538 expected skips, zero failures, 44057 assertions,
  3820 tests / 608 files / 212.91s.

## Retained failures and environment

First full native suite: 2278 passed / 1538 skipped / 3 failed. Parent mkdir,
canonical status deadline and optional-probe cleanup failures were retained.
Focused repair exposed the real platform-marker oracle mismatch. The slow-probe
diagnostics remain strict; isolated reruns passed without changing runtime bounds.

Second full suite: 2277 passed / 1538 skipped / 5 failed. Supervisor receipts showed
preflight_low_space with launchCount zero. Native DriveInfo confirmed C: zero free
bytes. Only the two owned temporary dependency/proof directories were relocated,
with literal validated paths and no reparse entries, to E:/YellowProofRecovery-0929.
Relocated Python/pyarrow versions remained 3.13.1/25.0.1. Finite proof subprocesses
used TEMP/TMP below that recovery root; no global environment change. C: recovered
only about 98 MiB, so disk headroom remains limited, not solved system-wide.

The final suite ran with those temporary paths and all original storage/process
guards. No user cache, live data, other worktree, model credential or unowned process
was deleted/stopped. Original failures and owned DB volumes are not erased.

Independent invariant/runtime integration approval remains pending. CI results
and published source SHA will be recorded on the existing PR; not inferred here.
