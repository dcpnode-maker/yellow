# Staff workbench: interaction and implementation contract

**Order440 · 2026-09-05 · Design prototype, not a released operational module.**

The [interactive study](staff-workbench/index.html) translates the
[staff journeys](STAFF-JOURNEYS.md), [casebook](HOTEL-CASEBOOK.md) and
[independent findings](../research/HOTEL-OPERATIONS-REVIEW.md) into a concrete review
surface. It lives inside the existing Yellow repository and extends the existing
operator's Apple appearance. It does not replace the current main app or introduce a
second backend. The six product appearance families and STR workspace destination
remain required.

## Information hierarchy

1. **Property and time:** property, local date/time and business date are explicit.
2. **Department and work:** what needs this team, what is with another team, and what
   was completed. Counts and queues use the same scope.
3. **Queue:** guest impact, next update, subject and current owner. Search/filter does
   not discard the selected context if it remains in the result.
4. **Task context:** exact guest/room/event/check reference, current evidence and the
   next useful action. Reveal details and history in context.
5. **Acknowledgement and receipt:** show the receiving team, accepted version, actor,
   outcome and successor owner. Sending is not acceptance.

The prototype uses 16 department views, 14 interactive fictional scenarios and eight
guest-lifecycle stages. The written casebook has 16 cases: YC-07 midnight rollover and
YC-12 sealed-day correction are specified for future live domain testing, not
independently executable prototype cases. YC-16 introduces their related close
concepts without claiming to seal or correct a real business day.

## Desktop and phone

Desktop keeps the queue and selected context side by side. Phone presents the queue,
then one focused task with an explicit Back action that restores selection and focus.
The department control is a compact select on narrow screens. The study's Phone
layout control deliberately constrains the rendered app to 390 CSS pixels for review;
it is not native-client evidence or a device-emulator performance claim.

The interface uses existing Yellow semantic colours and Apple token values: solid
white work surfaces, `#f5f5f7` background, `#1d1d1f` text, blue governed-action styling,
restrained yellow brand identity and readable status text. No new artwork, tracking,
third-party scripts, fonts, runtime dependencies or remote data calls are required.
Typography and density may differ by device; permissions and meaning must not.

## Complete prototype interaction: YC-01

| Step | Design role | Action | Result and remaining boundary |
|---|---|---|---|
| 1 | FO | Review update promise and room; request preparation | HK owns an unacknowledged handoff; room remains unready |
| 2 | HK | Accept the handoff | Accepted owner is visible to FO |
| 3 | Room attendant | Record cleaning completion | Inspection remains required by the fictional property policy |
| 4 | HK supervisor | Pass inspection | Inspection evidence goes to FO; no check-in has occurred |
| 5 | FO | Acknowledge room-ready evidence | Arrival review still requires current guest/room and prerequisite checks |
| 6 | FO | Complete arrival review | Simulation receipt only; production must revalidate and execute its command |

The design department selector is an exploration tool, not login or production
authorization. The study displays attendant/supervisor roles in action context;
the live implementation must separately enforce their actual permissions. Its
checklist records review steps, not verified identity, payment or room facts.

## Other prototype interactions

- Department switching preserves a selected relevant case and adjusts queue counts.
- Search matches the department-visible subject, context, title and case reference.
- Filters separate this team's work, other teams' work and completed reviews.
- Each scenario follows an explicit owner sequence; the wrong department gets a
  receiving-team navigation action instead of a completion control.
- The BEO example requires three affected departments to acknowledge v4 independently;
  prior acceptance is described as historical evidence, with unchanged AV retained.
- Primary actions require the displayed review checks. Each produces a visible
  in-memory receipt and next owner. A completed case remains inspectable.
- Guest journey and casebook navigation open a related scenario at its current owner.
- `/` focuses search outside inputs; Escape returns from narrow detail; native dialog
  behavior handles the design notes. Labels, focus outlines and a polite live region
  carry meaning beyond colour. Reduced-motion and forced-colour styles are included.
- Reset clears only fictional in-memory scenario progress. Reload also resets it;
  the URL preserves department/view/case navigation but never a guest transaction.

## Production mapping and capability truth

