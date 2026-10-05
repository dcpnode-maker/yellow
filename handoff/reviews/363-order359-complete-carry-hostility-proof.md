# Order 363 / 359 / 351 complete carry-hostility proof — fresh Tier-3 review

**Disposition:** WITHHOLD

**Reviewer:** `/root/order363_fresh_tier3`, fresh independent non-implementing Tier-3

**Exact proof candidate:** `80b696d054166ee4590b5139bf4cf644a1c6d601`

**Exact governance:** `b2707467236a585e8deb51c1843c86bc911bf28e`

## Blocking findings

### Inactive-decider proof tests the wrong condition

`resetCase()` makes the `INACTIVE` user active, while only requester and approver get
roles. The claimed inactive-decider is therefore an active unauthorized user. Removing
only migration0063's `AND u.status='active'` predicate survived a fresh 63-migration
focused run at **10/0 (110)**. Repair must grant the decider exact approval scope,
then inactivate that bound authorized user and kill the status-removal mutant.

### Event failure occurs before event mutation

The failing publisher throws without calling canonical publication or inserting
outbox. It proves rollback when publication fails, not rollback after the event row.
Repair must insert the canonical event in the supplied transaction, then fail before
completion, prove exact pre-state and permit one clean retry.

### Financial/fiscal byte snapshot omits required truth

The table list omits canonical `folio_balance`, `cashier_session`, `cashier_count`,
`cashier_count_line`, and `trust_negative_authorization`. It cannot prove complete
financial/fiscal/balance byte identity. Repair must snapshot the live exact surface
deterministically and include a mutation-sensitive observation for every member.

## Additional incomplete assertions

- ACL proof checks execute only for carry, not companion owner-mediated prepare.
- Same-key contender bodies and carry identities are not compared byte-for-byte.
- Consumed-approval reuse is masked by the already-resolved source; request and target
  reuse constraints are not independently mutation-sensitive.

## Executed evidence and cleanup

Exact baseline focused suite passed **10/0 (110)**. A second fresh PostgreSQL 16.15
database applied migrations 1–63 with exact `63/116/106/15/2`; the active-status
mutant also passed **10/0 (110)**. Broad gates were stopped after this decisive
mutant. The mutant was reverted and both disposable database projects/worktrees were
removed. Stable port3000 and `.yellow` were untouched. No carry, readiness, seal,
local, downstream, merge, deployment or Phase5 approval follows.
