# Question 131 — Order 085 existing segment claim guard

## BLOCKED — ARCHITECT NEEDED

**Order:** 085
**Raised by:** OpenAI Codex builder
**Production edits made:** only the in-scope segment-release method is uncommitted; claim behavior
is unchanged

Pre-implementation tracing found that reinstate must prove a cancelled segment owns no occupancy
before re-arbitration. A stale exclusive claim would normally conflict with itself, but positional
capacity can select a different numeric slot and create a second claim for the same segment.
Reservation code is forbidden from reading `space_occupancy`, and adding that read there would
also split occupancy authority.

May Order 085 expand the existing `ReservationOccupancyService.claimForSegment()` by one
tenant-scoped pre-allocation count that rejects any existing `slot_kind=segment` claim for the same
segment id? This changes no capacity arithmetic, retry rule, table, function, state or event. P4
will exercise the duplicate-positional case and require zero added claims.
