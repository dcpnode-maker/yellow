# Order 265 — Rotate exposed sole-local application credentials

**Status:** APPROVED-LOCALLY-D690
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

- [x] All five exposed protected values rotate without output or scope drift.
- [x] Old credentials fail, new credentials work and all non-auth data are exact.
- [x] Sole local is healthy/current with populated masked one-click sign-in.
- [x] Independent logging-safe non-operating review records approval or findings.

## Rotation evidence — D689

The final forward rotation used five fresh 64-character cryptographic values, each
explicitly different from the captured immediately prior generation. Exactly five
protected app environment values changed and every other environment value remained
byte-exact. New runtime and registrar credentials authenticated across the Compose
network's SCRAM path while both prior credentials failed. New local sign-in returned
HTTP200; the immediately prior password and JWT returned HTTP401. The hosted callback
secret changed. No value entered command arguments, output, Git or evidence.

Both ignored handoff files are owner/SYSTEM-only and match the running app; deploy
and the distinct unexposed approver password remain exact. Role attributes,
membership and permissions remain exact. Only the canonical active review-user auth
field changed to Argon2id.

Only app was recreated, finally `b084c60b9fe6` on approved image `83a7bb59bd70`.
PostgreSQL `b0a92182a16a`, Valkey `ae62afc8df69`, retained volume, two properties,
catalog44/98/88 and all-98-table row-count digest
`739b6a2d929a2278064e35935351f32fcc9290c16da2db9b5072e9640ed28763`
remain exact. Root/health/new-login are200; root is no-store with three populated
masked fields; both properties report262/263/review91/active7; only3000 is open and
3002/3188 are closed. No temporary credential file remains.

Two earlier secure forward rotations stopped only at a flawed old-database-password
assertion that used PostgreSQL's trusted localhost HBA and therefore could not prove
rejection. A later script attempt stopped before its transaction because compressed
redirection text was parsed as part of the database name; its unused protected temp
files were removed. None exposed a value. The final proof moved credential checks to
a transient container over the SCRAM-authenticated Compose network and passed every
required old/new assertion.

## Independent approval — D690

An independent non-operating Tier-3 reviewer approved exact commit `86e772e`. The
reviewer personally reproduced the current rotated generation, protected handoff
matching and owner/SYSTEM-only ACLs, external-network SCRAM authentication for both
rotated database roles, the canonical Argon2id local identity, exact restricted role
attributes/membership, read-only catalog44/98/88/two-property truth and the exact
all-table digest. Root, health, login and assets are HTTP200; the no-store sign-in is
populated and masked; both project snapshots remain262/263/review91/active7; only
port3000 is open. The reviewer restarted or mutated nothing and emitted no protected
value. Historical old-value rejection remains bounded to D689 provenance because
recovering compromised values solely to replay it would violate the logging-safety
boundary.
