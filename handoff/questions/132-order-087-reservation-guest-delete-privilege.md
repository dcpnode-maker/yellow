# Question 132 — Order 087 cannot remove guests through `app_role`

## BLOCKED — ARCHITECT NEEDED

Order 087 is preserved after its committed intentional red and before any production commit.
The first implemented fresh-database run reached the real PostgreSQL role and returned:

```text
PostgresError: permission denied for table reservation_guest
SQLSTATE 42501
1 pass, 4 fail, 35 assertions
```

The failure is exact. `migrations/0001_init.sql` grants `SELECT, INSERT` on all tables and `UPDATE`
on `reservation_guest`, but no `DELETE`. The order's locked full replacement must delete absent
non-primary rows before inserting the desired set. Validation-only cases pass because they fail
before that statement; every valid replacement is denied by PostgreSQL.

### Why Codex stopped

- Bypassing `SET LOCAL ROLE app_role`, connecting as owner or hiding deletion in another context
  would weaken the tenant/security boundary.
- Additive-only guest writes would lie about removal and make exact share allocation impossible.
- Moving a removed guest to a sentinel, encoding membership in facts/outbox, or inventing an
  `active` convention without schema would create a second source of truth.
- A new migration, privilege or SECURITY DEFINER function crosses the D-92 hard floor and overlaps
  the active architect security review.

### Recommended narrow answer

Authorize one forward migration granting `DELETE` on `reservation_guest` to `app_role`, plus exact
schema/privilege and cross-tenant delete-denial proofs. This table is not insert-only, already grants
unrestricted `UPDATE` to `app_role`, and RLS scopes DELETE through its existing USING policy. The
application service will still lock the reservation, preserve the primary row and delete only
same-reservation rows whose role is not `primary`.

If the security review rejects direct DELETE, choose and order a different durable membership model.
Do not ask Codex to add a SECURITY DEFINER shortcut implicitly; the current review already found
unfixed definer-function hardening debt.

### Disposable sufficiency probe — builder evidence, not authorization

Codex recreated a fresh six-migration database in Compose project `yellow-order-087-probe`, applied
`GRANT DELETE ON reservation_guest TO app_role` only inside that disposable database, and restarted
the complete focused suite. It passed:

```text
5 pass
0 fail
74 expect() calls
```

The suite includes exact 2/3/4-way shares, immutable primary identity, hostile values, same-tenant
party validation, terminal/status/property/tenant rejection, two-writer stale-hash arbitration,
actor/property/body-bound idempotency, guest/fact/event rollback boundaries and PII-free evidence.
An additional direct role/RLS probe set tenant A, assumed `app_role`, attempted to delete tenant B's
guest row, and observed:

```text
cross_tenant_deleted=0
foreign_row_remains=1
```

This proves the narrow grant is sufficient for the current service and that the existing policy
still hides a foreign tenant in this exact path. It does not approve the migration, settle Claude's
repository-wide runtime-role findings, or turn builder evidence into independent security review.

### Preserved state

- Red/order commit: `4f85d9d`
- Proof-correction commit: `89d5085`
- Uncommitted implementation/test files remain in the Order-087 worktree and typecheck.
- Temporary Compose project: `yellow-order-087-dev` on PostgreSQL port 5488; safe to destroy and
  recreate before the mandated from-top run.

Answer YES to the recommended narrow migration and specify its order/scope, or provide the alternate
durable membership contract. Until then no Order-087 production commit, Order 088 or Phase 5 work.
