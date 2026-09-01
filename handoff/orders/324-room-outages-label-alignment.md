# Order 324 — Room-outages label alignment

**Status:** READY-D902
**Phase:** 7 — founder-visible presentation of already-built room-state journeys
**Branch:** `phase-7/room-outages-label-alignment`
**Base:** `a01e4c2` (independently approved Order323 governance/local head)
**Risk tier:** 2 — presentation/navigation label; fresh independent browser review required

## Outcome

Replace the vague visible destination label **Operations** with **Room outages** on
the existing OOO/OOS workspace surfaces so users can distinguish it from the broader
Stay operations journey. Preserve the exact `operations` identity, route, router,
permissions, controls and server-governed behavior.

## Exact scope

- update the Simple secondary-workspace preview from Operations to Room outages;
- update only the visible `nav-operations` span and management-journey action label;
- fine-tune the Stay operations description to end with `room outages`;
- align `docs/UI-SPEC.md` and exact presentation assertions;
- preserve every id, data attribute, route, handler, request, action, permission,
  appearance and responsive behavior.

## Forbidden

No JS/CSS, new control/route/request/API/domain/service/database/schema/migration/
seed/data, credential/permission/status/review/phase/business authority, second/public
local, post310 work, merge, push or deployment. Local reflection is a separate order.

## Definition of done

- [ ] Intentional red precedes production.
- [ ] All scoped visible labels say Room outages with exact old identities retained.
- [ ] Seven journey identities and canonical `/operations` route remain exact.
- [ ] Focused, standing and static proof pass.
- [ ] Fresh independent Tier2 browser review approves.
