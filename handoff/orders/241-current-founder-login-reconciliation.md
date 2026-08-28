# Order 241 — Current founder login reconciliation

**Status:** APPROVED-LOCALLY-D634
**Phase:** 5 · human-testable application
**Branch:** `phase-5/current-founder-login-recovery`
**Base:** `75d0f04`
**Risk tier:** 2 — reversible loopback-only identity recovery
**Owner:** Codex operations; independent non-operating verification

## Outcome

Restore one-click founder sign-in on the sole loopback port-3000 local after the
approved private handoff file and the only surviving PostgreSQL volume diverged.
Preserve the existing database and all hotel, booking and financial data.

## Scope

- sole Docker project `yellow-order175-folio-responsive-containment`;
- canonical tenant `yellow-demo` and canonical local-review operator and approver;
- ignored owner-only `.yellow/current-founder-login.env` as the unchanged password
  source;
- owner-only pre-change database backup under `D:\Yellow\backups`;
- this order, one decision, one ledger record and independent operational evidence.

No product code, schema, migration, seed, permission, role, property grant, hotel
data, financial data, public bind, second local, deployment, merge or production
change is in scope.

## Required behavior and proof

1. Prove the current protected operator password is rejected by the served login API
   without printing the password, token or stored hash.
2. Take a restorable custom-format backup of `yellow_dev`, restrict it to the current
   Windows user and SYSTEM, and record only its path, size and SHA-256.
3. In one deploy-owned database transaction, require exactly one active canonical
   tenant, exactly one canonical operator and approver, distinct nonempty protected
   passwords, and update only each user's local Argon2id auth hash. Any mismatch
   rolls the transaction back.
4. Prove all other user columns, role memberships, permission rows, property grants,
   schema migrations, hotel cardinalities and financial cardinalities are unchanged.
5. Restart only the app container to clear the in-memory login throttle. Prove the
   protected operator credential returns HTTP 200, the rendered loopback login page
   remains prefilled/masked/no-store, authenticated property and project-status reads
   succeed, and ports 3002/3188 remain closed.
6. A non-operating reviewer independently repeats the redacted served proof and exact
   before/after database-diff checks. Do not disclose credentials in evidence.

## Definition of done

- [x] Backup is restorable, owner-only and hash-recorded.
- [x] Only the two canonical auth hashes changed.
- [x] One-click protected sign-in works on the sole healthy local at port 3000.
- [x] Independent operational verification is recorded.

## Built evidence

- The operator recorded the protected operator credential returning HTTP 401 before
  recovery without printing a password, token or stored hash. The existing ignored
  protected file remained the only password source.
- Pre-change custom backup
  `D:\Yellow\backups\yellow-pre-order241-20260828T163957Z.dump` is 645,451 bytes
  with SHA-256
  `a0de5e36fef7ba6e0681cc53badca10016d6b3263d22f1260cfc0808c285eb65`.
  Its ACL grants FullControl only to `ASTHA\astha` and SYSTEM, and PostgreSQL 16
  reads its 1,232-line catalogue successfully.
- The bounded deploy-owned transaction required the exact canonical tenant and two
  canonical active users, then changed only their local authentication values. The
  app container alone restarted to clear the in-memory login throttle; PostgreSQL,
  Valkey, protected files, schema and data remained in place.

## Independent review evidence

- A fresh non-operating reviewer independently verified the exact scoped app,
  PostgreSQL and Valkey containers healthy. The app binds only
  `127.0.0.1:3000`; TCP ports 3002 and 3188 are closed.
- `/health`, the loopback root and both protected local logins return HTTP 200.
  The root is `cache-control: no-store`, includes the local-prefill adapter and has
  matching tenant/email values plus a masked `type=password`, `autocomplete=off`
  password value equal to the protected operator value. Neither credentials nor
  bearer tokens entered evidence.
- Operator authentication returns exactly two granted properties. Each property's
  system-status read returns HTTP 200 with operational app/database state and true
  transaction-local tenant context. The independently repeated approver login also
  returns HTTP 200.
- Read-only PostgreSQL 16 extraction of the approved Order194 backup, the pre-change
  backup and live rows proves both canonical current auth values are byte-exact to
  their approved Order194 values, exactly two auth values differ from pre-change,
  and every non-auth field across the two current users is unchanged. No auth value
  or hash was emitted.
- The reviewer parsed the complete pre-change data stream and compared live deploy
  counts for all 93 base tables: 93 match and zero differ. A named 26-table authority,
  hotel, reservation, financial and immutable-evidence subset also has zero count
  differences, including 2 users, 6 user-role grants, 37 migrations, 2 properties,
  6 reservations, 2 occupancy claims, 6 folios, 75 facts and 22 outbox rows.
- The independent evidence is recorded in
  `handoff/reviews/241-current-founder-login-reconciliation.md`. Approval is limited
  to this reversible sole-loopback credential recovery; it is not a product, schema,
  data, merge, push, public or production approval and does not complete Phase 5.
