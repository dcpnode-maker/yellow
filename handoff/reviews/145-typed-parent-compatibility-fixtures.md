# Independent Tier-3 review — Order 145 typed-parent compatibility fixtures

**Verdict:** APPROVED

**Reviewer:** independent non-implementing OpenAI Codex Tier-3 reviewer

**Exact executable:** `81369f7c5ac8f572700ad44a9e47d11a6f7048d0`

**Admission / exact pre-fix state:** `28e0e4484bd05588e64a04617f64aeeb7c0703de`

**Approved base:** `2faf5e8db8264af59e65effdfcb5603da628a181`

**Strict migration source used only for proof:**
`b96101f55d05eced75d0ed6fe2a432251f810580:migrations/0014_bind_occupancy_caller_tenant.sql`,
Git blob `83fd6d4f4e99db52dc5670a2741dfa4455867d13`

No scope, fixture-authority, typed-parent, occupancy, tenant-isolation, lifecycle,
rollback, concurrency, security-definer, ACL, search-path, protected-file or
proof-strength finding was found. This approval is only for Order 145's two test
fixtures. It does not approve or close Order 126, merge, push or deploy anything, or
close a Cyber finding.

## Provenance and exact scope

The reviewer resolved Question 148 directly from metadata commit `7124777`; it names
the two inherited stale fixtures and requires this separate test-only predecessor.
`git merge-base --is-ancestor` passed for Base → admission → executable.

Admission-to-executable implementation changes exactly:

```text
tests/operational-blocks.integration.test.ts
tests/security-definer-containment.integration.test.ts
```

The remaining changes are only Order 145 builder metadata. There is no production,
migration, protected referee/architect fixture, role, ACL, function, state or event
change. Corrected fixture blobs are:

```text
tests/operational-blocks.integration.test.ts            096968d226fef8a356572e1c1f2e547aef9544cd
tests/security-definer-containment.integration.test.ts  6d2e9f0c24fe14345aead862487bd2f928b04443
```

The reviewer compared the exact zero-context diff and test declarations. All ten test
cases and their assertions are unchanged. The operational fixture only replaces broad
parent selection with joins to actual `space_occupancy` rows of the matching `ooo` or
`hold` kind. Those parents use globally primary-keyed UUIDs; strict migration 0014
independently validates exact tenant, kind, space and period before release. The
containment fixture only creates one same-tenant property-coherent guest, unit type,
sellable mapping, rate plan, reserved reservation and booked exact segment before the
existing app-role `record_occupancy` call.

## P0 — reviewer-reproduced strict red

The reviewer created a detached worktree at exact admission, overlaid only the strict
0014 blob above, installed frozen dependencies, migrated fresh `yellow_o145r_red`
through 0014, and ran:

```powershell
$env:YELLOW_REQUIRE_OPERATIONAL_BLOCK='1'
$env:YELLOW_OPERATIONAL_BLOCK_URL='postgres://yellow:yellow@127.0.0.1:5442/yellow_o145r_red'
$env:YELLOW_REQUIRE_SECURITY_DEFINER='1'
$env:YELLOW_SECURITY_DEFINER_URL=$env:YELLOW_OPERATIONAL_BLOCK_URL
bun test tests/operational-blocks.integration.test.ts tests/security-definer-containment.integration.test.ts
```

Result: 4 passed, 7 failed, 35 assertions. Operational P1/P2 and containment P0/P1/P2
remained green. Before each later operational case, stale cleanup raised exact `P0003`
`occupancy slot is unknown or foreign` for a zero-claim/wrong-kind row. The fabricated
containment segment raised exact `P0003` `occupancy typed parent is invalid or stale`.
This exactly reproduces the pre-registered compatibility red without modifying 0014.

## P1/P2 — corrected full-strength suites

The reviewer created a second detached worktree at exact executable, overlaid the
identical strict 0014 blob, freshly migrated `yellow_o145r_green`, and ran the same two
complete suites. Result: 10/10 passed with 65 assertions.

The operational suite retained exact OOO/OOS lifecycle evidence, zero-claim OOS,
close/repeat-close behavior, real-hold conflict with no artifacts, tenant/property and
hostile-input fail-closed behavior, injected second-publication rollback, and twenty
concurrent OOO attempts with exactly one winner and nineteen domain-conflict losers.

The containment suite retained app-owned `pg_temp` shadow denial, every definer's
qualified safe path, exact PUBLIC/app-role execution authority, direct DML and forbidden
function calls at SQLSTATE `42501`, negative prune interval at `22023`, owner-only prune
count/state, one exact app-role occupancy claim and release count `1`. The entire P3/P4
fixture transaction rolls back in `finally`, leaving no durable parent or claim.

## P3 — standing, protected and pristine gates

Reviewer-executed results on the exact executable:

```text
bun install --frozen-lockfile  23 packages, no changes
bun test                       173 passed, 422 skipped, 0 failed, 1,982 assertions
bun run typecheck              PASS
bun run boundaries             PASS, 64 TypeScript files
bun run license-check          PASS, 23 packages
bun audit                      PASS, no vulnerabilities
container image pin tests      PASS within standing suite
git diff --check Base..exe     PASS
```

On a separate fresh database migrated only through the executable's canonical 0013,
the unchanged architect fixture and protected referee passed 11/11 with 85 public
tables and 75/75 RLS tables/policies. `bun run schema:check` matched
`tests/schema/expected.sql` exactly. The application container was never started.

Protected SHA-256 values recomputed by the reviewer:

```text
migrations/0001_init.sql  fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923
tests/run_invariants.py   2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d
tests/seed_fixture.sql    bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62
tests/schema/expected.sql a5ffe526138e0c87365f58bbf1f0a08f51f531418aefe6ebe414ffda7e51d59a
```

All three exact `yellow_o145r_*` databases and both disposable detached worktrees were
removed. No `yellow_migrate_*` database remained. The shared PostgreSQL service was
left healthy on port 5442 for coordinator cleanup; no Compose service was started,
stopped or reconfigured by this review.
