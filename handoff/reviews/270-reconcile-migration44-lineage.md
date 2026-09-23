# Order 270 — Independent Tier-3 review

**Verdict:** APPROVED
**Reviewer:** independent non-implementing OpenAI Codex Tier-3 reviewer
**Reviewed commit:** `6547862165c23ff64392c288cd8726a3c0d46137`
**Reviewed range:** `f2beeb1f49d6e350a0181bfd91444899ec798e88..6547862165c23ff64392c288cd8726a3c0d46137`
**Date:** 2026-08-29

## Independence and scope

I did not implement Order270. I read `PROJECT.md`, `AGENTS.md`, live `state.sh`,
Order270, D-703/D-704, the relevant Order262/266/267/268 evidence, migrations0044,
0045 and0046, the migration runner tests and the directly affected financial/security
tests. I inspected the complete candidate diff and found no out-of-order historical
rewrite, ledger bypass, stable-runtime mutation or scope expansion.

Repository migration0044 is exactly34,363 bytes/878 LF lines/SHA-256
`5ea338b18aabb3cb2c5a4613c00ebf57806be881b956b13df1e2c95262cce55c`.
Migration0046 is exactly26,029 bytes/662 LF lines/SHA-256
`bd7fb83f619aabf76b7247246a096ca09275823d07cbdceeb2deec8a1e76b574`.
The `f2beeb1..6547862` migration0044 diff is exactly the two joins restored to the
historically applied `USING (ordinality)` form. The complete 649-line function body
in0046 is byte-equivalent to the corrected parent function after the required
`CREATE OR REPLACE` change, contains exactly the two explicit posting-ordinal joins,
and carries only its exact owner/revoke/grant containment. Fresh and historical
function definitions converge exactly.

## Reviewer-executed proof

I used only collision-proof disposable Compose project `y270review-6547862` on
PostgreSQL port56270 and Valkey port65270. The final proof used one uninterrupted
login-shell lifecycle and logging-safe authority import; no protected value was
printed.

- `bun test tests/migration44-lineage-reconciliation.intentional-red.test.ts`:
  `2 pass / 0 fail`.
- `./setup.sh --db-only`: fresh migrations1–46 for dev and test, exact46 migration
  rows/98 public tables/88 policies, and referee `11 passed, 0 failed of 11`.
- `YELLOW_REQUIRE_DATABASE_ACCEPTANCE=1 bun test
  tests/database-acceptance.integration.test.ts`: `11/0` with26 assertions.
- `bun run schema:check`: strict fresh schema exactly matches
  `tests/schema/expected.sql`; this is the textual schema and ACL oracle.
- Order262 positive-tax posting: `9/0` with70 assertions. Order266 positive-tax
  correction: `8/0` with68 assertions. Adjacent financial corrections and statements:
  `9/0` with53 assertions plus `12/0` with48 assertions.
- Runtime-DML authority: `5/0` with105 assertions. SECURITY-DEFINER containment:
  `3/0` with174 assertions.
- `YELLOW_REQUIRE_MIGRATION_DB=1 bun test tests/migrate.integration.test.ts` against
  the disposable cluster's unprotected `postgres` admin database: `39/0` with182
  assertions, including the Order270 staged1–44 binary-ledger/no-op case.
- Native `bun test`: `848 pass / 0 fail / 775 skip`, 8,547 assertions across1,623
  tests/292 files. `bun run typecheck`, 97-file import boundaries, 23-package licence
  policy, `bun audit` with no vulnerabilities, and `git diff --check
  f2beeb1..6547862` all passed.

## Retained historical archive proof

I independently verified the restricted Order267 archive at
`D:\Yellow\backups\yellow-order267-reconcile-20260829T022152Z.dump` as630,690 bytes,
SHA-256 `b427ea1ae369ddd6c6aa043f154aedcc304671b7886b4213c54d1dd0662c5201`,
891 readable catalogue lines, protected inheritance, and only owner plus SYSTEM
FullControl ACLs. I restored it only into disposable database
`yellow_order270_archive_review` in the unique review project.

The restore began at exact44 migration rows/98 public tables/88 policies and exact
migration0044 hash. Before upgrade I captured every field of ledger rows1–44 through
PostgreSQL binary encodings (`int8send`, `textsend`, `timestamptz_send`, including
`applied_at`) and captured counts for all97 non-ledger public product tables. Applying
the repository runner applied exactly0045 and0046 and reached46/98/88. Every captured
historical ledger byte and every product-table count remained identical. A second run
reported `applied=0 status=no-op` and `transaction_pids=none`; all46 ledger rows and
all product counts remained unchanged.

The archive intentionally has no ACL entries, and custom dump/restore canonicalizes
redundant CHECK-expression parentheses. It is therefore used only as the historical
ledger/data-preservation oracle, not as a strict textual schema or ACL oracle. Fresh
setup, schema drift, database acceptance, runtime-DML and SECURITY-DEFINER proofs
supply those strict oracles.

## Discarded harness attempts, cleanup and stable nonmutation

I retained rather than concealed four harness-only failed attempts: a split
login-shell lifecycle removed the first disposable containers before direct tests;
PowerShell expanded inline Bash variables to empty values and caused authentication
failures; the first migration-suite call correctly rejected protected admin database
`yellow_dev`; and the temporary untracked reviewer script made seven standing
boundary/provenance tests red. The corrected uninterrupted proof used a temporary
script created/deleted via `apply_patch`, the unprotected disposable `postgres` admin
database, and a clean-tree standing rerun. All final required commands are green;
none of those discarded attempts reached or disproved a product assertion.

The disposable containers, database, volume and network were removed, and proof
ports56270/65270 are closed. The sole stable runtime was never targeted. Exact app
`b084c60b9fe615f4aed9197dd71e7d77ddfdeb88e5a42496b039f55ef06f2c2f`, PostgreSQL
`f4f02655770a997df7641c887fe241e6002c1de7d847eaafc9db873ed7c52d12`, and Valkey
`aa3061bdf23123cc29447e338af6d28b2c89d50bc5daaf0222c89df040d052fa` remain running,
healthy and restart0 with their exact retained start times/images. Only
`127.0.0.1:3000` listens; ports3002/3188 and all proof ports are closed, and stable
`/health` returns HTTP200 `{"status":"ok"}`.

No blocking finding remains. Approval is limited to Order270's forward-only
migration0044 lineage reconciliation at the exact reviewed commit. It grants no local
promotion, merge, public deployment, Phase7-complete or application-complete claim.
