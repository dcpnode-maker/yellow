# Q217 — Order446 canonical87 release wiring

**Decision:** coordinator-approved technical scope admission under PROJECT.md and
D1427; no new business policy or founder action is required. This is preparation
for the tested Order446 feature, not permission to skip its financial proofs.

Adding only a migration would leave runtime readiness/current catalogue assertions
at86 and could silently run historical86 tests against87. The exact additional
paths below are admitted to Order446; no blind global86→87 replacement is allowed.

Coordinator runtime and migration proof:

- src/kernel/build-info.ts
- tests/build-readiness.test.ts
- tests/build-readiness.integration.test.ts
- tests/migrate.integration.test.ts

Bounded release-wiring worker:

- .github/workflows/ci.yml
- .github/workflows/release.yml
- scripts/local-review.sh
- setup.sh
- setup.ps1
- tests/setup-current-catalogue-oracle.test.ts
- tests/database-acceptance.integration.test.ts
- tests/app-role-nonlogin.integration.test.ts
- tests/india-gst-accommodation-final-component-tax-recording.integration.test.ts
- tests/native-fiscal-release-containment.integration.test.ts
- tests/positive-tax-correction.integration.test.ts
- tests/runtime-database-authority.integration.test.ts
- tests/release-workflow.test.ts
- tests/free-host-arm64.test.ts
- tests/fiscal-replay-workflow.test.ts
- tests/fiscal-retry-readiness.integration.test.ts
- tests/fiscal-retry-binding.integration.test.ts (only explicit preserved86
  migration-directory injection into its two imported runMigrations calls)

Changes are limited to current87 discovery/readiness, executed catalogue counts,
the eventual frozen0087 checksum, preserved historical prefix isolation, and
genuine new financial/HTTP/upgrade CI steps. Existing Q208 prefix85, Q212 binding
prefix86, the explicit85→86 migration boundary and their historical hashes must
stay unchanged. Q212 readiness imports current code and therefore runs on full87
while retaining its86-specific helper/checksum proof. Existing Order444/native85
and earlier77 launchers remain historical and unchanged.

No dependency, Docker/WSL startup, live app, provider, additional worktree, global
role change, UI asset or runtime deployment is authorized. The worker must not
invent a final0087 checksum or mechanically advance a count before actual SQL
confirms it. Canonical migration copy, schema generation and runtime frontier
promotion remain gated on complete whole-draft and independently executed proof.
Preparatory tests/CI wiring alone never mean that87 or Phase7 is complete.

No changes are needed to scripts/migrate.ts, scripts/schema-drift.ts,
src/kernel/index.ts, Dockerfile or package scripts. Further paths require another
exact written admission. .yellow/evidence/order446 remains the bounded ignored
artifact location; no uncommitted visual work may enter the functional candidate.

## Exact nonvisual candidate preparation

Root may construct one temporary Git index from exact published HEAD
d0f2f86391dfa1529f5436e7d866834bedda3608 plus only the admitted446/Q217
functional paths. src/app.ts and src/http/operator.ts are mixed with paused UI;
select only the added credit-note imports/constants/helpers/error mapping/API
methods and two API routes against HEAD. Do not include font/icon/guest-picker
assets or routes. Documentation must likewise include only the functional status,
order, decision and executable evidence additions, preserving historical truth.

One bounded immutable source archive/extracted verification artifact is admitted
at D:\Yellow\temp\order446-functional-validation-20260907. It is not a worktree,
another app, dependency install or database. Its node_modules may be a validated
junction to the active worktree's existing dependencies; no dependency copy.
No credentials/private evidence/UI assets may enter it. Record exact tree/archive
and real-index before/after hashes; preserve every unrelated real-index entry.
Code/schema promotion still follows the independent whole-draft proof above;
assembling the temporary candidate does not itself authorize publication/merge.

## Independent target-local readiness drift proof

The nonimplementer may exercise the grouped credit readiness probes from
tests/build-readiness.integration.test.ts ONLY on existing admitted synthetic
yellow_order446_credit_candidate_20260907 after the financial fault suite stops.
Do not invoke that file's generic database creation/bootstrap. Separate runtime
connections cannot see uncommitted deployment DDL, so committed target-local
metadata changes are admitted one probe at a time with exact finally restoration:
credit-binding FORCE RLS, tenant policy, app_role table INSERT ACL, the nonidentity
CHECK, property index, commit search_path/runtime EXECUTE ACL, private template
volatility, and credit-completion trigger deferred mode. Before each mutation,
capture the actual definition/owner/ACL and require the frozen intended baseline;
after it, personally require runtime readiness denial; after restoration require
runtime readiness success and equal OID-normalized schema plus all original rows.

No tenant/financial rows, migration ledger, roles/memberships/database ACLs, other
functions/relations, template or live app may change. No capability may remain
widened between probes or after failure. Record before/after source/effect hashes
and the unchanged outside/template/live snapshots. Complete the read-only schema
dump only after every probe restores successfully and no fault objects remain.
