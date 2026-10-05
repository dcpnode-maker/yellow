# RELEASE-20261001 — current fiscal-series fixture frontier

Status: bounded implementation/proof pending; independent review controls publication.
Basis: published a00ca3f941d601df6a436db53612d58b2f4f4729; draft PR98.
Laptop remains source/controller and final integration owner.

## Verified cause and strict remedy

Official CI36819524694 quality/Windows/local-review/nativeARM64/container pass.
Database passes migration, seed, fiscal434, credit446/447 and credit452, then fails
Order453 beforeAll at india-native-fiscal-series-authority.integration.test.ts:99:
strict current-mode max migration expectation99, actual100. Workflow intentionally
migrates the current target using all canonical migrations. The current release
contract src/kernel/build-info.ts exports CURRENT_MIGRATION_FRONTIER=100 and the
canonical tree contains exactly100 unchanged migrations through0100. This is a
stale current-target fixture admission expectation, not a lifecycle/SQL defect.

Replace only the current-mode literal99 with the existing exported canonical
CURRENT_MIGRATION_FRONTIER. Preserve exact equality, native-draft89, the paired
restricted role/target guards, exact function body guard, all database tests,
assertions, deadlines, historical prefix89 upgrade target and publication evidence.
Do not infer the expected frontier from the target database or accept >=/any frontier.

## Exhaustive eight-path scope

- tests/india-native-fiscal-series-authority.integration.test.ts: extend its
  existing kernel import and replace only the current-mode99 literal.
- tests/fiscal-retry-readiness.integration.test.ts: only its current-target
  migration count99 to existing CURRENT_MIGRATION_FRONTIER; retain full exact
  object equality, frontier, migration86 checksum and retry helper signature.
  Add explicit canonical-CI admission for exact current90_ci database/address,
  retaining original native PostgreSQL16 expectation and strict canonical18.
- .github/workflows/ci.yml: ONLY add explicit Q212 canonical-CI admission
  and exact existing POSTGRES_ADDRESS parameters to its current-readiness command.
- This order, handoff/questions/RELEASE-20261001-series-frontier.md and
  handoff/reviews/RELEASE-20261001-series-frontier.md.
- Append-only DECISIONS.log and handoff/LEDGER.md.

No product/domain, fixture helper, migration, schema, CI job/deadline, existing native target admission,
source lifecycle, live/production database, credentials, deadline or referee change.
All100migration bytes and protected kernel/frontier source remain unchanged. No0101.
No merge/deploy/laptop overwrite, tunnel-routing cutover or paid fallback in this order.

## Functional proof and publication

A non-implementer personally reproduces the exact Git baseline99-versus100 failure
on an owned disposable current target migrated through100, then executes full series
configuration/HTTP proofs on the candidate. Review wrong-frontier99/101 negatives
and native-draft89/source guards without touching tracked/product data. Run the
unchanged historical prefix89-to90 upgrade and Q212 current readiness proofs from
the corresponding CI slice if independently supported; any actual further failure
must be separately evidenced before changing scope. Do not mask a failure/skip or
rewrite protected historical contracts. Run types/boundaries and unchanged canonical
setup.sh --db-only11/11 before source publication; default standing after source
freeze. Preserve previous official RED/skipped gates; a new exact-source CI run is
required. Return immutable head/tree/allpaths/proofs and remaining hosting/local
integration blockers to the laptop controller.

## Dependency amendment before the second test edit

The exact subsequent CI Q212 current-readiness slice also migrates all100 files.
Its retained frontier assertion already uses CURRENT_MIGRATION_FRONTIER, but the
same exact object pins migration count99 at fiscal-retry-readiness line329. This
independently inspectable source mismatch is admitted before editing that path;
review must reproduce its RED on the exact fresh100 target before candidate proof.
Only the count literal changes to the same existing canonical constant; migration86
checksum/helper identity, strict full object equality and every other guard stay.
Historical native89 and upgrade89/90 remain immutable. No workflow/runtime change.

## Executable dependency amendment before PG-major/admission edits

Root non-implementer personally reproduced baseline authority4pass/1fail/49 on
real100, candidate fullseries+HTTP17/0/1318, four pre-fixture admission denials and
strict reader99/101 negatives. The next exact Q212 baseline fails earlier than its
count assertion: paired deployment/runtime identities pass, but its original
serverMajor16 assertion rejects canonical18 (1pass/1fail/8). The current CI uses the
pinned18.6 image; legacy native16 remains governed separately.

Before these edits, admit only an explicit YELLOW_REQUIRE_ORDER453_Q212_CI_CANONICAL
flag plus exact YELLOW_ORDER453_Q212_CI_DATABASE_ADDRESS. This branch must require
mandatory proof, paired target, exact yellow_order453_q212_current90_ci name,
matching loopback authority and port other than native55503. An unflagged CI-name
target must reject. CI mode expects exactly18; other existing native admission
continues to expect exactly16. No >= or accept-any server major. The workflow adds
only these two inline parameters. All tenant/runtime identity/fingerprint/role/
checksum86/helper and hostility/restore checks remain. Review independently proves
legacy16 baseline RED, isolates original count99 RED with only an outside-Git
major18 reference adjustment, then executes actual admitted candidate and invalid
CI-flag/address/name/role controls. Historical upgrade89/90 remains untouched.

## Final executed proof and review freeze

Nonimplementingroot personally current17/0/1318,Q2128/0/68,historical89→90
5/0/169,canonical11/11 executes. Exactbaseline99/1004/1/49; legacymajor16/18
baseline1/1/8 and countbaseline1/1/10 preserved. Eleven authority/configuration
negatives reject before fixtures; strictreader99/101 negatives reject. Owned
scratch databases removed and identical syntheticapp image restored. Types207
boundaries/whitespace pass. Finaldefault2520/1579DBenvskips/0/44979 in62.84s,
unchangedexternalownedsubreaper116reaps. Eightpaths/3sourcehashes frozen inreview;
all100canonical migrationfiles/kernel/refereebytes untouched,no0101. Bounded
sourcepublication accepted; newexactCI determinesreleaseacceptance. Earlier
RED/partiallyexecutedreceipts retained and classified; no hiddenwaiver.
