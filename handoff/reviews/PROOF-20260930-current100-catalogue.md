# PROOF-20260930 — independent current100 catalogue review

Verdict: **accepted bounded source reconciliation**, local commit only. Overall
standing/release, laptop integration and serving/readiness acceptance remain open.
Source basis e06e400a57485cc10a8a35c21dcb1e01b5a667d1; exact ten-path order.

## Independence and executed evidence

Root authored the order and reviewed; the bounded faster worker implemented the
five setup/test files. Root did not implement those files. Root personally ran:

- Clean pinned baseline current catalogue/upgrade: 0 passed, 2 failed; the two
  unrelated historical Order434 environment skips do not satisfy required proof.
- First candidate: fiscal current catalogue passed; upgrade rejected PostgreSQL18
  constraint metadata. The failure remains in the safe proof receipts.
- Final exact candidate: 3 passed, 0 failed, 23 assertions across full-current
  upgrade/no-op, fiscal catalogue and positive-tax semantic-route authority cases.
  The selected historical Order434 skips remain outside these three required cases.
- The new mandatory-column guard accepted all five exact canonical vectors, then
  rejected removal of registration_number NOT NULL using the same guard. Mutation
  occurred only after positive assertions in the newly-created yellow_migrate_UUID
  database, which the existing withDatabase finally cleanup drops.
- Pure current-oracle: 3 passed, 0 failed, 61 assertions.
- Exact candidate `./setup.sh --db-only`: **11 passed, 0 failed of 11**. Occupancy
  races, journal/seal, gapless invoice and tenant/table/view RLS proofs all executed.

Independent fresh catalogue measurement is exactly100 migrations,130 public
tables,120 RLS tables,120 policies,29 forced-RLS tables and2 views. Builder types,
205-file boundaries and complete whitespace checks pass; root personally repeated
whitespace and source/immutable-byte checks. Safe receipts live under
`/workspace/yellow-coordination/catalogue-proof/`.

## Contract and immutable-source review

Order635 already accepted0100. Full-current count/list expectations now include
the exact accepted0092–0100 filenames; no new migration or dynamic substitute.
All102 tracked migration/schema/referee files match pinned source byte-for-byte.
Every migration test block except the two explicitly admitted full-current blocks
is byte-identical to pinned source, including historical86/87/88/89 fixtures.

PostgreSQL18 documents NOT NULL as pg_constraint.contype='n'. The six admitted
full-current structural censuses exclude only that metadata kind and retain the
original strict12/19/7/14/8/13 counts, named constraints, definitions, ownership,
ACL and index checks. Mandatory columns remain exact through attnotnull vectors
independently compared with immutable tests/schema/expected.sql. No raised-count
workaround, relaxed assertion, SQL/grant/schema or domain mutation was introduced.

## Frozen five-file checkpoint

```text
4adc7616faeec2eacb7430faf3449faa4775f915e90a2c6c9787bd2d12064803  setup.sh
ddc07d7980c565c666a23f67fe703651f36e9a1e253a293f30aad2b252fcf776  setup.ps1
fc0a0b2387970385b4f7082eda412a315f43f50fda9bf8918a30325aa6c90021  tests/setup-current-catalogue-oracle.test.ts
a0de5717a624a9ff298b76d672ae914693f51f7d7918e5970337e49084a07741  tests/migrate.integration.test.ts
b090237e85a09c1cb23658bc0acbaeef84e86c3248d6c8713a7d3aae8b5650e5  tests/india-gst-accommodation-quoted-rate-applicability-recording.integration.test.ts
```

No push/PR while applicable release gates remain red/incomplete. No self-merge,
deployment, dirty-laptop overwrite, external-provider activation or full PMS/CRM
completion claim. Laptop quota monitor policy remains active; pause at<=1% with
no paid fallback/reset/automatic resume. Cloud has no direct usage reader.
