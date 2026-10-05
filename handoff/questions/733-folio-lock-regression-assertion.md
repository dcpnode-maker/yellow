# Scope question733 — adjacent lock assertion

Independent review found tests/order672-folio-workbench.test.ts still expects the
pre-727 deposit ownership expression. Order727 changed that expression but did not
list this older test. Implementation paused for this out-of-scope file.

## RESOLVED

Root authorizes a separate bounded Order733 to update only this literal,
preserving the ownership guard and executing the entire affected test. No financial
behavior, unrelated navigation baseline, grants or backend changes are authorized.
