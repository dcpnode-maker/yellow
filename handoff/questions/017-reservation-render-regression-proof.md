# Order 666 - Reservation rendering regression

The restored dashboard exposed React error 310 when navigating from search to a
reservation. `ReservationWorkspace` calls `useMemo` after loading/error returns.

## RESOLVED

This blocks the founder's requested working live journey. Keep the repair inside
the already-scoped ReservationWorkspace file; additionally admit the focused
regression test `tests/order666-reservation-render-safety.test.ts` in the live
source. Also admit `tests/order620-today-colleague-demo-path.test.ts`: its literal
assertion requires the nonexistent `setAssistantOpen` handler and must instead
verify the real `setAssistant` state binding/callback. No business-rule, database
or API change. Record red, green and browser proof.
