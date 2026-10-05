# Review — Order 514 Yellow named checkout preparation

## Result

Accepted for the current public PMS build. The change is navigation-only and
does not expand checkout, financial, occupancy, housekeeping or state-transition
authority.

## Findings and repairs

- The initial implementation recognized checkout wording and preserved cashier
  precedence, but the hosted smoke exposed a duplicate-name edge case: historical
  stays for the same guest made the complete command index ambiguous and the UI
  fell back to the generic departures lane.
- The resolver now restricts a named checkout request to live `due_out` or
  `in_house` candidates before unique-name resolution. A historical
  `checked_out` stay with the same guest name cannot shadow the current departure.
- Explicit folio or billing wording still wins and opens cashiering.
- Named checkout opens the existing reservation detail only. It does not call
  the checkout endpoint.

## Executed proof

From the canonical runtime source:

```text
bun test tests/yellow-voice-routing.test.ts tests/yellow-next-finance-workspace.test.ts tests/yellow-today-workspace.test.ts tests/yellow-reservation-board-pages.test.ts
29 pass, 0 fail, 172 expectations

bun run typecheck
pass

bunx vite build --config frontend/yellow/vite.config.ts
469 modules transformed; production build passed
CSS index-BDTnPOOf.css
JS index-Cf9yNN5_.js
```

The `yellow-public-demo` app image was rebuilt and its container reported
`healthy`. The public page returned HTTP 200 with `index-Cf9yNN5_.js`.

## Hosted browser proof

Public property:

`https://apps-assessing-appreciated-malpractice.trycloudflare.com/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today`

Command: `Prepare checkout for Ella Clarke`

Observed result:

- navigated directly to reservation `L3R-DO-0014`;
- guest `Ella Clarke`, status `due out`, assigned Room `114`;
- displayed `DEPARTURE READINESS` and blocker `folio window missing`;
- named confirmation checkbox remained disabled;
- `Check out guest` remained disabled;
- conversation stated that every blocker would be shown before any change.

No operational or financial mutation was made during proof.
