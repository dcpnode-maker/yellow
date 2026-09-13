# Q254 — Selective publication of the accepted print repair

**Status:** admitted technical publication scope, 2026-09-13.
**Authority:** coordinator implementation/publication mandate; Order465 independent
source approval. No new financial policy or runtime authority.

## Exact publication inventory

Publish on the existing branch and draft PR92, parent
`44ef5e08f985c59d61351ecf32e503233f4038c5`, only:

- `src/http/operator/invoice-print.js`
- `tests/operator-invoice-print.test.ts`
- `docs/CONTRACTS.md` (its sole Order465 append)
- `handoff/orders/465-invoice-print-retry-receipt-compatibility.md`
- `handoff/reviews/465-invoice-print-retry-receipt-compatibility.md`
- `handoff/questions/253-native-debit-note-economic-source-policy.md`
- `handoff/orders/460-current-source-single-local-promotion.md`
  (the inspected append-only Q251/Q252 admission history)
- `handoff/reviews/460-current-source-single-local-promotion.md`
  (the inspected append-only actual recovery/migration/staging/promotion record)
- `handoff/questions/252-q251-single-local-promotion-source.md`
- this question

The two product/test hashes remain the independently reviewed identities recorded
in review465. Q253 remains OPEN, not approval of debit-note economics. No private
evidence, credentials, runtime archive, prototype or paused445 source is publishable.
The mixed DECISIONS, LEDGER and PROJECT-STATUS working/index deltas are preserved,
not swept into this narrow commit; current build/release status is also recorded in
the existing PR body and the order/review.

## Procedure and acceptance

Use ordinary native Git path-scoped commit, as already successfully used for Q251.
Before committing, confirm exact branch/HEAD, open draft PR92 remote head matches,
none of these ten paths contains a pre-existing staged change, and inspect every
selected delta. Snapshot the complete working index entries/flags, relevant refs
and source hashes. Add only the three new order/review/question records and this
question and Q252 with intent-to-add if native path-scoped commit requires tracking; no
`git add .`, reset, checkout, clean, whole-index commit or force push.

Commit message is prefixed `[codex]`. Verify the commit has exactly these ten
paths, exact expected parent and reviewed product bytes. Confirm all original
tracked working-source bytes, selected new files, preserved paused445 source and
all outside-scope staged entries/flags remain unchanged, then
ordinary non-force push to the existing branch. The source must pass fresh exact
revision CI; the parent's green CI is not successor proof. Keep PR92 draft and
never merge the coordinator's own PR.

This permits Git source publication and existing PR-body status updates only.
No new worktree, copied dependencies, database access, migration, provider action,
app restart, local artifact mutation or live promotion is admitted. If native Git
cannot preserve the dirty tree, stop that publication route and record the actual
conflict instead of constructing a broad cleanup or publication framework.

## Runtime audit receiving scope

The three additional460/Q252 paths above carry already executed evidence, not
new runtime authority. Root inspected their full diffs: both existing460 files
are append-only and Q252 is the recorded source admission. No pre-existing staged
overlap exists in them. This avoids publishing a current build without its restart
audit while preserving the mixed status/ledger/decision working and index states.
The final changed-path count is ten, not the earlier seven-path draft.

Ignored `.yellow/evidence/order465/` may hold compact JSON metadata-only preflight
and completed-publication receipts written with apply_patch. Do not copy the source,
Git index, dependency tree or private runtime data there.

Publication preflight clarification: native Git's enabled filesystem monitor may
refresh the in-memory `CE_FSMONITOR_VALID` bit (`0x200000`) during ordinary Git
commands. The raw flag digest changed after the admitted intent-to-add/dry-run;
all source bytes and outside-scope staged entries remained identical. Preserve
and compare persistent semantic flags (including assume-unchanged, skip-worktree
and intent-to-add), not this disposable monitor-cache bit. No outside-scope
semantic flags are currently set. Record both raw and normalized observations;
do not describe the earlier raw flag digest as unchanged. Git defines this bit
as in-memory metadata in
<https://raw.githubusercontent.com/git/git/master/read-cache-ll.h>.
