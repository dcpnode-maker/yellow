# Question 057 — Order 053 proof uses stale schema-column names

## Trigger

The first implemented Order 053 focused run returned 5 pass / 2 fail. Product behavior,
rollback and the 20-way occupancy race passed. P1 queried nonexistent
`fact_log.request_id`; P7 joined `role_permission` using nonexistent `permission_id`.

## Exact evidence

- `fact_log` has no correlation/request column. `outbox.correlation_id` exists, while
  both block-related events are already identifiable by `aggregate_id` or their exact
  money-free `payload.block_id`.
- `role_permission` is `(role_id, permission_code)` and `permission.code` is its foreign
  key; there is no numeric permission id.

## Proposed correction

Keep every cardinality and permission assertion. For P1 count outbox rows whose
`aggregate_id` is the block or whose payload contains that block id, matching P3's
already-green evidence query. For P7 join `role_permission.permission_code` to
`permission.code` and `role_permission.role_id` to `role.id`. Recreate the database and
restart all seven proofs. No product, threshold, scope or expected value changes.

## Hard-floor status

Implementation edits stopped at the red run. Temporary architect response required
under D-92/D-95/D-115.
