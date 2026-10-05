# RELEASE-20261001 — dependent series catalogue reference review

Status: bounded source change independently accepted; final required CI and laptop-owned integration remain pending.

I reviewed the frozen candidate on basis `808064df0d98c511f821ef33d6fd373eda9af7d3` as a non-implementer. The six admitted paths are exactly:

- `tests/india-native-fiscal-series-authority.integration.test.ts`
- `handoff/orders/RELEASE-20261001-series-reference.md`
- `handoff/questions/RELEASE-20261001-series-reference.md`
- `handoff/reviews/RELEASE-20261001-series-reference.md`
- `DECISIONS.log`
- `handoff/LEDGER.md`

The test change is limited to the Order453 source-contract reference derivation. It asserts the current two-key Order452 projection, transforms that projection to the existing six-key series projection, normalizes CRLF on both sides of the full-query comparison, and retains the original eight relation-field guards and six structural-evidence guards. The six exclusion names and the series helper SQL are unchanged. The root cause matches the failed quality job: the former literal skipped the current relation expression and matched the unchanged constraint expression.

I reproduced the exact-basis baseline failure from `git show`: **0 passed, 1 failed, 3 assertions**. The frozen source file SHA-256 is `9287e16b61b55b46f7e0970916fd1d1e8317d50d11edf36f3404ebce08e2aad6`; its focused source-contract test passed **1/0/18**. A CRLF-converted shared helper also passed **1/0/18**. An ephemeral missing-projection variant failed at the new presence assertion. A paired ephemeral removal of `pg_get_functiondef` from both helper references preserved full-query equality and failed at the original structural-evidence guard. All variants were under `/tmp`; no source fixture was changed.

TypeScript compilation, all **207** import-boundary checks, and `git diff --check` passed. The unchanged canonical `./setup.sh --db-only` proof passed **11/11** with **130 tables** after migrations 1–100. Its wrapper stopped and restored only the exact owned synthetic app; the app image was unchanged. The read-only retained synthetic `yellow_dev` ledger census found 100 entries, max version 100, none at or above 101, and version 100 checksum `f70844b2c8205c286f7f552dd1f8a4a2023645f70dcd00dbdacc7c777b0415d4` for `0100_housekeeping_transition_timestamp_precision.sql`. The census makes no claim about unseen laptop or other databases.

The final default standing proof passed **2520 tests, 1579 explicit database skips, 0 failures, and 44979 assertions** in 63.57 seconds under the unchanged external subreaper. The final source tree still requires exact required CI, laptop receiving-tree, and live serving identity/readiness proof before release acceptance. No migration, either catalogue helper, database test body, authority file, or protected referee/schema source changed in this candidate. The 100 migration files match `a0fecd98`; this worker source and the observed retained database end at version 100 with no 0101 allocation or application.

Outside-Git receipts and focused logs are retained under `/workspace/yellow-coordination/release-20261001/`, including `series-reference-baseline-final.log`, `series-reference-candidate-final.log`, both negative variants, the CRLF-positive result, `series-reference-types-final.log`, `series-reference-boundaries-final.log`, `series-reference-ledger-census.json`, and `independent-arm64-index-canonical-drained.json`.
