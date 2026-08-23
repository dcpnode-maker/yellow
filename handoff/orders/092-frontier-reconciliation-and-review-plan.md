# Order 092 — Frontier reconciliation and independent-review plan

**Phase:** 4 · **Branch:** `phase-4/reconcile-order-091-frontier`
**Base:** `backup/order-091-final-4874f5c` at `4874f5c`
**Tier:** 2 — governance and review coordination; no product behavior
**Written by:** OpenAI Codex under the founder directive imported from `5f49c82`

## Outcome

Establish Order 091 as Yellow's actual implementation frontier, preserve the advanced
lineage's D-1 through D-291 byte-for-byte, reconcile the separate handoff branch's
colliding D-91 through D-93 with explicit Git provenance, and turn Orders 045–091 into
a risk-ordered independent-review and repair program. The order changes no product code,
schema, proof assertion, backup ref, `main`, or user-owned local configuration.

## Scope

- `AGENTS.md`
- `CLAUDE.md`
- `docs/WORKFLOW.md`
- `handoff/ROSTER.md`
- `handoff/ROADMAP.md`
- `handoff/ORDER-TEMPLATE.md`
- `handoff/REVIEW-TEMPLATE.md`
- `handoff/orders/092-frontier-reconciliation-and-review-plan.md`
- `handoff/ORDER-045-091-REVIEW-PLAN.md`
- `handoff/LEDGER.md`
- `DECISIONS.log`

## Required work

1. Record exact server-side `refs/heads/` hashes for the handoff and advanced refs,
   their fetched remote-tracking refs, and executable ancestry proof.
2. Preserve advanced D-1…D-291; append a new decision that maps the handoff branch's
   colliding labels to provenance-qualified aliases rather than renumbering history.
3. Apply D-91's permanent ownership and independent-review rule to the operative
   adapters and workflow without importing Phase-0-era files over advanced work.
4. Record that Orders 087 and 088 have no order files or commits and are reserved gaps,
   not hidden or completed work.
5. Publish risk-ordered review waves with reviewer-executed commands, repair routing,
   and explicit completion criteria. No debt row becomes approved by this order.
6. Preserve `.agents/`, `.codex/hooks.json`, and `handoff/chat-archive/` as untracked,
   user-owned material pending deliberate classification.

## Forbidden

- Any product source, test assertion, migration, schema snapshot, package/lock, CI,
  Compose, backup ref, `main`, or imported chat edit
- Rewriting or deleting an existing decision, claiming builder evidence as review,
  interpreting absent Orders 087/088 as delivered, or naming Claude as mandatory
- Any merge, destructive cleanup, dependency change, or weakening of the 11/11 floor

## Definition of done

- [x] Both server-side protected refs and all reported checkpoint ancestry are independently proven.
- [x] Exact-tip baseline is green, including schema drift and referee 11/11.
- [x] Governance files reflect D-91 without overwriting advanced lineage history.
- [x] Collision provenance and the review/repair plan were committed at `21ae495`.

## Review-plan correction evidence

Wave B reviewer execution stopped B13 before named assertions because the Order-084
review seed requires the canonical launch seed. The executable matrix now runs
`bun run db:seed` against the fresh B13 database before the reservation-offers proof.
No product assertion failed and no Wave-B approval was recorded before this correction.

## Independent review completion

Wave A (`1e422eb`), Wave B (`645b5ca`), Wave C (`a49be76`) and Wave D (`4ff64e5`)
durably record reviewer-executed approval for exactly one exclusive owner per all 45
manifest rows. The B13 plan correction is `d50517c`. Orders 087/088 remain absent gaps.
The historical manifest rows are not rewritten; the four review files are authority.