| Proposed surface | Reuse | Remaining work |
|---|---|---|
| Arrival queue/context | `src/contexts/reservations/arrival-roll.ts`, `detail.ts`; `src/http/operator/` | Scoped query composition, field minimization and task-context navigation |
| HK preparation/room facts | `src/contexts/housekeeping/arrival-cleaning.ts`, `tasks.ts`, existing condition/discrepancy operations | Exact acknowledgement semantics and inspector permission mapping; no invented state transition |
| Arrival/departure decision | `src/contexts/stay-operations/` readiness, check-in and checkout surfaces | Fresh command-time revalidation, source version and complete two-role browser proof |
| Financial exceptions | `src/contexts/financials/` cashiers, folios, posting, reversal and approval paths | Exact source-to-target workflow and provider acknowledgement; prototype never posts money |
| Groups/events | Existing group primitives, Phase11 and Phase17 plan | Blocks/pickup completion, function-resource lifecycle, BEO version/acknowledgement and actualization |
| Outlet/spa/stores | Phase17 contracts and existing financial/occupancy boundaries | Specialist model, integrations, scoped roles, receipts and full acceptance |
| Shift overview | Existing kernel task/fact/outbox and business-day work | Minimal projections, delivered/accepted/blocked distinction, escalation and retention policy |

Verify each source path and contract while writing the implementing order. A located
module is a foundation, not proof of this complete end-to-end surface. New event,
table, grant or state-transition work needs its own admitted scope and required
independent executable review.

## Domain command boundary

Every implementation order must name its existing or newly admitted command/query,
actor/property/tenant scope, purpose-limited returned fields, current-source version,
idempotency key, exact allowed transition, approval policy and durable receipt.
Critical writes run through the owning domain transaction, with audit and outbox in
that transaction. UI, voice, AI and integrations use the same boundary.

Do not copy prototype state into production as an authorization mechanism. Do not
store guest data or tokens in localStorage. Do not treat source-code fixtures,
checkboxes, CSS-hidden fields or the receiving-team selector as server evidence.
Occupancy, money, legal invoice issuance and access credentials remain independent
governed commands. “Resolved” and “guest follow-up complete” are separate outcomes.

## Required states for the live slice

| State | User-visible treatment | Acceptance |
|---|---|---|
| Loading | Preserve context; mark stale counts unavailable | No invented zeros or enabled write based on old data |
| Empty | Explain the active scope; allow filter recovery | A zero result is distinct from failed fetch |
| Stale / conflict | Show what changed and require fresh decision | Old inspection/BEO/reservation version cannot authorize a write |
| Permission denied | State the unavailable action and permitted handoff | No hidden data or capability leak; tenant/role failures tested |
| Delivery pending | Distinguish queued, delivered and acknowledged | Retry/deduplication produces one recipient work item |
| Unknown command outcome | Keep original request identity; provide reconciliation | No blind second booking, posting or key issuance |
| Blocked / overdue | Name blocker, owner and next update | No automatic closure or silent override |
| Success | Show durable receipt and exact next owner | Read-back agrees with actual committed state |
| Draft exit | Retain or explicitly discard safe draft | Focus/navigation continuity and no accidental submission |

These live failure states are specification requirements. The in-memory study models
owned sequencing, checklist gating, case completion, empty filtering and role-view
handoffs. It does not simulate authenticated transport, real concurrency, offline
synchronization, payment/fiscal authority or complete failure recovery.

## Run and review

Open `docs/design/staff-workbench/index.html` from a local checkout, or run:

```bash
cd docs/design/staff-workbench
node preview.mjs
```

The preview binds loopback port4173 by default and serves only allowlisted prototype
files. It does not serve the repository, credentials or an operator-login proxy.
`npm run dev -- --host 0.0.0.0 --port 4173 --strictPort` supports the managed
preview environment; it is not a production deployment recipe. No installation or
database is required. The main hotel app retains its existing
[local launcher](../RELEASE.md), real PostgreSQL, login and release gates.

Read [prototype QA](staff-workbench/design-qa.md) for what was actually exercised.
Before production acceptance, execute the casebook against real authenticated roles,
the canonical schema and relevant domain commands; then preserve CI/referee and
independent review evidence. A prototype review is not a waiver of those gates.


## Measured visual fidelity and laptop continuation

The prototype has no independently selected source screenshot for a full pixel
comparison. Its [QA record](staff-workbench/design-qa.md) preserves actual functional
and layout evidence with a blocked visual-source result. A screenshot of the
implementation is not its own approved source. The founder requested local-session
continuation; the exact [laptop handoff](../../handoff/orders/440-hotel-journeys-and-schema-guide.md#laptop-session-handoff--visual-reference-and-measured-fidelity)
is part of the same order, with receipt/execution status recorded separately.

Open `staff-workbench/compare.html` locally for offline screenshot comparison. Select
an independently chosen source image and a rendered implementation capture at the
same state, viewport, density, font and browser configuration. Equal image dimensions
are required; there is no automatic crop, resize, ignored region or tolerance. The
page shows side-by-side images, an adjustable overlay, highlighted changed pixels and
an exact difference count. Inputs stay in the browser. Identical decoded pixels
prove equality of the supplied images, not reference approval, real-device coverage,
accessibility or correct operational behavior. Prefer lossless PNG captures.
