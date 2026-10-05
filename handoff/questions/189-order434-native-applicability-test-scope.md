# Question189 — Native applicability requires a prospective document identity

**Raised:** 2026-09-05, Order434, before editing the additional test path.

The existing quoted-applicability test rejects the substring `document` anywhere
in the module. Order434 explicitly requires a native timing projection containing
the prospective document UUID, without issuing a document. The new native branch
therefore needs the identity while the existing external branch remains read-only
and unchanged. This is a stale whole-source assertion, not a failed money, tenant,
document-issuance or provenance invariant.

## RESOLVED — D1343, bounded technical scope amendment

Admit only `tests/india-gst-accommodation-quoted-rate-applicability.test.ts` for
this correction. Keep the whole-module prohibition on DML, tax-amount calculation,
posting and IRP effects. Replace only the blanket word-level document ban with
checks for document-writing/number-allocation actions and an executable assertion
that the legacy external result has no native prospective-document fields. Keep
all existing substantive external lineage, exact outputs, source reconciliation,
component arithmetic and frozen/replay tests intact.

This does not permit a public issue action, SQL write, changed external result,
relaxed database proof or independent approval. The native prospective UUID remains
database-generated inside the dedicated final issuing transaction.
