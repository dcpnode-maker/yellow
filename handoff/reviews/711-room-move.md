# Order711 independent review — backend proof (frontend review pending)

Reviewer: Codex independent review agent `/root/review709`; not an implementer of the room-move UI or workspace integration.

## Scope and isolation

- Read `PROJECT.md`, `AGENTS.md`, the Order711 brief, and `yellow-postgres-patterns/SKILL.md` before database action. D-287, D-305, and D-380 were checked.
- Existing PostgreSQL 18 service only: `yellow-public-demo-postgres-1` at loopback port 55432. No new service, app, roles, or cluster grants.
- Created exact fresh database `yellow_order711_proof_20260925103705_5149` from `template0`; restored **schema only** from `yellow_public_demo` through `pg_dump --schema-only` and a single target transaction. No tenant rows were copied.
- Before fixtures, verified `current_database() = yellow_order711_proof_20260925103705_5149`, `session_user = yellow_deploy`, `tenant` count 0, and `schema_migration` count 0. Separately authenticated existing `yellow_deploy` and `yellow_runtime` credentials through distinct host URLs and verified both selected the exact proof database.
- The helper is `scripts/order711-room-move-proof.ps1`. It rejects an existing proof DB, unexpected source/service/port/role identities, failed restore, nonempty target, or missing role authentication. It sets `YELLOW_REQUIRE_RESERVATION_SEGMENTS=1` for the suite and never falls back to live URLs. It preserves the proof DB on failure and currently retains it for inspection.

## Personally executed proof

Command: `pwsh -NoProfile -File scripts/order711-room-move-proof.ps1`

Result: `bun test tests/reservation-segment-changes.integration.test.ts` **7 pass, 0 fail, 115 expect() calls**, 8.00 s, with `YELLOW_REQUIRE_RESERVATION_SEGMENTS=1` and separate deploy/runtime proof URLs. The passed cases include exact-period departure re-arbitration, same-type room move old/new segment history and exact replay, occupied/OOO rollback, twenty contenders with one winner, tenant/state/shape/stale/idempotency guards, and publication-boundary rollback before same-key retry. No skip was counted as proof.

After the suite, a read-only check found `yellow_public_demo` still had 1 tenant and the proof database had 2 fixture tenants. The suite's fixed fixture IDs and trigger/table cleanup were confined to the proof database. The proof DB is intentionally retained; cleanup, if wanted, must verify and target this exact disposable database only.

## Review status

The backend segment/occupancy proof was completed on a fresh isolated current schema before the UI was reviewed. The later component and workspace review is recorded below; production cutover and actual browser interaction are separate, still-pending gates.

## Workspace wiring review (provisional)

Personally ran `bun test tests/order711-room-move-integration.test.ts tests/order709-reservation-integration.test.ts`: **6 pass, 0 fail, 48 expect() calls**. These are source-wiring assertions only, not component or browser proof.

Inspected `ReservationWorkspace.tsx` and the two test files. The room-move sibling is mounted under Stay & billing beside departure, keyed by property/reservation/confirmation. Its lock joins the parent mutation busy state, holds the Stay section, and synchronously informs the outer shell on lock acquisition. Parent navigation and neighboring lifecycle, departure, arrival pickup, guest creation/allocation, check-in, checkout, folio, and operational actions are disabled or guarded during the move. Conversely, the move component's `otherMutationBusy` excludes its own lock, so its retry/reconciliation controls are not disabled by parent state. The reservation detail error branch retains stale data and the mounted component while a locked readback has an error; `onRefreshDetail` explicitly rejects an errored or missing refetch result rather than presenting stale data as authoritative.

No blocking workspace-wiring finding from this inspection. Its conditions—component recovery marker, strict server/history receipt reconciliation, and executable state tests—were subsequently reviewed below.

## Component review findings and resolution

The first controller/component pass matched the existing HTTP shapes: `GET reservation-segments?confirmationNo=`, separately authorized `GET inventory`, and idempotent `POST .../segments/:segment/move` with `{ segment: receipt }`. Receipt validation binds source/destination IDs and spaces, sequence, server move instant, period split and null journal; fresh history plus reservation detail are required before success. POST token failure is definite and checked before transport; network/5xx/malformed 200/readback failures retain an uncertain attempt. These observations are source inspection, not yet focused test acceptance.

Two concrete issues were sent to the builder and root:

1. Destination selection filters active **sellable units** but drops `Space.status` from the inventory read, so an inactive physical destination space can be offered. The existing occupancy `prepareClaimForSegment` requires `space_status = active`. UI selection must reflect that same eligibility and test the inactive-space case.
2. A manual read refresh does not invalidate prior history, inventory, destination or confirmation before fetching. After one successful read, a later inventory 403 or failed refresh leaves stale candidates and an enabled Confirm path once loading ends. That conflicts with the order's non-bypassable denied inventory permission. The builder was asked for a behavior-level success→403→no-POST regression.

The builder corrected both issues. Destination eligibility now requires an active physical `Space` as well as an active same-type single-exclusive sellable unit; the inactive-space regression exercises the filter. A refresh clears prior history, inventory, destination, and confirmation before either GET; the component uses an executable `emptyRoomMoveRead`/`roomMoveCanSubmit` transition to prevent stale selection after a failed read. The component also checks source unit type against the latest segment and resets completed state on close/reopen. POST 408 and 429 are now treated as uncertain; initial definite 403/409 responses remain definite, while a later definite response cannot discard an already uncertain attempt. The recovery region carries `data-lifecycle-recovery="true"` while posting/uncertain, so the shell guard permits its own retry controls.

Additional behavior tests now exercise a first 503 followed by a second POST using the exact same frozen attempt key, a valid receipt followed by 403 history readback staying uncertain, and pure view-state helpers actually used by the component for failed-refresh clearing, sticky retry/parent lock after later definite failure, and completed-panel close/reopen. Static SSR/source assertions remain supplementary; there is no DOM-mounted test harness in this repository. A real browser check is still required by the order.

Personally executed after the corrections:

- `bun test tests/order711-reservation-room-move.test.tsx tests/order711-room-move-integration.test.ts tests/order709-reservation-integration.test.ts` — **15 pass, 0 fail, 106 expect() calls**.
- `bun run typecheck` — passed both root and frontend TypeScript checks.
- `bun run boundaries` — passed, 208 TypeScript files scanned.

**Independent code/proof verdict: accepted for build and bounded browser verification.** This does not claim an actual room was moved through the UI, that availability/readiness is known before POST, or that the combined 711/712 release has been cut over. The retained isolated PostgreSQL proof remains the personally executed occupancy/domain evidence.
