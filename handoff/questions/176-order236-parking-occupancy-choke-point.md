# Question 176 — How can bounded parking use canonical occupancy without weakening rooms?

**Raised:** 2026-08-28
**Order:** 236
**Resolved:** D-621

## Evidence

The first fresh-PostgreSQL implementation proof reached the established
six-argument `record_occupancy()` and failed with `P0003 occupancy typed parent is
invalid or stale`. That function deliberately accepts a segment only when the target
space is mapped to the segment sellable unit and the claim period equals the complete
segment. Parking is not room inventory and begins at assignment time, so adding a
parking space to the room mapping or backdating the claim would corrupt inventory or
time truth. Direct occupancy DML would violate the canonical choke point.

The same issue affects checkout: the established typed-parent release cannot validate
a shorter parking period, and deleting only the claim would leave
`vehicle.parking_space` stale.

## Resolution

Preserve the established six-argument recorder unchanged. Migration0037 adds one
owner-private seven-argument overload that additionally validates the exact onsite
reservation-linked vehicle and admits only the server-derived remaining current
segment period. PUBLIC, `app_role` and `yellow_runtime` cannot execute that overload;
only the governed owner capability calls it.

Preserve `release_occupancy(uuid,uuid)` as the sole externally callable release name.
Its prior implementation becomes an owner-only invoker helper. The wrapper validates
parking claims and their vehicle parents, deletes them, clears matching vehicle
pointers, then delegates any remaining room/unit claims atomically. No manual parking
release command or new client authority is introduced.

This is the narrow architecture correction recorded by D-621; it does not change
room/unit admission, create another occupancy write path, or widen product scope.
