# Order 709 independent source review — 25 September 2026

Reviewer: Codex independent review agent `/root/review709`. I did not implement the Order 709 source or tests. Reviewed the serving-source checkout `D:/Yellow/git-live-order611-source-v2` at Git HEAD `e06e400a` on `codex/live-order611-source-v2`, including uncommitted Order 709 work. `PROJECT.md`, `AGENTS.md`, `docs/PROJECT-STATUS.md`, Order 709, the Party decisions D-311–D-319 and the canonical operator handler were read. `state.sh` could not run because Windows `bash.exe` had no `/bin/bash`; `./state.ps1` ran successfully.

## Scope and findings

Inspected `frontend/yellow/src/ui/GuestProfileCreate.tsx`, `guest-profile-create.ts`, `guest-profile-create.css`, the Order 709 tests and the two uses in `ReservationWorkspace.tsx`. The UI sends only the established property-scoped, bearer-authenticated `POST /parties` command and body-only `POST /parties:search` query. The server retains `crm.parties:read/write` and exact property-grant authority. No reservation commit, guest-allocation save or occupancy command is called by profile creation. Booking selection happens only after a validated create receipt and exact Party-ID search readback; allocation still needs a separate role selection and Save.

The builder corrected findings raised during review: uncertain outcomes keep the frozen body and original key while exposing a usable reconciliation action; canonical duplicate-review replies, including an empty current set after stale acknowledgement, keep the same key; malformed success receipts cannot establish Party-ID lineage; receipt and readback contact hints are compared with the deterministic canonical masks; stale property/unmount callbacks are discarded. Parent busy/navigation guards retain the recovery surface. No unresolved source finding remains in this scoped review.

## Proof personally executed

- `bun test tests/order709-guest-profile-create.test.tsx tests/order709-reservation-integration.test.ts tests/yellow-guest-search-workspace.test.ts tests/yellow-reservation-guests.test.ts tests/order710-housekeeping-discrepancies.test.tsx tests/order710-housekeeping-integration.test.ts tests/operator-housekeeping-discrepancy-http.integration.test.ts tests/housekeeping-discrepancy-reporting.domain.test.ts` — **44 passed, 0 failed, 240 assertions across 8 files**. Order 709 contributes 17 focused tests plus 6 existing guest-search/allocation regressions. This covers duplicate acknowledgement, same-key uncertainty and replay, malformed receipt, masked contact mismatch, permission denial, authorized readback, stale callbacks and booking/allocation wiring.
- `bun run typecheck` — exit 0; backend and frontend `tsc --noEmit` passed.
- `bun run boundaries` — exit 0; **208 TypeScript files scanned**.

The earlier preliminary Order 709 run had two failures caused by tests counting Party-ID search requests as create requests. The builder corrected the assertions, and the final combined run above passed. The earlier preliminary typecheck failure from a literal-inferred message parameter was also corrected before the final passing gate.

## Follow-up: narrow mobile header correction

Root's actual 390px browser check found the inline Cancel control clipped to a 43.5px box with 63px of scroll width. The builder changed only the Order 709 heading layout: title copy can shrink and wrap, while Cancel keeps its intrinsic nonshrinking width and nowrap text. My first CSS inspection caught the broader primary-button selector overriding Cancel's quiet colors. The builder excluded Cancel and secondary controls from that selector and pinned both the layout and selector in the focused regression. I inspected the final component/CSS and personally reran `bun test tests/order709-guest-profile-create.test.tsx tests/order709-reservation-integration.test.ts` — **18 passed, 0 failed, 105 assertions across 2 files**. This supersedes the earlier Order 709 focused count; the broader 44/0/240 command above was run before this CSS/test-only follow-up. The final rendered 390px recheck belongs to root's separate browser proof and is not claimed in this source review.

## Decision and limits

Independent source review approves the bounded Order 709 UI integration. I did not run the historical Party PostgreSQL integration suite against the serving database: it seeds and deletes fixtures. No actual browser interaction, live Party write, deployment or end-to-end database mutation is claimed here; root owns those separate acceptance and release proofs. This review does not approve Party domain/schema changes, booking commit, guest allocation persistence, profile editing or ecosystem completion.
