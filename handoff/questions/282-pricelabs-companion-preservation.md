# Q282 — preserve non-PMS PriceLabs companion without inventing a ledger

Order460/Q276, 13 September 2026. Root's admitted read-only native query confirmed
yellow_pricelabs_staging: public.schema_migration absent, two user schemas and two
user tables. Existing companionContent assumes all yellow_* databases have that
ledger and only captures public, so it cannot correctly preserve this companion.
This is a source-preparation defect, not database corruption.

Delegate /root/q258_source_adapter owns only these existing unconsumed helpers:

- .yellow/evidence/order460/market92-capture.ts
- .yellow/evidence/order460/market92-verify.ts
- .yellow/evidence/order460/market92-preservation.test.ts

Preserve the accepted75a2eba1 source/recovery binding. Root/Astra independently
accepted the preceding tiny binding refresh at hashes379ae82e/5c56fed1/601f8a67,
with11/0/95 and strict types. No capture/recovery action consumed these helpers.

Implement the smallest explicit non-PMS companion branch. Only the exact known
yellow_pricelabs_staging may have a missing ledger; represent that as null rather
than a fictional migration frontier0. Other Yellow release companions still require
their complete existing ledger. PriceLabs capture must preserve ALL its non-system
schemas, table rows, catalogue/ACL/owner/constraints/defaults/functions/views/types,
sequences and database properties. Do not merely skip the database or hash public.
Reusing existing catalogue/table/sequence code via validated schema parameters is
preferred to another framework or duplicate snapshotter. Preserve exact primary
serving/recovery/public semantics and their hashes, query/resource/session limits.
Hash data before output; no raw hotel/client rows or credentials in receipts.

Verifier must bind the companion set to the actual cluster inventory, accept null
frontier only for the explicit non-PMS identity, reject omission/duplication,
unexpected ledger/state/namespace/data changes and preserve all current migration
delta restrictions. Unknown new companion layouts fail closed, never silently skip.
Add focused tests for null-vs-fabricated frontier, missing/changed staging content,
omitted companion and unchanged release-companion semantics.

Import stays inert. Only pure source tests/typechecking admitted here; no actual
database query/write, native fixture, authority read, runtime action, process,
WSL/Docker/state, Git mutation or new files. Root will personally inspect and
separately admit/execute native read-only capture proof after source acceptance.
Root owns this question, Order460, Review460/checklist/status/decision/ledger.

## Narrow review corrections and read-only proof preparation

Independent Astra found three real gaps: assigned null without ledger-absence
proof, omitted database-local default ACLs, and unrepresented enum definitions.
The same three files now assert ledger absence inside the read-only transaction,
hash local default ACLs including namespace-null, and fail closed on enum/range/
multirange/domain layouts. No generic type framework or database change is added.
The existing exact-identity-guarded priceLabsCompanionContent function is exported
for direct proof without generating a source splice or reading all companion DBs.
Worker hashes: capture e76c1462ebcceb2c7d6fb4434cd8c99609be9288b6849649acb8fbc7e77b3d32;
verifier f3611dd191b1e09836503aee1b8827777edac7211eac6e6106e9eadcc044be55;
test fe7c8b9914527934bcaa81517d956e84bef116c1112756f52069804253cac21d.

After final independent source acceptance, root admits exactly two sequential
read-only calls of that exported function for yellow_pricelabs_staging on the
existing receipt-bound native PG13580/127.0.0.1:55503 cluster. Reuse approved
private deploy authority; verify native executable/start and cluster identity
before the calls. Retain its repeatable-read/read-only/session/time limits.
Require exact two schemas/tables, absent public ledger, stable content hash,
and zero companion sessions. Only counts, names of these known schemas/tables,
catalogue/key digests and aggregate hashes may leave the process; no raw rows or
credentials. Use a bounded child, close both pools, and confirm the incumbent
app remains unchanged. This is compatibility proof, not a quiescent serving
baseline, clone, migration, registry write, release claim or new database.

## Executed independent proof

Astra final13pass/0fail/111 and strict accepts all three corrections plus the inert
export. Root personally13/0/111 and strict, followed by the admitted native proof.
The first identity preflight stopped before capture due inet address text including
/32; host(inet_server_addr()) corrects only that formatting mismatch. Both actual
read-only captures then matched832fa0dd62684a2ae0ef8e6bf5376f0e730879823b884f28305652a3b03b8ede:
pricelabs_staging/public; archive_file133 rows, import_bundle7 rows;65 catalogue
entries;0 sequences and other sessions. SourceE76C1462 retained. No data mutation,
import or release claim; current app remains41415/91 and sole3000 unchanged.
