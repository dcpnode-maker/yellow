# Order 270 — Reconcile historical migration0044 lineage forward-only

**Status:** APPROVED-D705
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

- [x] Exact historical0044 bytes are restored and the delta moves to0046.
- [x] Fresh and historical-upgrade executable convergence is green.
- [x] Focused, standing, schema and referee gates are green.
- [x] Independent Tier-3 approval is recorded.
- [x] Stable local remains untouched; a later order owns promotion.

## Builder evidence — D704

- Intentional red was exactly `0 pass / 2 fail`; final static lineage is `2/0`.
  Migration0044 is exactly34,363 bytes/878 LF lines/SHA-256
  `5ea338b18aabb3cb2c5a4613c00ebf57806be881b956b13df1e2c95262cce55c`.
  Migration0046 is exactly26,029 bytes/662 LF lines/SHA-256
  `bd7fb83f619aabf76b7247246a096ca09275823d07cbdceeb2deec8a1e76b574`
  and contains exactly the two explicit posting-ordinal joins in the complete
  replacement function with unchanged owner/revoke/grant containment.
- A collision-proof disposable PostgreSQL16.15 project bootstrapped migrations1–46
  for both dev/test at98 public tables/88 policies and referee `11/11`. Acceptance
  is `11/0`; Order262/266 posting/correction is `9/0 + 8/0`; inherited correction
  and statement adjacency is `9/0 + 12/0`; runtime-DML/SECURITY-DEFINER is `5/0 +
  3/0`; strict fresh schema snapshot is green.
- The migration runner is `39/0`. Its Order270 case first stages1–44, snapshots all
  44 ledger rows through PostgreSQL binary encodings including `applied_at`, applies
  exactly0045/0046, proves every historical byte unchanged, records46 rows, and proves
  the next run has zero transaction PIDs and `applied=0 status=no-op` with all46 rows
  byte-identical.
- The retained630,690-byte Order267 archive was restored only into the disposable
  database. Applying0045/0046 preserved every historical-ledger binary digest and
  every non-ledger public-table row-count digest, reached exact46/98/88, and reran as
  a no-op. That archive intentionally contains no ACL entries and a dump/restore
  canonicalizes redundant CHECK-expression parentheses, so it is not used as a
  strict ACL/textual-schema oracle; the fresh1–46 schema, function authority and
  security suites are the executable schema oracle.
- Native standing is `848 pass / 0 fail / 775 skip` with8,547 assertions across1,623
  tests/292 files. Typecheck,97-file boundaries,23-package licence policy,
  zero-vulnerability audit and diff hygiene are green.
- Two discarded harness attempts are recorded rather than hidden: a login-shell
  lifecycle stopped the first disposable database before a Windows test invocation,
  and an adjacent finance invocation initially used the runtime role where the legacy
  suites require deploy proof authority (`42501`, four setup failures). Both were
  corrected without product edits and the exact final commands are green.
- The disposable project, containers, network and volume were removed. Stable app,
  PostgreSQL and Valkey retain exact full IDs, healthy/restart0 state, the retained
  volume and sole loopback3000; ports3002/3188 and all proof ports are closed.

## Independent approval — D705

A fresh non-implementing Tier-3 reviewer inspected exact commit
`6547862165c23ff64392c288cd8726a3c0d46137` and personally reproduced the fresh,
historical-archive, migration, finance, authority, schema, referee, standing and
static proof with no blocking finding. All disposable resources were removed and
the reviewer verified the exact stable containers remained healthy/restart0 with
sole loopback3000. Full evidence is recorded in
`handoff/reviews/270-reconcile-migration44-lineage.md`. Approval is limited to this
lineage reconciliation; local promotion remains a separate order.
