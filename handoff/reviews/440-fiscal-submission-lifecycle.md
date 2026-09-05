# Order440 Lane A review — fiscal submission lifecycle

Reviewer: `/root/native_migration_assembly` (non-implementer)
Date: 2026-09-06
Scope: Lane A only — `src/contexts/tax-fiscal/fiscal-provider.ts`,
`src/contexts/tax-fiscal/fiscal-submission-state.ts`, and
`tests/fiscal-submission-state.test.ts`, per Order440.

## Personally executed proof

Command:

```text
bun test tests/fiscal-submission-state.test.ts
bun run typecheck
```

Result: 14 passed, 0 failed, 66 `expect()` calls; TypeScript `tsc --noEmit`
passed. No database, service, migration, HTTP route, provider, or external
submission was used.

The tests exercise exact input/state/event snapshots, UUID/SHA/provider-key
binding, all four modes, mode-correct terminal results, pending/timeout/duplicate
lookup, known-not-sent-only retry, attempt/document/payload/tenant/provider
mismatch, terminal immutability and exact replay, hydrated mutable-state replay,
proxy/accessor/symbol rejection, and provider-pending normalization.

## Review result

Lane A is acceptable for its admitted pure contract. The reducer has explicit
closed transitions, mode conflict rejection, terminal replay protection,
known-not-sent retry gating, and frozen copied outputs. The provider interface is
provider-neutral and does not itself confer fiscal authority.

One integration note is intentionally deferred, not a Lane A failure: the
provider-port binding carries tenant/provider/attempt/document/payload identity
but not `FiscalSubmissionMode`; the durable caller/adapter integration must bind
mode when selecting and validating a provider result. Do not infer that the
current interface is sufficient for database or HTTP integration without that
follow-on check.

This review approves only the private Lane A types/reducer and these unit tests.
It does not approve Order440 as a whole, provider activation, IRP sandbox or
production registration, migration/schema changes, durable request/attempt/
receipt persistence, or Phase 7 completion.

Frozen source hashes (SHA-256):

```text
fiscal-provider.ts           7B1A0610B314A9EBF694F542B3AF7F6ED0DA10E38FC24ED58B7E3CD641F9BE60
fiscal-submission-state.ts   726269CAE184F23727DD32A5208CF846D197C7FF681A1FDB5B9098079C81E17D
fiscal-submission-state.test.ts
                              19ACEB02B730C42177464815A47D150F7BEEC855ECC455D3FF1DFDFD385034ED
```

## Q197 issued-wire projection receipt

Coordinator metadata correction2026-09-06: the Lane A reducer digest above was
missing its final `D`; rehashing the unchanged file verifies the full SHA-256.
This corrects the receipt transcription, not the reviewed implementation.

Reviewer: `/root/native_migration_assembly` (non-implementer), 2026-09-06.
This receipt is limited to the private Q197 projection; it is not a provider,
database-writer, network, or Order440 completion approval.

Commands personally executed:

```text
bun test tests/india-irp-issued-wire-candidate.test.ts
bun run typecheck
bun test tests/india-irp-issued-wire-candidate.integration.test.ts
```

Results:

- Unit: 10 passed, 0 failed, 52 expectations.
- Typecheck: `tsc --noEmit` passed.
- Genuine PG proof on `127.0.0.1:55503/yellow_order440_wire_20260906`, using
  only `yellow_deploy` and `yellow_runtime` with the supplied proof password:
  4 passed, 0 failed, 230 expectations. The three real issued invoices covered
  Karnataka, Chandigarh, and Maharashtra/Karnataka; the cross-tenant source
  isolation case also passed.
- Gating: with no URLs and `YELLOW_REQUIRE_ORDER440_DATABASE=1`, the process
  failed closed with the explicit missing-URL error (exit 1). With both URLs
  absent and the require flag unset, the integration explicitly skipped 6 tests,
  0 passed, 0 failed.

The proof verified stored source-byte hash before projection, deterministic
wire/hash replay, seven-section shape, `Version`/`DocDtls` identity, seller and
buyer preservation, fixed Qty/Unit compatibility values, bigint amount
conservation and numeric wire lexemes, unchanged document/series/journal/
posting/fact/outbox/submission/origin rows, and tenant-context isolation. The
projection returns `authenticatedProviderSandboxCertified: false`; no provider
was contacted and no IRP authority result is claimed.

Hashes before and after proof were unchanged:

```text
india-irp-issued-wire-candidate.ts             FC9787C120458D709A5DF521474A31435DAB2A0EBECC7E8AEB529C0972DFA7EB
india-irp-issued-wire-candidate.test.ts        1D561522595387D728CB28F32E038D0CFA668F9237728B1C528691C984F93C87
india-irp-issued-wire-candidate.integration.test.ts
                                                CD7FBA74653B5AD2312910AA7232B5573CF9BBCCAC25F6910D913111AE01B104
```
