# Q256 — Reuse the existing browser fiscal receipt validator

**Status:** technical scope clarification implemented and independently accepted,
2026-09-13; admitted before extra-path edits. **Order:**466.

The original requirement to reuse a shared browser validator was not executable:
the backend snapshot depends on node:util/Buffer/Bun and the available browser
invoice-print validator is private. Do not invent an asset or copy another parser.
Root and the bounded reader inspected actual snapshotReceipt/snapshotDelivery:
they depend only on documentId/propertyNode/documentSha256, not INV source/body.
The INV-specific source validator is separate and must not be called for a credit.

Admit only one extra production path, src/http/operator/invoice-print.js, for a
small inert exported fiscalDeliveryRegistrationStatus(identity, deliveryValue).
Exact/accessor-free three-field identity validation precedes the unchanged
snapshotDelivery and registrationStatus functions. Return only frozen {code,label}
or null. Never return internal rows, signed payloads, provider identity or the
print-specific detail text. No QR creation, source parsing, DOM, I/O or command.
All existing private validator/status/print behavior stays byte-for-byte unchanged.

The builder /root/q251_artifact owns only this facade. The Order466 source worker
owns invoices.js and pure tests; browser worker remains disjoint. The workbench
may lazily load the already-served print asset after a valid credit discovery and
delivery response, with its existing scope/abort checks repeated after import.
No API/router/new asset/dependency change. No source/runtime publication admission.

This structurally revalidates an already server-authorized receipt; it is not new
browser cryptographic verification. Only the existing production accepted label
may say IRP registered. Sandbox/pending/rejected/cancelled/ambiguous/legacy remain
distinct. Pure tests must execute actual facade and preserved print paths, including
wrong identity/extra keys/accessors/receipt variants and no payload leakage.
Root is the nonimplementer and personally reruns the relevant proof.

The same facade builder may add tests/operator-invoice-credit-note-parity.test.ts
for actual backend service discovery with an injected in-memory Tx (no database),
canonical/boundary/hostile receipt parity and every actual facade delivery state.
The small draft pure suite is not a substitute for these required cases. No copied
validator, source-edit permission beyond the facade or widened runtime action.

Completed facade SHA895803a6 and parity test5e37c348 are independently covered in
Review466. Root personally executes the combined79pass/9explicit DB skips/0fail
proof and confirms byte-for-byte back-projection of all pre-existing print source.
This closes the technical reuse question only; it grants no financial/provider or
publication/runtime authority.
