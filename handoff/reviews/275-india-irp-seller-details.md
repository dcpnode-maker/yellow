# Order 275 — Independent Tier-3 review

**Verdict:** APPROVE — no finding  
**Reviewer:** fresh non-implementing OpenAI Codex Tier-3 reviewer (`/root/order275_independent_review`)  
**Reviewed commit:** `a412e6fa8bb89dd78c05d67c9e1d6b9ae4ed9efa`  
**Reviewed base:** `c674c8173b35b8fba04e42d8e37ef82c1aed2e32`  
**Reviewed range:** `c674c81..a412e6f`  
**Date:** 2026-08-29

## Independence and scope inspection

I implemented none of Order275. I read `PROJECT.md`, `AGENTS.md`, ran `./state.sh`,
and read the exact order, roster/workflow and mandatory Yellow compliance rules. I
inspected the complete commit range, the pure builder, bounded-context export,
intentional-red and hostile tests, contracts/extensions, Phase-7 plan, roadmap,
decision and ledger entries. The exact twelve changed paths are within the order's
declared scope and `git diff --check c674c81..a412e6f` passed. The worktree was clean
at the exact reviewed commit before this review record was created.

The parent commit contains neither
`src/contexts/tax-fiscal/india-irp-seller-details.ts` nor its bounded-context export.
The candidate contains both and D-718 records the pre-implementation intentional-red
execution. I did not treat the implementer's recorded green results as review proof;
all final executable results below are my own runs.

## Statutory and source audit

I verified the candidate against the two official primary sources named by the
order/preflight:

- Government of India, CBIC, Notification No. 60/2020 — Central Tax, FORM GST
  INV-01, schema version 1.1:
  `https://einvoice6.gst.gov.in/content/wp-content/uploads/2022/07/notification-60-central-tax-english-2020.pdf?x16745=`;
- GSTN-authorized IRIS IRP notified schema publication:
  `https://einvoice6.gst.gov.in/content/notified-e-invoice-schema/`.

FORM GST INV-01 makes supplier information mandatory and specifies supplier legal
name max100, optional trade name max100, GSTIN exactly15, address1 max100, place
max50, state from the GST-system enumerated list and PIN as a six-digit number. The
IRIS notified-schema mapping confirms the transmitted JSON names
`SellerDtls.Gstin`, `LglNm`, `TrdNm`, `Addr1`, `Loc`, `Pin` and `Stcd`; optional
address2, phone and email are separately named fields and are not invented here.

The candidate emits exactly those seven admitted fields in fixed order, omitting
only `TrdNm` for exact null. It validates the canonical 15-character GSTIN shape,
state prefix and checksum; rejects inactive GST state codes25/28; requires a
six-digit nonzero PIN string before numeric projection; enforces the notified text
limits without trim, truncation, splitting, coercion or synthesis; and rejects
missing, surplus, accessor-backed, proxy, mutable or non-canonical source evidence.
The exact Order272 property, scheme/currency, frozen jurisdiction identity and
canonical hashes are validated before projection.

Registration/evidence lineage stays outside transmitted JSON. The result, lineage,
payload and seller record are recursively frozen; the source remains unchanged;
replay is byte-identical; `payloadJson` is the exact fixed-order serialization and
`payloadHash` is SHA-256 of those exact bytes.

## Personally executed proof

Commands and results at exact commit `a412e6f`:

- `bun test tests/india-irp-seller-details.intentional-red.test.ts
  tests/india-irp-seller-details.test.ts`: **9 passed, 0 failed, 111 assertions**.
- `bun test tests/india-gst-supplier-registration.intentional-red.test.ts
  tests/india-gst-supplier-registration.integration.test.ts
  tests/india-irp-seller-details.intentional-red.test.ts
  tests/india-irp-seller-details.test.ts`: **16 passed, 11 expected environment
  skips, 0 failed, 160 assertions**.
- `bun test`: **864 passed, 787 expected environment skips, 0 failed, 8,715
  assertions; 1,651 tests across 296 files**.
- `bun run typecheck`: exit0.
- `bun run boundaries`: **99 TypeScript files scanned**, pass.
- `bun run license-check`: **23 installed packages**, pass.
- `bun audit --audit-level=high`: **no vulnerabilities found**.
- `git diff --check c674c81..a412e6f`: exit0.
- Exact range/path inspection: twelve changed paths, all admitted by Order275; no
  schema, migration, seed, dependency, runtime, local or credential path changed.

I separately scanned the complete product source. Its sole import is
`node:util`; it contains no `Tx`, SQL/database/service/repository import, network
call, async path, DML statement, document series, journal, posting, outbox, payment,
event, submission or persistence call. The focused P8 static effect oracle
independently asserts the same zero-authority boundary and passed in my run.

## Findings and verdict

No finding remains. I approve only the pure Order275 `irp_json_1_1` seller-details
projection at exact commit `a412e6fa8bb89dd78c05d67c9e1d6b9ae4ed9efa`.

This approval grants no buyer/recipient/SEZ, place-of-supply or supply-type policy;
no CGST/SGST/IGST decomposition; no item, value or tax computation; no document
allocation, numbering, hash chain or issue; no provider/submission/API/HTTP/UI; no
database, transaction, SQL, schema, migration, seed, local promotion, merge, public
deployment, Phase-7-complete or application-complete authority. Apart from this
review record, I changed no repository file and performed no database or runtime
mutation.
