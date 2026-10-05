# Order 536 — governed showcase BAR release publication

## Objective

Create and activate one exact, internally governed BAR release for each of the
two isolated showcase properties so their already-configured inventory can
produce canonical, commit-arbitrated offers for the native reservation flow.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tools/provision-public-showcase-rate-releases.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-public-showcase-rate-releases.test.ts`
- existing authenticated rate-builder draft, simulate, approval-request,
  approval-decision and publish APIs
- exact Locanda and London property, BAR plan, unit-type and representative
  sellable-unit identifiers returned by the current authenticated runtime
- `handoff/reviews/536-public-showcase-governed-rate-release.md`
- independent execution and verification by a non-implementing reviewer

## Fixed release commands

- Model: `room-matrix` version 1, guided authoring, no RMS binding.
- Targeting: one inclusive, unit-type-specific rule for each of the three room
  types at a property. Direct and other channels remain eligible; this order
  does not create or change provider/channel mappings.
- Locanda SAR two-adult showcase nightly values: L1BR 85000, L2BR 125000,
  LPH 250000 minor units.
- London GBP two-adult showcase nightly values: KING 20500, DLX 27000,
  STE 46000 minor units.
- Guest eligibility follows each property's configured room-type maximum; no
  package, promotion, cancellation, deposit, guarantee or no-show policy is
  invented by this order. Refund treatment remains `policy`.
- Distribution mode is `all` with no channel list. This is local release
  eligibility only and is not an OTA/provider push.

## Required behaviour

1. Authenticate the requester through existing automatic demo entry and the
   distinct approver through protected environment-supplied local-review
   credentials. Never embed or emit a bearer token or password.
2. Before any write, verify the exact property/plan/currency/inventory shape,
   the six Order535 current price rows, and that each plan has no existing
   model, target or release history. Any divergence aborts before mutation.
3. Create each atomic model/target/release trio through the governed API with a
   deterministic idempotency key and verify its exact reconstructed authoring
   command.
4. Simulate one representative preview cell per configured room type. Request
   approval as the requester; the requester must remain unable to decide or
   publish. Decide as the distinct approver, then publish only as that same
   approver after a fresh simulation.
5. Replay every exact mutating request and prove the same result is returned
   with `idempotency-replayed=true` and no duplicate model, target, release,
   approval, fact, outbox or idempotency evidence.
6. Verify each plan has exactly one active latest release and canonical future
   availability returns one bookable, priced, `promise=false`,
   commit-arbitrated offer per configured room type with the fixed release
   amount.
7. Output only non-sensitive property codes, counts and statuses.

## Exclusions

- No direct SQL/DML, migration, schema, permission, inventory, rate-plan,
  policy, reservation, guest, financial or public frontend change.
- No provider/OTA request, mapping, campaign, distribution publication, or
  claim that the internal scenario values are client-approved market rates.
- No self-approval, automatic approval, approval credential disclosure, or
  weakening of the four-eyes state machine.

## Risk and review

Rate-release activation is a sellability state transition. A non-implementing
reviewer must inspect the exact script, personally execute the preflight and
governed workflow, verify all-history tenant-scoped database evidence and prove
requester/approver separation before Order533 can rely on the result.

## Verification

- Focused source contract test and dry preflight.
- Independent reviewer execution through authenticated APIs only.
- Reviewer-personal tenant/property-scoped, read-only all-history census of
  extension, approval, fact, outbox and idempotency evidence.
- Reviewer-personal canonical availability proof, followed by the distinct
  Order533 reservation commit/replay gate.
