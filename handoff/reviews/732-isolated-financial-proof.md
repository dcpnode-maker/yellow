# Independent review — Order 732 isolated financial proof

Reviewer: `financial_proof732`, a nonimplementing agent. Date: 2026-09-25. Verdict: **the isolated Order 727 financial proof passes**. This does not repair the inherited shared or serving cluster's role drift.

## Provenance and bounded retry

The prior attempt used `pg_isready` without `-h`, detected the image's temporary Unix-socket bootstrap server, and failed provisioning with `Connection closed`; no migrations or fixtures were applied. The prior reviewer's later command verified host TCP `SELECT 1` and exact database/deploy identity but exited before provisioning because its runtime and registrar password variables were unset. Root interrupted that reviewer and transferred exclusive ownership of the already-started, unmigrated retry container to me; no third container was created.

I verified the exact container ID `49b670a09658ee2f55fdde7d0d64fbbfe442a306707d8b9ab1bded67d09a3a9f`, labels `codex.order=732` and `codex.owner=guest_contract709`, PostgreSQL `18.6-alpine`, loopback `127.0.0.1:55434`, 512 MiB, one CPU, no restart policy, and no shared mount. The official image's anonymous internal PostgreSQL volume belonged to this disposable instance. The database was `yellow_order732_financial_proof`; before setup, neither `schema_migration` nor `yellow_runtime` existed. The exact proof-only deploy credential was read internally from this container's environment and never printed or persisted. Fresh pairwise distinct runtime and registrar credentials were generated in the same PowerShell process. No serving connection, volume, role, or secret was used.

I personally ran host-side Bun SQL `SELECT 1, current_database(), session_user` via `127.0.0.1:55434` with a two-second connection timeout and asserted exact database and `yellow_deploy` identity. It passed before the unchanged `scripts/provision-local-database-authority.ts`. The provisioner created owner, runtime and registrar roles. The unchanged `scripts/migrate.ts` then applied migrations 0001 through 0101; summary `applied=101 status=applied`.

Required suites ran sequentially against this isolated database with their `YELLOW_REQUIRE_*` flags set to `1`:

| Personally executed command | Result |
|---|---|
| `bun test tests/financial-corrections.integration.test.ts` | 9 pass, 0 fail, 53 assertions |
| `bun test tests/financial-statements.integration.test.ts` | 12 pass, 0 fail, 48 assertions |
| `bun test tests/operator-folio-workbench.integration.test.ts` | 25 pass, 0 fail, 266 assertions |

I directly queried `pg_roles`, `pg_auth_members` and `schema_migration`: `app_role`, `yellow_owner`, `yellow_runtime` and `yellow_extension_registrar` all had `rolinherit=false`, no superuser or BYPASSRLS privilege; `yellow_runtime -> app_role` had `inherit_option=false`, `set_option=true`; the migration ledger counted 101. The corrections suite also passed its exact function privilege/ACL assertions that had failed on the drifted shared cluster. This is reviewer-executed genuine PostgreSQL and authenticated HTTP proof, not a mock or implementer-supplied result.

I inspected a bounded 60-line container log tail before cleanup. It contained expected hostile-test denials: non-`app_role` financial lock/header calls, missing or invalid tenant/target/actor, and denied direct journal update/delete. No credential appeared in the inspected output. The green suite results show these are negative test cases, not setup failures.

The original shared-cluster `yellow_runtime INHERIT` and membership `inherit_option=true` mismatch remains unresolved. This isolated pass does not authorize role changes there, production readiness, local app promotion, or any real guest financial action.

Cleanup completed after rechecking exact ID, name, labels, loopback port and the single anonymous internal data volume. I stopped and removed only `49b670a09658ee2f55fdde7d0d64fbbfe442a306707d8b9ab1bded67d09a3a9f` with its disposable anonymous volume. `docker ps -a` confirmed no `yellow-order732-financial-proof` container remains. No serving container, database, cache or shared volume was stopped or removed.
