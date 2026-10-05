# Order 668 - Shared hotel search and capability activation

2026-09-23. COMPLETE 2026-09-24 for this scope; receipt668 records proof and limits.
Owner: Codex. Founder requests orchestrated continuation
and activation of completed functionality on the single existing live app.

## Delivery and scope

Build one shared search surface for guest profiles (including organizations when
returned by existing API), reservations and room references on reservations. Reuse
existing tenant/property-authorized APIs, canonical IDs and current routes. Do not
claim full folio, group, task or catalog indexing without implementing it.
Room-reference matches open the owning stay, not a fictitious room detail page.
Include a cashier link for a found stay using its existing reservation parameter.

Exact source: `D:/Yellow/git-live-order611-source-v2`. Allowed files:
- `frontend/yellow/src/hotel-search.ts` (pure matching/presentation model).
- `frontend/yellow/src/ui/HotelSearch.tsx`, `frontend/yellow/src/ui/hotel-search.css`.
- `frontend/yellow/src/App.tsx` (header integration only).
- `frontend/yellow/src/ecosystem/capability-registry.ts` and
  `frontend/yellow/src/workspaces/EcosystemHub.tsx` (only shared-search entry).
- `tests/order668-hotel-search.test.ts`, `tests/order668-search-surface.test.ts`.
- Generated `public/yellow-next` assets.
- Matching order in this source and this coordination order, its receipt
  `handoff/receipts/668-shared-hotel-search-and-activation.md`, plus
  `docs/FEATURE-ACTIVATION.md` in coordination repo.

Read-only bounded capability inventory may inspect existing routes, workspaces,
registry and tests. No blanket status-flipping. Preserve all dirty changes.

## Contracts

Search opens on desktop/mobile, supports keyboard/Escape, accessible dialog and
focus return. Inputs are bounded; explicit submit avoids per-keystroke API calls.
Results are capped, sorted deterministically and linked to canonical IDs. Show
per-source failures and partial/truncated results. Never call a denied source
through a different permission path. Queries/cache keys include property; do not
persist search/guest data to localStorage. No AI or external provider calls.
Respect existing in-flight financial/lifecycle navigation locks.

## Verification and deployment

Focused behavior tests, root/frontend typechecks, import boundaries, independent
read-only review of property/cache/result boundaries and execution of proof;
actual browser search -> detail navigation, focus/keyboard, empty/error states
where practical. One app build/recreation only after checks; preserve rollback.
No backend/schema/auth/financial/state-transition changes, no seed/data mutation,
new infrastructure, credentials, paid usage or secret logging. No full-PMS claim.
Unbuilt features remain visibly unavailable with a concrete next dependency.
