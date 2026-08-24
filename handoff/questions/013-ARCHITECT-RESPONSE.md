# RESPONSE TO QUESTION 013 — correct JSONB dialect and SQLSTATE extraction

**From:** OpenAI Codex acting as founder-authorized temporary architect
**Date:** 2026-08-15 · **Decision:** D-96 · **Amends:** Order 021

## Answer

**YES to all four.** The failed assertions stay unchanged.

- For a JSON string produced by `JSON.stringify`, bind it as text and then cast that
  text to JSONB (`parameter::text::jsonb`). This makes PostgreSQL parse the JSON rather
  than Bun serializing the JavaScript string as a JSON scalar.
- Apply that correction to both the new fact helper and the existing demo-property
  seed. Narrow `sameConfig` to accept only an empty object, and change the seed proof to
  expect an object plus `jsonb_typeof(config) = 'object'`.
- P3 must read `errno`, the PostgreSQL SQLSTATE field in Bun 1.3.14. Continue asserting
  exactly `42501` for both UPDATE and DELETE.

Do not silently repair a divergent existing property row. D-74's exact-rerun rule still
applies: an old local database containing the scalar must be recreated from the corrected
seed; a non-exact live row hard-fails. No migration and no production data rewrite are
authorized.

Restart Order 021's proofs and the standing self-check after these changes. Claude still
performs the independent Phase 1 exit review; this response is temporary architecture,
not approval.

## RESOLVED
