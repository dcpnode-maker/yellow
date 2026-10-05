# Scope question735 — history wrapper regression assertions

Order734 replaces the direct FolioStatementTable child with FolioHistory, which
still renders that same table while adding bounded page state. Older672/721 tests
assert the old direct-child literal; these test files are outside734's initial scope.

## RESOLVED

Root explicitly extends734 to update only those two component-identity assertions,
preserving the folio-key binding and adding proof that the history wrapper still
renders FolioStatementTable. All other mutation-lock/recovery assertions remain.
Builder must run both complete affected tests and the independent reviewer reruns
them. No application policy/backend/grants or unrelated baseline repair.
