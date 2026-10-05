# Order 509 — Yellow direct read-command routing review

## Verdict

**ACCEPT — deployed bounded read-command slice.** This is not acceptance of all
Yellow tools, all PMS workflows, or native Gemini Live audio.

## Automated evidence

- `bun test tests/yellow-voice-routing.test.ts tests/yellow-today-workspace.test.ts tests/yellow-reservation-board-pages.test.ts`
  — 25 passed, 0 failed, 125 expectations.
- `bun run typecheck` — passed.
- `bunx vite build --config frontend/yellow/vite.config.ts` — passed; 469
  modules transformed.
- Deployed bundle: `index-Dg9r2YLD.js`; public route returned HTTP 200 and the
  app container became healthy.

## Hosted browser evidence

On the public Locanda property:

1. Activated Yellow and submitted `Show today's arrivals`.
2. The Today body immediately changed to `Arrivals · Due in (2)` and rendered
   the complete live two-row arrivals grid. No `Open workspace` button or
   second manual action appeared.
3. Submitted `Show guest profiles` from the same command surface.
4. Browser immediately navigated to the governed `/guests` workspace, with
   conversation context restored. No intermediary link was required.
5. Activated Yellow on Guests and visually confirmed the same procedural
   neon-yellow active-state shell, command bar and exit control. The assistant
   no longer loses its visual state outside Today.

## Safety observations

- Local lane resolution precedes generic workspace resolution.
- A uniquely named read opens the reservation directly.
- Model guidance is still converted only through `guidedNavigationPath`'s
  finite allowlist; model prose is not executed as a route.
- Existing check-in, room-assignment and folio confirmation tests remain green.
  This order added no write, database, journal, payment or state-transition
  behaviour.
