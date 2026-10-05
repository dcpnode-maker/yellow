# Independent review — RELEASE-20261001 PG18 schema snapshot

Accepted for bounded six-file source publication. Release acceptance still
requires the exact successor's CI and laptop reconciliation. Root did not author
the snapshot: crs_module copied a verified fresh full PG18 capture. Root personally
executed the independent proofs below; builder output alone was not acceptance.

## Full-schema review

Parent snapshot SHA256: cc573c27ff9d9470b7a5b97192adcf5d9d0c078fa275ebcb8134dc44313607d3.
Candidate SHA256: f02f40fd46fda9a73086e4e03dd0517c26e8cade99b8ae675d73cdb36da81cc2
(1,896,247 bytes). Parent and candidate retain 1,980 ordered object markers.
Only two version headers, one transaction_timeout setting and 239 explicit
nondefault NOT NULL constraint names differ. The catalog validates all239 on
25 tables; diagnostic-only back-projection is byte-equal to the parent.
All190 functions,609 ACL blocks,120 RLS,120 policies,98 indexes and every other
object block are unchanged. No helper normalization was broadened.

## Personally executed proof

- Fresh second target migrated canonical100; every ledger filename/checksum
  matches its exact file. Census130/120, two views and two security-invoker settings.
- Deployment seed and acceptance24 passed/0 failed/75 assertions.
- Unchanged CLI reproduced parent RED at line6; candidate green. Two independent
  captures match the builder capture and candidate bytes exactly.
- Six temporary fixture negatives (NOT NULL, RLS, ACL, column, index, function
  body) each fail the unchanged CLI; exact fixture restoration and final green.
- Required operational review seed27/0/117; fiscal review seed8/0/79; no skips.
- Literal unchanged ./setup.sh --db-only: RESULT: 11 passed, 0 failed of11.
- Isolated native runtime from inherited f610 product bytes: exact health200,
  ready200/revision f610/frontier100, local signed login200, authorized property
  system-status200 and tenant context; both required workers configured,
  projection cursor established,23 restricted runtime sessions. Loopback only.
- Types exit0;207 import boundaries; whitespace; unchanged schema tests4/0/19.
  Default standing2520 passed/1580 explicit DB-environment skips/0 failed/44979
  assertions. Required database proofs above did not use those skips.
- All100 migration bytes equal laptop committed e06; no0101 exists or was allocated.
  Schema helper, referee, CI and product sources are unchanged.

Proof targets were absent before CREATE and removed only after this invocation
created them. Exact existing owned synthetic app/container/image was restored.
Retained synthetic catalogue, schema, migration ledger, data row counts, global
role flags and authority-file bytes matched before/after. No business database,
credentials or existing laptop source was operated on.

## Evidence and limits

Mode0600 full receipts/logs are outside Git in
/workspace/yellow-coordination/release-20261001/:
independent-pg18-core-v4-receipt.json, independent-pg18-core-v4-summary.json,
independent-pg18-runtime-v2-receipt.json, pg18-schema-standing.json,
pg18-independent-migration-source-proof.json, and schema-f610-yellow-dev/.
The official f610 database failure and parent snapshot remain preserved.
Earlier outside-Git harness failures (incorrect ledger column/import and absent
runtime key) are retained separately; source assertions were not changed to pass.
This is a synthetic native runtime proof, not a public app, Docker-byte-identical
runtime proof, laptop integration, durable business-data recovery or phase closure.
No self-merge, deployment, paid fallback or complete PMS/CRM claim.
