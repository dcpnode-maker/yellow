# Question 020 — Order 024 exposed unbound default JTI factory

**Status:** CLOSED — see `020-ARCHITECT-RESPONSE.md` and D-103.

## RESOLVED

## Stop condition

Order 024's first pre-registered proof could not reach the API. Issuing its bearer token
with the production default threw:

```text
TypeError: Expected this to be instanceof Crypto, but received an instance of Hs256TokenSigner
code: ERR_INVALID_THIS
```

`Hs256TokenSigner` assigns `crypto.randomUUID` directly, then invokes it as a private
field method. Bun binds `this` to the signer rather than Crypto. Existing Order 020 tests
always injected `jtiFactory`, so the default path was uncovered.

## Question

May Order 024 Scope add `src/contexts/identity/token.ts` and `tests/token.test.ts` only
to wrap the default as `() => crypto.randomUUID()` and prove default issuance produces
a valid UUID JTI?

