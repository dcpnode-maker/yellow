# HARNESS-004 independent synthetic-pilot review

Reviewer: **/root/harness_luna_review**, GPT-6 Luna, nonimplementer. Parent recorded
the reviewer's direct tool-executed results below; parent UI proof is separate.
Source: T3 `e9362f737747c11221300c234dc99b1b7d4386c4`; adapter
`c71b1392495f27f2b0e403e58ece493c2a407652`. No live execution activation approved.

## Personally executed by reviewer

- `node --test scripts/yellow-pilot.test.mjs scripts/yellow-pilot-paperclip.test.mjs`:
  **6 passed** in the T3 checkout.
- `corepack pnpm --filter t3 exec vp test run src/universalHarness/paperclip.test.ts src/auth/RpcAuthorization.test.ts`:
  **15 passed**.
- `node --test receipt-store.test.mjs`: **14 passed** in the adapter checkout.
- Unauthenticated `http://127.0.0.1:38873/api/orchestration/snapshot`: **401**.
- `http://127.0.0.1:38874/api/health`: **200**, health metadata only.

The reviewer found no blocking issue in the snapshot facade's read-scope mapping,
loopback validation, redirect rejection, cross-company checks or bounded reads.
Verdict: acceptable **read-only synthetic pilot**, not production execution.
The reviewer explicitly did not claim independently verified authenticated new
RPC/UI behavior. Parent real-browser proof is in CONNECTED-PILOT-2026-09-28.md.

## Retained finding and closure

**P2 — incomplete pilot settings guard**, scripts/yellow-pilot.mjs: runtime mode
and background intervals could change while still passing the original guard.
Known providers remained disabled; no enabled-generation exploit was established.

Parent repaired exact approval-required mode, custom/battery-saver/schema1
background and exactly two zero polling intervals, including decoded Effect
Durations. Reviewer independently inspected the two-file repair and personally
executed the launcher suite **7 passed** plus `node scripts/yellow-pilot.mjs check`
**passed**. Finding closed. Existing pilot state was already present; the check
did not create new state.

## Activation gaps deliberately not signed off

No actual Paperclip adapter entrypoint, authenticated dispatch transport, live
ownership/budget authorizer, immutable workspace resolver or ACK reconciliation.
Cancellation still needs an atomic fence against turn acceptance. Receipt tests
prove the isolated journal, not these integration boundaries. The optional
compiled coordinator launcher extension has a separate narrow follow-up review.

## Built-runtime extension and live check

Reviewer independently inspected the explicit `check-built`/`serve-built` mode
extension: it selects compiled server/dist/index.js, requires its assets and
does not silently fall back to source. The TSX dependency loader exists. Its
personally executed launcher suite passed **8 tests**; `check-built` passed.
The first health probe was during startup and could not connect; this is
retained as a failed availability probe, not reported as a green result.

Once parent startup/recovery completed, the reviewer personally repeated only
the health read: **HTTP200, status ok, startup phase ready**. This accepts the
built launcher's narrow availability/isolation purpose, **not dispatch or the
broader integration**. Final personally executed suites cover 15 bridge/auth,
8 launcher and 14 receipt tests (37 distinct tests; repeated suites not added).
