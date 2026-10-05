# Order 430 — India native fiscal invoice issuance

## Current review — D1321 repair candidate

**Verdict:** CHANGES REQUIRED
**Candidate:** exact `794bb8a3130a89b6bc1243adc7c1e76306287610`, reviewing repair diff `4e56f74..794bb8a`
**Reviewer:** `/root/order430_d1321_tier3`, fresh independent non-implementing Tier-3 reviewer
**Date:** 2026-09-05

### Blocking finding — incomplete canonical evidence authentication

P1: migration 0074 now reconstructs the legal seller, buyer, transaction, item and
value sections from persisted rows, but it still does not independently authenticate
the complete approved Order413/426/429 evidence. The checks at lines 310–354 establish
digest consistency for supplied UTF-8 bytes and linkage among supplied descendants.
The persisted comparisons at lines 534–570 cover only selected nested fields.

In particular, the Order426 canonical lineage has four fields, as defined in
`india-irp-accommodation-validation-compatibility-pre-document-evidence-assembly.ts`.
The capability checks only `lineage.sourceEvidenceHash` at line 342. It never checks
`preDocumentEvidenceAssemblyHash`, `serviceQuantityUqcCompatibilityEvidenceHash`, or
`itemCandidatesEvidenceHash`, their exact key set, or their correspondence to the
approved child composers. Its Order413 admission similarly requires the top-level
`supplyNatureAtTimeOfSupply` key but never validates that value. The complete financial
source's predecessor hashes, journal/room-night evidence and nested source hash are
also absent from the persisted provenance comparison. The approved Order413 service
validates this ancestry explicitly before producing its canonical source hash.

A digest of caller-supplied bytes establishes consistency of those bytes; it does
not establish equality with the canonical approved composer result. Reconstructing
the legal body does not establish authenticity of the independent lineage fields.
Consequently D1304's exact-evidence requirement and D1321's claim of complete
preimage/provenance binding remain unmet. The origin record stores these hashes as
authority and incorporates the readiness hash into its origin identity, so this is
material audit/fiscal provenance rather than incidental metadata.

This finding comes from complete source-contract comparison and SQL inspection.
It is **not** a claim that I executed a new successful bypass. I personally executed
the existing permanent governed forged-seller regression; it passed and proves that
specific legal-body repair. That case changes legal content, so the new complete-body
equality check rejects it without independently exercising the omitted lineage checks.
No new exploitation harness or product mutation was created for this review.

Repair the complete evidence-authentication boundary, including canonical preimages
and child lineage, then add permanent negative regression cases that isolate evidence
integrity from legal-body equality and prove unchanged counters and zero artifacts.
A different fresh non-implementing Tier-3 reviewer must inspect the repair and
personally rerun the required proof. Existing passing suites do not close this finding.

### Personally executed proof

I read PROJECT.md, AGENTS.md, the relevant phase, architecture, workflow, roster,
Order430, D1302/D1304/D1316/D1321 and the prior review; ran `bash ./state.sh`; inspected
the exact candidate diff, migration, service, source/descendant composers and tests.
Yellow's PostgreSQL-pattern skill was also checked against the database evidence.

Fresh native PostgreSQL **16.15** binaries were taken from
`E:\yellow\toolchains\postgresql-16.15\pgsql\bin`. I created my own cluster at
`C:\Users\astha\AppData\Local\Temp\yellow-430-review-794bb8a-20260905\data`, bound only
to `127.0.0.1:55439`. No implementer database or output was reused. Init arguments:
`initdb -D <review-data> -U yellow_deploy -A trust --encoding=UTF8 --locale=C`;
start arguments: `pg_ctl -D <review-data> -l <review-root>/server.log -o "-h 127.0.0.1 -p 55439 -c max_connections=160" -w start`.
`createdb -h 127.0.0.1 -p 55439 -U yellow_deploy` created each database below.
Generated disposable role passwords were supplied only through process environment
to `bun scripts/provision-local-database-authority.ts`.

