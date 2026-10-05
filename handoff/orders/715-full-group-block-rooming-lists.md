# Order715 — Show the complete loaded group-block workbench

Founder continuation. Existing authorized group-block GET includes the complete
returned allotment and picked-up rooming-list arrays. Active React silently limits
the useful view to eight allotments and six bookings with no reveal control.
Expose compact per-block Show all / Show fewer controls; preserve default compact
preview, canonical count/provenance and existing reservation links. Do not claim
the response is globally complete beyond its returned server contract.

Scope: completion_queue709 owns only the group-block panel in
frontend/yellow/src/workspaces/ReservationWorkspace.tsx, its relevant style additions
in frontend/yellow/src/ui/reservation-workbench.css if that path exists (otherwise
write question715 before selecting another), tests/order626-group-block-rooming-list.test.ts,
new tests/order715-full-group-block-lists.test.tsx; this order,
tests/reservation-calendar-ui.test.ts only stale navigation label/wiring alignment
documented by Q715 (retain substantive date/range/limit assertions);
handoff/questions/715.md, handoff/receipts/715-full-group-block-lists.md,
handoff/reviews/715-groups.md. Root owns docs/PROJECT-STATUS.md, handoff/LEDGER.md,
generated public/yellow-next/** and external D:/Yellow/temp/order715-* builds.

Read-only UI change. No linked-group/block creation, allotment/pickup/wash commands,
policy, status, occupancy, financial or schema change. Empty/loading/error remain
honest. Lists expand independently, keyboard/touch usable, resets safe on block
identity change, no hidden booking links added outside authorized response.
Focused executable interaction proof plus adjacent623/626, types/boundaries/build,
independent review and real public browser. Coordinate file ownership; no other
ReservationWorkspace or shared table edits. App-only release and retained rollback.
