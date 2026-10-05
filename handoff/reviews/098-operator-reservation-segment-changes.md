# Independent review — Order 098 operator reservation segment changes

**Result:** APPROVED

**Reviewed tip:** `4dc8159`

**Implementation base:** `699cbd6`

**Rejected first tip:** `7793c56`

**Reviewer:** independent non-implementing Codex reviewer

**Date:** 2026-08-24

The reviewer did not implement Order 098. The first review rejected `7793c56` after a
hostile production-helper canary under `TZ=America/New_York` proved that the server
instant `2025-11-02T06:30:00.789Z` rendered into `datetime-local` as
`2025-11-02T01:30:00.789` and an unchanged submission became
`2025-11-02T05:30:00.789Z`. Milliseconds survived but the exact instant shifted one
hour across the daylight-saving fold.

Corrected tip `4dc8159` closes the finding. The field is explicitly labelled UTC,
`utcInstantInputValue` renders the canonical server instant without browser-local
conversion, and submission parses the field by appending `Z`. The permanent extracted-
production canary changes the process timezone to America/New_York and proves the exact
second-fold `.789` instant round-trips unchanged. The complete asset proof passed 9/9
with 112 assertions. The focused fixture now leaves shared permission catalogue rows
intact and inserts them with `ON CONFLICT DO NOTHING`; the focused database proof passed
twice consecutively in the same fresh database.

The full first-pass inspection found the 18 implementation files exact to Order 098
scope. The real segment query binds tenant id, transaction-local tenant context,
property and exact confirmation, returns ordered immutable history and makes only the
latest segment actionable. A temporary reviewer canary proved sibling-property and
foreign-tenant lookup both fail with the property-local not-found envelope; it passed
3/3 with 17 assertions and was removed. Distinct segment read/write scopes, strict
routes/bodies/keys, injected-command-only adapter convergence and server-owned move
clock were inspected and passed.

The reviewer personally executed on fresh isolated PostgreSQL:

- focused Order 098 adapter P1/P2/P4 — 3 passed, 0 failed, 15 assertions; reviewer
  sibling-property/foreign-tenant canary — 3 passed, 0 failed, 17 assertions;
- inherited Order 086 real departure/move proof — 6 passed, 0 failed, 108 assertions,
  including exact occupancy replacement, incompatible/OOO/occupied destinations,
  twenty-way one-winner races, replay and publication rollback;
- `npx -y bun@1.3.13 run typecheck` — passed; `run boundaries` — 59 files, no violations;
- first-tip standing — 125 passed, 0 failed, 1,609 assertions; corrected-tip standing —
  126 passed, 0 failed, 1,615 assertions;
- fresh review seed — 11 passed, 0 failed, 39 assertions; fresh deployment acceptance —
  4 passed, 0 failed, 10 assertions; normalized schema snapshot — exact;
- dependency licence policy — 23 packages; audit — no vulnerabilities;
- separate app-never-started 84-table referee database — **11 passed, 0 failed of 11**;
- corrected-tip asset proof — 9 passed, 0 failed, 112 assertions; corrected-tip focused
  adapter proof — 3 passed, 0 failed, 15 assertions twice in the same fresh database.

Migration, schema snapshot, referee, package/lock, Compose/CI and kernel surfaces are
unchanged. Migration 0001 SHA-256 remains
`FE2A9FC949C6BACDED3F8D3FC4D14FC596A83EBDE9AEB043EB10845F07B30923`; the untouched
referee remains `3228279BD99A8F9B6AF99748F31D4D4B482A8E627E16D92644D9D859AD8BEFA1`.
The order header's four Markdown hard breaks are the only `git diff --check` reports.
Disposable reviewer infrastructure was removed, and user-owned `.agents/`,
`.codex/hooks.json` and `handoff/chat-archive/` paths were untouched.

## Exclusive Order 098 discharge

- 098
