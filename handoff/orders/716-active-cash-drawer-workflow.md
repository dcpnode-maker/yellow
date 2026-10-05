# Order716 — Cash-drawer workflow in the active cashier

**Deferred25September by founder:** cash-drawer functionality is not needed now.
Order721 removes the active integration while retaining this source and independent
proof. The prepared716 image was never promoted and is stale relative to the final
identity-guard source. Do not rebuild/promote716 without renewed product scope.

Founder continuation after714/715. Existing CashierService/Order197/D534 already
defines open, immutable blind count, approval and close. Active React currently
shows readiness only. This order exposes those existing commands, not a new cash
payment system. Natural solution: existing cash drawer/session/count/approval
primitives and APIs; no schema, policy, economics or privilege changes.

Scope and ownership:
- review709 (reassigned25September after its independent714/715/717 reviews;
  it will NOT review its own716 implementation): new
  frontend/yellow/src/workspaces/CashDrawerWorkbench.tsx,
  frontend/yellow/src/workspaces/cash-drawer-client.ts,
  frontend/yellow/src/workspaces/cash-drawer-workbench.css,
  tests/order716-cash-drawer-client.test.ts,
  tests/order716-cash-drawer-workbench.test.tsx.
- Root: frontend/yellow/src/workspaces/FinanceWorkspace.tsx only replace readiness
  summary with the new panel and shared synchronous mutation/navigation lease;
  tests/order716-finance-integration.test.ts; scripts/order716-cashier-proof.ps1.
- Governance: this order; handoff/questions/716.md; handoff/receipts/716-cashier.md;
  handoff/reviews/716-cashier.md; docs/PROJECT-STATUS.md and handoff/LEDGER.md.
- Generated public/yellow-next/**; external D:/Yellow/temp/order716-* release files.

Inspect exact current src/app.ts, src/http/operator.ts, financials/cashiers.ts and
legacy operator workbench before coding; do not guess receipt/read shapes. Reuse
GET cashier-sessions for configured drawers/denominations and authorized sessions.
Staff can open with denomination quantities, submit an immutable blind count,
request discrepancy approval, approve/reject using existing supervisor scope, and
close/recover via ordinary or supervised canonical routes as authorized. No freeform
denomination, client total, expected amount, account/user/currency/date authority.
Amounts remain exact server-returned strings, not browser arithmetic. Never display
expected cash in blind-count entry. Nonzero discrepancy is not normalized away:
existing reason and different-user approval are required by the server. If current
read/route contracts cannot safely support a step, record the exact gap first.

Each action has a reviewed frozen request, explicit acknowledgement, immutable key,
exact successful receipt plus appropriate current readback, stale identity/token
protection and same-key unknown-outcome recovery. Hold shared parent lease while
draft/review or unresolved mutation can be lost by navigation; Cancel only before
an uncertain write. Never silently clear an unknown attempt when refreshing.
Respect read/operate/supervise grants, no role fabrication. No configured drawer
means a truthful empty state and explanation, not invented seeded drawer/session.
No full cash-accounting, physical verification, payment/refund, day-close or
ecosystem-complete claim. Retain compact responsive existing ERP visual system.

Independent nonimplementer personally runs focused client/React/integration tests,
full types/boundaries and existing financial-cashier-sessions.integration.test.ts
with REQUIRE=1 against fresh schema-only isolated database. No live QA cash/session
mutation. Founder subsequently requested the public website remain stopped:
root therefore tests only the existing loopback app at127.0.0.1:3010 after an
app-only candidate refresh, preserving rollback and database/cache. The tunnel
must remain OFF until the founder explicitly asks to reopen it. If the property
has no configured drawer, browser proof is limited to empty-state/refresh/layout;
do not seed cash configuration merely to make QA possible. No own merge.
