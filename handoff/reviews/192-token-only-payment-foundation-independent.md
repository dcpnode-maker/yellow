# Order 192 independent Tier-3 review — APPROVED AFTER CORRECTION

**Reviewer:** OpenAI Codex independent non-implementing reviewer

**Base:** `a92659b00f6ac541f3b4af09ad6d062e9a446d9b`

**Implementation candidate:** `afaa9674c65984f08cbd56031510c308ce3681ad`

**Corrected proof candidate:** `549b81dba6ead5163135d0c4a76169429174eebd`

**Builder-governance head reviewed:** `caf60333731d6cd688da3c126ef0af92561617c3`

**Decision:** APPROVED — D-509

## Summary

The exact payment implementation, migration, contracts and production source remain
byte-identical to the previously reviewed `afaa967` candidate. Corrected candidate
`549b81d` changes only two admitted proof files and closes all three D-507 blockers:
the scanner now executes over public/assets/seeds/evidence fixtures with a narrow
counted non-card allowlist; both new tables receive real tenant-A/B hostile execution;
and deterministic distinct-key capture/void, increment/capture and refund races prove
exact winner and loser-artifact behavior. The complete Tier-3 review was rerun from
the top on fresh reviewer-owned databases and is green.

## Resolved findings

| D-507 blocker | Correction and reviewer result |
|---|---|
| No-PAN/CVV scan omitted public assets and evidence fixtures. | The scanner traverses every existing `src`, `public`, `assets`, `migrations`, `scripts`, `fixtures` and `tests` surface; asserts representative runtime, scenario, Party, fact, outbox, idempotency and SQL fixture files are included; uses only two exact counted non-card integer allowlist entries; checks Luhn and CVV/CVC shapes; and checks fact/outbox/idempotency evidence plus forbidden database column names. P5 passes. |
| New-table tenant isolation was catalogue-only. | P1 creates tenants A and B, operations and receipts, proves each app-role transaction sees only its own operation/receipt, rejects A-context inserts carrying B authority, rejects foreign reconciliation, and proves zero hostile artifacts. P1 passes. |
| P4 lacked distinct state/refund races. | Three pause-controlled twenty-way tests race distinct capture-vs-void, incremental-vs-capture and refund keys. Each produces one winner, nineteen rejected losers, exact payment/journal/fact/outbox/line cardinalities, at most one capture, bounded refunds, exact folio balance and zero tenant ledger drift. P4 passes. |

No prior Order192 assertion was removed or weakened. The only companion Party-proof
change constructs its hostile CVV sentinel dynamically so rejection remains active
without retaining prohibited contiguous evidence.

## Personally executed evidence

- Read the constitution, Phase5 plan, roster/workflow, Order192, D-505–D-508 and the
  mandatory compliance/entity/PostgreSQL skills. Repair scope is exactly
  `tests/financial-payments.integration.test.ts` and
  `tests/operator-party-profiles.integration.test.ts`; no migration, production
  source, contract, schema expectation or setup behavior changed after `afaa967`.
- `.\setup.ps1 -DbOnly`: fresh migrations1–21, exact87 public tables, 77 RLS-enabled
  tenant tables and77 policies; referee **11 passed, 0 failed**.
- Corrected payment suite with isolated runtime/deployment URLs: **10 pass, 0 fail,
  560 expectations**. It executes schema/index/FK/RLS/ACL shape, A/B isolation and
  hostile writes, journal-free auth/increment/void, one balance-capped capture,
  linked refunds, same-key and distinct state/refund races, receipt reconciliation,
  rollback, hostile authority/money/token containment, normalized evidence and
  canonical journal lines.
- Fresh `yellow_order192_rereview` migrated1–21 and seeded canonically. Database
  acceptance, app-role nonlogin and runtime-authority: **21 pass, 0 fail,
  117 expectations**.
- Inherited financial postings: **10 pass, 0 fail, 111 expectations**, including
  500 charges and 1,000 balanced immutable lines.
- Cached `oven/bun:1.3.14-alpine` migration suite: **23 pass, 0 fail,
  118 expectations**, including the symlink fail-closed fixture.
- Native Windows migration suite: **22 pass, 1 host-policy failure**. The only failure
  is disclosed Windows `EPERM` while the test creates its symlink fixture before
  product migration code runs; the identical Linux execution above is green.
- `bun test`: **264 pass, 511 database-dependent skips, 0 fail,
  3,378 expectations**.
- Schema drift: exact; typecheck: pass; boundaries: 70 files; licences: 23 packages;
  `bun audit --production`: no vulnerabilities; both exact-range diff checks pass.
- Disposable reviewer database was dropped; worktree was clean before governance.

## PowerShell setup review

The earlier `setup.ps1` repair is unchanged and was re-executed end to end. Explicit
Compose argument arrays and standard input fix PowerShell binding without weakening
readiness, postmaster identity, SQL `ON_ERROR_STOP`, database recreation, exact table
count or referee failure propagation.

## Verdict

**APPROVED.** Corrected exact Order192 candidate `549b81d` satisfies D-505 and closes
D-507 with personally rerun Tier-3 proof. Approval covers only this bounded token-only
payment foundation; no local promotion, founder database/credential/permission
mutation, merge, push, public/production deployment or Phase completion is approved.
