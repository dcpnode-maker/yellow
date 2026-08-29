# Order 270 — Reconcile historical migration0044 lineage forward-only

**Status:** READY-D703
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/reconcile-migration44-lineage`
**Base:** `38c419d` (built Order269 status through approved Order266)
**Risk tier:** 3 — applied migration identity and governed financial posting function
**Owner:** Codex implementation; independent non-implementing execution mandatory

## Authority and outcome

The retained sole-local ledger proves migration0044 was applied with SHA-256
`5ea338b18aabb3cb2c5a4613c00ebf57806be881b956b13df1e2c95262cce55c`,
while the approved repository currently contains later bytes at
`c678ef9bf25e5da20298a9dada22ef5f0af7b441cb4f17659ded96c628e6ac86`.
The ordinary runner correctly blocks this mismatch. Restore the repository file to
the exact historical applied bytes and carry the only later semantic repair forward
in new migration0046, so fresh and historical-upgrade databases converge without a
ledger override or stable-runtime mutation.

## Proven recovery

The exact applied file is recoverable losslessly from retained local rollout
`D:\Yellow\codex-sessions\2026\08\28\rollout-2026-08-28T23-52-14-01a0499b-aed6-71c1-816b-07b4ccaa698d.jsonl`:
line3086 Add plus line3192 Update, stopping before line3249, yields34,363 bytes,
878 LF lines and exact SHA-256 `5ea338…55c`. The later line3249 patch changes exactly
two `record_positive_tax_journal_binding` joins from legacy
`JOIN requested USING (ordinality)` to explicit
`ON requested.ordinality = canonical_taxes.posting_ordinal`, yielding the current
34,457-byte/880-line `c678…ac86` file. The Order267 backup independently proves the
same historical ledger and function semantics.

## Exact scope

- restore only `migrations/0044_governed_positive_tax_posting.sql` to exact applied
  bytes;
- add `migrations/0046_positive_tax_posting_ordinal_repair.sql` containing only the
  deterministic replacement of `record_positive_tax_journal_binding` with the two
  explicit posting-ordinal joins and unchanged owner/ACL/search-path containment;
- exact migration, database-acceptance, schema and directly affected Order262/266
  tests plus the stale setup display phrase;
- this order, Phase7/build/roadmap, decision, ledger and independent review evidence.

## Forbidden

No rewrite/allow-list/ignore of `schema_migration`; no edit to migration0001 or any
other historical migration; no product row, seed, credential, role, permission,
HTTP/UI/status, stable database/runtime/cache/container/volume/local mutation; no
second local app, merge, public deployment, Phase7 or application-complete claim.

## Required proof

- intentional red proves the prior repository0044 hash mismatches exact applied truth
  and migration0046 is absent;
- repository0044 becomes byte-exact34,363/878/`5ea338…55c` and migration0046 has a
  fixed checksum with only the full governed function replacement plus unchanged
  owner/revoke/grant containment;
- fresh migrations1–46 and an isolated clone of the Order267 historical backup both
  apply/no-op and converge to exact schema/function/catalog truth; historical ledger
  rows1–44 including `applied_at` remain byte-identical;
- focused Order262 posting and Order266 correction, migration, acceptance, schema,
  referee11/11, standing and static gates are green;
- a fresh non-implementing Tier-3 reviewer personally executes the proof and records
  approval or findings before any local promotion.

## Definition of done

- [ ] Exact historical0044 bytes are restored and the delta moves to0046.
- [ ] Fresh and historical-upgrade executable convergence is green.
- [ ] Focused, standing, schema and referee gates are green.
- [ ] Independent Tier-3 approval is recorded.
- [ ] Stable local remains untouched; a later order owns promotion.
