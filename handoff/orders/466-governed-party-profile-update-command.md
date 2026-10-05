# ORDER 466 — governed-party-profile-update-command

**Phase:** 0 · **Branch:** `phase-0/governed-party-profile-update-command` · **Written by:** Codex · **Date:** 2026-09-20

## Goal
Expose a narrowly scoped, security-definer PostgreSQL command for an active Party
display/legal-name update, preserving the runtime role's direct `party` update
denial while atomically recording the required Party update audit fact and outbox
event.

## Why now
Order 465's isolated integration proof established that direct runtime SQL is
correctly denied. A governed database capability is required for editable guest
profiles and the later synthetic fixture reconciliation.

## Scope — files Codex may create or change
- `migrations/0092_governed_party_profile_update.sql`
- `src/contexts/crm/parties.ts`
- `src/contexts/crm/index.ts`
- `tests/party-profiles.integration.test.ts`
- `docs/CONTRACTS.md`
- `docs/EVENTS.md`
- `handoff/orders/466-governed-party-profile-update-command.md`
- `handoff/reviews/466-governed-party-profile-update-command.md`

## Definition of done
- [x] The runtime role retains no direct `UPDATE` privilege on `party`.
- [x] A new typed security-definer function accepts only tenant, Party, property,
  actor, request, current expected presentation values and requested replacements;
  it enforces `session_user = yellow_runtime`, `current_user = yellow_owner`, exact
  tenant/active Party/property relationship and compare-and-swap semantics.
- [x] On a changed update it changes only `display_name`/`legal_name`, inserts one
  minimized `party.updated` fact and one matching outbox event in the same
  transaction. It returns a typed no-op/changed result; no raw names enter fact or
  outbox payloads.
- [x] The CRM service uses the command rather than direct Party `UPDATE`; the
  idempotency receipt remains stable under a later Party update.
- [x] Isolated integration proof covers first/update/replay/no-op/CAS conflict,
  wrong tenant/property/actor, direct update denial, publish failure rollback and
  preserved protected-table fingerprints.
- [x] An independent reviewer executes relevant proof and the 11/11 referee before
  any live-demo use.

## Forbidden in this order
- Broad runtime `UPDATE` grants, changes to Party roles/contacts/attributes,
  reservation/occupancy/financial/identity changes, or live demo mutation.
- Unreviewed fixture repair or review seed execution.
