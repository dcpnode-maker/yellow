# Order 324 — Room-outages label alignment

**Status:** BUILT-PENDING-FRESH-TIER2-REVIEW-D903
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

- [x] Intentional red precedes production.
- [x] All scoped visible labels say Room outages with exact old identities retained.
- [x] Seven journey identities and canonical `/operations` route remain exact.
- [x] Focused, standing and static proof pass.
- [ ] Fresh independent Tier2 browser review approves.

## Builder evidence — D903

- Intentional red was1 pass/1 fail/22 assertions: only the stale visible label failed;
  exact identities, shared router and `/operations` route stayed green.
- Production changes four visible text surfaces plus their specification/assertion;
  no JavaScript, CSS, id, data attribute or behavior changed.
- Focused proof is19 pass/0 fail/278 assertions including real Chromium geometry.
  Standing proof is1142 pass/890 expected database skips/0 fail/17389 assertions
  across2032 tests/371 files.
- Typecheck,127-file boundaries,23-package licence policy,audit0 and diff pass. The
  sole local remains untouched pending independent review.
