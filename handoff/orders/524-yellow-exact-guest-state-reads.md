# Order 524 — Yellow exact guest-state reads

## Objective

Make Yellow distinguish completed check-ins today, continuing stayovers and
completed check-outs today from planned due-in/due-out lanes in local text and
voice reads.

## Scope

- `frontend/yellow/src/voice.ts`
- `frontend/yellow/src/App.tsx`
- `tests/yellow-voice-routing.test.ts`
- focused frontend verification and public browser proof
- `handoff/reviews/524-yellow-exact-guest-state-reads.md`

## Required behaviour

1. Exact completed-event wording resolves before broader arrival, in-house or
   departure wording.
2. Yellow filters only the existing server-provided `operationalState`; it does
   not infer completed events from stay dates or stored reservation status.
3. Results render in the existing inline movement workbench and do not navigate.
4. Zero-result states remain truthful and usable.

## Exclusions

- No reservation, check-in, checkout, occupancy, fact, database, API or schema
  changes.
- No synthetic completion event or state mutation.

## Verification

- Intentional failing focused tests before implementation.
- Focused routing/frontend tests, strict TypeScript and production build.
- Public exact-state command proof and phone geometry proof.

