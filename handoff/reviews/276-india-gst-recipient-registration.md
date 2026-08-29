# Order 276 — independent Tier-3 review

**Reviewed commit:** `9a4a958fe22773547cfffc7d136046df8410d22e`  
**Reviewer:** independent non-implementing Codex Tier-3 reviewer  
**Date:** 2026-08-29  
**Verdict:** **CHANGES REQUIRED**

## Blocking finding

### F1 — the mandatory canonical database/referee gate is stale and exits nonzero

On a fresh, isolated, app-never-started Compose project, I personally ran:

```text
COMPOSE_PROJECT_NAME=<isolated-review-project> \
YELLOW_APP_PORT=<unused> \
YELLOW_POSTGRES_PORT=<isolated> \
YELLOW_VALKEY_PORT=<isolated> \
./setup.sh --db-only
```

The command successfully provisioned authority, applied migrations `0001` through
`0048`, created and seeded `yellow_test`, and then exited `1` at the committed
`setup.sh` table-count oracle:

```text
yellow_test has 100 public tables; expected 99 after migrations 1-47.
```

`setup.sh` still asserts 99 tables after migrations 1–47 even though Order276 adds
migration 0048 and the committed database/schema tests correctly require 100 tables.
This is a blocking Tier-3 finding because `PROJECT.md`, `AGENTS.md` and
`docs/WORKFLOW.md` require the canonical `./setup.sh --db-only` command to exit green
and reach `11 passed, 0 failed of 11` before the change is reviewable. A separately
invoked referee cannot convert a nonzero canonical gate into an approval.

Required correction: authorize and update the bounded setup oracle to exact
`100 public tables after migrations 1-48`, then rerun the entire canonical isolated
command to exit `0` with exact referee `11/11`. Because `setup.sh` is outside the
current Order276 scope, correct the order scope or use a separate bounded order; do
not widen scope silently. Fresh independent Tier-3 re-execution remains required.

## Reviewer-personal evidence

I inspected the exact `3114d24..9a4a958` scope, migration, service, exports, tests,
schema oracle and contracts. `git diff --check` is green and the migration SHA-256 is
`d57c5db53f75d719ef2e802a738f815cd03a54a87dbdec1f8813574666e0012f`.

Against a fresh PostgreSQL 16.15 database prepared by the failed-at-final-oracle setup
run, the narrower executable proofs were green:

- Order276 intentional-red plus exact product/database proof: **14 passed, 0 failed,
  115 expectations**;
- database acceptance against the freshly migrated canonical development seed:
  **13 passed, 0 failed, 34 expectations**;
- runtime-DML authority: **5 passed, 0 failed, 107 expectations**;
- standalone invariant referee against the prepared `yellow_test`: **11 passed,
  0 failed of 11**.

The complete non-database standing/static gates were also green:

- `bun test`: **870 passed, 798 environment-skipped, 0 failed, 8,785 expectations;
  1,668 tests across 298 files**;
- `bun run typecheck`: exit `0`;
- `bun run boundaries`: **100 TypeScript files scanned**;
- `bun run license-check`: **23 packages passed**;
- `bun audit`: **0 vulnerabilities**;
- exact-scope `git diff --check`: exit `0`.

## Code and containment inspection

No second implementation finding was identified in the bounded Order276 surface.
The new root starts with `tenant_id`; its primary, uniqueness and lookup indexes all
lead with the tenant; the Party foreign key is composite on `(tenant_id, party_id)`;
RLS is enabled with transaction-local `app.tenant_id`; ownership is `yellow_owner`;
`PUBLIC` and `yellow_runtime` receive no authority and `app_role` receives SELECT
only. The one-GSTIN-per-tenant uniqueness prevents one statutory registration number
from attaching to two Party identities in a tenant.

The resolver equality-binds tenant, Party and registration UUID, requires an active
unmerged Party, accepts only the `in-gstin` scheme, revalidates UUID/GSTIN checksum,
current state code, NFC/control/text/PIN boundaries, and fails closed on absent,
foreign, ambiguous or malformed evidence. It reads no mutable Party/profile/address/
role fallback, emits no SQL write, returns a recursively frozen deterministic result,
and tenant-binds the evidence hash. The executed proof confirmed tenant concealment,
app-role DML denial, replay, zero protected effects and mutation-free failures.

Approval is withheld solely and mandatorily because the committed canonical setup
gate is red. This review grants no legal-buyer, `BuyerDtls`, place-of-supply,
CGST/SGST/IGST, document, submission, API, UI, local-promotion, merge, deploy, Phase-7
or application-complete authority.
