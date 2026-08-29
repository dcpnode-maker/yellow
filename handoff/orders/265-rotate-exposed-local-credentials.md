# Order 265 — Rotate exposed sole-local application credentials

**Status:** READY-D687
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/rotate-exposed-local-credentials`
**Base:** `347f24c` (Order264 changes-required incident record)
**Risk tier:** 3 — emergency credential and local identity rotation
**Owner:** Codex operations; independent non-operating verification required

## Authority and outcome

The founder's standing authorization for pending credential actions and D-686's
mandatory remediation authorize immediate rotation of every protected value present
in the app environment exposed to the internal verification log. Restore a secure,
healthy sole local at `http://127.0.0.1:3000`, retain populated masked one-click
sign-in with the new password, preserve both hotels and all product data, and obtain
a fresh logging-safe independent review.

## Exact scope

- generate distinct cryptographically random replacement runtime-database,
  extension-registrar, local-review, JWT-token and hosted-callback secrets only in
  process memory;
- atomically rotate exact `yellow_runtime` and `yellow_extension_registrar` role
  passwords plus the exact canonical local-review operator Argon2id credential;
- atomically replace ignored `.yellow/runtime-database-authority.env` with deploy
  password retained and new runtime/registrar values, preserving owner-only ACL;
- atomically replace only `YELLOW_REVIEW_PASSWORD` in ignored protected
  `.yellow/current-founder-login.env`, retaining its distinct unexposed approver
  password and preserving owner-only ACL;
- recreate only the app from already-approved image `83a7bb59bd70` with new protected
  values and unchanged non-secret environment/configuration;
- invalidate old local sign-in and JWT/database credentials; verify new credentials
  internally without outputting either generation;
- this order, decision, ledger and independent review evidence.

## Required proof

1. Preflight one healthy loopback3000 app, exact PostgreSQL/Valkey/volume, two
   properties, catalog44/98/88 and exact all-table digest from D-686.
2. Replacement values are pairwise distinct, bounded and never passed as command-line
   arguments, printed, committed or persisted outside the two protected ignored
   handoff files, database password verifier/Argon2id record and app environment.
3. Exact role attributes/membership/ACL remain unchanged; new runtime and registrar
   credentials authenticate and captured old credentials fail.
4. Exactly one canonical review-user auth field changes; the new password succeeds,
   captured old password fails, and no tenant/property/business-row count changes.
5. Only the app container is recreated. PostgreSQL/Valkey ids, retained volume,
   catalog44/98/88, two hotels and all-table row-count digest remain exact.
6. Root/health/login/assets HTTP200; root is no-store with populated tenant/email/new
   masked password; both property snapshots are262/263/review91/active7; sole3000 is
   open and3002/3188 closed.
7. Protected environment comparison and re-review use a logging-safe program whose
   error path emits constants only; no protected value reaches tool/review output.
8. Independent non-operating reviewer records approval or findings.

## Forbidden

No deploy-password rotation, user/email/tenant/property/permission/role-attribute/
membership/product-data change; no migration, seed, provisioning, cache/volume,
PostgreSQL/Valkey recreation, second local, public bind, product code, dependency,
merge, public/production deployment, product-review advance, Phase7 or
application-complete claim. Never print, hash through a shell alias, log, commit or
repeat protected values.

## Rollback

Old exposed values must never be restored. A failed app replacement is repaired by
the retained approved image using the new secrets. A database/identity rollback is
forbidden; recover forward under this order.

## Definition of done

- [ ] All five exposed protected values rotate without output or scope drift.
- [ ] Old credentials fail, new credentials work and all non-auth data are exact.
- [ ] Sole local is healthy/current with populated masked one-click sign-in.
- [ ] Independent logging-safe non-operating review records approval or findings.
