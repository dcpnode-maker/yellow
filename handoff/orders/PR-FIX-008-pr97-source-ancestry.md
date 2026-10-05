# PR-FIX-008 - Repair PR97 ancestry without a live downgrade

Founder authority: repair all existing public PRs. No own GitHub merge or live
promotion. Starting source d708ff29e2e44df74a5c1a12e58a8cf656b14c8d; incoming main
3503b0c01f336637d2583963c17b792f6ad59efe. Branch phase-9/pr97-base-repair.

## Scope

- Integrate those exact two committed Git sources. The 112 actual conflict paths
  are the immutable path list from `git merge-tree --write-tree --name-only`
  for these inputs (candidate tree af645c573a992e2ba997a854afb05eb24aad57b1).
  All automatically merged incoming paths are from that same pinned public main.
- Preserve newer PR97 conflict hunks through Git's scoped current-side strategy,
  while retaining compatible non-conflicting main changes. This is an integration
  candidate, not approval that either implementation may bypass current guards.
- This order, paired question/receipt and ignored finite proof output only.

No new business behavior, migration renumbering, event, permission, approval-control
or provider change is admitted. If validation needs another source/test change,
record its exact scope in a new question/order before editing.

Protected migrations 1-100 must be byte-identical to the existing PR97 source.
PR92/PR93's different migration-92 lineage is NOT imported into PR97. Independent
cross-PR catalog consolidation is future work, not inferred from clean individual PRs.
Preserve current source's PG18 version gates; do not downgrade the live PostgreSQL.

Run types/boundaries, dependency gates, full standing tests, real relevant browser
proofs and the isolated canonical referee. Integrating invariant-adjacent contexts
requires independent reviewer execution before acceptance; parent/Qwen/CI evidence
alone is not that approval. Do not publish as fully accepted or deploy the candidate.
