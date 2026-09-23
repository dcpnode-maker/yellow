# Independent review — Order 094 reservation-guest DELETE privilege

**Result:** APPROVED

**Reviewed tip:** `d5a686d`

**Reviewed base:** `963793d`

**Reviewer:** independent non-implementing Codex reviewer

**Date:** 2026-08-24

The reviewer did not implement or edit the change. The exact seven-file diff remained
inside Order 094 Scope. Migrations 0001–0006 and `tests/run_invariants.py` were
byte-identical to the base. Migration 0007's independently calculated SHA-256 was
`b39b67ed47e83f348f88dfa892dc5c6df75014822b2bf1084c97c51d2c6571db`.

On a fresh isolated `yellow-order094-review` PostgreSQL project, the reviewer personally
executed P1/P2: **2 passed, 0 failed**. Tenant A could delete its non-primary guest,
tenant B's row was invisible to the same DELETE and remained present, and rollback
restored tenant A. `app_role` was a non-superuser without `BYPASSRLS` and did not own
the table. `reservation_guest` retained RLS and its transaction-local tenant policy;
PUBLIC had DELETE on zero public tables. Base-to-tip ACL drift added only
`reservation_guest` DELETE; the inherited `availability_projection` privilege remained
unchanged from migration 0005.

The migration ledger contained exact versions 1–7 and checksums, deployment acceptance
passed **4/4**, and the normalized schema matched the committed snapshot. Typecheck,
58-file import boundaries, the **120 pass / 0 fail** default suite with 1,544 assertions,
23-package licence policy and zero-vulnerability audit all passed. A second fresh
app-never-started referee database reported **11 passed, 0 failed of 11**. The reviewer
removed all disposable review containers, databases, network and volume afterward.

No guest command, general deletion/erasure API, Party deletion, financial/statutory
deletion, schema shape, event, state transition, product context or unrelated privilege
was introduced.

## Exclusive Order 094 discharge

- 094
