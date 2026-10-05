# Order 419 — Public synthetic write sandbox

## Objective

Allow public-demo testers to perform the supported PMS create, read, update
and workflow-confirmed delete/correction actions against the isolated synthetic demo
tenant, manually or through Yellow's confirmation-gated command path.

## Scope

- Replace the temporary public-demo read-only mutation guard with the existing
  automatic, bounded synthetic-demo session. The founder explicitly removed the
  passcode requirement for this temporary public test.
- Let every visitor use the synthetic demo's supported PMS workflows; this is not a
  production authentication pattern.
- Route every write through the existing authenticated PMS endpoints, permissions,
  state machines, transaction/outbox audit path and confirmation UI. Yellow may
  prepare/navigate/confirm a supported action but cannot gain a second write path.
- Preserve the deterministic synthetic-only fixture; all names, contacts, stays,
  preferences, notes and operational records must be fictional and non-deliverable.
- Record the actor/session and existing domain audit evidence for every permitted
  write; present clear public-demo scope wording.
- Add focused boundary tests plus an independent review/proof before enabling writes.

## Explicit exclusions

- No real guest identity, contact, payment, travel-document, booking or loyalty data.
- No real credentials or production identities in source, browser storage, logs,
  test output or chat transcript.
- No bypass of RLS, occupancy, journals, fiscal chains, state machines, approvals or
  existing confirmation controls.
- No persistent user account provisioning, external channel action, provider action,
  production tenant access or new migration.

## Acceptance

1. A public synthetic-demo visitor can execute supported PMS writes,
   and each write is visible through the existing audit/domain history.
2. Yellow's write proposals always show a review/confirmation step and execute only
   through the same endpoint as manual UI actions.
3. Sensitive content never reaches Gemini and the shared fixture remains synthetic.
4. Independent reviewer executes the public-write and audited-workflow proofs.
