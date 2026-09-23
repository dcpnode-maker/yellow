# Independent Tier-3 review — Order 166 reservation read surface

**Verdict:** APPROVED
**Reviewed candidate:** `0e88417faf17fded2f519d29c4732002891bb159`
**Exact Base:** `c0fa84d202a20c593b8b994d367b681b38db2c79`
**Reviewer:** OpenAI Codex, independent non-implementing Tier-3 reviewer
**Date:** 2026-08-26

## Admission, ancestry and scope

I did not implement Order166. I read `PROJECT.md`, ran `./state.sh`, read Order166,
D-433, the Yellow entity/PostgreSQL/compliance rules, the final Order141 approval and
the Order165 approval. Exact Base `c0fa84d` is an ancestor of the immutable candidate.

The approved Order141 ten-commit source series `55f5fbd..9397c14` is integrated as
`7591fad..84fe6a1`. `git range-diff` reports equal product commits; its three evidence
commits differ only by additive current-ledger context. The approved Order141 order,
review, backlog and final source/test blobs are byte-identical at the original and
integrated tips. The integrated Order165 review blob is likewise byte-identical to its
approval source. The candidate diff stays inside the order's admitted paths and changes
no migration, schema expectation, dependency, lockfile or Compose definition.

The implementation is read-only. The board is one set-wise, tenant/property-leading
statement with a materialized bounded page, deterministic `(created_at, id)` descending
keyset ordering, `LIMIT <= 101`, no `OFFSET`, no contact join, no JSON predicate and no
N+1 query. Inputs are exact and canonical: status is enumerated, stay bounds are paired,
ordered and at most 366 days, and the opaque cursor is canonical base64url over exact
microsecond UTC plus a lowercase UUID. The UUID detail reuses the approved Order141
aggregate and hostile stored-reference guards. HTTP admits no detail query string and
only status/from/to/after/limit on the board, checks tenant scope and property grants,
returns generic UUID not-found across foreign/missing boundaries, and derives lifecycle
actions from stored server status. Exact-confirmation compatibility is retained.

## Reviewer-executed functional proof

Focused static execution passed **8/8**, 55 assertions, with the six database cases
correctly gated. On a fresh isolated PostgreSQL 16.15 database, distinct deploy/runtime
authority and real `prepare:false` connections, the complete live proof passed
**14/14**, 113 assertions:

- board **3/3**, proving strict malformed input denial before SQL, tied timestamp UUID
  ordering, canonical cursor rejection, complete pages without duplicates/omissions,
  status and paired overlap filtering, repeatability, property isolation, no contact
  leakage and unchanged reservation cardinality;
- approved detail plus UUID extension **6/6**, proving byte-equivalent confirmation/UUID
  aggregates, exact input shapes, tenant/property/missing denial, all inherited hostile
  range/Party/account/task/predecessor guards, chronological history and zero read
  artifacts;
- real operator HTTP **5/5**, proving scope/property binding, generic foreign/missing
  UUID responses, strict PII-query rejection, canonical deep-link shell, server-derived
  actions and legacy exact-confirmation compatibility.

The board SQL oracle also proves one bounded statement containing `LIMIT`, with neither
`OFFSET` nor `contact_point`. Candidate source contains no write, lock, event or schema
path; before/after cardinality and schema/ACL checks remained exact.

## Full, security and protected gates

- standing `bun test`: **190 passed, 471 skipped, 0 failed**, 2,206 assertions across
  101 files;
- focused static security/JWT/image/schema suite: **32/32**, 295 assertions;
- `bun run typecheck`; import boundaries over 66 TypeScript files; dependency licence
  policy over 23 packages; `bun audit`; exact container-image pins; `git diff --check`:
  all pass;
- fresh `./setup.sh --db-only` on loopback-only ports 5653/6603: 17 migrations,
  85 public tables and protected referee **11 passed, 0 failed of 11**;
- fresh deployment acceptance **6/6**, 13 assertions, and live schema exactly matches
  `tests/schema/expected.sql`;
- post-proof authority audit shows `yellow_runtime` remains non-superuser,
  non-`BYPASSRLS`, with zero direct table grants; protected evidence/mutation tables
  have zero forbidden app-role DML grants.

Protected SHA-256 values remain exact: baseline
`fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`, referee
`2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`, fixture
`bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`, and expected
schema `df2d78c5d65545acb04529aacc1af1cfe18a5fece1047ce1dde104c9597c1edf`.

## Reviewer incidents and cleanup

The first historical `range-diff` used mistyped SHA `55f5fbdb`; the corrected
`55f5fbd` command produced the admission evidence above. The inherited Order141 test
accepts one URL for both its runtime service and its fixture administrator. Against the
canonical least-privileged runtime role, its first attempts correctly stopped at
`fact_log` denial (`42501`) and then tenant RLS before any read assertion. I recreated
that proof in a separate disposable database, temporarily granted fixture DML and
enabled `BYPASSRLS` only for the fixture run inside the exclusive review cluster, then
immediately restored `NOBYPASSRLS`. The six read proofs passed, and the canonical
database's final role, direct grants, schema and acceptance checks remained exact. This
is a disclosed inherited harness limitation, not product authority used by the read
surface. One schema-check invocation also omitted `YELLOW_SCHEMA_DATABASE`; it refused
before capture and passed after the required variable was supplied.

The exclusive reviewer PostgreSQL/Valkey containers, network and volume were removed;
ports 3113/5653/6603 are free. No reviewer application was started. Founder containers
and identities on ports 3000/3002 remained unchanged, and no founder credential or
runtime data was read or mutated.

## Verdict boundary

Order166 is approved only at immutable candidate
`0e88417faf17fded2f519d29c4732002891bb159`. This approves the migration-free bounded
reservation board and UUID detail read surface. It does not approve a new UI, any
reservation write, schema/grant change, merge, push, deployment or broader Phase5
completion.
