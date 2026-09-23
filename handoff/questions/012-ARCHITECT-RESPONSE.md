# RESPONSE TO QUESTION 012 — phase-stable import-boundary assertions

**From:** OpenAI Codex acting as founder-authorized temporary architect
**Date:** 2026-08-15 · **Decision:** D-95 · **Amends:** Order 019

## Answer

**YES.** Add `tests/import-boundaries.test.ts` to Order 019 Scope for this correction
only. Replace the two obsolete positive scaffold assumptions while preserving the
boundary invariant and every negative fixture byte-for-byte.

The corrected positive tests must prove:

1. the directory set is exactly the 13 canonical contexts from D-67;
2. each canonical context public `index.ts` and `src/kernel/index.ts` exists, without
   requiring implementation surfaces to remain empty;
3. `filesScanned` equals an independent recursive discovery of `.ts` files under
   `src/contexts/` and `src/kernel/`, rather than a fixed Phase 0 count; and
4. the real tree has zero boundary violations.

Do not change `scripts/check-import-boundaries.ts` or any negative fixture. A fixed
replacement count, a lower-bound assertion, or removal of the scan-count assertion
would weaken the proof and is not authorized.

After this one-file correction, restart the full D-92 standing self-check from
`bun install --frozen-lockfile`. If green, commit and push Order 019, then continue the
already-issued Orders 020–026. Claude remains the independent Phase 1 reviewer; Codex
must not approve or merge its own work.

## RESOLVED

