# Order468 — independent current-target read-only verification

Reviewer: Codex `/root/astra_review`, non-implementer. Date: 2026-09-20.

**Decision: ACCEPT the current-state verification below; withhold full Order468
pre/post no-delta acceptance.** The deployed target matches the accepted command
source and has the expected canonical fixture/audit pair and healthy endpoint.
Historical protected-table preservation cannot be independently established without
the missing preflight content baseline. Do not label that requirement proved or
close it merely because current state and isolated source proofs pass.

## Authority and method

Read the canonical Order468 and Yellow PostgreSQL rules. Connection credentials were
read only from the expressly authorized private `seed.env` in the recorded Order444
control directory, used in-process, and never printed. The database component was
retargeted internally to the exact instructed review database. Host/port were checked
against the recorded loopback deployment before connecting. No connection strings,
public endpoint addresses or raw profile values are recorded here.

The recorded candidate receipt's `reviewDatabase` and `postgresPort` match the
target. Its historical migration frontier remains91; the independently read current
database ledger is93. The reviewer did not edit/reissue that receipt or interpret its
old frontier as proof of current migration state.

Database checks used `psycopg2` with READ ONLY sessions (REPEATABLE READ for data
snapshots), transaction-local `set_config('app.tenant_id', ..., true)` before tenant
reads, and explicit tenant/identity predicates. A separate runtime connection used
`SET LOCAL ROLE app_role` to verify the RLS-bound read. Transactions ended in ROLLBACK.
Only SELECT/session-local settings were executed. No command function was invoked.
No migration, seed, reconciliation, login, authenticated write or test fixture ran
against this current target.

Health checks used unauthenticated GET requests only, with20-second timeouts and
status-only output. Browser JavaScript/automatic demo login was not executed.
The only file changed by the reviewer was this review.

## Personally verified results

- Target database identity and transaction READ ONLY assertions: true.
- Listeners for the database, local app and public-edge proxy are127.0.0.1-only.
- Migration ledger:93 rows, contiguous versions1–93, every filename/checksum matches
  the current reviewed runtime migration sources.
- Accepted0092 SHA256:
  `105CA27C2F4D7FCB4F8BB6DFB6EB28B5A8C615D80EB9B4D863A006497DD47DDA`.
- Accepted0093 SHA256:
  `C9201892E38BC8F3FBB55DEF457B7289E34CEE126282D57A386580B1F0C21346`.
- Both deployed function bodies match their accepted migration bodies after only
  line-ending/outer-whitespace normalization. Both are SECURITY DEFINER, owned by
  `yellow_owner`, have the exact fixed `pg_catalog, public, pg_temp` search path,
  permit app-role execution and do not grant PUBLIC execution.
- Direct table-level and any-column UPDATE privilege on Party are false for both
  app_role and yellow_runtime.
- Expected active synthetic Party with canonical display/legal name and attrs:1.
  Matching fixed reservation/property/primary-Party/ARR-CLEAN relationship:1.
  Exact canonical guest-role detail:1; total roles on that Party:1.
- Expected UTC property:1; expected active actor:1.
- Runtime RLS-bound canonical Party read:1; READ ONLY/app-role checks both true.
- Matching `party.reconciled` facts:1; matching outbox events:1.
- Exact changed-field names: `display_name`, `legal_name`. Both are allowed; count2,
  unique. The current canonical attrs are verified but were not reported changed.
- Audit/event target, actor, property, correlation/request linkage, aggregate/entity
  kinds and property-UTC business dates all match. Fact payload minus request_id
  equals event payload. Exact allowed payload keys: fact `{party_id,changed_fields,
  request_id}`, event `{party_id,changed_fields}`; no raw profile values present.
- Party, fact and outbox have the same visible PostgreSQL xmin, consistent with the
  accepted same-transaction correction. This is corroborating current MVCC evidence,
  not a replacement for a historical full-table baseline.
