# Question 166 — Order 156 needs an unforgeable registration authority

**Status:** OPEN — founder trust-boundary choice required
**Order:** 156
**Raised by:** independent Tier-3 pre-implementation review
**Date:** 2026-08-25

## Stop

The corrected three-argument `app_role`-executable capability does not close the
pre-registered exploit. A direct runtime caller can invoke the function after setting
the same effective tenant and thereby bypass the HTTP
`identity.extension-type:register` scope check. Adding actor/property/request arguments
and writing the audit fact atomically improves command shape, but the same caller can
select any visible authorized actor UUID. A custom actor/scope GUC is equally forgeable.

No implementation edit or product commit was made. The worktree stopped cleanly.

The review also confirmed two dependent facts:

- the capability must own the catalogue mutation and fixed audit fact atomically,
  deriving the existing UUIDv5 subject internally rather than accepting a caller
  selected subject or operation;
- D-395/D-402 settlement requires every extension registry pool, including the server
  and review-seed callers, to use unprepared connections before scrub/DISCARD reuse.

## Options

### 1. Dedicated registrar database principal and pool — recommended

Create one narrowly provisioned registrar login/credential used only by the
authenticated extension-type registration path. Grant it only execute on the bounded
owner function; grant neither it nor runtime/app_role direct catalogue or fact-table
mutation. The function accepts the full fixed audit envelope, validates exact tenant,
property and input bounds, derives the UUIDv5 subject, inserts the type and fact in one
transaction, and preserves identical/divergent behavior. Runtime/app_role/PUBLIC cannot
execute it. Add exact credential/provisioning/server/review-seed scope and independent
Tier-3 proof. This is the clearest database-enforced separation and adds one secret to
operate.

### 2. Signed authorization assertion

Keep the runtime pool but pass an application-signed actor/scope assertion that the
owner function verifies before mutation. This requires a database-visible verification
key/secret lifecycle, replay/expiry design and cryptographic proof. It avoids another
login but expands the authentication architecture substantially.

### 3. Command-shape mitigation only

Validate a caller-supplied actor against `app_user`/role/permission/property rows and
write the fact atomically, while explicitly accepting that raw runtime SQL can
impersonate another authorized actor. This removes direct table DML but does not close
the stated platform-scope bypass, so it is not recommended.

## Requested ruling

Authorize option 1, option 2, or explicitly accept option 3's residual impersonation
risk. Option 1 is recommended because it is narrow, testable and does not put signing
key verification inside PostgreSQL.
