# Order 430 — India native fiscal invoice issuance

**Verdict:** CHANGES REQUIRED — D1316
**Candidate:** exact `4e56f74093984432bdfe5193276a810e34b0549b` over approved Order429 base `25d1db3`
**Reviewer:** `/root/order430_final_tier3`, fresh independent non-implementing Tier-3 reviewer

## Blocking product finding

`commit_india_native_fiscal_invoice` does not bind its caller-supplied
`preDocumentJson`, `sourceEvidenceHash`, `preDocumentEvidenceHash`, or
`readinessEvidenceHash` to the genuine Order429 evidence that the TypeScript service
resolved. The capability re-resolves persisted supplier/recipient identities and
integer totals, but it checks `SellerDtls` only for JSON object shape and checks the
three evidence hashes only for 64-character hexadecimal shape.

I proved the bypass through the exact governed `yellow_runtime -> SET LOCAL ROLE
app_role` path on a genuine persisted source and configured series. I changed the
approved seller GSTIN from `27ABCDE5751F1ZM` to `29ABCDE1234F1Z5`, changed the legal
name to `FORGED SELLER PRIVATE LIMITED`, and supplied unrelated hashes consisting of
64 zeroes, ones, and twos. The database capability returned one issued document and
persisted all forged values and all three unrelated hashes. The stored document hash
correctly authenticates the forged body; it does not authenticate that the body is
the exact approved Order426/429 body.

This violates D1304 and Order430's trust boundary: the internal capability must
independently bind buyer/supplier identity before trusting frozen composer evidence,
accept only the service's exact Order429 hashes/body, and preserve exact Order426
party evidence. The fact that the TypeScript service normally supplies honest input
does not repair the owner capability's independently required validation.

Repair must make any changed SellerDtls/party evidence or any substituted Order429
hash fail before number allocation and leave the counter, document, origin, fact,
outbox, and idempotency inventories unchanged. Permanent PostgreSQL hostility proof
must execute that negative case through the governed runtime/app-role capability; a
shape-only/static assertion is insufficient. A different fresh Tier-3 reviewer must
repeat the complete proof.

## Reviewer-executed evidence

A fresh native PostgreSQL 16.15 cluster applied all 74 migrations and reported 125
public tables. The exact repaired suite passed **13/13 with 568 assertions**, including
100 distinct governed sources in one tenant/property/series, exact numbers `1..100`,
counter `101`, exact 100 document/origin/fact/event/completed-key inventories, and a
recomputed complete genesis-to-tail hash chain. Replay/rollback/no-reuse,
immutability, RLS, hostility, reversal-first, issue-first, seal-first, and
issue-first-then-seal cases passed.

After resetting the populated database, Order408 plus audited-seal compatibility
passed **15/15 with 161 assertions**. Native unit/static proof passed **12/12 with 75
assertions**; SECURITY DEFINER containment passed **3/3 with 210 assertions**. The
normalized native schema dump matched `tests/schema/expected.sql` byte-for-byte:
**933,734 bytes**, SHA-256
`a5cd39c835bcc29480d4848aca69b1a109776eb9113cb9c797bc6ee26a18b948`.
A separately fresh migrated and fixture-loaded database passed referee **11/11**.

Standing proof passed **1,473 tests, 1,067 expected environment skips, 0 failures,
20,733 assertions** across 2,540 tests/469 files. TypeScript, 161-file import
boundaries, 23-package licences, dependency audit, and diff check passed. Migration
0074 SHA-256 remained
`449bf89b617a9e520450b8268f1368943044f2937df62a516a18d1d01f53e931`.

One first adjacent-suite run reused the populated native database and was discarded
after fixture collisions; its clean reset produced the reported 15/15 result. One
first referee invocation hit only Windows console encoding; that database was
discarded, recreated, migrated, reseeded, and the exact referee passed 11/11.

The shared branch advanced after review began only by later Order432 governance/test
changes. `git diff 4e56f74..HEAD` was empty for migration 0074, the Order430 service,
factory, and native tests; all Order430 proof covered the requested candidate.

## Authority and cleanup

Order430 remains active and unapproved. No document, numbering, series, IRP/provider,
API/UI, local-runtime, Phase-7, merge, push, or deployment authority is granted.
The disposable PostgreSQL server, databases, credentials, and cluster directory were
removed after review.
