# Question 128 — Order 078 focused-proof columns

## BLOCKED — ARCHITECT NEEDED

**Order:** 078  
**Raised by:** OpenAI Codex builder  
**Production edits made:** the uncommitted review-seed implementation exists only in
`scripts/seed-review.ts`; Order 078 and its intentional red proof are committed at `1ec6309` and
`48de087`

The first implemented fresh-database run returned 8 pass / 3 fail. All new product assertions before
the failures passed: exact policy/plan counts, requester/approver evidence totals, canonical FLEX,
active release, four-eyes approval and identical rerun. The three failures are proof-query defects:

1. Inherited P2 is named “every inventory aggregate” but grouped every requester fact. It now sees
   the legitimate Order-078 `approval_request`, `policy` and `rate_plan` event pairs in addition to
   the unchanged `unit_type`, `space` and `sellable_unit` rows.
2. The P3/P4 read-only snapshots select nonexistent `fact_log.operation`; the immutable schema and
   `recordFact` use `fact_log.fact_type` for the audit operation.

May the in-scope test be corrected only by adding an explicit
`fact.entity_type IN ('unit_type','space','sellable_unit')` predicate to the inventory proof and
renaming only the snapshot projection from `operation` to `fact_type`? Expected inventory and rate
cardinalities, production code, schema, audit behavior and every product assertion remain unchanged.
After the correction I will recreate the database and restart all eleven tests from the top.
