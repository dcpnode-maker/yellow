# Order 591 — completed checkout retrieval

## Objective

Make a freshly opened, explicit `checkout <guest or confirmation>` request retrieve
the authoritative completed departure when no active departure with that identity
exists, so colleagues can review the verified guided checkout after reload without
re-exposing any checkout action or inventing the departed room.

## Source authority

- Begin from the exact current public serving source at
  `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.
- Work only in a separate isolated candidate. Order 590's visual candidate remains
  frozen and is not an implementation base for this order.
- The complete reservation command index and reservation detail are server reads.
  The completed journey is read-only because the canonical reservation is already
  `checked_out` and its segments are `departed`.

## Scope

- `frontend/yellow/src/voice.ts`
- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/workspaces/ReservationWorkspace.tsx`
- Focused voice/source/browser tests for completed retrieval and active-departure
  precedence.
- `handoff/orders/591-completed-checkout-retrieval.md`
- `handoff/reviews/591-completed-checkout-retrieval.md`
- `handoff/LEDGER.md`

## Required behavior

1. An exact confirmation or uniquely matching name resolves an active `due_out` or
   `in_house` departure exactly as before.
2. Only when no active departure matches that identity may the same explicit
   checkout command resolve one unique `checked_out` reservation from the complete
   server command index.
3. Active departures take precedence over departed history. Multiple active or
   multiple completed identity matches remain unresolved rather than guessed.
4. A completed resolution says it is opening a completed departure review, not
   current checkout readiness.
5. The guided checkout opens directly in its verified Release/completed state and
   exposes no final checkout consent or action for a `checked_out` reservation.
6. The room shown after departure comes only from the authoritative command-index
   row already used to resolve that exact reservation. If that row has no room label,
   the UI continues to say not resolved; no room is inferred from history text.
7. Existing primary-folio, settlement and checkout keys, confirmations, endpoints
   and mutation behavior remain byte-equivalent and out of scope.
8. A fresh actual public-data candidate session retrieving `Rohan Kapoor` /
   `L3R-DO-0013` shows Departed, room 113 and the settled zero-balance folio at 375
   and 1440 px, with no operational write.

## Required proof

- Focused unit tests for active precedence, unique completed fallback, ambiguous
  fail-closed behavior, completed copy, authoritative room propagation and absence
  of a completed checkout control.
- Strict frontend typecheck, Vite production build, package licence audit and actual
  import-boundary CLI.
- Browser proof starts from a fresh session and permits only GET/HEAD/OPTIONS plus
  the existing synthetic demo-session entry; any checkout/folio/financial write
  fails the proof.
- Independent non-implementing review. Although this order is read-only, it touches
  a checkout surface and must prove no state-changing authority widened.

## Exclusions

- No migration, schema, seed, fixture, role, grant, backend, API, database, worker,
  financial, occupancy, checkout-state, provider, container or public deployment
  change.
- No fallback to a partial Today lane, fuzzy merge between guests, inferred room,
  re-checkout, rollback, reopen-stay action or whole-PMS completion claim.
- No Order 590 ribbon/depth change; combined promotion is governed separately.
+

## Implementation checkpoint — 2026-09-22

The isolated implementation candidate is
`D:\Yellow\temp\order591-checkout-history-source`, copied from the exact public
source named above. Public source, database and deployment remain unchanged.

- `voice.ts` resolves live `due_out`/`in_house` departures first. Only when no
  live identity match exists does an explicit checkout command resolve one unique
  `checked_out` row; ambiguous live or completed identities fail closed. Completed
  results carry only the command-index row's room label.
- `App.tsx` says it is opening a completed departure review, passes the completed
  marker and authoritative room label into the journey, and retains the complete
  index as the only source for history fallback.
- `ReservationWorkspace.tsx` opens completed history directly on Release and
  suppresses every folio/checkout mutation control for a checked-out reservation.

Frozen candidate file hashes:

| File | SHA-256 |
|---|---|
| `frontend/yellow/src/voice.ts` | `6c0a76b818e32dc5c829d7978735a0469b72e7a0e612b839c0ba93665166fd47` |
| `frontend/yellow/src/App.tsx` | `c061c8900757bb3bd61247bf645d1c34ceda253fe2ad4a226a8f40bde1dd6056` |
| `frontend/yellow/src/workspaces/ReservationWorkspace.tsx` | `cff36c5892447e0d20a6649411c94274a6ba986ae38db1ba7d0fbabcd88dc78d` |
| `tests/yellow-completed-checkout-retrieval.test.ts` | `27eca932b32b17fc81f98604386b09fce43085fb099c86c41ffc766f4a1392fb` |

Focused proof is 4 passed, 0 failed, 16 assertions. Strict frontend TypeScript,
the 484-module Vite production build, and the 203-file import-boundary scan pass.

Fresh-session browser proof against the isolated port-3012 candidate at 375 and
1440 CSS px resolves `checkout Rohan Kapoor` to `L3R-DO-0013`, opens directly on
Release, shows `Departed` and authoritative room `Two Bedroom Residence 113`,
and exposes no checkout control or confirmation checkbox. Bill review shows
`WINDOW 1 / Primary / SETTLED / SAR 0.00`. Document and body widths remain
viewport-contained, browser error/bad-response sets are empty, and a deny-by-default
network guard records zero writes after the explicitly allowed synthetic
`POST /api/v1/auth/demo:enter`. No deployment is claimed; independent review is
required.

