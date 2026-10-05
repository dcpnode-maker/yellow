# Order 392 — fresh independent Tier-3 review

**Verdict:** APPROVED-CLOSED-D1130
**Activation:** `341eff1`
**Candidate:** `1807b6f`
**Reviewer:** `/root/order392_fresh_tier3`, fresh non-implementing Tier 3

I independently approve the bounded event-first carry-inventory repair. Inspection
confirms that selected-day and persisted-current `discrepancy.carried` events are
inventoried before either discrepancy or carry-link joins. Each relevant aggregate
must have exactly one event, an existing same-property discrepancy and space,
exactly one target link, and exactly one fully canonical safe target link. The
separate candidate evidence still rejects any additional, duplicate, unsafe,
source/current-orphan, mixed ordinary/carried, unresolved-source, foreign-property,
or incoherent link evidence; no cross-product or payload-derived authority enters
the result.

Reviewer-personal execution used a fresh official Windows PostgreSQL 16.15 cluster
with SCRAM login roles and `pg_stat_statements` preloaded, then applied migrations
1–66. The complete focused candidate matrix passed 30/0 (251 assertions): D1127
missing aggregate+link, foreign-property aggregate, D1124 source/current orphans,
duplicate and mixed carried events, D1121 and all 48 carry mutations, coherent
source/target exclusion, ordinary candidate retention, one-statement/snapshot,
366/367 backlog and 500/501 candidate bounds, readiness, operator transaction
wiring and read-only UI/API containment. `pg_stat_statements` 1.10 recorded the
composed workbench statement under the required preload.

Two reviewer-only mutations proved the load-bearing design. Reintroducing a
discrepancy-dependent event inventory made the permanent D1127 regression red 0/1;
restoring exact source returned it green 1/0. Forcing the target-link predicate true
and adding a carried event to an otherwise coherent source link made the hostile
proof red 0/1; exact restoration made the same proof green 1/0. All reviewer-only
edits were removed before the final candidate run.

TypeScript, 141 import boundaries, 23 dependency licences, dependency audit with
zero findings, and diff hygiene pass. The review server is stopped and port 55492
is closed. Automated policy blocked recursive removal of the verified stopped
disposable directory `E:\yellow\reviews\order392-tier3`; it contains only this
review cluster and logs and is not a running local. No product, permanent test,
schema, API/UI, stable local, `.yellow`, deploy, merge or push surface was changed
by the reviewer. Order384 still requires a separate fresh full restart.
