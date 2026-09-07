# Q220 — Current87 migration acceptance oracles

**Status:** RESOLVED technical scope under Order446. **Date:**2026-09-08.

Exact e3262afa CI34153361691 clears cumulative Phase3, then fails seven
assertions in tests/migrate.integration.test.ts that still expect the previous
full-current catalogue. The historical-lineage test also contains masked stale
ledger length, no-op discovered count and final catalogue assertions after the
first failure. Its predecessor is1–44, but its upgrade explicitly applies the
full PROJECT_MIGRATIONS directory, now1–87. Normal CodeQL is independently green;
later database acceptance steps remain skipped, not passed.

Admit only tests/migrate.integration.test.ts and the existing
tests/setup-current-catalogue-oracle.test.ts for exact current87 expectation
corrections and regression coverage. Audit each literal in its test's migration
source context: current tables129, RLS119, policies119, forced28, migration87.
Append0087 to the full-current appliedFiles expectation. Retain historical
prefix84/85/86 expectations, exact predecessor checksums and all security,
transaction, tenant, mutation and failure assertions. No SQL/product changes,
shared-cluster bootstrap, new database, UI, runtime or provider activation.

The nonimplementing reviewer records the exact CI findings and executes focused
red/green pure tests. Root independently checks the bounded diff and publishes
only these two test files plus this scope record. Exact-source CI must still
execute actual database proofs; skipped native hooks are never a pass claim.
