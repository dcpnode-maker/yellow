# Order 472 — deployment preflight

**Current independent decision: ACCEPT current-state verification only; WITHHOLD
full Order472 protected-state preservation/closure acceptance.** See the independent
read-only postflight below. The earlier stopped preflight remains historical.

Date: 2026-09-20 · Executor: Codex `/root`.

**Decision: stopped before mutation.** A read-only metadata preflight against the
verified public-demo database returned the following exact cardinalities:

| Check | Result |
| --- | ---: |
| migration ledger maximum / count | 93 / 93 |
| canonical Party | 1 |
| canonical guest-role detail | 0 |
| canonical reservation | 1 |
| canonical account / primary folio | 1 / 1 |
| account postings / linked payment operations | 0 / 0 |
| account.reconciled fact / outbox event | 0 / 0 |

The target account is structurally eligible but the role check was subsequently
re-audited before any mutation. The earlier count used an application-side JSON
serialization fingerprint rather than PostgreSQL JSONB equality. A read-only
PostgreSQL recheck established that the target role equals the reviewed canonical
JSONB fixture, with normalized fingerprint
`761ff24de983cf7a55ca19a1e1dd3d4d`. Therefore the earlier `0` is withdrawn as a
false-negative preflight result, not a target drift. Migration0094 remains
**unapplied** and its function remains **uninvoked** at this point in the record.
The next deployment attempt must take a new full protected-state baseline and use
canonical JSONB equality for this prerequisite.

## Independent read-only postflight — 2026-09-20

Reviewer: Codex `/root/astra_review`, independent of implementation/deployment.
Personally read Order472, the accepted Order471 source review and Yellow PostgreSQL/
entity rules, then executed the following checks against the actual public-demo
database. These are reviewer-executed results, not implementer-pasted evidence.

### Authority, connection containment and commands

Only the expressly authorized Order444 private seed.env and Order460 runtime-private
app.env were read. Credentials were parsed and passed in-process only. The deploy
URL and runtime URL agreed on database and loopback deployment endpoint. Database
identity was asserted in-process; its name, URLs, credentials and raw account name
are deliberately absent from this record. Expected synthetic account-name bytes
were extracted from the accepted0094 source and compared in-process, not printed.

PowerShell invoked the locally installed Python3.13 `python.exe -` with a stdin
verification script using psycopg2. The deployment connection used
`set_session(readonly=True,isolation_level='REPEATABLE READ')`; current_database and
transaction_read_only were asserted before proceeding. Every tenant-scoped read
followed bound-parameter `SELECT set_config('app.tenant_id', ..., true)`. A separate
runtime READ ONLY connection used `SET LOCAL ROLE app_role` and transaction-local
tenant context for the RLS proof. Every transaction ended with ROLLBACK.

Only SELECT and connection/session-local settings were executed. No migrations,
reconciler invocation, direct UPDATE attempt, seed, login, write test, role change
outside SET LOCAL ROLE, fixture operation or live data modification occurred.
Direct-UPDATE restriction was proved through effective privilege inspection, not
by sending a prohibited write to the live database. Only this review was edited.

Representative exact SQL forms, with private/fixed values bound as parameters:

```sql
SELECT version,filename,checksum_sha256 FROM schema_migration ORDER BY version;
SELECT set_config('app.tenant_id',%s,true);
SELECT prosrc,pg_get_userbyid(proowner),prosecdef,proconfig,proacl::text,
       has_function_privilege('app_role',oid,'EXECUTE'),
       has_function_privilege('yellow_runtime',oid,'EXECUTE')
FROM pg_proc WHERE proname='reconcile_synthetic_clean_arrival_account';
SELECT has_table_privilege(%s,'public.account','UPDATE'),
       has_any_column_privilege(%s,'public.account','UPDATE');
SELECT count(*),COALESCE(md5(string_agg(md5(to_jsonb(z)::text),''
       ORDER BY md5(to_jsonb(z)::text))),'')
FROM <fixed-allowlisted-table> z WHERE tenant_id=%s;
```

PUBLIC EXECUTE was separately checked with aclexplode on the effective/default
function ACL. Source hashes were computed with PowerShell Get-FileHash SHA256;
stored function body comparison normalized only line endings and outer whitespace.
All processes exited0; all database assertions passed.

### Personally verified current-state results

- Source0094 SHA256 equals the accepted value
  `867F54D3F94655FC5AA4B631433C37ED173AA20BB6E515F9DF39D52E1C1B7C89`.
- Live ledger has exactly94 rows and versions are contiguous1–94. Every retained
  migration filename/checksum matches its current reviewed runtime source bytes.
- Deployed0094 function body matches source. Owner yellow_owner; SECURITY DEFINER
  true; exact search_path `pg_catalog, public, pg_temp`; app_role EXECUTE true;
  direct yellow_runtime EXECUTE false; PUBLIC EXECUTE false.