| Reviewer command / proof | Personally observed result |
|---|---|
| `bun scripts/migrate.ts`, fresh `yellow_review430` | All 74 migrations; 125 public tables; one migration backend |
| Same migration command after native suite | `applied=0 status=no-op` |
| `bun test tests/india-native-fiscal-invoice-database.integration.test.ts`, deploy/runtime URLs for `yellow_review430`, `YELLOW_REQUIRE_ORDER430_DATABASE=1`, `YELLOW_REQUIRE_ORDER413_DATABASE=1` | **14 pass, 0 fail, 570 assertions**, 129.54 seconds |
| Fresh all-74-migration `yellow_review430_compat`; `bun test tests/india-final-component-tax-correction.integration.test.ts tests/business-day-seal.integration.test.ts tests/security-definer-containment.integration.test.ts` with required database flags | **18 pass, 0 fail, 371 assertions**: 15 correction/seal cases with 161 assertions plus 3 SECURITY DEFINER cases with 210 assertions |
| `bun test tests/business-day-seal-authority.integration.test.ts`, same isolated compatibility database | **3 pass, 0 fail, 6 assertions**; total correction/seal compatibility **18/18, 167 assertions** |
| Fresh separately migrated `yellow_review430_referee`; `psql -h 127.0.0.1 -p 55439 -U yellow_deploy -d yellow_review430_referee -v ON_ERROR_STOP=1 -f tests/seed_fixture.sql`; `PYTHONIOENCODING=utf-8`, local `YELLOW_DSN`, `python tests/run_invariants.py yellow_review430_referee` | **11 passed, 0 failed of 11** |
| `bun test tests/india-native-fiscal-invoice.test.ts tests/india-native-fiscal-invoice-database.intentional-red.test.ts tests/india-irp-accommodation-fiscal-action-readiness.test.ts tests/india-irp-accommodation-fiscal-action-readiness.intentional-red.test.ts tests/india-final-component-tax-correction.intentional-red.test.ts tests/business-day-seal.test.ts tests/schema-drift.test.ts` | **28 pass, 0 fail, 195 assertions** |
| `bun run typecheck`; `bun run boundaries`; `bun run license-check`; `bun audit`; `git diff --check 4e56f74..794bb8a` | Passed; **161** TypeScript boundary files; **23** licensed packages; no reported dependency vulnerabilities |

The native suite personally proved the governed `yellow_runtime -> app_role`
self-consistent forged-party rejection with next number 1 and zero document/origin/
fact/event/idempotency artifacts. It also proved 100 **distinct persisted governed
sources** contending on one series: exact unique numbers 1–100, counter 101, exact
100 document/origin/fact/event/completed-key inventories, and every recomputed
genesis-to-tail hash link. Its replay, changed actor, rollback, immutability, RLS,
ACL, reversal-first, issue-first, seal-first and issue-first-then-seal cases passed.

Native `pg_dump -h 127.0.0.1 -p 55439 -U yellow_deploy -d yellow_review430 --schema-only --no-owner --no-comments`,
normalized using the repository's `normalizeSchemaDump(raw, true)` and LF-normalized
committed snapshot, matched **exactly**: **948,770 bytes**, SHA-256
`8d4b2f726bf76d1ebda95801a9ff76f7a05feff91a7453232ef2bc86de6590af`.
Migration 0074's reviewed Git blob is `e4f6bb7c27c6de5d9df24e32068ee38f58ea3ca4`;
its checkout-byte SHA-256 (Windows line endings) is
`58cb493c86aeb13a697f6e882656a49b5b7617d185c5cf0746de8bf2eaa4c43c`.

### Standing-suite limits

Two complete `bun test` runs each reported **1,473 pass, 1,068 expected environment
skips, 1 fail** across 2,542 tests / 469 files. Neither is a green standing gate.
The first, concurrent with native database stress, timed out in unrelated Order239
P4 after 5,317 ms (20,756 assertions overall). The second failed in unrelated
Order330 at `DevToolsActivePort` read with Windows `EBUSY` (20,752 assertions).
`bun test tests/rate-quote-tax-preview.integration.test.ts` subsequently passed
**12/12, 45 assertions**; `bun test tests/operator-app-bar-responsive-containment.intentional-red.test.ts`
subsequently passed **1/1, 4 assertions**. These focused passes do not relabel either
full run as green. An earlier focused command mistakenly named the absent
`rate-quote-tax-preview.test.ts`; it matched no tests and is not counted as proof.

### Scope and cleanup

I edited only this review file. No product, migration, stable-local, `.yellow`, Docker,
provider/IRP, commit, push, merge or deployment action was performed. The shared branch
later advanced to `1d78d6d` for parent-owned Order432 work; this review remains attached
to candidate `794bb8a` and the unchanged Order430 product blob above.

Automatic approval review rejected the combined server-shutdown and validated
recursive temporary-directory removal command as **“blocked by policy”**, without
more detail. A separate `pg_ctl -D <review-data> -m fast -w stop` succeeded; a check
confirmed no listener on port 55439. The stopped disposable cluster, three databases,
role password hashes, log and schema-check script remain only beneath
`C:\Users\astha\AppData\Local\Temp\yellow-430-review-794bb8a-20260905`.
Their deletion is **unfinished**; I did not bypass the rejection. Nothing was deleted.

## Prior D1316 review — historical evidence

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
