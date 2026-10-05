# Order 681 — calendar delivered

2026-09-24. Source admitted by independent reviewer after personally executed
PostgreSQL proof: 13/0/89 including empty rooms, moved segments, DST, half-open
nights, tenant/property bounds, real500/1000 truncation and cancelled exclusions.
Review: `handoff/reviews/681-reservation-room-calendar-independent.md`.

Root live browser proof on the public app: List → Room calendar in the same SPA;
real Riyadh room rows and reservation segments; room-type filter; next-week and
Today controls; no-match notice retains empty rooms; a temporary browser-only
blocked calendar request shows Retry and recovers after the block is removed;
named cell opens matching canonical reservation detail. Desktop and375px mobile
screenshots show contained horizontal grid scrolling, no page-width overflow.
No runtime console errors before the intentional network block. The direct date
fill tool changed the native input display without committing a React change;
button-based date navigation was separately proved, not misreported as date-picker
acceptance. Blank cells explicitly do not promise sellable inventory.

Delivered in the sole healthy image recorded in receipt683. Read-only calendar;
Groups remains existing overview only, not group creation/allotment/pickup writes.
