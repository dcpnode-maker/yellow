# PR-FIX-007 - Recover proof storage without lowering guards

## Scope

- Relocate only the owned `.yellow/pr93-python` and
  `.yellow/pr93-dependencies-before-clean-install-0929` directories to the explicit
  `E:/YellowProofRecovery-0929` recovery root, using validated literal paths.
- Create a test-only temporary directory below that recovery root and set TEMP/TMP
  only in finite proof subprocesses. No global Windows environment change.
- This order and paired receipt; no application, supervisor or guard-source edit.

The second full native run had 2277 passes, 1538 skips and five failures. Four
supervisor receipts identify `preflight_low_space`, `launchCount: 0`; a subsequent
native DriveInfo check verified C: AvailableFreeSpace and TotalFreeSpace both zero.
This is a real environment refusal, not a security bypass or passing test.

Both moved directories contained only this lane's dependencies. No recursive
deletion, live DB, other worktree, user cache or unowned process is in scope.
Recoverable relocation verified plain source/destination ancestry and no reparse
entries. The relocated Python still reports 3.13.1 and pyarrow 25.0.1. C: space
recovered only about 98 MiB, so preserve that limitation; E: has about 58 GiB free.

Execute original finite supervisor and status proofs on the new temporary root,
then the full standing suite with no timeout, launch, cleanup or storage-guard
waiver. Preserve both failed full-suite logs/results in the paired receipt.
