# Independent review — Order 099 operator reservation booking workbench

**Result:** APPROVED

**Reviewed tip:** `a3c2e8c`

**Implementation base:** `41f72b3`

**Rejected first tip:** `defd446`

**Reviewer:** independent non-implementing Codex reviewer

**Date:** 2026-08-24

The reviewer did not implement Order 099. The first review rejected `defd446` for two
browser defects. An extracted-production harness started a hold, changed property and
cleared selection/hold/draft, then resolved the old-property response; the cleared hold
was incorrectly replaced with `{ id: "stale-hold", ... }`. The visible boundary copy
also omitted Party creation/profile merge, deposits and public guest booking from the
later workflows expressly required by the order.

Corrected tip `a3c2e8c` closes both findings. Hold and commit capture the current search
generation and property before the request and discard late success or error responses
unless both still match. The permanent canary extracts and executes the production hold
and commit functions and proves late hold success and commit success cannot resurrect
old-property state. The reviewer temporarily extended the same harness to reject the
late commit promise; stale error text likewise did not repaint the cleared property.
The extension passed and was removed. Visible copy now explicitly names Party
creation/profile merge, deposits, public guest booking, payment, tax finalization,
folio, journal and fiscal-document work as separate or incomplete workflows.

The exact `41f72b3..a3c2e8c` scope contains only the ordered client assets, focused
proof/status and governance files. No server/context/adapter, schema, permission,
dependency, Party, payment, tax, folio, journal or fiscal implementation changed.
Static inspection confirms every offer and issue is rendered through safe text APIs;
only server `bookable=true`, `promise=false`,
`commit_arbitration_required=true` offers with a server total are selectable. Offers
remain evidence, holds remain temporary and confirmation is rendered only from the
canonical commit response. Property and search changes invalidate live booking state,
and the corrected guards prevent late responses from reversing that invalidation.

On fresh isolated PostgreSQL project `yellow-order099-rereview`, port 5505, the
reviewer personally executed:

- `npx -y bun@1.3.13 test tests/operator-reservation-booking.integration.test.ts tests/operator-assets-security.test.ts` — 14 passed, 0 failed, 156 assertions;
- reviewer-extended extracted-production late hold success / commit success / commit
  error canary — 1 passed, 0 failed, 5 assertions;
- canonical launch seed followed by `YELLOW_REQUIRE_RESERVATION_OFFERS=1 npx -y bun@1.3.13 test tests/reservation-offers.integration.test.ts` — 6 passed, 0 failed, 76 assertions;
- canonical launch seed followed by `YELLOW_REQUIRE_OPERATOR_HOLD=1 npx -y bun@1.3.13 test tests/operator-holds.integration.test.ts` — P1–P6 all passed, covering real ten-minute hold occupancy, twenty-way one-winner race, replay, release, authority and publication rollback;
- `YELLOW_REQUIRE_RESERVATION_COMMIT_HTTP=1 npx -y bun@1.3.13 test tests/reservation-commit-http.integration.test.ts` — 5 passed, 0 failed, 61 assertions, including held/direct replay, last-room race, bounded positional retry, authority and publication rollback;
- `npx -y bun@1.3.13 run typecheck` — passed; `run boundaries` — 59 files, no violations;
- `npx -y bun@1.3.13 test` — 131 passed, 342 skipped, 0 failed, 1,659 assertions across 76 files;
- fresh `tests/review-seed.integration.test.ts` — 11 passed, 0 failed, 39 assertions;
- fresh seed and `tests/database-acceptance.integration.test.ts` — 4 passed, 0 failed, 10 assertions; normalized schema snapshot — exact;
- `npx -y bun@1.3.13 run license-check` — 23 packages passed; `npx -y bun@1.3.13 audit` — no vulnerabilities;
- separate app-never-started, freshly migrated and seeded 84-table database through untouched `tests/run_invariants.py` — **11 passed, 0 failed of 11**.

Question 135 does not block Order 099. The inherited Order 055 P7 test executes and
passes its typed hold UI and no-browser-occupancy assertions, then fails only an obsolete
exact seventeen-permission equality because the canonical role now also has the six
independently approved Orders 096–098 guest/lifecycle/segment scopes. Order 099 neither
changes nor depends on those scopes, and its forbidden scope correctly prevents editing
that historical proof here. The discrepancy remains disclosed for a later corrective
order; it is not contrary evidence about hold or booking behavior.

Migration, schema snapshot, referee, package/lock, Compose/CI, server, adapter and all
contexts are unchanged. Migration 0001 SHA-256 remains
`FE2A9FC949C6BACDED3F8D3FC4D14FC596A83EBDE9AEB043EB10845F07B30923`; the untouched
referee remains `3228279BD99A8F9B6AF99748F31D4D4B482A8E627E16D92644D9D859AD8BEFA1`.
Disposable reviewer infrastructure was removed. User-owned `.agents/`,
`.codex/hooks.json` and `handoff/chat-archive/` paths were untouched.

## Exclusive Order 099 discharge

- 099
