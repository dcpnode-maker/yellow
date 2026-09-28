# PR-FIX-010 - Bind CI to the renamed real research-map browser proof

Founder authority: fix the existing public PRs. Exact starting source
3c23bae906d79a121b483668623bdcb3839aafc5, branch phase-9/pr93-ci-proof.
The previously completed sanitized Astra handoff checkout is reused only after
confirming a clean tree, no process referencing it and retaining its original
phase-0/yellow-harness-astra-handoff branch at b9649cbb.

## Scope

- `.github/workflows/ci.yml`: the existing required map-browser step must run both
  the preserved real Leaflet test and the renamed research MapLibre browser test.
- `tests/market-map-ci-proof-wiring.test.ts`: regress the exact filenames, required
  browser flag, shared proof directory and fail-closed artifact retention.
- This order, paired question and one receipt; ignored finite proof output only.
- Exact copied manifests and frozen lifecycle-disabled proof dependencies under
  the newly owned `E:/YellowProofRecovery-0929/pr93-ci-dependencies`, and this
  reused worktree's previously absent `node_modules` junction to that install.
  Dependency metadata/lockfiles, global caches and prior installs stay unchanged.

Fresh CI36497197841 passed the old-named Leaflet test but rejected artifact upload:
the report-producing test was renamed during PR-FIX-003's necessary two-map merge.
Fix that stale command, not the upload gate. Keep if-no-files-found:error, action
pins, deadlines, both renderer implementations and all business code unchanged.

## Acceptance

Paired static wiring assertions plus actual required Chromium execution producing
nonempty proof files; existing types/boundaries/licence checks; fresh exact-SHA CI.
Previous 2282/0 standing suite and isolated referee remain historical source proof,
not substituted for this changed workflow's fresh CI. No own PR merge/deployment.
