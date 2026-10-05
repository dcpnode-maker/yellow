# RELEASE-20261001 — independent credit-delivery catalogue review

Verdict: **accepted for bounded source publication** under the finalized order and
resolved scope question. The finite maintenance-estimate correction and required
owned PostgreSQL proofs pass. **Genuine native ARM64 and all required CI jobs on
the published successor remain pending**, as do laptop receiving and live proof.

## Independence and source

This reviewer implemented none of the source, test, order or governance changes.
Actual shell/file access was verified. Only this admitted review and outside-Git
receipts were written; no commit, publication, merge or deployment was performed.

Basis `20c9ee13e11c8a9a146687b7d79c43a9c36ef420`, branch
`phase-7/release-local-gates-20261001`. Personally verified frozen SHA256 values:

| Source | SHA256 |
|---|---|
| `tests/fixtures/india-native-credit-delivery-fixture.ts` | `5e3751f128d0b617ec8b161e4a7bda9a88705160c47c87faa4ed9bcd6268e361` |
| `tests/india-native-credit-delivery-upgrade.integration.test.ts` | `60cf2b607a1cf5d00f548a071a22b1d66ad6b0b180f771309a539aa832e73896` |

The helper subtracts exactly `relpages` and `reltuples` from its relation JSON,
with the precise maintenance comment. Reversing those changes reconstructs the
complete basis helper. Every other relation field and the complete columns,
functions, constraints, triggers and policies remain in the comparison. The full
public-row fingerprints are unchanged. No broader Order453 normalization is used.

Removing the single additive probe reconstructs the complete original upgrade
file. Original cases, assertions, admission guards and 60/120/120-second case
deadlines remain byte exact. The probe retains Bun's default deadline. All other
tracked bytes match the basis except the admitted append-only governance;
specifically all **102 migration/schema/referee files**, every application file,
CI, setup, authority, image pins and generated assets are unchanged. This branch
retains migrations1–100 and introduces no0101. The exhaustive admitted union is
seven paths: the two test files, scoped order/question/review, DECISIONS.log and
handoff/LEDGER.md. Both records preserve their complete basis prefixes. The
finalized order and new entries accurately retain the pending release gates.

## Personally executed proof

Safe evidence is under `/workspace/yellow-coordination/release-20261001/`, named
`independent-credit-catalogue-*`. Execution reused the single owned
`yellow-catalogue-referee` PostgreSQL18.6 stack at loopback55442, its existing
mode0600 private authority, deployment `yellow_deploy` and runtime
`yellow_runtime`. No administrator role was passed as runtime.

Seven actual upgrade-file negative controls ran before any fixture creation:
missing runtime URL, deployment identity as runtime, wrong database, missing
target mode, missing CI admission, mismatched declared address and native mode
without Q241 admission. Each exited nonzero with its intended admission error;
the exact disposable target remained absent after each control.

For baseline and candidate, the runner separately proved absence before creating
only `yellow_order452_upgrade88_ci`, copied the immutable complete1–88 prefix,
ran the production migrator and used the exact existing workflow Order452
prerequisite recipe: two financial-adjustment permissions and the canonical
fiscal_provider extension schema. It retained explicit ci-canonical mode,
mandatory paired upgrade URLs, exact address and canonical-upgrade admission.
It dropped only its created target in finally. No additional serving database,
provider activation or real guest/payment data was involved.

| Personally executed check | Result |
|---|---|
| Basis helper with unchanged new ANALYZE case on fresh admitted88 | Expected **RED: 0 passed, 1 failed, 4 assertions**, 904ms |
| Actual candidate upgrade file, all original and additive cases | **5 passed, 0 failed, 159 assertions**, 5.84s; no skips |
| Unchanged `./setup.sh --db-only` | **11 passed, 0 failed**, 130 tables, 5.29s |
| Types, import boundaries, whitespace | **Passed**; 207 TypeScript files scanned |

Baseline used a task-local outside-Git mirror containing the unchanged candidate
test and exact basis helper. A test-name filter selected only the new ANALYZE
case for causal reproduction; candidate acceptance executed the actual complete
file without filters, retries or deadline/concurrency changes. Baseline failed
at catalogue equality after the raw page/tuple change assertions and complete
public-row equality succeeded. Visible raw estimates changed from0/-1 to38/2048
for the probe and1/0 to8/2048 for its primary-key index. This RED remains saved.

The probe owns a unique guarded name, proves absence, creates2048 synthetic rows,
disables autovacuum only on that new table, then runs real ANALYZE. Candidate
proves unchanged complete rows and normalized catalogue, followed by positive
catalogue changes for column nullability and enabled RLS. Cleanup drops the table
only when this test created it. Product tables receive no new ALTER/DELETE/TRUNCATE.

All original upgrade behavior passes: predecessor body/default faults reject
with55000 and preserve rows/catalogue; the unmodified production migrator's
late PZ452 fault rolls back function and ledger, preserves a genuine synthetic
credit and leaves its rollback connection usable; canonical88→89 preserves old
rows and exact ledger/checksum, passes restricted runtime discovery and becomes
an exact production-runner no-op.

The official decoded database-job110214181377 log was personally fetched. Its
visible failure fragments show schema_migration estimates0/-1→2/88 and both
indexes1/0→2/88. Bun truncates the large catalogue strings, so those fragments
alone do not constitute a complete catalogue census. The exact two-key source
diff and deterministic owned baseline/candidate proof establish this correction.
The earlier remote failure is retained; no remote GREEN is claimed for this source.

## Ownership, identity and remaining acceptance

The unchanged migration0012 active-runtime guard was preserved. Only the exact
existing synthetic app was paused during fresh prefix preparation and canonical
proof, then restored in finally with the same container and image. Both disposable
proof databases were removed; the admitted target is absent. Public health and
readiness subsequently returned200. Those endpoints serve the prior937912 build
at frontier100 and are a restoration check, not unpublished-candidate serving proof.

The effective PostgreSQL image remains verified OCI index
`77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873`, selecting native
Linux/amd64 config `c293117fcecda7344b5480222e813b9f673d7abd69b1dd95eff239b768b04f59`.
This execution supplies no native ARM64 claim. Source hashes remain unchanged
after proof, and the shared55442 proof slot has been returned free.

Publication is eligible for these bounded reviewed changes. Final release
acceptance requires genuine native ARM64 and every required CI gate on the exact
successor, with any synthetic merge revision bound by Git-tree equality. Laptop
receiving ownership/hunks and live source/image/readiness remain distinct. No
whole-phase, whole PMS/CRM, self-merge, deployment, paid fallback or laptop overwrite
is approved by this review. The laptop monitor's stop-at1% quota rule remains in force.
