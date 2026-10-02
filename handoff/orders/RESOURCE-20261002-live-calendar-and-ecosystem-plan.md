# Restore the live reservation Calendar and retain the ecosystem destination

Founder explicitly authorizes live implementation on 2026-10-02, with Astra leading design and architecture and laptop owning integration/source/runtime. Base 93bf7f94ce36bbe67404853661ed40f641b5db01 on phase-7/live-ecosystem-20261002. Preserve the dirty canonical checkout and original Yellow theme, ribbon/navigation, access controls and domain commands. CompSet Studio remains separate.

## First release scope

- frontend/yellow/src/reservation-calendar.ts: property-local civil dates, bounded range and honest reservation-summary projection.
- frontend/yellow/src/workspaces/ReservationCalendar.tsx and reservation-calendar.css: date navigation, 7/14/30-day clickable stay timeline, search/status filtering, keyboard access, responsive horizontal scrolling, loading/error/empty states and summary limitations.
- frontend/yellow/src/workspaces/ReservationWorkspace.tsx: route the existing Calendar view to the real component; retain list, groups, CRS, creation and every navigation lock.
- frontend/yellow/src/yellow-api.tsx: optional board date-range/signal inputs only, preserving existing unfiltered callers, authoritative property/session and complete keyset pagination.
- tests/yellow-reservation-calendar.test.ts and tests/yellow-reservation-calendar.ui.test.tsx: civil dates/DST, interval boundaries, cancellation/unassigned/malformed evidence, actual rendering, read contract and retained navigation wiring.
- docs/PROJECT-STATUS.md and docs/LIVE-ECOSYSTEM-20261002.md: exact first-release proof plus staged requirement-to-source/gap map from Astra. Unbuilt workflows remain explicit.
- this order and independent review under handoff/reviews.

The board summarizes multiple segments into first arrival/last departure and a latest room label. This release displays a reservation stay summary, never room-level occupancy, split-stay continuity, exact allocation or bookability. Departure date is exclusive for overnight summaries; day-use is explicit. Cancelled/no-show history is selectable separately. Empty cells confer no selling promise. Fail pagination closed; do not silently truncate. No new server endpoint, schema/migration, dependencies, auth policy, rates/finance/occupancy writes or simulated backend. Room-grid/segment reads and all wider transactional capabilities require subsequent bounded orders.

## Verification and admission

Focused executable tests, retained session/navigation/UI checks, root/frontend strict types, boundaries and an isolated Vite build. Astra independently reviews and executes frozen-source proof before exact-source live admission. Browser visual acceptance remains separate and cannot be claimed from HTML/API proof. Never bypass browser saved-permission restrictions.

Root may create version-exact runtime/asset/owner manifests under E:/YellowWorkspace/Data/BuildArtifacts/yellow-receiving-build-20261001-v1/ and adapt the independently reviewed smooth-navigation release helper for the new revision. Copy protected config unchanged except build revision. Verify current owner/source/hash and exact Bun/watcher identities; replace only the app origin and watcher on existing3184. Preserve PostgreSQL2124, named connector, Worker/VPC/account/hostname and stop/pause latches. Preserve prior runtime and rollback receipts. Update authoritative runtime record atomically only after public readiness/assets/auth/authorized-board proof. No database-start workaround or tunnel reprovisioning.

## Wider authorized destination

Calendar room allocation/split stays/blocks; enterprise hierarchy with scoped/consolidated views; CRM group quote/displacement/approval/escalation; housekeeping floor/voice progress/inspection; STR owner/long-stay/expense/payout; RMS forecast/profit/channel taxes/explanation/override; CRS/public booking and finance exception journeys. Astra's staged plan must reconcile existing implemented capabilities with prototype-only, foundation-ready and missing backend work. This first order does not declare those capabilities complete.
