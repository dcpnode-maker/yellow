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
