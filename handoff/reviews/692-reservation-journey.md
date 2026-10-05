# Order692 independent review — reservation journey board

Reviewer: order679_independent_review (did not implement). 25 September 2026.

## Source findings and resolution

- The board uses the latest persisted unsealed property business day (consistent with the existing close workbench). Multiple open backlog days are expected. No browser-day fallback is used. Property/tenant scope and existing read grant remain in the HTTP/service path; the stage predicate executes before keyset LIMIT. Cursor binds the stage and business date.
- I flagged a calendar-clock check that would omit a fact-backed checked-in arrival on a paused business day; the builder changed it to the property's local stay-date comparison. I flagged missing HTTP mappings for no-day/stale-cursor errors; the board handler now returns explicit 409/400 rather than 500. Waitlist copy now states it is not confirmed.
- I flagged loss of phase-specific filters, sorts and columns when the grid unmounted. The final `MovementGrid` remains mounted in a hidden/inert wrapper through loading, error, creation and sibling tabs; its `views[status]` state survives. The stage URL is retained through Groups/Calendar, and creating/uncertain-command work disables cross-view controls with the existing global lifecycle lock. Root mounted transition proof remains a separate acceptance step.
- Astra-review amendment: Individual board detail links now carry the selected, typed phase as `returnStage`; the compact detail's local-route helper validates that token before returning to the same property. Unknown or duplicate tokens fall back to Today, never to a caller-supplied URL.

## Personally executed proof

- Isolated synthetic PostgreSQL 18.6, exact loopback `127.0.0.1:55692` / `yellow_order692_proof`; migrations 0001–0101 via runner. Canonical referee `tests/run_invariants.py` on this disposable database: 11 passed, 0 failed. No public/live database writes.
- `bun test --timeout 30000 tests/reservation-board.integration.test.ts` with isolated deploy/runtime roles: **8 pass, 0 fail, 116 assertions**. Personally reran after the final same-day `due_out` arrival correction. Real SQL fixture verifies tenant/property containment, max of two persisted open days, paused-day fact-backed checked-in arrival (both `in_house` and `due_out`) overlapping In house, future waitlist, due-out/departure, checked-out history, anomalous/cancelled/overdue entries in All, stage/date cursor mismatch and no-open-day conflict. Fixture cleaned its own rows.
- `bun test tests/order692-reservation-journey.test.ts tests/order692-reservation-journey-http.test.ts tests/yellow-reservation-board-pages.test.ts tests/reservation-workspace-routing.test.ts`: **12 pass, 0 fail, 61 assertions**. Includes grant-before-read, status/stage validation, explicit HTTP error mapping, mixed-day client rejection, URL phase retention and waitlist wording.
- After the return-phase amendment, personally reran those four suites with `tests/order693-reservation-detail.test.ts`: **15 pass, 0 fail, 98 assertions**. Personally reran the real PostgreSQL board suite unchanged: **8 pass, 0 fail, 116 assertions**, then `bun run typecheck`: pass.
- The exact disposable proof container `yellow-order692-proof` had no mounts, used tmpfs `/var/lib/postgresql`, and exposed only loopback port 55692. After the final proof I removed that container; its synthetic data is not recoverable and no live database was involved.
- `bun run typecheck`: pass after scoped compatibility mocks; `bun run boundaries`: pass, 208 TypeScript files.

## Conclusion

Independent source and executable PostgreSQL review: **approved for scoped Order692 integration**. Root owns mounted desktop/phone and final public cutover QA; this review does not claim those checks were personally performed or that the new board is deployed.
