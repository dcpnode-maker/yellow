# Order 241 — current founder login reconciliation independent review

**Conclusion:** APPROVED LOCALLY

**Reviewed governance head:** `3a73e13`

**Reviewer:** independent non-operating OpenAI Codex reviewer

## Scope and independence

The reviewer did not perform the recovery and did not edit product source, protected
files, database rows, runtime topology or backups. Verification used read-only Docker
inspection, loopback HTTP requests, TCP probes, PostgreSQL catalogue/data extraction
and SELECTs. The two existing protected credentials and short-lived bearer tokens
were held only in process memory and were never printed, persisted or copied into
evidence. Successful login requests were the only authenticated operations.

## Runtime and protected sign-in

- `yellow-order175-folio-responsive-containment-app-1`, its PostgreSQL container and
  Valkey container are healthy. The app publishes only
  `127.0.0.1:3000->3000`; direct TCP probes find 3000 open and 3002/3188 closed.
- `GET /health` returns HTTP 200 with `status=ok`. `GET /` returns HTTP 200 and
  `cache-control: no-store`. The document includes the loopback prefill script,
  exact protected tenant/email values and a password input with `type=password` and
  `autocomplete=off`; the HTML-decoded value equals the protected operator value.
- POST `/api/v1/auth/local:login` independently returns HTTP 200 and a nonempty token
  for both canonical protected operator and approver values. No token or credential
  was emitted. The operator's `/api/v1/me/properties` returns HTTP 200 and exactly two
  properties. Both system-status calls return HTTP 200, operational app/database
  states and true transaction-local tenant context.

## Backup and exact authentication comparison

- Pre-change backup
  `D:\Yellow\backups\yellow-pre-order241-20260828T163957Z.dump` is exactly 645,451
  bytes with SHA-256
  `a0de5e36fef7ba6e0681cc53badca10016d6b3263d22f1260cfc0808c285eb65`.
  `icacls` shows only `ASTHA\astha:(F)` and `NT AUTHORITY\SYSTEM:(F)`.
  PostgreSQL 16 `pg_restore --list` exits 0 with 1,232 catalogue lines.
- Approved Order194 source backup
  `D:\Yellow\backups\order194\yellow-order194-20260827-212544.dump` is 3,316,902
  bytes with SHA-256
  `caa847920a869a0df74b1b4a173cc55e3e40289362cdd0b691523e8b440ac63f`;
  `pg_restore --list` exits 0 with 973 catalogue lines.
- The reviewer captured `pg_restore --data-only --table=app_user --file=-` for both
  backups and a live `COPY (SELECT ...) TO STDOUT` entirely in process memory.
  The canonical operator and approver are present in every source. Current auth is
  byte-exact to approved Order194 for 2/2 users, differs from pre-change for exactly
  2/2 users, and the live/pre-change non-auth difference count is zero. Current and
  pre-change user counts are both two. No auth field or digest was printed.

## Persistent no-drift proof

- The reviewer parsed every pre-change COPY stream in memory and compared it with
  deploy-role live counts across all 93 public base tables: 93 match, zero differ.
- A named 26-table subset independently matches exactly: tenant 1, users 2, roles 2,
  permissions 59, role-permissions 56, user-role property grants 6, migrations 37,
  properties 2, unit types 3, spaces 7, sellables 7, rate plans 2, reservations 6,
  segments 6, occupancy claims 2, folios 6, facts 75 and outbox rows 22; rate-price,
  journal, posting, payment, payment-operation, deposit, hosted-request and API
  idempotency counts remain their recorded zero values.
- Final `git status --short` was empty before this review record was written. No
  persistent runtime or database mutation was made by the reviewer.

## Verdict

Order241 meets its bounded definition of done and is **APPROVED LOCALLY** under
D-634. This approval covers only recovery of one-click sign-in on the sole loopback
local. It does not approve product or schema changes, merge, push, public bind,
production deployment or Phase-5 completion.
