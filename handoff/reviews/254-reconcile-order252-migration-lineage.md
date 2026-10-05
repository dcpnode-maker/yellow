# Review 254 — Reconcile Order252 migration lineage forward-only

**Reviewer:** independent Codex Tier-3 reviewer (`/root/order247_verify`)
**Decision:** APPROVED
**Date:** 2026-08-29
**Authority:** Order254 / D-659 only

## Verdict

APPROVED. No blocking Order254 finding.

Migration0041 is restored byte-for-byte to the historical artifact already represented
by the retained ledger. Migration0042 is an append-only migration-history step that
replaces only `public.link_tax_attribution_reservation(uuid,uuid,uuid,uuid,uuid,uuid)`:
the unbound path returns zero rows before product-authority checks, while the bound
path, signature, security-definer containment, search path, owner and ACL remain
exact. The fresh and historical-upgrade paths converge to the same reviewed schema.
No ledger row was rewritten.

This approval grants no local promotion, data mutation, ledger override, reservation
contract expansion, posting/document authority, merge, deploy, Phase7-complete or
application-complete claim.

## Historical provenance and D-73

- Repository `migrations/0041_quoted_tax_reservation_lineage.sql` is 11,523 bytes and
  SHA-256 `96795066ed0ae795044a56c7fbef33087e8c7fa94647b22482ee6b48ed06f171`.
- It is byte-equal to the independently reconstructed historical artifact at review
  time. The source session log contains the original add-file payload and subsequent
  exact hash output; the recovered artifact also matches the retained migration-ledger
  digest and historical function block order.
- Migration0042 is 7,524 bytes and SHA-256
  `dd2622f024859231a6128f649276bb4904d60f2380de9324196c22ac43b0c098`.
- Inspection found no checksum override, ignore path or `schema_migration` mutation.
  The change obeys D-73: immutable applied bytes are restored, and the correction is
  carried only by the next numbered transactional file.

## Function, owner and ACL inspection

On both the fresh database and upgraded historical database, catalog proof returned:

- `SECURITY DEFINER`, `VOLATILE`, search path `pg_catalog, public, pg_temp`;
- owner `yellow_owner`;
- `app_role` has EXECUTE;
- `yellow_runtime` and PUBLIC do not have EXECUTE;
- final function definition hashes are identical across both database paths;
- the binding lookup precedes tenant/property/actor authority checks only in the final
  migration42 definition; historical migration41 retains authority-before-binding.

Migration0042 contains no migration-time table/data DML. Its only INSERT is inside the
governed function body and is the existing immutable lineage append on the bound path.

## Personally executed proof

All database proof used disposable project `yellow-order254-review`, ports 55472/6402,
and never addressed the sole local application or retained database.

### Fresh 1–42

- `./setup.sh --db-only` with isolated Compose authority: migrations 1–42 applied;
  96 public tables; 86 RLS policies; referee **11 passed, 0 failed**.
- `bun run schema:check`: exact match to `tests/schema/expected.sql`.
- `bun test tests/database-acceptance.integration.test.ts`: **10 passed, 0 failed,
  22 assertions**; ledger includes exact 0041 and 0042 checksums.
- `bun test tests/quoted-tax-reservation-lineage.integration.test.ts`: **7 passed,
  0 failed, 24 assertions**. This includes ordinary unquoted held/direct zero-lineage,
  exact quoted lineage, replay/divergence/tenant containment, rollback, ACL/RLS and
  no financial/document artifact proof.
- `bun test tests/reservation-parent-before-occupancy.integration.test.ts`: **7 passed,
  0 failed, 45 assertions**.

### Historical 41 → 42

A disposable migration directory containing exactly repository migrations 1–41 was
used with the production migration runner against an empty isolated database.

- First run: `applied=41`; ledger count 41; historical function authority-before-
  binding order confirmed.
- Full-directory run: applied exactly
  `0042_quoted_tax_reservation_no_binding_compatibility.sql`; `applied=1`.
- Serialized rows 1–41 before and after were byte-equal, including `applied_at`.
- Rerun: `applied=0 status=no-op`; ledger count remained 42.
- Final upgraded database: 96 public tables, 86 policies, exact 0041/0042 hashes;
  function definition identical to fresh; `bun run schema:check` exact.

### Static and repository gates

- `bun x tsc --noEmit`: pass.
- `bun run boundaries`: pass, 93 TypeScript files scanned.
- `git diff --check`: pass.

An additional full Order081 harness rerun on the constrained shared reviewer host
completed four functional cases but its P2 concurrency case hit that file's explicit
30-second ceiling, followed by the expected cleanup wait. This is not treated as an
Order254 defect: Order254 changes no runtime service/table contract, fresh and upgraded
function definitions are byte-identical to the already-approved Order252 final schema,
and the directly affected unquoted held/direct, concurrency/replay, rollback and
containment proof above is green. The timing observation is retained here rather than
silently omitted.

## Scope inspection

The diff is confined to the recovered 0041 bytes, new forward-only 0042 replacement,
exact migration manifest/schema/setup expectations and narrow Order254 governance and
contract evidence. No table, seed, credential, local runtime, HTTP/UI, folio, account,
posting, document or statutory implementation is admitted.

## Cleanup

The disposable reviewer Compose project, volumes, network and external historical
migration directory were removed after proof. The sole local remained untouched.
