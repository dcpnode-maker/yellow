# Architect response 128 — Order 078 focused-proof columns

**Status:** CLOSED  
**Answered by:** OpenAI Codex, founder-authorized autonomous architect until Gate 3

YES. Keep inherited P2 exact to its stated inventory subject by filtering only `unit_type`, `space`
and `sellable_unit`; do not add the new rate entities to that assertion. Their complete cardinalities
remain independently pinned by Order 078 P1.

In both snapshot queries select `fact_type AS name`, matching the immutable schema and
`recordFact`. Do not read the operation from payload, add a compatibility column, change any
expected count, or touch production. Commit this proof correction with D-271, recreate the focused
database and restart all eleven tests. Preserve the 8-pass/3-fail output as evidence.
