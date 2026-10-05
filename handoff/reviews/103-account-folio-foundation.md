# Independent review — Order 103 account-owned reservation folio foundation

**Result:** APPROVED

**Reviewed tip:** `a587a23`

**Implementation base:** `f32663f`

**Reviewer:** independent non-implementing Codex Tier-3 reviewer

**Date:** 2026-08-24

The reviewer did not implement Order 103. The exact `f32663f..a587a23` change is
limited to the order's declared migration, financial-context service, proof,
documentation and status surfaces. It adds no table, column, status, account role or
event and does not edit the immutable baseline. No HTTP, UI, worker, journal, posting,
balance, payment, deposit, tax, fiscal document, trust, AR, cashier or business-day
behavior enters this slice.

Migration 0009 preserves the existing single-column entity keys and adds the candidate
`(tenant_id,id)` keys required by tenant-coherent account and folio foreign keys. The
account property/Party and folio account/reservation references therefore fail at the
database edge when parent and child tenants disagree. The exact
`(tenant_id,reservation_id,window_no)` uniqueness constraint is tenant-leading and
arbitrates concurrent reservation windows independently of application checks. Nullable
house/outlet/event relationships retain their baseline semantics.

`FolioService.openPrimary` accepts only the order's tenant, reservation, idempotency and
audit envelope shape. It binds every read/write to both the requested tenant and the
transaction-local PostgreSQL tenant, locks the reservation before deriving property,
primary Party and currency, accepts only the four ordered reservation statuses, and
fails on property mismatch. Lock order is deterministic: idempotency claim, reservation
advisory/row lock, canonical account advisory/row lock, then the one property folio
series. Concurrent reservations sharing an account serialize on the same composite
account key without a reverse lock path; concurrent keys for one reservation serialize
before account or numbering work.

Account reuse is exact on tenant + property + `guest` + primary Party + currency. The
service creates a non-PII open account only when none exists and fails closed for
ambiguous, frozen, closed or inconsistent accounts. An existing window 1 is returned
unchanged only when it is open and belongs to that canonical account. Otherwise the
service requires exactly one non-fiscal `kind='folio'` series, locks it, increments it
and inserts the folio in the same transaction as the minimized fact, catalogued outbox
event and durable idempotency outcome. A later failure rolls the series update and every
artifact back. Payloads contain only folio/account/reservation UUIDs, window number and
folio reference; no Party identity, contact, note, token, raw reservation metadata or
money is exposed.

On a fresh disposable database `yellow_review103` under local PostgreSQL 16.15, the
reviewer personally executed:

- migrations 0001 through 0009 from zero — all applied successfully on the migration
  runner's reserved backend; migration 0009 ledger checksum is
  `56d3d47e2007d9106376459dc77623551f21731c5b6312e43e6ab100150205c2`;
- Order 103 focused P1–P4 — **12 passed, 0 failed, 90 assertions**. This directly
  rejected cross-tenant account/folio references and duplicate window 1; proved exact
  account reuse and property/currency separation, locked numbering and minimized
  evidence, unchanged reopening, twenty-way different-key convergence, exact replay
  and changed-request conflict, failure-after-outbox rollback with number reuse,
  hostile inputs/states/series/accounts/corrupt windows, app-role RLS isolation and
  byte-identical excluded financial table counts;
- canonical `setup.ps1 -DbOnly` against a newly recreated `yellow_test` — migrations
  0001–0009, exact **84 public tables**, untouched invariant fixture and **11 passed,
  0 failed of 11** referee checks;
- fresh deployment acceptance — **4 passed, 0 failed, 10 assertions**, including exact
  PostgreSQL version/preload, nine-row immutable migration ledger, deployment ownership
  and canonical seed;
- normalized schema drift check — exact match to `tests/schema/expected.sql`;
- TypeScript typecheck and the 24-package permissive licence gate — passed; `bun audit`
  reported no vulnerabilities.

The reviewer also inspected the committed builder evidence for the Linux-only standing
surfaces: 13/13 migration tests, 136/0 standing tests with 1,719 assertions and 61-file
import boundaries. A reviewer attempt to repeat repository-wide standing checks on the
Windows host was discarded because Bun 1.3.14 failed package-export resolution before
test assertions despite an exact frozen install; no such environment failure is counted
as product proof. The non-waivable Tier-3 evidence above was personally executed on the
exact tip and fresh PostgreSQL.

Protected migration 0001 SHA-256 remains
`FE2A9FC949C6BACDED3F8D3FC4D14FC596A83EBDE9AEB043EB10845F07B30923`; the referee
SHA-256 remains
`3228279BD99A8F9B6AF99748F31D4D4B482A8E627E16D92644D9D859AD8BEFA1`.
User-owned `.agents/`, `.codex/hooks.json` and `handoff/chat-archive/` paths were not
modified.

Approval is exclusive to Order 103's account-owned primary reservation folio
foundation, migration 0009 and its documentation/proof. It does not approve charges,
balances, statements, more windows, routing, transfer, correction, settlement,
payments, tax/fiscal behavior, cashier, AR, trust, day close, API or UI.

## Exclusive Order 103 discharge

- 103
