# Order 669 - Existing group-block overview

2026-09-24. Added a read-only beta ecosystem entry, routed to the existing
reservation board. Full Groups & sales remains planned. No group data, state,
allotment, contract or financial mutation was added or performed.

Browser evidence: board rendered LOC-MICE-0926 and LOC-SOC-0928, per-type/day
allotment and pickup, cutoff details and four linked rooming-list stays per block.
Clicking Sara Al Harbi / L3R-FU-0030 opened the exact reservation with booking,
guest/share, stay, folio and timeline sections.
Final deployed ecosystem card was scrolled into view and clicked; it navigated
to `/p/6081b544-22a1-534f-a86d-bb1ae0519e14/reservations` and both group blocks
rendered. Fresh browser error/warning log was empty; no group edits performed.

Independent reviewer `/root/journey_service_research` inspected the new beta
entry and existing route mapping, and personally ran the shared focused suite:
21 pass, 0 fail, 96 assertions; root/frontend typecheck pass. Combined serving
build and rollback evidence is in receipt668. This is activation of an existing
read-only view, not completion of group creation, sales, editing or contracting.
