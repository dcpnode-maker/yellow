# Order 394 — fresh independent Tier-3 review

**Verdict:** APPROVED-CLOSED-D1138
**Activation:** `1594723`
**Candidate:** `cb2f1f0`
**Prior withheld review:** `471c3f8`
**Reviewer:** `/root/order394_fresh_tier3`, fresh non-implementing Tier 3

The test-only repair is approved. The permanent harness extracts and executes the
shipped `loadDayCloseWorkbench` function and both shipped Refresh/Retry listener
bodies. Controlled discovery promises prove generation, active-view and selected-
property changes independently stop before any dated request, render or history
canonicalization. Discovery failure, dated deep-link bypass, and absent-date Refresh
and Retry rediscovery are executable rather than source-token assertions.

Reviewer-personal mutation proof first passed 7/0 (30 assertions), then removed only
the exact generation/view/property guard immediately after discovery. Exactly all
three stale cases failed because a second dated request started; the other four
behavior cases remained green. Restoring that exact guard returned the same suite to
7/0 and `git diff --exit-code -- src/http/operator/operator.js` proved byte-exact
production restoration. Combined permanent Order394/393/384 operator proof passes
16/0 (99 assertions).

The existing stopped disposable review cluster was reused without another database
copy. Official PostgreSQL 16.15 with `pg_stat_statements` preloaded passes the relevant
readiness/workbench/domain/operator matrix 47/0 (363 assertions), including one-
statement readiness/workbench snapshots, discovery containment and zero writes,
D1121/D1124/D1127 hostility, 48 carry-field mutations, and exact 366/367 plus 500/501
bounds. Full operator proof passes 513/0 with 117 expected database skips (5,700
assertions). TypeScript, JavaScript syntax, 141 import boundaries, 23-package licence
policy, zero-vulnerability audit and diff hygiene pass.

The PostgreSQL server was stopped and port 55491 is closed. A new 4.16 GB WSL crash
directory filled C: during review; it was moved intact to the founder-approved
`D:\Yellow\cleanup-quarantine` rather than touching project evidence. No product,
permanent test, schema, seed, stable local, `.yellow`, deploy, merge or push surface
was changed by this reviewer. Order393 may now proceed to the separately mandatory
complete fresh Order384 restart; this approval is not that restart.
