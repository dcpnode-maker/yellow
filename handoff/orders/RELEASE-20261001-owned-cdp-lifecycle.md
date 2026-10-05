# RELEASE-20261001 — owned interactive-browser lifecycle

Basis58cd09ad13987bafb6068ab72a753746a555bfa5/tree3448877604d41fd5ec12eceae763010c378cd012. Laptop remains source/controller/final integrator; this is a cloud-only release-test repair. Preserve enterprise portfolio, phone and CompSet lanes.

## Observed defect and honest limits

OfficialCI36834555882 attempts1 and2 both hit Order459's existing120s test timeout; attempt2 has2519/1580skip/1fail/43866 assertions, exactly1113 fewer than root2520/1580skip/0/44979. All browser assertions are unexecuted. Later nativePowerShell tests pass on attempt2. Unchanged focused two-CPU run passes8/0/1132 in12.649s. No selected-browser/per-phase markers identify the early error or stalled stage. Existing /json/new fetch/JSON awaits and final chrome.kill()/await chrome.exited are unbounded; the latter can hide a prior callback error until the outer timeout. No claim yet that cleanup or binary selection is the observed CI cause.

## Exhaustive scope

- tests/operator-workspace-layout.browser.test.ts: reuse existing installed-browser resolver, bound startup transport/owned cleanup, and safe phase/viewport diagnostics only.
- tests/helpers/owned-cdp-proof-lifecycle.ts: focused helpers for bounded HTTP target capture and exact owned child termination, no raw PID/process-wide enumeration or arbitrary process killing.
- tests/owned-cdp-proof-lifecycle.test.ts: meaningful real controlled-child and HTTP-negative lifecycle proof, including original error preservation and unrelated-process survival.
- This order, handoff/questions/RELEASE-20261001-owned-cdp-lifecycle.md, handoff/reviews/RELEASE-20261001-owned-cdp-lifecycle.md.
- Append-only DECISIONS.log and handoff/LEDGER.md.

No product/frontend/DB/migration/kernel/referee/CI/native-review-resume changes. All existing assertions, cases, UI commands and120000ms test budget remain byte-identical where possible. Use existing5s CDP operation bounds for HTTP, do not extend. Root must check exact body/URL/context, graceful close then exact owned SIGKILL fallback and bounded exit; cleanup must not mask original proof failure. No retries/skip/synthetic substitute browser. Additional path requires explicit amendment before edits.

## Required proof

Independent nonimplementer personally reproduces an unresponsive HTTP endpoint and TERM-ignoring owned child negative, verifies bounded termination and unrelated child survival; all timers/sockets/owned children are cleaned. Existing resolver tests unchanged. Actual original browser assertions on current Chrome run at twoCPU and full default standing, types/boundaries/whitespace and unchanged setup.sh --db-only11/11 before publication. Verify all browser expect/input/assertion vectors unchanged from58cd and original timeout retained. Preserve both CI failures; exact new successor CI must identify any further actual UI failure, no deadline/assertion waiver or blind rerun. No self-merge/deploy/paid fallback/laptop overwrite/business-data operation or public URL claim.
