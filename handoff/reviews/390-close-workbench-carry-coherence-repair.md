# Order 390 — fresh independent Tier-3 review

**Verdict:** WITHHELD-D1124
**Activation:** `dc98833`
**Candidate:** `6768026`
**Reviewer:** `/root/order390_fresh_tier3`, fresh non-implementing Tier 3

The candidate cannot be approved because its complete-read fail-closed promise is
still false for missing/mixed carry evidence. `workbench_candidate_evidence.unsafe`
does not reject `carried_event_count<>0` when no related carry link exists. An
unresolved selected-day discrepancy can therefore have one canonical ordinary report
plus an orphan `discrepancy.carried` event, be neither safe nor unsafe, and disappear
silently from the returned candidates.

I independently reproduced this on fresh official Windows PostgreSQL 16.15 with SCRAM
authentication and `pg_stat_statements` preloaded after applying migrations 1–66. The
fixture contained two open days, one active tenant/property actor, one unresolved
discrepancy, one exact selected-day `discrepancy.reported` event, one same-discrepancy
selected-day `discrepancy.carried` event, and no carry link. The exact candidate service
returned successfully:

`{"returned":true,"candidates":0}`

Order390 requires missing, duplicate, mixed, foreign, or mismatched carry evidence to
make the entire read unavailable, so this is a substantive Tier-3 fail-open defect.
The permanent suite's 48 mutations all start from an existing coherent link and do not
cover the absent-link/orphan-event class.

Before the hostile reproduction, reviewer-personal execution passed focused PostgreSQL
31/0 (286 assertions), including the D1121 forged-hash regression, the 48 existing
mutations, coherent source/target exclusion, ordinary candidate retention, 366/367 and
500/501 bounds, zero-write checks, readiness snapshot/statistics, and operator
transaction reuse. Focused static execution also passed 16/0 (120 assertions),
typecheck, 141 boundaries, license23, and diff hygiene. Those greens cannot support
approval after the mandatory hostile red; broad standing/referee execution was stopped
and no partial result is reused.

Required repair: classify any selected or related carried-event evidence without
exactly one fully coherent link as unsafe, add permanent source and target orphan-event
regressions (including mixed ordinary+carried evidence), and rerun the full mutation
matrix under a different fresh Tier-3 reviewer. No reviewer product/test/local/`.yellow`/
deploy/merge/push mutation was made.
