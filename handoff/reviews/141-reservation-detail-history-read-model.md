# Order 141 independent review — reservation detail and history read model

**Result:** APPROVED — no findings

**Reviewed executable:** `9b6f344de50ffad3420821673c2936322526312c`

**Builder evidence tip:** `d189c83cdba17ebee77ec1462655ebf4155574bf`

**Base:** `952478d17bcebd67e696d5cb76eec37e89cabcf3`

**Reviewer:** independent Codex agent; did not implement the candidate

**Date:** 2026-08-25

## Findings

None.

The final candidate closes both earlier review blockers. Segment periods now fail closed
unless finite, non-empty and exactly `[)`, before required bounds are formatted. Stored
references are resolved losslessly and rejected when hidden by RLS, cross-tenant,
wrong-property or subject-incoherent. This includes reservation property/primary/booker,
group, segment unit-type/unit/rate-plan, guests and the unique primary guest, folio
accounts including D-320 null-property accounts, pickup tasks, and fact predecessors.

The implementation remains a parameterized read-only context query. Tenant and property
scope are applied to the root lookup and every property-scoped reference; transaction-local
tenant context is checked; no mutation, lock, advisory lock, occupancy, outbox, migration,
permission, route, UI or runtime wiring was introduced. History remains append-only in
stable order with complete payload and supersession data, and repeated reads do not write.

## Reviewer-executed proof

All commands were run personally from the Order 141 worktree against the exact executable
and evidence tree. The PostgreSQL proof used isolated Compose project
`yellow-o141-review`, app/PostgreSQL/Valkey ports `31441/55441/63941`; the concurrent
Order 130 project on `55430/63930` remained untouched.

```powershell
bun run typecheck
bun run boundaries
bun test
bun run license-check
bun audit
```

- Typecheck passed.
- Import boundaries passed: 64 TypeScript files scanned.
- Standing tests passed: 150 passed, 397 skipped, 0 failed, 1,832 assertions.
- Licence policy passed for 23 installed packages.
- Audit reported no vulnerabilities.

```powershell
$env:COMPOSE_PROJECT_NAME='yellow-o141-review'
$env:YELLOW_POSTGRES_PORT='55441'
$env:YELLOW_VALKEY_PORT='63941'
$env:YELLOW_APP_PORT='31441'
.\setup.ps1 -DbOnly
```

Pristine setup created both databases, applied migrations 0001–0011, produced 85 tables,
confirmed RLS on 75/75 protected tables, and passed the protected referee: 11 passed,
0 failed of 11.

```powershell
$env:YELLOW_REQUIRE_RESERVATION_DETAIL='1'
$env:YELLOW_RESERVATION_DETAIL_URL='postgres://yellow:yellow@127.0.0.1:55441/yellow_test'
bun test tests/reservation-detail.integration.test.ts
$env:YELLOW_SCHEMA_DATABASE='yellow_test'
bun run schema:check
git diff --check 952478d17bcebd67e696d5cb76eec37e89cabcf3..d189c83cdba17ebee77ec1462655ebf4155574bf
```

- Focused proof passed: 5 passed, 0 failed, 51 assertions, including hostile finite-range,
  RLS/reference-coherence, null-property folio, pickup-task and predecessor cases.
- Schema matched `tests/schema/expected.sql` exactly.
- Diff whitespace check passed.

After proof, `docker compose down -v` removed only the isolated Order 141 containers,
network and volume. Docker Desktop/WSL were not stopped, and Order 130 containers remained
running. Approval is limited to the Order 141 read-model scope and makes no integration,
merge, deployment, HTTP/UI or full-UAT claim.
