# Question 105 — Order 066 targeting persistence and precedence

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 066

The baseline has tenant parties/roles, unit types and sellables, but no rate-class or
market-group/market/segment/campaign master tables. May Order 066:

1. persist immutable `rate_plan_target` extension drafts with no migration/event/transition;
2. represent a hotel-defined class as a canonical code plus an immutable property-owned unit-type
   membership snapshot inside the draft;
3. validate company/agent/source through real tenant party roles while treating other commercial
   dimensions as strict hotel-defined codes; and
4. resolve by physical rank, then constrained commercial count, then unique explicit priority,
   returning a conflict instead of selecting among equal top tuples?

## Answer

Yes. This is the narrowest truthful persistence and precedence boundary. The class snapshot is
configuration, not inventory truth. Custom commercial codes are exact case-sensitive hotel
vocabulary, not undeclared global records, and later publish/distribution orders must validate any
external mapping they consume. Store no money/date/policy formula, emit no event, and do not alter
an earlier version. Equal top tuples must remain a visible publish-blocking conflict.
