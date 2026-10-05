# Question 134 — Order 095 hostile idempotency-key proof

Order 095's first implemented PostgreSQL run passed P1, P2 and P4. P3 then expected a
rejection but received success. Inspection found the proof loop spreads each hostile
input and then always replaces `idempotencyKey` with a valid unique key. That erases the
deliberately short `"short"` value in P3 case 1, so the service correctly receives and
accepts a different valid request.

May the proof preserve the explicit short key for that one case while continuing to
generate unique valid keys for all other hostile cases, then restart the complete focused
suite? Production code, expected errors and all other assertions remain unchanged.
