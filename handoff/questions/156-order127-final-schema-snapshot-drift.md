# Question 156 — Order-127 final schema snapshot drift

**Status:** RESOLVED BY D-405 — CORRECTION READY
**Order:** 127 · runtime database authority
**Stopped executable:** `fd0de7bc750e3a248bef277f9e67672d555f63f3`
**Related decisions:** D-75, D-79, D-88, D-392, D-405

## RESOLVED

## Standing-gate stop

The builder and an independent non-implementing reviewer each ran the live normalized
schema gate against separately fresh databases migrated through 0015. Both obtained
the same first assertion failure at line 21: the checked-in pre-0015 snapshot begins
with the `btree_gist` extension, while the final dump first contains the explicit
`public` schema object. The mechanical diff also confirms the snapshot omitted the
remaining final-0015 functions and ACLs. Static normalization tests still pass. This
is therefore real derived snapshot drift, not a tool or database precondition
failure, and D-88 stops review of the prior executable.

## D-405 exact correction

`tests/schema/expected.sql` is already explicitly in Order-127 scope and is required
to be mechanically regenerated. Regenerate that file only from a fresh final-0015
database using the existing pinned PostgreSQL 16 dump path and unchanged normalization
logic. Do not hand-author, filter, reorder or otherwise narrow the dump. Then require
two consecutive byte-identical generated dumps, a passing live `schema:check`, the
complete standing self-check and a fresh independent Tier-3 review on the resulting
immutable SHA.

## Exclusions

No migration, schema object, normalization rule, pg_dump option, source, runtime
authority, ACL, RLS, test assertion or other scope path changes. No reuse of stopped
review evidence, self-review, merge, push, deployment, live mutation or Cyber closure.
