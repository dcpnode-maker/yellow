# Order 393 — fresh independent Tier-3 review

**Verdict:** WITHHELD-D1135
**Activation:** `f421e7a`
**Scope correction:** `d5e1df9`
**Candidate:** `f32cc2c`
**Reviewer:** `/root/order393_fresh_tier3`, fresh non-implementing Tier 3

The bounded database and HTTP entry repair is structurally correct, but the required
stale-discovery safety proof is not mutation-sensitive. The product checks request
generation, active view and selected property immediately after the undated discovery
response and again after the dated workbench response. However, deleting the first
guard still leaves every permanent Order393 operator and D1131 regression test green.
That mutation permits a stale discovery response to initiate a dated financial read
after the operator has changed property or left the workspace. The later guard prevents
rendering, but it does not meet the explicit contract that stale discovery must never
load the workbench.

Reviewer-personal execution used a fresh official Windows PostgreSQL 16.15 cluster,
SCRAM-authenticated `yellow_runtime` and extension-registrar roles, and
`shared_preload_libraries=pg_stat_statements`, then applied migrations 1–66. The exact
candidate passed the focused readiness/workbench/operator matrix 40/0 (333 assertions),
including earliest persisted unsealed discovery, sealed exclusion, active actor,
tenant/property/grant containment, unavailable equivalence, exact least-data JSON,
zero writes, one-statement dated workbench, strict five-minute readiness, all carry
coherence hostility, and exact 366/367 plus 500/501 bounds.

The discovery-path mutation was correctly caught red 0/1 and restored green. The
load-bearing stale-guard mutation was not caught: both permanent operator files passed
9/0 (69 assertions) after the guard immediately following discovery was removed.
Exact product restoration returned the same 9/0. Because this is a mandatory
reviewer-executed mutation gate, broad standing/static results cannot convert the
candidate to approved.

Required repair: add deterministic behavioral or mutation-sensitive permanent proof
that settles the first discovery promise, changes request generation/view/property,
and proves no dated workbench request, rendering or URL canonicalization occurs. It
must also cover discovery failure, refresh/retry rediscovery when absent, and deep-link
discovery bypass as executable behavior rather than source-token presence. Route the
unchanged-or-repaired product to a different fresh Tier 3, then restart the separate
complete Order384 review. The disposable database server is stopped and port 55491 is
closed. No product, permanent test, schema, seed, stable local, `.yellow`, deploy,
merge or push surface was changed by the reviewer.
