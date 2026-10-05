# Order711 — active same-type room move

Status: live in combined711/712 app image13774b4024aa3a8485bbca642142616f980f1423272689c6f3abe966504f0ed4.
No ecosystem completion is claimed. Previous709/710 image remains tagged
before-orders711-712 for rollback.

Room move reuses D-287/D-305's existing immediate same-unit-type exclusive-room
command. Root has mounted the new component next to departure changes under Stay
& billing, added the shared pending lock and preserved the mounted form across
detail-refetch failure. The move's own recovery is not disabled by its parent lock;
neighboring departure/arrival-pickup/guest/lifecycle actions are blocked.

Independent reviewer review709 personally executed the existing real PostgreSQL
segment suite on a fresh schema-only isolated database in the existing PG18 service:
7 passed,0 failed,115 assertions, REQUIRE flag enabled, distinct deploy/runtime
identities. This included20-contender occupancy arbitration, history split,
idempotency, hostile tenant/shape/source guards and rollback. No live tenant data
copied, no live fixture writes or cluster role changes. Exact retained proof DB and
repeatable helper are documented in review711. Initial proof schema had0tenant rows.

Root wiring711/709/710 proof9/0/64; reviewer personally711/709 wiring6/0/48.
These wiring assertions do not establish controller correctness or browser behavior.
Final independent711 review accepted15/0/106 with full types/208 boundaries; final
combined712+711+709 proof46/0/283 and root Vite551 passed. Initial review found inactive
physical-space selection and stale selection after inventory403; both corrected.

Root public browser on L3R-IH-0012 personally opened Stay & billing → Move room,
read exact source112 and seven configured same-type choices, selected107 and checked
confirmation: submit became enabled. No POST was submitted. Close/reopen cleared
selection and disabled submission. Narrow320px controls stayed inside viewport
(236px buttons);390px and desktop entry points verified. Configuration explicitly
does not claim room availability/readiness. Real write/arbitration evidence is the
isolated reviewer PostgreSQL suite above, not a live move. No physical phone touch,
keys, readiness or financial behavior is claimed.

App-only cutover: local/public health200, app healthy; existing PostgreSQL/Valkey/
tunnel remained running unchanged. Inherited ready503/build_revision_unavailable
remains outside this UI release. No backend/schema changes, commit/PR/merge.
