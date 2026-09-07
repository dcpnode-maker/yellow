# Built operator capability inventory — Order444

**Source inventory: 7 September 2026. Not a deployment receipt.** The current
checkout mounts 15 workspaces. The retained founder runtime is still the older
frontier77 app until a separately verified update. Read
[current status](../PROJECT-STATUS.md) for the actual serving source and database.

The source of route truth is [app.ts](../../src/app.ts); browser dispatch and
existing task handoffs are in [operator.js](../../src/http/operator/operator.js).
Permissions are enforced in [the HTTP operator](../../src/http/operator.ts), not
by a navigation button, layout, prototype role switch or management badge.

In the table, `P` means `/p/:property` and `API` means
`/api/v1/properties/:property`. References to tests identify executable coverage,
not a claim that every integration test ran against the current candidate. The
[Order440 review](../../handoff/reviews/440-operator-invoice-workflow.md) records
the actual independently executed fiscal database evidence. Each review release
must add its own exact SHA, fixtures, commands/results and access receipt.

| Workspace / route | Existing reads and governed actions | Permission families / boundary | Representative proof |
|---|---|---|---|
| Today — `P/today` | Reservation board/detail; arrival/departure readiness; room assignment; pickup dispatch/work; arrival cleaning; check-in/checkout | `reservations.lifecycle:read`, segments read/write, `crm.parties:read`, `stay-operations.checkin:read/commit`, checkout read/commit, pickup dispatch/work, arrival-task read/create. Dirty-room override is separate. | [Room assignment](../../tests/due-in-room-assignment.integration.test.ts), [arrival/HK navigation](../../tests/operator-arrival-cleaning-checkin-continuity-navigation.integration.test.ts) |
| Availability — `P/availability` | `POST API/availability:search`; real inventory/holds; protect/release inventory; continue into reservation commit | Inventory availability/configuration read, holds read/write, `reservations.booking:write`. PostgreSQL alone decides sellability. | [Inventory](../../tests/inventory.integration.test.ts) |
| Reservations — `P/reservations`, `P/res/:reservation` | Board/detail, Party and guest context, booking, guest/travel/lifecycle updates, cancel/reinstate, segment changes/room move, primary folio, assignment/check-in/checkout | Reservation booking, guests read/write, lifecycle read/write, segments read/write, CRM Parties read/write; additional stay/folio permissions for their actions | [Reservation shell](../../tests/operator-reservation-workspace.integration.test.ts), [check-in](../../tests/operator-checkin-workbench.integration.test.ts) |
| Folios — `P/folios`, `P/folio/:folio` | Statement by ID/reference; primary/additional windows; charge; correction; settlement/close; transfers/receivable approval; deposit request/application when configured | Folios read/open/settle/close, charges write, adjustments write with separate post-seal privilege, transfers write, receivables read/transfer/approve, payments read/write, deposits apply. Never delete a posting. | [Folios](../../tests/financial-folios.integration.test.ts), [transfers](../../tests/financial-folio-transfers.integration.test.ts), [settlement](../../tests/financial-folio-settlement.integration.test.ts) |
| Invoices — `P/invoices`, `P/invoices/:document`, `P/invoices/new/:reservation/:folio` | Search/document/receipt; explicit buyer and readiness; confirmed immutable issue; provider choice/request when configured; current receipt and print; optional document-history disclosure | `tax-fiscal.documents:read/issue`, `tax-fiscal.india-valuation:finalize`, submissions read/request; server retry has distinct submissions retry. Q209 source adds the five fiscal grants to the operator only; the retained frontier77 app has not received them. | [Actual invoice browser](../../tests/operator-invoices.browser.test.ts), [native fiscal database](../../tests/india-native-fiscal-invoice-database.integration.test.ts), [real layout/disclosure browser](../../tests/operator-workspace-layout.browser.test.ts) |
| Cashiers — `P/cashiers` | Session list/open/count; request/decide approval; close/supervised close | `financials.cashiers:read/operate/supervise`; supervision is separate | [Cashier sessions](../../tests/financial-cashier-sessions.integration.test.ts), [cashier workbench](../../tests/operator-cashier-workbench.integration.test.ts) |
| Day close — `P/day-close` | Persisted open-day backlog/readiness; carry approvals; discrepancy carry; explicit audited seal | `financials.business-days:read/seal`, business-day carry/approve-discrepancy-carry and underlying DB seal permission. No ordinary posting after seal. | [Day-close workbench](../../tests/business-day-close-workbench.integration.test.ts) |
| Owner trust — `P/trust` | `API/trust/accounts`, preview, approval inbox/request/decision, immutable expense posting | `financials.trust:post`, `financials.trust:approve-negative`; different-user checker. This is not a bank payout or complete owner-statement module. | [Trust accounting](../../tests/financial-owner-trust.integration.test.ts) |
| Room outages — `P/operations` | Read/open/close operational block; inspect/update OOS sellability policy | Inventory blocks read/write, configuration read, policy read/write | [Inventory policy](../../tests/inventory-policy.integration.test.ts) |
| Housekeeping — `P/housekeeping`, `P/housekeeping/tasks/:task` | Board/detail, conditions, discrepancy, sheet preview/history/generation, arrival cleaning and task transitions | Tasks read/work/inspect, conditions initialize, sheets read/generate, arrival tasks read/create, discrepancies read/report. Cleaning, inspection and FO acknowledgement remain distinct. | [Task lifecycle](../../tests/housekeeping-task-lifecycle.integration.test.ts), [sheet generation](../../tests/housekeeping-task-sheet-generation.integration.test.ts) |
| Vehicle register — `P/vehicles`, `P/vehicles/:vehicle` | Bounded persisted reservation-linked vehicles; current parking; governed parking assignment | `stay-operations.vehicles:read/park`; this mounted workspace does not create vehicle records | [Reservation integration](../../tests/operator-reservation-workspace.integration.test.ts), actual route/controller source above |
| Inventory setup — `P/inventory` | Unit types, spaces, sellable units, bulk rooms, projections, blocks/policy, offline leases | Configuration read/write, availability read, blocks/policy/offline-leases read/write; projection is not sellability authority | [Inventory](../../tests/inventory.integration.test.ts) |
| Restrictions — `P/restrictions` | Read/create governed restriction configuration and inventory context | `inventory.restriction:read/write`, configuration read | [Workbench API](../../tests/operator-workbench.integration.test.ts) |
| Rates — `P/rates` | Configuration/current prices; policy/plan/price; supersede; draft/quote/simulation; approval/release/publish/undo; bounded intent interpretation | `rates.configuration:read/write`, `rates.pricing:read/write`. Default intent adapter is deterministic, not proof of an external AI service. | [Workbench API](../../tests/operator-workbench.integration.test.ts), rate routes/controller above |
| Project status — `P/status` | `GET API/system-status`, recorded source/catalogue/worker evidence | `inventory.availability:read`; read-only. Planned phases do not become operational capabilities. | [Workbench API](../../tests/operator-workbench.integration.test.ts) |

