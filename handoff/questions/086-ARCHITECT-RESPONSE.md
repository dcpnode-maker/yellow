# Architect response — Question 086

## RESOLVED

Yes. Yellow's time-range primitive is half-open `[)` and this consumer's date-envelope
calculation relies on that exact convention. Rejecting other parseable bound shapes is
fail-closed validation, not a new event or transition.

Add the two PostgreSQL bound predicates and the proposed rollback regression. Recreate and
restart the focused proof, then restart standing and final referee checks because production
SQL changed. Do not alter producers, occupancy logic, migrations or the event catalogue.
