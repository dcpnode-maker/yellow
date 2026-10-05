# Review 587 — guided Yellow checkout

**Reviewer:** `/root/order587_review` (independent; did not implement Order 587)  
**Date:** 2026-09-22  
**Candidate:** `D:\Yellow\temp\order587-guided-checkout-source`  
**Verdict:** **APPROVED for the bounded Order 587 source/UI scope; no high-risk finding.** This is not public-deployment, merge, database-write, or whole-application approval.

## Scope and authority result

I read `PROJECT.md`, `AGENTS.md`, `BUILD-PLAN.md`, the relevant checkout/folio
decisions, and `handoff/orders/587-guided-yellow-checkout.md`. `./state.sh` could not
execute because this host has neither WSL nor an available Bash binary; I performed
the equivalent read-only Git/order/service checks in PowerShell. The canonical tree
was already dirty (273 status entries) on branch
`phase-0/founder-context-demo-readiness` at `a043bb29`; I did not modify candidate
implementation.

The source delta against the exact serving source is confined to the four ordered
frontend files, plus the focused test:

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/yellow-api.tsx`
- `frontend/yellow/src/workspaces/ReservationWorkspace.tsx`
- `frontend/yellow/src/styles.css`
- `tests/yellow-guided-checkout.test.ts`

`package.json` and `bun.lock` hashes match the serving source exactly. There is no
backend, migration, schema, grant, role, payment, journal, posting, tax, fiscal,
cashier, OTA, worker, or dependency authority change.

## Personal source inspection

- Named checkout routes to the lazy `OverwatchCheckoutJourney`; it does not invoke a
  mutation while resolving or rendering.
- Reservation detail and checkout readiness are no-cache/refetch-on-mount reads.
  Every folio gets its own authoritative statement read.
- Opening a missing primary folio, settling one zero-balance open folio, and final
  checkout each have distinct checkboxes and distinct guarded click handlers.
- Folio opening rereads reservation/readiness. Settlement rereads reservation,
  readiness, and the exact statement. Checkout rereads reservation/readiness plus
  every current folio statement before the command, then rereads reservation and
  requires `checked_out` plus all segments `departed` before success copy.
- Primary-folio, per-folio settlement, and checkout operation keys live in refs.
  Network/5xx uncertainty does not regenerate them; reconciliation reads run before
  a retry is offered.
- Settlement is exposed only for `open` and exact zero balance. A non-zero folio
  renders exact minor-unit-derived money and routes to Finance; it cannot be
  synthetically balanced from this journey.
- Damage inspection, missing items, and minibar are explicitly `Not recorded`.
  Luggage/pickup is rendered only from persisted travel facts, and the copy states
  that no task or escalation contract is invented here.
- AI speech remains outside the journey. The journey has no mount/effect mutation and
  no automatic checkout/settlement/folio action.

## Commands personally executed

From the frozen candidate unless otherwise stated:

```text
bun test tests/yellow-guided-checkout.test.ts
  6 pass, 0 fail, 48 assertions

bunx tsc -p frontend/yellow/tsconfig.json --noEmit
  exit 0

bunx vite build --config frontend/yellow/vite.config.ts
  exit 0; 484 modules; entry 190.95 kB, reservation chunk 104.23 kB

bun test tests/operator-checkout-workbench.integration.test.ts \
  tests/operator-folio-workbench.integration.test.ts \
  tests/financial-folio-settlement.intentional-red.test.ts
  27 pass, 6 explicit DB-environment skips, 0 fail, 268 assertions

bun run boundaries
  203 TypeScript files scanned; pass
```

The four known route-split-era static failures were rerun in both the current serving
source and the candidate. Both produced the same exact result: 46 pass, 4 fail. The
failures are stale monolithic-`App.tsx` string-location expectations in cashier,
checkout confirmation, reservation board, and voice-routing tests; Order 587 neither
introduced nor widened them.

`bun run license-check` reached the audit but reported the repository's installed
`tslib@2.8.1` as rejected `0BSD`. No dependency or lockfile changed in Order 587
(`package.json` and `bun.lock` SHA-256 are byte-identical to the serving source), so
this is recorded as an inherited environment/policy gate rather than Order 587
authority. It must still be resolved or explicitly governed before a PR/release that
requires an all-green global licence gate. The mandatory fresh `./setup.sh --db-only`
PR referee was not runnable on this host because Bash/WSL is absent; Order 587 changes
no database code, and this approval does not waive that pre-PR gate.

## Personal browser and visual proof

I ran the candidate at `http://127.0.0.1:3011` with installed Chrome/Playwright and
opened two real synthetic stays through an explicit `checkout <guest>` request:

- Ella Clarke: one non-zero folio; exact `SAR 1.00` itemized line and Finance route.
- Rohan Kapoor: missing folio; separate unchecked confirmation and disabled opening
  action.

Observed network writes during both render-only journeys:

```text
POST /api/v1/auth/demo:enter
```

There was no folio, settlement, checkout, or other operational write. There were no
failed requests or HTTP >=400 responses. Chrome alone requested missing
`/favicon.ico`; it is unrelated to the journey.

Measured reflow:

| CSS width | document scroll width | body scroll width | tabs | selected | depth cards |
|---:|---:|---:|---:|---:|---:|
| 1440 | 1440 | 1424 | 5 | 1 | 2 |
| 375 | 375 | 359 | 5 | 1 | 2 |
| 240 | 240 | 224 | 5 | 1 | 2 |

I personally viewed the accepted reference and all four rendered screenshots. The
fidelity ledger is:

1. one quiet gray rounded ribbon base is retained;
2. the selected segment is a white sliding pill;
3. the requested thin yellow border and restrained yellow edge glow distinguish the
   selected tab without LED-bulb decoration;
4. exactly two low-contrast cards sit behind the ribbon/work region, both
   `aria-hidden` and pointer-inert;
5. the primary work panel remains white, spacious, and legible despite dense hotel
   facts;
6. mobile uses horizontal ribbon reveal so the selected tab and confirmation remain
   accessible without document overflow;
7. the fixed Yellow-active banner occupies its normal top band at 240 px, while the
   bill confirmation and action remain reachable and unclipped below it.

Screens inspected:

- `D:\Yellow\temp\order587-checkout-1440.png`
- `D:\Yellow\temp\order587-checkout-375.png`
- `D:\Yellow\temp\order587-checkout-240.png`
- `D:\Yellow\temp\order587-checkout-nonzero-375.png`

## Frozen source hashes

```text
App.tsx                         e1ec1ed6029cfd2390c09dc062f4159a2f103ce2ff9a3abe7427eea3ecf8157d
yellow-api.tsx                  8b2ce9e44f669fe076a634c0473ec25a321896c6439b8f935a5e729546db2aad
ReservationWorkspace.tsx       674338e6c0986528fd9a43902d5a3f1a3e1991543c0e3aa806ae540ffea17f8a
styles.css                      7801611d096cdb70c59c998375ec41c9743f371bc6356c3980e4c1c835bd7f3c
yellow-guided-checkout.test.ts  de24bce61e09e623f0d1b3272029fbde7b48807f3f85a70c626103e8db761caa
```

## Findings

No Order 587 high-risk finding. The candidate preserves server authority, separate
human confirmation, retained retry identity, truthful physical-operation evidence,
and the ordered visual constraints. Public promotion remains a separate order and
must not imply that checkout, settlement, luggage, minibar, damage inspection, or
housekeeping escalation occurred merely because this UI rendered.
