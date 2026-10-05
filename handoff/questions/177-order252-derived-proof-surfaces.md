# Question 177 — Which derived proof surfaces must advance with migration 0041?

**Raised:** 2026-08-29
**Order:** 252
**Resolved:** D-654

## Evidence

Fresh migration and focused proof reached the exact new 96-table schema. The canonical
`setup.sh --db-only` referee still asserted migration40/95 tables, so the required
standing gate would reject the truthful additive migration. The older Order081
reservation-commit harness also used one deployment-owner DSN for both fixture setup
and application transactions. The new owner-mediated lineage capability correctly
requires the real `yellow_runtime`→`app_role` transition; three held-path tests therefore
failed at the invocation guard even though focused real-runtime behavior and the
Order129 split-authority suite were green.

Neither issue changes product behavior. They are exact derived proof/configuration
surfaces required to execute the already admitted Order252 contract.

## Resolution

Expand Order252 only to update `setup.sh` from migration40/95 to migration41/96 and
to split `tests/reservation-commit.integration.test.ts` into its existing deployment
fixture authority plus runtime application authority, preserving the historical
single-URL fallback only where it still names both explicitly. No setup provisioning,
seed, product, API, local runtime or credential behavior changes.

