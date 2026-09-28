# PR-FIX-005 - Repair native test fixtures without changing authority

Authority: founder's standing repair-all-public-PRs directive. PR93 remains
stacked on PR92; no live runtime, credential or permission-policy change.

## Scope

- tests/pricelabs-import.test.ts: reuse an already-existing approved directory
  without resetting its ACL; create and protect only a uniquely owned fixture.
- tests/project-status.test.ts: diagnostic assertions only if necessary. Preserve
  deadlines, slow-child cleanup, no-survivor and fail-closed requirements.
- Local Git info/exclude: exclude the three owned PR93 temporary proof paths,
  not any tracked source or broader user directory.
- This order, questions/PR-FIX-005-native-test-fixtures.md and a paired receipt.

The first full native suite retained 2278 passes, 1538 skips and three failures:
an existing readonly test-parent mkdir, a canonical status lifecycle deadline,
and a slow-table status cleanup failure. The latter passed on isolated rerun;
do not turn a failed cleanup proof into success or loosen a runtime bound.

Do not chmod, delete or change ACLs on the shared approved parent. Preserve its
allowlist and all host restrictions. Keep the importer private-output proof.
First exclude only the owned dependency backup and venv from Git scanning, then
reproduce status failures before proposing any deadline or runtime-source change.
Any wider source need requires a new question/order before editing.
