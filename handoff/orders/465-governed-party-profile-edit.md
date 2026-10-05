# ORDER 465 — governed-party-profile-edit

**Phase:** 0 · **Branch:** `phase-0/governed-party-profile-edit` · **Written by:** Codex · **Date:** 2026-09-20

## Goal
Add the first governed CRM Party-edit operation: update a Party's display and legal name with idempotency, tenant scope, audit fact, and a `party.updated` outbox event.

## Why now
The public PMS requires editable guest profiles, and Order 463 showed that a direct Party update would bypass Yellow's audit/event invariants. This introduces the reusable domain path required for both ordinary PMS editing and the later synthetic-fixture reconciliation.

## Scope — files Codex may create or change
- `src/contexts/crm/parties.ts`
- `src/contexts/crm/index.ts`
- `tests/party-profiles.integration.test.ts`
- `docs/EVENTS.md`
- `handoff/orders/465-governed-party-profile-edit.md`
- `handoff/reviews/465-governed-party-profile-edit.md`

## Contracts to honour (read before writing code)
- `PROJECT.md` invariants 3, 5, 7 and 9
- `docs/CONTRACTS.md` CRM Party profile boundary
- `docs/EVENTS.md` profiles event family
- `src/contexts/crm/parties.ts` current create/search normalization and idempotency contract
- `handoff/orders/464-live-demo-clean-arrival-party-reconciliation.md`

## Definition of done
- [ ] `PartyProfileService.update` accepts only Party UUID, display name, optional
  legal name, idempotency key and an envelope whose operation is `party.updated`.
- [ ] Update executes through `PostgresIdempotency`, asserts tenant-local active
  Party identity under lock, and is a no-op/replay when the requested shape is
  already current.
- [ ] The only domain mutation is `party.display_name` and `party.legal_name`;
  kind, status, attributes, roles, contacts, reservation links and financial data
  remain out of scope.
- [ ] One `party.updated` fact and one matching same-transaction outbox event are
  emitted only when a change is committed, with minimized payload that contains no
  raw name/contact value.
- [ ] Integration tests prove tenant isolation, validation, idempotency conflict,
  update/replay, no-op behaviour, event/fact pairing, minimized evidence and
  rollback after publish failure.
- [ ] Focused test and typecheck are green; an independent reviewer executes the
  relevant proof and records the result before use in Order 464.
- [ ] The integration proof runs only against a newly created, explicitly named
  isolated test database; it is never pointed at the public demo database.

## Forbidden in this order
- Product migrations or new tables, new roles/contacts/attributes editing, merge/anonymize
  behavior, or any changes to reservation, financial, occupancy, identity or
  external-provider records.
- An unscoped `UPDATE party`, a fabricated `party.created` event, or an event/fact
  outside the command transaction.
- Any live-demo database change or review-seed execution.

The normal migrations and fixture rows required for a disposable, isolated
integration-test database are allowed only for that database and are not product
schema changes under this order.

## Open questions already answered
> Q: Why not use a one-off SQL correction for synthetic data?
> A: Party profile edits are cross-module-visible and require an idempotent audit
> fact plus matching same-transaction outbox event. This order supplies that path.
