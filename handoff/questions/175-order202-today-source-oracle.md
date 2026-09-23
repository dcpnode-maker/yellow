# Question 175 — Order202 stale Today source-boundary oracle

## Evidence

Order202 inserts the Housekeeping sheet workbench between the existing Today helpers
and `setReservationBoardState` in `src/http/operator/operator.js`. The Order177 test
defines `todaySource` as that entire positional slice. It therefore now includes the
new, separately governed housekeeping sheet-generation POST and fails its Today
GET-only assertion even though `loadTodayLane` still performs only the fixed bounded
GET to `/reservation-board`.

The product behavior is unchanged; the oracle's end marker no longer bounds Today.

## Resolution

Admit only `tests/operator-today-command-centre.integration.test.ts` to Order202 scope.
Replace the positional multi-feature slice with an explicit composition of the exact
Today functions under test. Retain every query, boundedness, non-PII, GET-only,
storage, DST, stale-paint, responsive and focus assertion.

No application behavior, route, authority, data, migration or UI scope is widened.

