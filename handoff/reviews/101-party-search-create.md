# Independent review — Order 101 tenant-safe Party search and create

**Result:** APPROVED

**Reviewed tip:** `7f0fdfb`

**Implementation base:** `69242f1`

**Rejected first tip:** `7753614`

**Reviewer:** independent non-implementing Codex reviewer

**Date:** 2026-08-24

The reviewer did not implement Order 101. The first review rejected `7753614` because
the create contract permits several unique email contacts while duplicate lookup,
reason construction and masked evidence evaluated only the first sorted email. A Party
sharing only a later email could therefore pass empty acknowledgement even though the
service acquired an advisory lock for every email token. The registered eight-test
proof passed 8/8 with 116 assertions at that tip, confirming this hostile case was not
covered.

Corrected tip `7f0fdfb` closes the finding through the complete production path. It
derives every canonical email value, compares the whole set in PostgreSQL candidate
lookup, uses the same set for duplicate reasons and exposes hints only for matching
contacts. The permanent second-email canary supplies a unique first email and an
existing Party's email second, then proves exact masked duplicate review is required
and artifact counts remain unchanged. No input restriction or product behavior was
silently narrowed.

The exact `69242f1..7f0fdfb` scope matches Order 101. Migration 0008 adds only the
tenant-leading `party_tenant_status_id` and
`contact_point_tenant_kind_value` indexes. Search binds the authenticated transaction
tenant and requested tenant, joins Party children on both Party id and tenant, excludes
non-active Parties, remains bounded and returns masked contacts. Hostile baseline
children whose tenant and Party ownership disagree cannot attach to a returned Party.
Create rejects unknown top-level and contact fields, normalizes names/email/E.164,
locks the sorted tenant-scoped name and every contact token, recomputes the exact
current tenant candidate set, never auto-merges, and atomically persists Party, roles,
contacts, fact, event and idempotency outcome. Fact, event, duplicate and stored
idempotency evidence contain no raw names or contact values. Exact replay, changed
request conflict and failure-after-outbox rollback are covered by production-shaped
proof.

On fresh isolated PostgreSQL project `yellow-order101-rereview`, port 5507, the
reviewer personally executed:

- `npx -y bun@1.3.13 scripts/migrate.ts` — migrations 0001–0008 applied on one
  connection-affine backend, including migration 0008 checksum/ledger evidence;
- `YELLOW_REQUIRE_PARTY_PROFILES=1 npx -y bun@1.3.13 test tests/party-profiles.integration.test.ts`
  — P1–P4 passed 8/8, 0 failed, 118 assertions, including the corrected second-email
  overlap, corrupt child joins, tenant isolation, normalized per-token lock races,
  exact acknowledgement, replay, rollback, PII minimization and unknown-field rejection;
- `npx -y bun@1.3.13 run typecheck` — passed;
- `npx -y bun@1.3.13 run boundaries` — 60 TypeScript files, no violations;
- canonical seed followed by
  `YELLOW_REQUIRE_DATABASE_ACCEPTANCE=1 npx -y bun@1.3.13 test tests/database-acceptance.integration.test.ts`
  — 4 passed, 0 failed, 10 assertions;
- `COMPOSE_PROJECT_NAME=yellow-order101-rereview YELLOW_SCHEMA_DATABASE=yellow_dev npx -y bun@1.3.13 scripts/schema-drift.ts --check`
  — exact normalized schema snapshot;
- `npx -y bun@1.3.13 test` — 131 passed, 350 skipped, 0 failed, 1,659 assertions
  across 77 files;
- `npx -y bun@1.3.13 run license-check` — 24 installed packages passed;
  `npx -y bun@1.3.13 audit` — no vulnerabilities.

A separate app-never-started PostgreSQL project `yellow-order101-referee`, port 5508,
was freshly migrated through 0008, loaded only with the untouched invariant fixture and
run through `python tests/run_invariants.py yellow_dev`: **11 passed, 0 failed of 11**.

Protected canonical surfaces `migrations/0001_init.sql`, `docs/STATE-MACHINES.md`,
`docs/EVENTS.md` and `docs/EXTENSIONS.md` are unchanged. Migration 0001 SHA-256 remains
`FE2A9FC949C6BACDED3F8D3FC4D14FC596A83EBDE9AEB043EB10845F07B30923`; the untouched
referee remains `3228279BD99A8F9B6AF99748F31D4D4B482A8E627E16D92644D9D859AD8BEFA1`.
The order header's four intentional Markdown hard breaks are the only whole-order
`git diff --check` reports. Both disposable reviewer database projects and volumes were
removed. User-owned `.agents/`, `.codex/hooks.json` and `handoff/chat-archive/` paths
were untouched.

Approval is exclusive to Order 101's tenant-safe Party search/create domain surface,
migration 0008 and its ordered proof/documentation. It does not approve Party merge or
anonymisation, identity documents, addresses, consent/preferences, profile editing,
cross-source identity links, reservation integration, HTTP, UI, payment, fiscal or any
other later CRM behavior.

## Exclusive Order 101 discharge

- 101
