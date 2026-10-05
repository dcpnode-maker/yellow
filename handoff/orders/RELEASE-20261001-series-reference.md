# RELEASE-20261001 — dependent series catalogue reference

Status: implementation and independent local proof complete; final CI pending.
Separate review controls bounded publication. Laptop owns final integration.
Basis: published `808064df0d98c511f821ef33d6fd373eda9af7d3`, draft PR98.
Laptop remains the controller and final integration/acceptance owner.

## Verified dependency and exact remedy

CI36817617539 Windows/container launcher pass. Quality fails exactly one pure
Order453 source-contract test; dependent database/ARM jobs are skipped, not proved.
That test derives an expected six-field series query by replacing the original
unfiltered relation projection in the Order452 helper. The reviewed808 successor
now subtracts relpages/reltuples and wraps that projection over two lines, so the
old literal replacement skips that relation expression and instead matches the
unchanged pg_constraint projection. The series helper/query remains unchanged.

Update ONLY this reference derivation: explicitly require the current two-key
Order452 projection, replace it with the existing exact six-key series projection,
and normalize only its one introduced relation FROM line break. Keep exact full
query equality, all eight retained relation-field guards, all six structural
evidence guards, every prior test/assertion/target admission/deadline, and the
series helper's six-key contract. Add the source-projection presence assertion so
a missing/mismatched replacement cannot silently pass.

## Exhaustive scope

- `tests/india-native-fiscal-series-authority.integration.test.ts`: this one pure
  test's reference calculation and one additive presence assertion only.
- This order, `handoff/questions/RELEASE-20261001-series-reference.md`, and
  `handoff/reviews/RELEASE-20261001-series-reference.md`.
- Append-only `DECISIONS.log` and `handoff/LEDGER.md`.

No change to either catalogue helper, database test body/fixture, application,
schema/migrations, all102protected referee/schema bytes, existing expectations,
permissions, deadlines, CI jobs or source lifecycle. No new migration/serving
database, laptop overwrite, merge/deploy, spending or credential change.

## Acceptance

Independent non-implementer reproduces the one pure baseline failure, executes the
candidate source-contract tests, and verifies the exact full equality plus every
original guard remains. Execute meaningful negative variants of the reference
projection and retained structural evidence, restored entirely outside tracked
source; no new checked-in tests are needed. Types/207 boundaries and unchanged
canonical11/11 pass before bounded source publication. Review freezes exact six
paths. Final full default standing/required CI on the new source determines release
acceptance; previousRED and skipped-job evidence remain preserved. All100migration
bytes stay identical to e06 and this branch has no0101. Laptop receiving-tree and
live serving image/source/readiness remain separate required evidence.

## Executed source-bound proof

Final one-file hash9287e16b61b55b46f7e0970916fd1d1e8317d50d11edf36f3404ebce08e2aad6
retains the original CRLF normalization on both equality sides. Builder whole-file
baseline3pass/10DBskips/1fail/33assertions, final4/10/0/48. Independent exact Git
baseline targeted0/1/3 and final1/0/18; a CRLF-converted reference passes1/0/18.
Missing two-key projection rejects before equality. Paired missing-function evidence
preserves equality but rejects at the original structural guard (15assertions).
All variants stay outside tracked source. Types,207boundaries and whitespace pass.
Independent unchanged canonical11/11/130tables passes; same owned app restored.
Final full default standing2520pass/1579explicit DB environment skips/0fail/44979
in63.57s under existing external owned subreaper,115adopted children reaped. No
concurrency/deadline/test flags changed; earlier pre-CRLF standing remains separate.
Actual SELECT-only retained synthetic yellow_dev ledger is100rows/max100/zero>=101;
last0100 checksum matches Git. No cloud0101 file/hash/application exists in this
worker source/owned retained target; unseen laptop/other databases are not attested.
