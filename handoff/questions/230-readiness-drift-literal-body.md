# Q230 — Literal SQL body in readiness drift oracle

**Status:** RESOLVED bounded test-only repair under Order447.

Exact-head CI34165275976 at52467d4f failed database step16 after all Phase3,
migration, seed, Order434, Order446 and Order447 suites passed. The readiness drift
test replaces a function body using a JavaScript replacement STRING containing
SQL regex `$'` text. JavaScript expands that token into the post-match suffix,
corrupting the deliberately changed CREATE FUNCTION before the readiness check.
The resulting PostgreSQL42601 atposition2830 is a deterministic test-oracle error.
The same class was diagnosed in the private native drift helper earlier; its
callback repair must also reach the committed test.

Scope: `tests/build-readiness.integration.test.ts` only: make the existing body
replacement a callback preserving all original bytes, plus a focused pure
regression assertion if needed. Preserve the exact intended appended comment,
all expected drift denials/restores and every production/migration byte. No wider
test weakening, timeout change or skipped proof is authorized. Root independently
reviews and executes focused checks; exact-source CI must execute the real drift
test. No local database bootstrap, runtime promotion, provider action or merge.

Coordination/evidence may update this question, Order447 review, ledger, decisions
and project status with actual commands/results. Keep the failed CI evidence;
do not rerun unchanged source or claim the original run passed.