- No surviving row in the15 protected tables below, nor any unrelated Party in the
  tenant, has the correction fact's xmin. This bounds observable surviving-row
  mutations from that transaction; it cannot reveal deleted rows or reconstruct
  arbitrary earlier/later changes.
- Local health GET200; public root GET200; public health GET200.

All proof processes completed successfully. An initial verification predicate had
assumed a particular two-field combination; read-only inspection of field *names*
corrected that assumption to the actual allowed display/legal-name pair above. No
raw values were read into output and no deployed-state change was made.

## Current protected-state census and content fingerprints

These are **post-deployment observations only**, not asserted pre/post matches.
Fingerprints are deterministic MD5 aggregates of sorted complete JSONB row hashes,
scoped to the fixed synthetic tenant. Empty tables have an empty hash string.

| Table | Current rows | Current fingerprint |
| --- | ---: | --- |
| reservation | 2219 | 7e5c2dd646636f9bd62f6eda8e54d4be |
| reservation_segment | 2219 | b794c19a2075b9d3782d3c41e480cd10 |
| reservation_guest | 2217 | 470499a3ad95927f04ca736c59559814 |
| party_role | 30 | 72101e945232cee18e0e8efd8670a817 |
| contact_point | 20 | 46a3a90502b2b86c659295629b094b13 |
| space_occupancy | 278 | 486ff1a88a1b71287e0bcd029edbfd70 |
| account | 19 | e4c6b01d0646073aa0d77f47e1724cb4 |
| folio | 32 | e15a5cf1202f815f8f1886a37b437697 |
| journal | 27 | 6d9d9f1e2cf37c1bc1b8fcfbcdf41f87 |
| posting_line | 56 | 4933e07b3ada4bea3facb943865288d3 |
| payment | 0 | empty |
| payment_instrument | 0 | empty |
| document | 1 | a78c56f0d11e27b091d7b780acd15a07 |
| identity_document | 3 | 851c8191ada0a35ee356842e58f7165f |
| app_user | 3 | 009bd1009d43da69aa9cb016b479e7be |
| unrelated Party rows | 29 | 7724427f52c6c55882ae80c4701f458a |

Representative exact read-only SQL forms used (parameters remain private/in-process):

```sql
SELECT version, filename, checksum_sha256 FROM schema_migration ORDER BY version;
SELECT set_config('app.tenant_id', %s, true);
SELECT count(*), COALESCE(md5(string_agg(md5(to_jsonb(t)::text), ''
       ORDER BY md5(to_jsonb(t)::text))), '')
FROM <fixed-allowlisted-protected-table> t WHERE tenant_id=%s;
SELECT count(*) FROM <fixed-allowlisted-protected-table> t
WHERE t.tenant_id=%s AND t.xmin=(
  SELECT xmin FROM fact_log WHERE tenant_id=%s AND entity_id=%s
  AND fact_type='party.reconciled');
```

Identifiers were composed only from the fixed reviewed table allowlist; identity
values used bound parameters. Source checksums and expected synthetic name values
were loaded from accepted local files and compared in-process, not logged.

## Historical evidence limitation — explicit, unresolved

The implementation owner expressly confirmed no persisted protected-table preflight
fingerprints/snapshots exist. The only reported preflight evidence was ledger91 and
Party/reservation/role shape counts. The reviewer joined after deployment and did
not personally execute that preflight. The normal runner reportedly applied exactly
0092/0093 and the reconciler reportedly returned changed/2; current ledger/function/
audit state corroborates the outcome, but does not independently reconstruct the
complete historical action sequence or no-delta guarantee.

Accordingly Order468 steps5/6's full historical protected-state delta claim remains
**unproven**, not disproved. Do not fabricate a baseline or rerun/undo the operation
to create one. A genuine retained before-snapshot could support later comparison if
one becomes available. Current state can serve as an explicit baseline for a future
separately scoped operation, never retroactively for this one.

This review is not Order461 acceptance, full demo-readiness approval, permission to
reseed or authorization for further live changes. Independent Order466/467 source
proofs remain separate evidence with their previously recorded scope.