- Effective table UPDATE and any-column UPDATE on account are false for both
  app_role and yellow_runtime.
- Canonical account count1: exact tenant/account/property/Party, guest role, USD,
  null credit limit, open status and expected canonical name.
- Active unmerged canonical person1; exact canonical guest-role JSONB1; canonical
  reservation/property/primary-Party/confirmation1; exact open primary folio bound
  to target account/reservation/window1 count1; UTC property1; active actor1.
- Target account posting count0. Payment operations matching account OR primary
  folio count0.
- Target account.reconciled facts1 and outbox events1. Their entity/aggregate kinds,
  target, tenant, both actor IDs, property and non-null request/correlation linkage
  agree. Exact fact payload is `{account_id,changed_fields:['name'],request_id}`;
  exact event payload is `{account_id,changed_fields:['name']}`. Full JSON equality,
  not just key presence, was asserted. No raw profile/name value appears in payload.
- Fact business_date equals valid_from in the locked property's UTC timezone;
  outbox business_date equals fact business_date. Current account/fact/outbox xmin
  are equal, corroborating one transaction's surviving versions. This does not
  reconstruct the historical command or deleted rows.
- Runtime connection: session_user yellow_runtime, current_user app_role,
  transaction READ ONLY and account RLS active all true. Exact target read returns1
  under its tenant context and0 under a foreign context.

Correlation is verified for mutual consistency in current evidence. No separate
persisted invocation/request receipt was supplied, so this is not an assertion of
comparison against an independently retained original request identifier.

### Health — unauthenticated status-only GET

Python urllib.request used GET with20-second timeouts; response bodies were not
printed or executed, so automatic browser demo entry was not triggered.

- Designated local app, port3000 `/health`:200.
- Current public root:200.
- Current public `/health`:200.
- An additional legacy port3010 health probe was unavailable. The implementation
  owner confirmed3000 is the designated current process;3010 is not an Order472
  health dependency and is not counted as a failure of the designated app.

### Current protected-state fingerprints — postflight only

Complete row JSONB is hashed deterministically within the fixed tenant, sorted by
row-content hashes. These are current observations, **not a pre/post comparison**.

| Table | Rows | Current fingerprint |
| --- | ---: | --- |
| org_node | 5 | 3e49cae7f2cfb4d7ffcf3cf46cea3e74 |
| app_user | 3 | 009bd1009d43da69aa9cb016b479e7be |
| party | 30 | 113b99e5f380c875acf826056cf1732f |
| party_role | 30 | 72101e945232cee18e0e8efd8670a817 |
| contact_point | 20 | 46a3a90502b2b86c659295629b094b13 |
| reservation | 2219 | 7e5c2dd646636f9bd62f6eda8e54d4be |
| reservation_segment | 2219 | b794c19a2075b9d3782d3c41e480cd10 |
| reservation_guest | 2217 | 470499a3ad95927f04ca736c59559814 |
| account | 19 | aebd6183f0ca4aa8ef4ce6377f09193f |
| folio | 32 | e15a5cf1202f815f8f1886a37b437697 |
| business_day | 22 | f03a72e8b726346ec643355e3fe6b730 |
| space_occupancy | 278 | 486ff1a88a1b71287e0bcd029edbfd70 |
| journal | 27 | 6d9d9f1e2cf37c1bc1b8fcfbcdf41f87 |
| posting_line | 56 | 4933e07b3ada4bea3facb943865288d3 |
| payment_operation | 0 | empty |
| payment | 0 | empty |
| payment_instrument | 0 | empty |
| document | 1 | a78c56f0d11e27b091d7b780acd15a07 |
| identity_document | 3 | 851c8191ada0a35ee356842e58f7165f |

### Blocking limitation for full deployment acceptance

The deployment owner explicitly confirmed that no persisted full protected-table
preflight content baseline exists for Order472. The reported in-process preflight
established ledger93, eligible identities, zero posting/payment-operation and zero
account-reconciled evidence, and a noncanonical name; the label itself was supplied
as CAS in the invoking transaction but not logged. The reviewer did not witness
that execution, and no separate request receipt was retained.

Current source/function/ledger/evidence/state checks all pass, but neither matching
xmin nor isolated Order471 proofs establish that every protected live row remained
unchanged. Earlier Order468 postflight observations are not a substitute for the
Order472 required immediate full preflight baseline. In particular, a current
snapshot cannot prove absence of historical edits/deletions or permitted-name-only
delta across the deployment. Do not fabricate a baseline or re-invoke/undo the
correction to manufacture one.

**Decision: ACCEPT current-state verification; WITHHOLD full Order472 historical
protected-state/no-delta acceptance and closure.** This is an evidence gap, not a
finding that corruption occurred. The order's preflight-baseline requirement was
not evidenced as fulfilled. Source acceptance under Order471 remains separate.
No seed readiness, further repair, public-data mutation, overall app readiness or
application completeness is granted by this review.
