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
fiscal-submission-state.ts   726269CAE184F23727DD32A5208CF846D197C7FF681A1FDB5B9098079C81E17
fiscal-submission-state.test.ts
                              19ACEB02B730C42177464815A47D150F7BEEC855ECC455D3FF1DFDFD385034ED
```
