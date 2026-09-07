# Q219 — Dedicated current credit-provider journey proof

**Status:** RESOLVED technical scope, Order447. **Date:**2026-09-08.

Existing signed-provider integration suites intentionally prove historical prefix81
and must not acquire a silent dependency on credit migration88. Admit the new
tests/india-native-credit-provider-journey.integration.test.ts instead of widening
their required source frontier. It reuses existing real encrypted/signed synthetic
provider utilities, canonical issued-invoice and446 credit fixtures, and the real
repository/worker/authorized receipt API. Shared new447 fixture ownership remains
with the SQL builder; coordinate exports instead of conflicting edits.

This source-only proof must cover the genuine credit request→worker→RS256-verified
receipt→durable GET journey, plus byte-identical replay, wrong original reference,
wrong signed QR document type and durable zero-financial-mutation fingerprints.
No fake verifier, real provider call, UI, new runtime package, global bootstrap or
database execution is admitted. An exact native target/preservation plan is required
before any actual integration run. Existing prefix81/86 proofs remain unchanged.
