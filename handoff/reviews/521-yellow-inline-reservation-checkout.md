# Order 521 — Yellow inline reservation and checkout review

## Verdict

**ACCEPT — bounded inline reservation/departure flow published.** This review
covers rendering the existing governed reservation workspace inside Yellow. It
does not accept checkout generally or claim that the current scenario has a
checkout-ready folio.

## Implemented

- Unique named reservation reads remain inside Yellow and render the existing
  complete reservation workspace.
- Unique named checkout preparation remains inside Yellow and renders current
  server-owned departure readiness, room, folios, blockers and the existing
  separate confirmation controls.
- The request itself performs no checkout and no other write.
- Existing readiness, unchecked confirmation and disabled-button gates are
  unchanged.
- Inline back-navigation is hidden so the embedded view does not unexpectedly
  leave Yellow; the surrounding AI-mode exit remains available.

## Executed proof

- `bun test tests/yellow-voice-routing.test.ts tests/yellow-ambient-ai-mode.test.ts tests/operator-today-command-centre.integration.test.ts`
  — **37 passed, 0 failed, 325 assertions**.
- `bun run typecheck` — passed.
- `bunx vite build --config frontend/yellow/vite.config.ts` — passed; 469
  modules transformed.
- Published assets: `index-izkmvZn3.js`, `index-vf6ZwBNz.css`.
- App-only Docker rebuild completed; app health became `healthy` and public
  property route returned HTTP 200.
- Public command `Prepare checkout for Ella Clarke` kept the URL unchanged and
  rendered reservation `L3R-DO-0014`, status due out, room `114`, zero folio
  windows, blocker `folio window missing`, unchecked disabled confirmation and
  disabled `Check out guest` control.
- Live 375×812 geometry: inner/document width `375`, body width `359`; inline
  reservation viewport `453` high with `973` reachable scroll height. Checkout
  computed disabled `true`.

## Limits

- The current Locanda scenario departure cannot be checked out because its
  folio window is missing. This order truthfully exposes that blocker; it does
  not manufacture financial data.
- No commit path was exercised and no state changed.
- The quick tunnel remains temporary and laptop-dependent.
