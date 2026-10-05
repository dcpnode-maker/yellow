# Order 461 — Unified cashier and guest billing desk

## Objective

Replace the separate folio lookup mental model with one operational billing desk.
An authorised cashier must be able to find an in-house reservation by guest name,
reservation confirmation or folio reference; inspect all live posting windows; post
the permitted charges; organise charges across multiple folio windows; route an
eligible balance to a company or agent; and enter the governed invoice journey.

## Natural-solution test

This is not a new ledger, balance, invoice, payment, guest or company model. It is
one operator composition over the existing Party, reservation, account/folio,
journal/posting, receivable-transfer, document and cashier-session services.

## Scope

- Create a single **Billing desk** presentation reached from Cashiers. Folios becomes
  the statement/detail surface of that same desk; Invoices remains the legal-document
  queue and issuance surface.
- Add a bounded, tenant-scoped in-house billing search by exact or prefix guest
  display name, reservation confirmation and folio reference. Results must show only
  the current property and must resolve one chosen reservation before any mutation.
- Reuse existing multi-window folios to present practical bill partitions such as
  Accommodation, Food & beverage, Alcohol, Spa, Laundry, Transport and Other. A
  partition is a named folio window, not a separate financial balance.
- Reuse the statement service’s eligible charge options and existing immutable
  posting/correction endpoints; preserve their existing transaction-code and USALI
  routes. Present tax categories only where a proven server-side tax/evidence path
  supplies them; otherwise disclose the unsupported prerequisite and do not infer tax.
- Reuse Party-backed reservation sharers. Show all entitled sharers on the selected
  stay and allow the existing allocation/folio-window mechanisms to produce distinct
  statements where configured. No duplicated person records and no rewriting posted
  ledger lines.
- Surface existing recipient evidence and invoice-readiness blockers. Add recipient
  capture only through a separately scoped, verified operator adapter to the existing
  India-GST registration/evidence service; no company/agent transfer implies legal
  buyer identity. Issued documents remain immutable and corrections are credit notes.
- Keep cash drawer opening/count/close as a custody control within Cashiers, but add
  a clearly separate guest-billing pane so cash float is not confused with guest
  revenue or payment settlement.
- Repair the deterministic synthetic-only in-house cashier fixture when a public
  browser proof exposes an incoherent selected stay. The fixture must carry the
  same authoritative primary-guest, segment-occupancy and open-primary-folio
  relationships that the existing reservation-detail and statement readers require.
  It may create no journal, posting, payment, document, external action or real
  identity data; all fixture writes remain seed-idempotent and are independently
  reviewed before the public runtime is reseeded.
- Add voice command drafts for search, opening the billing desk, opening a named
  folio window and preparing a governed charge. Voice may never write through a
  second path: it must show the exact guest, charge, amount, tax category and target
  window, then invoke the existing confirmed endpoint with an idempotency key.

## Explicit exclusions

- No copying OPERA source code, proprietary layouts, documentation or trade dress.
  Yellow will achieve comparable hotel workflows using its own design and domain
  model.
- No migration, new ledger, direct posting_line mutation, payment-card data, tax
  calculation in the browser, fiscal-document mutation, unaudited split logic, or
  unverified recipient-GST capture path.
- No claim that India GST invoice issuance or IRP submission is legally available
  until the recipient evidence, tax calculation and fiscal provider prerequisites are
  fully configured and independently proven.

## Acceptance

1. A cashier can locate an in-house guest by guest name, reservation confirmation or
   folio reference, and opens one authoritative billing desk without manually
   navigating between Folios and Invoices.
2. The desk presents current posting windows and their categories; charges are
   prepared and confirmed through the existing immutable ledger service only.
3. Sharer, company/agent receivable and GST-recipient paths are visibly distinct and
   preserve Party and fiscal evidence lineage.
4. Cash-drawer custody controls remain intact and are visually separated from guest
   billing.
5. Desktop/mobile browser proofs, financial invariant tests and an independent
   reviewer-executed proof cover every mutation path.

## Verification

- `bun run typecheck` and targeted financial/operator tests.
- Tenant-isolation and cursor-bound search proof.
- Browser proof: search → choose reservation → inspect/organise windows → prepare
  charge → explicit confirm → immutable statement refresh.
- Separate proof that a fiscal document cannot be edited and a correction creates a
  compensating document/workflow.
- Independent reviewer executes the mutation and fiscal-boundary tests, then records
  findings in `handoff/reviews/` and `handoff/LEDGER.md`.
