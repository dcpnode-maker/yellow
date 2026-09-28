# PR-FIX-010 - Actual artifact-producing CI path

Implemented from public 3c23bae906d79a121b483668623bdcb3839aafc5. Fresh CI36497197841
failed only the proof upload because its command retained the pre-merge filename.
The corrected command runs both real Leaflet and research MapLibre tests. Missing
artifact rejection, action pins and timeouts remain byte-unchanged.

Native actual required Chromium proof: **11 passed, 0 failed, 152 assertions** across
the paired wiring test and both browser files, 12.77s. The E-drive proof directory
contains a passed/required JSON receipt (5306 bytes) and five nonempty PNG captures
of flat/globe/restored/Dubai/mobile renders. Types pass; 203 boundary files pass.
Actual ordinary frozen dependency root: 48 packages, licence pass, audit `{}`/0.
The first new static assertion incorrectly assumed direct assignment of the passed
status; it failed, was corrected to the existing Object.assign form, then both new
tests passed. No application behavior was altered to accommodate the assertion.

`state.ps1` was executed in this owned review project. Its optional Docker probe
hung and was terminated within the bounded diagnostic; service observations are
unavailable, not evidence of a stopped live app. No service/container was restarted.
Protected migrations, src, frontend and public bytes equal 3c23 exactly. The prior
11/0 referee and 2282/0 full-suite source proof are retained in PR-FIX-003-007.
This workflow-only repair requires fresh CI before declaring #93 fully green.

Local generated proof: E:/YellowProofRecovery-0929/pr93-ci-map-proof
Local text proof: E:/YellowProofRecovery-0929/pr93-ci-browser-0929.log
No own PR merge or live promotion; no private credentials in this receipt.
