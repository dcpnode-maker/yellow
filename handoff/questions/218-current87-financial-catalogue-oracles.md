# Q218 — Current87 acceptance catalogue repair

**Status:** RESOLVED technical scope, Order446. **Date:**2026-09-08.

Exact7f416a0e CI34152535210 fails the cumulative database gate at
tests/financial-postings.integration.test.ts:194: expected128 public tables,
actual129 after canonical0087. Five other CI jobs and normal CodeQL are green;
later credit/readiness/upgrade/referee CI steps were skipped, not passed. The
independent native87 schema/referee remain separately proven.

Read-only sweep identifies one additional full-current catalogue oracle in
tests/india-gst-accommodation-quoted-rate-applicability-recording.integration.test.ts
still expecting86/128/118/118/27/2. CI runs that suite on the full current source;
it is not a historical-prefix test. Exact87 truth is87/129/119/119/28/2.

Admit only the two assertion/title corrections in those exact files and a pure
regression in tests/setup-current-catalogue-oracle.test.ts tying their literal
oracles to the already checked current migration/schema frontier. Preserve all
financial/ACL/tenant/trigger assertions, timeouts, old prefix migration proofs,
merged/local status literals and cryptographic byte counts. No product or SQL
change, generic shared-cluster bootstrap, seed reset, UI or runtime promotion.

Root records red/green focused proof and publishes exact test-only paths, retaining
paused UI and in-progress447 source outside that commit. New exact-source CI must
execute the previously skipped real database gates before merge/release.
