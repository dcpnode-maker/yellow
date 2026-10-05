# Order 475 — current-target reviewed-seed read-only preflight

Date: 2026-09-20 · Executor: Codex `/root`.

One runtime-RLS database session ran with `BEGIN TRANSACTION READ ONLY`,
`SET LOCAL ROLE app_role`, and transaction-local Yellow Demo tenant context. It
ended with `ROLLBACK`. No seed, DDL, DML, migration, reconciliation function,
login, restart, credential output, or external request occurred.

The fixed reviewed clean-arrival prerequisites are canonical:

| Comparison | Result |
| --- | ---: |
| Read-only / app-role / tenant-bound context | true / true / true |
| Clean-arrival Party count / canonical shape | 1 / true |
| Canonical guest-role detail | 1 |
| Canonical guest account | 1 |
| Clean-arrival primary folio relationship | 1 |

The fixed public cashier target exists but is incomplete:

| `PARKING-REVIEW` relationship | Count |
| --- | ---: |
| Current in-house reservation | 1 |
| Primary reservation guest | 0 |
| Exact exclusive segment occupancy | 0 |
| Open primary folio | 0 |
| Zero-balance primary folio | 0 |

This proves the previously blocking clean-arrival collision is not present in the
current target and that the public cashier error represents missing synthetic
fixture relationships. It does not itself authorize mutation; any delivery must
use the independently reviewed exact seed source or a separately reviewed bounded
reconciler, preserve financial zero state, and receive independent postflight.
