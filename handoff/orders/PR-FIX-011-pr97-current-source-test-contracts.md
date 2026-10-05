# PR-FIX-011 - Align stale proof contracts to existing PR97 source

Founder authority: repair public PRs. Candidate PR-FIX-008 is still unaccepted.
Initial native suite: 2457 pass, 1558 configured skips, six failures; preserve the
complete red log at E:/YellowProofRecovery-0929/pr97-native-standing-0929.log.

## Scope

- `tests/free-host-arm64.test.ts`, `tests/release-workflow.test.ts`: assert the
  existing exact migration100/130-table launcher/referee contract, not stale99.
- `tests/project-status.test.ts`: mirror the already-documented case-insensitive
  native Windows marker scan and case-sensitive Bash scan, with paired fixtures.
  Do not edit production state scripts or loosen deadlines.
- `tests/reservation-board.integration.test.ts`: assert the existing public
  marketCode/sourceCode projection, including nonempty and null values, while
  retaining exact output-key/cursor/SQL/tenant assertions. No service/query edits.
- `tests/yellow-reservation-finance-entry.test.ts`: inspect actual active lazy
  ReservationWorkspace/FinanceWorkspace modules, rather than the retained legacy
  App.tsx copies. Keep every lifecycle/charge/recovery assertion and assert the
  lazy binding. No finance command, permission, posting or UI behavior changes.
- This order, paired question and one receipt; ignored finite proof output.

The emitted app entry exceeds the unchanged 200000-byte budget and needs a
separate scoped bundling repair. The rejected 0BSD dependency remains blocked
pending a founder licence decision. Neither problem is waived by this order.

## Acceptance

Focused tests, exact protected migration equality, strict types/205 boundaries,
then the complete suite including the separately repaired bundle. DB-dependent
skips are not execution proof. Independent invariant-adjacent acceptance remains
required; no publish-as-accepted, own merge or live promotion.
