---
name: yellow-entity-patterns
description: MANDATORY before creating, modifying, or extending ANY entity, table, module, or domain concept in the PMS codebase. Use whenever adding a feature that stores data, when deciding "new table vs extension content vs hot column", when touching reservations, folios, accounts, spaces, occupancy, parties, or any bounded context. Also use when reviewing schema PRs. Skipping this skill causes the exact drift the architecture forbids.
---

# PMS Entity Patterns

The system has 16 primitives and 13 bounded contexts. Almost every "new feature" is a
new COMBINATION of existing primitives, not a new primitive. Run the Natural-Solution
Test before inventing anything.

## The decision ladder (top to bottom, stop at first fit)

1. **Is it config?** → `extension` row against an existing `extension_type`. No code.
2. **Is it a new KIND of config?** → new `extension_type` + JSON Schema in EXTENSIONS.md.
3. **Is it behaviour on events?** → `automation` (trigger + condition AST + registered
   action). Register a new `automation_action` if the verb doesn't exist.
4. **Is it a party in a new role?** → `party_role` row (owner, agent, company, guest…).
   NEVER a new person-like table.
5. **Is it money movement?** → `account` (with role) + `journal` + `posting_line`.
   Trust money = account with role `trust` + automation. NEVER a parallel ledger.
6. **Is it a per-vertical attribute of a space?** → hot column ONLY if it is queried in
   availability predicates (gender_policy, length_cm…); otherwise JSONB `attributes`.
7. **Only then**: a new table. Follow the table rules below and add it to SCHEMA.sql,
   STATE-MACHINES.md (if stateful), EVENTS.md (its facts), CONTRACTS.md (its surface).

## Table rules (non-negotiable)

- `tenant_id uuid not null` is the FIRST column and LEADS every index.
- Money = `bigint` minor units + `currency char(3)`. Never numeric/float.
- Time ranges = `tstzrange`, half-open `[)`. Stay dates = `daterange` `[)`.
- Financial + occupancy + rate history tables are INSERT-ONLY. Corrections are new rows
  that reference what they correct (`reverses_journal_id`, `superseded_by`).
- State lives in explicit `status` columns whose transitions exist in STATE-MACHINES.md.
  If you can't point to the transition table, you may not change the status.
- Every cross-context effect = event in `outbox`, same transaction. No direct writes
  into another context's tables. Module surface = `src/contexts/<ctx>/index.ts` only.

## The shapes that already exist (reuse, don't reinvent)

- **Party** owns roles; roles own accounts. **Account** owns folios (folio = window
  over an account, NOT owned by reservation — Round-1 finding).
- **Space → SellableUnit → occupancy claim**: exclusive claim `[0,∞)`, bed claim
  `[pos,pos+1)`. All conflicts are range overlaps. See yellow-postgres-patterns.
- **ReservationGroup** kind = linked | block | share. Blocks deduct allotment only.
- **fact_log** is the one bitemporal spine: rates, config, ledger references. Don't
  add per-table valid_from/valid_to columns; write facts.
- **document + document_series**: anything numbered/legally sequenced (invoices,
  credit notes, registration cards) with hash chain fields already present.
- **task** is the one work primitive: housekeeping, maintenance, follow-ups.

## Smells that mean STOP

- A second table storing people, money balances, or availability.
- An UPDATE on posting_line, journal, rate_price, or space_occupancy.
- A status enum not in STATE-MACHINES.md.
- tenant_id derived from request body instead of the session token.
- A context importing another context's internal files.
- "We'll just add a column" on a table another context owns.

When in doubt: write the Natural-Solution Test (does the primitive combination solve it
with zero new concepts?) in the PR description before writing DDL.
