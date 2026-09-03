# Order 384 — fresh independent Tier-3 review

**Verdict:** WITHHELD-D1121
**Activation:** `61b6da1`
**Candidate:** `7e81901`
**Reviewer:** `/root/order384_fresh_reviewer`, fresh non-implementing Tier 3

The candidate cannot be approved because its promised complete-read fail-closed
carry-lineage contract is false. `workbench_carry_lineage` accepts an existing
source link as valid using only identity, property/date/space/target/open-day and
hash-shape checks. It does not re-prove the already-approved canonical carry
evidence, including canonical hash equality, source resolution and timing, target
state/reporter/timing, maker/checker chronology, approval binding, and carried-event
binding.

I independently reproduced the defect on fresh official Windows PostgreSQL 16.15
with SCRAM authentication and `pg_stat_statements` preloaded after applying
migrations 1–66. The live catalogue was 66 migrations, 116 public tables, 106
policies, 290 public indexes and 3 non-internal triggers. I inserted an unresolved
ordinary source discrepancy and a structurally valid forged carry link whose
`discrepancy_state_hash` and `request_hash` were deliberately noncanonical 64-byte
hex values. The exact Order384 service returned successfully with:

`{"RETURNED":true,"candidates":0,"unknown":0,"unresolved":1}`

The expected result under Order384 is complete-read unavailable. Instead,
`source_count=valid_source_count=1` makes the row neither a candidate nor unsafe,
silently hiding it. This is a Tier-3 financial lineage defect, not a missing test
cosmetic.

Before the hostile reproduction, reviewer-personal focused execution passed 24/0
(140 assertions): all Order384 domain/PostgreSQL/operator tests plus the existing
readiness suite, including the preload-backed one-statement/snapshot case and strict
five-minute semantics. Those greens do not cover the reproduced forged-link path
and therefore cannot support approval. Broad standing/referee/browser gate execution
was stopped after the definitive mandatory hostile proof failed; no partial green
result is reused as approval.

Required repair: reuse or exactly preserve the complete approved carried-link
coherence predicate, add hostile mutation cases for every load-bearing carry field,
and prove a forged or incoherent existing source/target link makes the whole
workbench unavailable. A fresh non-implementing Tier-3 reviewer must then restart
the full Order384 proof. No production, test, migration, schema, seed, runtime,
local, `.yellow`, deploy, merge or push surface was changed by this reviewer.

---

## Complete fresh restart after Orders 390–392

**Verdict:** WITHHELD-D1131
**Reviewed tip:** `0b5ff75` (approved repaired product `1807b6f`)
**Original implementation:** `7e81901`
**Reviewer:** `/root/order384_final_fresh_tier3`, fresh non-implementing Tier 3

The repaired database read is coherent, bounded and fail-closed, but the ordinary
operator entry into the workbench is not usable. The visible `nav-day-close` control
calls `setView("day-close")`, which pushes `/p/{property}/day-close` without a date.
The only date selector is initially disabled. `dayCloseRouteDate()` consequently
returns null, and `loadDayCloseWorkbench()` takes its `if (!selected)` branch and
returns before the only `close-workbench` request. The selector is populated only by
`renderDayClose()` after a successful request, leaving no route from normal
navigation to the first authoritative snapshot. Only a manually constructed
`?date=YYYY-MM-DD` deep link can enter the working flow. This contradicts the order's
operator backlog-selector delivery and UI-SPEC §41's claim that the authenticated
operator workbench can load and replace the selector with persisted open days.

The reviewer executed a deterministic probe over the shipped HTML and JavaScript.
All six load-bearing predicates were true—visible navigation exists, the selector
starts disabled, the route date is nullable, ordinary navigation pushes an undated
path, the null branch returns before the request, and selector population occurs
only after a response—then the probe exited red with:

`RED: ordinary Day close navigation reaches an undated route, returns before its only request, and leaves the only date selector disabled`

This red was found only after a complete fresh restart. On a new official Windows
PostgreSQL 16.15 cluster with SCRAM roles and `pg_stat_statements` preloaded, the
reviewer personally applied migrations 1–66 and passed the complete focused matrix
31/0 (255 assertions), including one composed statement/snapshot, strict five-minute
readiness, actor/tenant/property containment, D1121/D1124/D1127, all 48 carry-field
mutations, coherent source/target exclusion, zero writes and exact 366/367 plus
500/501 bounds. Migration acceptance passed 39/0 (187), deterministic seed passed
10/0 (63), database acceptance passed 23/0 (65), direct official `pg_dump` matched
`tests/schema/expected.sql`, and a separately fixture-seeded database passed the
referee 11/11. The first referee invocation used the canonical demo seed rather than
the referee fixture and failed its documented precondition; it was not counted as
product evidence and was rerun correctly without a waiver.

Full operator proof passed 504/0 with 117 expected database skips (5,651 assertions),
and standing proof passed 1,241/0 with 974 expected database skips (18,693
assertions). TypeScript, JavaScript syntax, 141 import boundaries, 23 dependency
licences, zero-vulnerability audit and the scoped implementation diff pass. The
review server is stopped and port 55494 is closed. No production, permanent test,
schema, seed, stable local, `.yellow`, deploy, merge or push surface was changed by
the reviewer. The verified stopped disposable review roots remain because recursive
cleanup was blocked by execution policy.
