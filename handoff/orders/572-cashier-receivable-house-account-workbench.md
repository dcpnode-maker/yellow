# Order 572 — cashier receivable and house-account workbench

## Objective

Complete the missing operational bridge between an in-house guest folio and a
company or travel-agent receivable account. The React cashier must retrieve the
stay through one practical search, show the authoritative account-owned target and
credit evidence, and complete only a separately confirmed server-governed transfer.

## Natural-solution test

This reuses the existing Party roles, company-role accounts, folios, immutable
journals, receivable preview, approval and transfer services. It creates no Post
Master room, inventory space, balance table, posting path or accounting primitive.
A non-resident Post Master is represented by an account-owned house/receivable
target, never by a sellable guest room.

## Implementation authority

The sole serving source remains
`D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- `tests/yellow-cashier-receivable-workbench.test.ts`
- `tests/yellow-next-finance-workspace.test.ts`
- `handoff/orders/572-cashier-receivable-house-account-workbench.md`
- `handoff/reviews/572-cashier-receivable-house-account-workbench.md`
- `handoff/LEDGER.md`

## Required behaviour

1. Cashier stay search remains a single field and matches guest, confirmation,
   room, room type, source/channel and exact folio reference where the loaded data
   supplies them. A chosen result opens its existing folio automatically.
2. An open positive-balance folio exposes a **Direct billing / Post Master** panel
   that loads only server-returned company or travel-agent receivable targets.
3. Selecting a target performs the existing read-only authoritative preview and
   displays exact transfer balance, current exposure, credit limit and projected
   exposure in property currency.
4. Within-limit transfer requires an entered audit reason and a separate visible
   confirmation. It uses the existing endpoint and one stable idempotency key, then
   refreshes the exact folio and verifies the balance/result before success copy.
5. Over-limit preview cannot transfer directly. It offers the existing approval
   request only, explains that a different authorised supervisor must approve it,
   and never self-approves in the colleague session.
6. Drawer absence does not disable folio or receivable work. Stale selection,
   changed preview, ambiguous search and failed/uncertain responses perform no new
   request with changed inputs and never claim success without authoritative refresh.
7. The panel is mobile-first, keyboard labelled and uses at least 44px controls.

## Exclusions

- No synthetic physical `PM` room, occupancy claim, schema/migration or direct SQL.
- No new transfer, approval, settlement, payment, invoice, tax or ledger semantics.
- No automatic selection of a company/agent from a reservation source code.
- No self-approval, drawer/session bypass, fiscal-document issue or checkout.

## Verification

- Focused parser/UI/idempotency/error-state tests.
- Strict frontend TypeScript and production build.
- Read-only live proof against current public targets/preview where available.
- 375px and desktop rendered containment/accessibility proof.
- Independent non-implementing review personally executes the focused and relevant
  financial proofs before public promotion.

## Outcome — accepted and publicly promoted 2026-09-21

- Implemented the bounded cashier/receivable workbench in the sole serving source.
  The single search now retrieves current, future and historical reservations by
  guest, confirmation, room, room type, source/channel or exact folio reference.
- Folio posting remains available without a configured cash drawer. Direct billing
  uses only canonical server-owned company/travel-agent receivable targets; it does
  not create a physical Post Master room or alter occupancy.
- Exact-money display, consent-fresh preview, drift/reconfirmation, over-limit
  different-supervisor approval, stable-key uncertain recovery and exact refreshed
  statement evidence are enforced by the mounted UI.
- Independent reviewer `/root/astra_review` accepted R6 after personally executing
  the focused UI, hostile-response, browser and isolated PostgreSQL financial proof.
  Frozen hashes and all retained R1–R6 findings are recorded in the review file.
- Root built and promoted only `yellow-public-demo-app-1`; PostgreSQL, Valkey and the
  Cloudflare tunnel were not recreated. Local and public health returned HTTP 200.
  The live page serves `index-DgR-zKvS.js` and `index-DyJx7-FL.css` and a read-only
  hosted-browser check showed the unified search, Omar Siddiqui's open SAR 25 folio,
  charge groups, posting controls, direct-billing panel and drawer-independent copy.
- No public financial command or database mutation was performed during promotion.
  Whole-PMS completion, custom adjustments/allowances, bill splitting, settlement
  and fiscal issuance remain separate open work.
