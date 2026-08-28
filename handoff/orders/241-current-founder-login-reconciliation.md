# Order 241 — Current founder login reconciliation

**Status:** READY — founder-directed local credential recovery
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

- [ ] Backup is restorable, owner-only and hash-recorded.
- [ ] Only the two canonical auth hashes changed.
- [ ] One-click protected sign-in works on the sole healthy local at port 3000.
- [ ] Independent operational verification is recorded.