## Exact invoice command map and remaining limits

The invoice module is [invoices.js](../../src/http/operator/invoices.js):

- `POST API/invoices/search` is a bounded read.
- `POST API/reservations/:reservation/folios/:folio/invoice-readiness` requires
  the explicit legal buyer before showing a confirmable invoice.
- `POST API/reservations/:reservation/folios/:folio/invoice-issue` preserves the
  original idempotency key on an uncertain outcome and revalidates server evidence.
- `GET API/invoices/:document` reads immutable issued content; its `/receipt`
  reads delivery status by that document.
- `GET API/fiscal-provider-options` intersects protected configuration with current
  persisted authority. Opening/printing an invoice never requests provider delivery.
- `POST API/fiscal-submissions` requires explicit provider/environment intent.
  The server's `POST API/fiscal-submissions/:submission/retry` is separately
  authorized. Reload-safe retry-only provider binding remains outstanding; no
  inference from provider label/key is permitted.

Hosted providers remain absent/default-off in the current local configuration.
Do not substitute a synthetic acceptance for authentic sandbox onboarding.

## Fixture and runtime readiness

The baseline [review seed](../../scripts/seed-review.ts) grants normal operational
access. A separate second user has the documented post-seal, cashier supervision,
receivable approval, trust approval, dirty-room override and inspection privileges.
Being able to select a layout never changes these roles.

Q209 source now adds the exact five existing fiscal document/submission
permissions to the baseline operator, preserving separate checker authority. Its
separate genuine invoice-ready/issued seed passed independent database/replay/
signed-session proof8/0(79), with baseline seed27/0(117) separately proven. It is
not yet deployed in the retained
founder runtime. Payment/deposit UAT
also needs its separately governed fixture and provider configuration. Therefore
mounting these controls is not evidence that every button works with the current
review credentials. The schema85 preview requires its own explicit synthetic
grants/fixtures and independently executed financial/tenant proof.

The route inventory found that `P/trust` was recognized by the client but not
registered as a server shell GET. The scoped source repair is now implemented:
[its test](../../tests/operator-trust-navigation.test.ts) proves repeated deep
GET/reload returns the same no-cache shell, invokes no domain service, and leaves
the protected trust API on its existing unauthorized path. Focused trust/motion
proof passes3/3(54 assertions); the final root suite passes1839/0. The retained
local77 app has not received this repair yet.

## Partner walkthrough after verified promotion

1. Sign in using the prefilled local-only form; identify source/catalogue in
   Project status and the selected synthetic property.
2. Today → seeded arrival → actual reservation and room evidence → relevant HK
   task and inspection → separate permitted check-in. Do not skip a missing gate.
3. Stay → folio → original statement/window → preview/confirm a permitted action
   → its actual receipt. Use the second user only for explicit checker privileges.
4. Return from a service task to the same guest/reservation context.
5. With the newly proven fiscal fixture: Review invoice → legal buyer → exact
   confirmation → issued document → guest print. Show provider registration as
   unavailable unless authentic sandbox configuration was separately supplied.

Try Calm, Precision and Timeline on that same mounted subject with an unfinished
input. Values, selection, filters, focus and request identity must survive. The
current shell-layout slice is not completion of all Astra identity/department
journeys. Actual per-skin screenshots and measurement belong to its build receipt.

## Explicitly not released by this inventory

The 14-case/16-department staff-workbench study is fictional design evidence, not
16 production modules. Spa, outlet operations, events/groups/BEO, procurement,
distribution/channel management, RMS, standalone CRS/CRM, multilingual voice,
native clients and the distinct full STR portfolio journey are not in this shell.
Existing owner-trust and reservation capabilities do not make those systems
complete. Preserve them in the agreed 18-phase roadmap and future voice handoff.
