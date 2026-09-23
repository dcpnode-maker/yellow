# Order 634 — Ready check-in demo fixture

## Purpose
Make the public Yellow PMS demo show one simple, operationally useful check-in path without overcomplicating hotel math: one arrival remains blocked, and one arrival is fully ready after normal prerequisites are satisfied.

## Scope
- Public synthetic demo fixture/provisioning only.
- Check-in readiness API/probe coverage for a ready due-in reservation.
- Use existing PMS primitives: reservation segment, assigned room, housekeeping condition, primary folio.
- No direct writes to `space_occupancy`.
- No new tables, financial posting model, or migration unless absolutely required.

## Acceptance
- Public/demo readiness probe proves at least one blocked arrival and one ready arrival.
- Ready arrival has `canCheckIn=true`, no blockers, assigned room, active segment, and primary folio.
- Existing public demo probes remain green.
