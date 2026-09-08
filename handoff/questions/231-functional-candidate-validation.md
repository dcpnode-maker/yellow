# Q231 — Exact non-UI candidate validation and publication

**Status:** RESOLVED bounded coordination for Orders447/448, Q230.

CI34165275976 passed the complete Order446 and Order447 database steps but failed
the subsequent readiness oracle described in Q230. A combined non-UI candidate
may contain the exact seven448 functional paths plus that test-only repair, without
waiting for an unchanged parent CI to become green. This admits publication for
exact-source CI, not final acceptance of an unverified candidate.

Preserve the existing seven-path d0e6ba48fe5b3cda11bfb640d47c61bc657b0b37 candidate
and its manifest/evidence. Create a new disposable candidate index for the combined
source. Root reviews its complete scoped diff. Preserve all unrelated real-index
entries/flags and worktree edits, notably the paused UI changes in app.ts and
operator.ts. Neither full mixed working file may be staged into this candidate.

Reuse ONLY the existing source validation artifact at
`D:\Yellow\temp\order447-functional-validation-20260908`. Verify its complete
previous tracked blob manifest first, and its existing node_modules junction to
the active dependencies. Update only the old/new tree delta with exact Git blob
bytes and validate the entire resulting tracked tree. Never create another
worktree, .git checkout or dependency copy. Keep previous archives and logs; do
not recursively delete the source artifact or any dependency path.

Run the full nonvisual standing suite, typecheck, import boundaries and license
check in that exact candidate context with database/provider/runtime authority
variables removed. Bound processes/output and retain every result. Git operations
use a disposable index; source archive changes do not alter HEAD or real index.

After accepted native448/Q229 evidence and standing checks, root may publish the
exact source plus truthful scoped order/review/contract/status records to the
existing branch/PR. Use an expected-parent reference update and preserve all
unrelated staged entries and flags. No main merge, UI, local promotion, provider
activation or phase-complete claim. Exact-source CI is still mandatory before
final acceptance, and any failure must be diagnosed rather than silently rerun.
