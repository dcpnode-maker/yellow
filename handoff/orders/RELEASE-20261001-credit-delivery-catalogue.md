# RELEASE-20261001 — credit-delivery catalogue maintenance statistics

Status: implementation and independent local proof complete; final required CI
acceptance remains pending. Separate independent review controls source publication.
Phase 7 bounded worker successor; laptop owns final integration and acceptance.
Basis: reviewed `20c9ee13e11c8a9a146687b7d79c43a9c36ef420` on isolated
`phase-7/release-local-gates-20261001`. Published PR98 remains at937912 while
two separately reviewed successor commits are prepared for one fast-forward.

## Verified failure and finite repair

Official CI36813515138 database job110214181377 passes migrations, seed, native
fiscal434 and credit446/447 before one Order452 upgrade proof fails. Its
predecessor body/default fault is correctly rejected with SQLSTATE55000, and the
row/ledger hashes remain unchanged. The post-rollback catalogue comparison differs
only in estimated `pg_class.relpages` and `reltuples` for schema_migration and its
two indexes:0/-1 or1/0 become2/88. These are ANALYZE/VACUUM planner estimates,
not schema definitions. Other three upgrade tests pass.

`creditDeliveryCatalogue` currently serializes complete pg_class records. Remove
ONLY those two observed estimate keys from that relation projection. Preserve all
other pg_class fields, full columns/functions/constraints/triggers/policies,
row hashes, migration ledger/checksums, actual rollback and hostile fault checks.
Existing Order453 normalizes additional maintenance fields; this order deliberately
admits only the two demonstrated here. No migration, source domain or CI changes.

## Exhaustive scope

- `tests/fixtures/india-native-credit-delivery-fixture.ts`: relation JSON projection
  subtracts exactly relpages/reltuples, with a precise maintenance comment.
- `tests/india-native-credit-delivery-upgrade.integration.test.ts`: one additive
  owned-fixture proof of stable catalogue/row hashes across real ANALYZE and of
  changed catalogue for column nullability and RLS flags. Reuse existing mandatory
  paired admission and disposable rollback target; no new target/database or
  product table mutation. Preserve every original test/assertion/deadline.
- This order, `handoff/questions/RELEASE-20261001-credit-delivery-catalogue.md`,
  and `handoff/reviews/RELEASE-20261001-credit-delivery-catalogue.md`.
- Append-only `DECISIONS.log` and `handoff/LEDGER.md`.

The probe is a uniquely named owner-created public table on the admitted disposable
target, created only after proving its absence and dropped in finally only when
this test created it. No ALTER/DELETE/TRUNCATE of product tables, credentials,
real guest/payment data, reset, deadline expansion, skip or test assertion removal.
Protected migration/schema/referee and all application files remain byte exact.

## Acceptance

1. Independent non-implementer reproduces the new deterministic ANALYZE proof RED
   with the old helper on an owned clone; verifies changed fields and unchanged rows.
2. Candidate passes all five Order452 populated upgrade cases on fresh admitted88
   with actual canonical88→89 migration, predecessor faults, late rollback, exact
   ledger/checksum and no-op assertions. Require genuine structural/RLS changes
   to remain detectable and reject invalid authority/target admission before fixtures.
3. Types/import boundaries and whitespace pass. Unchanged setup11/11 must pass on
   the owned canonical stack, pausing/restoring only its exact synthetic app if needed.
4. Independent review freezes exact seven-path scope before commit/publication.
   Publish reviewed ARM index plus this separate successor by fast-forward only;
   never self-merge/deploy or overwrite dirty laptop source.
5. Track genuine native ARM64 and ALL required CI jobs on the exact new source.
   Bind synthetic merge serving revision to reviewed branch through Git-tree equality.
   Laptop receiving ownership/hunks and live image/readiness remain separate proof.

## Personally executed independent evidence

Seven actual-file authority controls reject before fixtures. On the required fresh
canonical88 target, the old helper with the unchanged new ANALYZE test is RED:
0pass/1fail/4assertions in904ms. Final candidate passes all five upgrade cases:
5pass/0fail/159assertions in5.84s, retaining the original predecessor body/default
faults, production-runner rollback, canonical88→89 preservation and exact no-op.
Unchanged setup gives11passed/0failed,130tables in5.29s. The disposable target and
probe are removed; the same exact owned app container/image is restored. Source
hashes remain frozen. This worker branch contains migrations1–100 unchanged from
e06; no0101 is introduced or allocated. Final genuine CI and laptop receiving/live
proof remain pending.
