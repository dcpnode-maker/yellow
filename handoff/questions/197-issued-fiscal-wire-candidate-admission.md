# Question197 — Order440 issued-source wire candidate admission

**Status:** RESOLVED — scoped technical admission; no founder action required.
**Date:** 2026-09-06
**Owner:** Codex implementation coordinator.

The owner inspected canonical0077's final composition and commit, not only the
ordinary intermediate item candidate. Final `preDocumentJson` selects compatibility
items carrying the already-recorded Qty1.000/UnitOTH pair. Order440's earlier source
description is corrected; published migration bytes remain unchanged.

## Exact scope

- `handoff/orders/440-fiscal-submission-lifecycle.md`
- this question
- `src/contexts/tax-fiscal/india-irp-issued-wire-candidate.ts`
- `tests/india-irp-issued-wire-candidate.test.ts`
- `tests/india-irp-issued-wire-candidate.integration.test.ts`
- `.github/workflows/ci.yml` (one required isolated Order440 issued-wire proof step
  after the existing native suite; no changes to existing proofs or releases)
- `handoff/reviews/440-fiscal-submission-lifecycle.md` (new independent receipt)
- append-only `DECISIONS.log` and `handoff/LEDGER.md` (coordinator only)

No index export, HTTP route, service registration, provider, dependency, migration,
schema or retained-local database is admitted. The module is a private projection
candidate, not a second financial source or a certified provider adapter.

## Contract

`projectIssuedIndiaIrpWireCandidate(input: unknown)` returns a frozen discriminated
result. Input has exact string fields `documentId`, `documentSha256`, `contentJson`.
Success has `kind: "india_irp_1_1_issued_wire_candidate"`, the unchanged document ID
and source hash, deterministic `wireJson` and `wireSha256`, and
`authenticatedProviderSandboxCertified: false`. Strings avoid a mutable byte-array
escape. Failure exposes a stable code and generic message without guest/provider
content. The caller must supply rows from an authenticated native-origin read;
hash verification alone does not establish origin or tenant authority.

Verify exact UTF-8 source hash before parsing. Require the existing bounded fixed
source fields and permitted GST component families. Serialize only schema-known
numeric decimal fields as validated numeric lexemes; never general string unquoting,
floating money arithmetic, or modification of invoice dates/numbers, fiscal source,
tax components or quantity/unit. Check item/value conservation with bigint minor
units without recomputing the tax basis/rate rules. Reject unsupported shapes rather
than silently dropping source data. Preserve exact code/text identity and escape JSON
strings using the standard serializer. Do not expose secrets or document content in
errors. Source input must remain unchanged; repeated projection is byte-identical.

## Real proof and unresolved durable design

Use a fresh synthetic clone and the existing real native fixture/issuance command.
Read exact `content::text` and `sha256` under the correct tenant, join the immutable
native origin, project the issued document, and verify the source/series/accounting
remain unchanged. Require explicit Order440 database environment or skip visibly;
setting the require flag with missing URLs is a setup failure, never a pass. The
admitted CI proof creates its own empty synthetic clone from the existing template
at migration77, supplies both explicit URLs and the require flag, runs the same
integration file, and drops only that exact CI-owned database. It runs after the
native files but before their shared step's cleanup trap removes the template.

The durable design must not blindly adopt one row per attempt: business-day seal
currently counts rejected/error fiscal_submission rows, so historical failures could
otherwise remain a permanent false blocker. Resolve current head versus retained
attempt history explicitly before DDL. Migration0016 makes fiscal_submission
SELECT-only to app_role; baseline blanket grants are historical, not current write
authority. Define separate permission/capability boundaries without silently treating
document issuance permission as provider submission authority. Neither issue blocks
this private deterministic projection or requires founder credentials.
