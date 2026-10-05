# Native Month / Year / Timeline calendar

Founder authorizes implementation and parallel build/test execution on 3 October 2026. Laptop is source and live-runtime controller. Continue from phase-7/live-ecosystem-20261002 at 0103326dd880a309e562a0699339a4a0350d41ab; preserve the currently served 0ffb1288 release and the dirty canonical checkout. CompSet Studio remains separate.

## Scope and ownership

- New frontend/yellow/src/hosting-calendar.ts, workspaces/HostingCalendar.tsx, workspaces/hosting-calendar.css and tests/yellow-hosting-calendar.test.tsx: bounded 11R chat implementation, then explicit freeze. No simultaneous production writer.
- Parent-owned src/contexts/reservations/calendar.ts and index.ts, src/http/operator.ts, src/app.ts: native read-only segment and sellable-unit calendar endpoint with actual lifecycle-read scope and freshly checked property grant. Recover the retained artifact only as an unverified candidate; give it fresh source and executable proof.
- Parent-owned frontend/yellow/src/hosting-calendar-api.ts, yellow-api.tsx , workspaces/ReservationCalendar.tsx and the guarded calendar callback in workspaces/ReservationWorkspace.tsx: strict response validation, explicit authorized property IDs, cancellation, Month/Year/Timeline controls, civil-date queries and real segment rendering. Preserve existing CalendarTimeline exports/tests where useful and existing reservation navigation locks.
- New tests/reservation-calendar.integration.test.ts, tests/operator-hosting-calendar.test.ts and tests/yellow-hosting-calendar-api.test.ts: real isolated PostgreSQL and API authority/range evidence, malformed/incomplete response rejection and retained session/navigation behavior.
- docs/PROJECT-STATUS.md, docs/LIVE-ECOSYSTEM-20261002.md, this order and independent handoff/reviews/RESOURCE-20261003-native-hosting-calendar.md: exact source and bounded acceptance.
- Versioned build, synthetic-database, phone and live-release artifacts under E:/YellowWorkspace/Data/BuildArtifacts/yellow-receiving-build-20261001-v1/hosting/native-hosting-calendar-v1. No live fixture reseeding or database shutdown.

## Behavior

Every client gets Month (default), Year and Timeline. One hotel shows real rooms; one apartment shows its genuinely configured sellable units. Portfolio scope is distinct from the view choice, uses only explicitly granted properties, and does not infer access from parent names or geography. Month uses the current authenticated Airbnb host layout as the interaction reference, with Yellow branding and existing fonts. Year renders all twelve real months. Timeline preserves per-segment room moves, gaps, unassigned segments and collisions.

Queries are half-open property-local civil ranges, bounded to 366 days. Positive same-day stays remain visible; overnight checkout is exclusive. Preserve exact UTC periods. No summary-derived room allocation, invented rates, availability, inheritance or automatic price/block changes. Room/segment limits and incomplete portfolio loads must visibly fail closed. Blank cells do not authorize bookings.

No new dependencies, migrations, financial/occupancy writes, tenant/auth-policy changes, credential disclosure, tunnel provisioning or original theme replacement. Pricing remains explicit unavailable until a separately scoped canonical read is admitted; configured prices cannot be represented as final guest quotes.

## Required proof and release

Run meaningful focused tests, strict root/frontend types, module boundaries and Vite compile against frozen source. Independent non-implementer must inspect the new tenant-scoped read and personally execute isolated PostgreSQL/API authority proof before live admission. Phone compile/test receipts must pin input hashes and identify the actual device; queued jobs are not proof. Cloud runs disjoint existing public-booking candidate builds/tests and cannot replace this source tree.

Stage a new version-exact release from the current owner, preserve protected configuration/JWT expiry, database and connector owners, stop/pause latches and rollback source/assets. Only replace the precisely owned app origin and watcher after validation. Public readiness/assets/auth and actual browser Month/Year/Timeline behavior must pass before reporting deployment. Do not merge one's own PR or claim all eighteen phases complete.
