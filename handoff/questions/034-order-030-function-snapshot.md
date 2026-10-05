# Question 034 — Occupancy function result is invisible to its statement snapshot

Order 030's first database run returned no joined occupancy row after
`record_occupancy()` supplied its UUID in the same SQL statement. The transaction rolled
back. May placement call the unchanged function, capture its UUID, then read the claim in
a second statement within the same transaction? May the 20-way race and cleanup use
30-second budgets without reducing contention?

## RESOLVED

Answered by D-122 and `034-ARCHITECT-RESPONSE.md`.
