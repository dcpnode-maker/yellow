# Review 590 — shared ribbon depth system

**Reviewer:** `/root/order590_review` (independent; did not implement Order 590)  
**Date:** 2026-09-22  
**Candidate:** `D:\Yellow\temp\order590-ribbon-source`  
**Verdict:** **APPROVED for the bounded Order 590 source/UI scope.** The corrected freeze fixes the prior 240 px keyboard-reveal defect, retains the approved Today and Checkout treatments, and introduces no authority, data, or public-release change.

## Independence, source lock, and scope

I read `PROJECT.md`, `AGENTS.md`, `BUILD-PLAN.md`, Order 590, Orders/Reviews 585–588, and the prior retained review. I did not edit candidate implementation, public source, image, containers, data, or configuration. `state.sh` cannot execute on this Windows host because its Bash launcher has no installed `/bin/bash`; I ran the read-only Windows `state.ps1` equivalent.

I personally re-hashed the corrected freeze. Every ordered hash matches:

| File | SHA-256 |
|---|---|
| `frontend/yellow/src/ui/SegmentedRibbon.tsx` | `28fd36b2e8860b1367be34935aecb7a552e83ffc4daf1c67915845a364781551` |
| `frontend/yellow/src/workspaces/OperationalHub.tsx` | `7ae9670667ed9470bccb70dcac4f141d46e7b05e61eb57eb4c5edf75bae25cd9` |
| `frontend/yellow/src/workspaces/EcosystemHub.tsx` | `2839758312b45d7dfd3051f5deec095d2cef2c72c90d521b880ae5e03d544105` |
| `frontend/yellow/src/workspaces/MarketIntelligenceLab.tsx` | `c0071274ca8029e435ebb45ca2d2f12be595644707bcd772bc58b2d13ef1e503` |
| `frontend/yellow/src/styles.css` | `dc0f7e95aea033c079279855c28fba3a70f993f973fcafd44a11d4741416cca4` |
| `tests/yellow-shared-ribbon-depth.test.ts` | `92034bb802dc2a32cc1b1a73b83bb0b80eb4130657d4bf59a98db9c1cc21b0f0` |

`package.json` and `bun.lock` remain byte-identical to the serving source. Checkout source is unchanged: candidate/serving hashes match for `App.tsx`, `ReservationWorkspace.tsx`, and `yellow-api.tsx`. The candidate's generated `public/yellow-next` assets are isolated build output bind-mounted only into the port-3011 review container; the public serving source and distinct port-3010 app remain untouched.

## Corrected keyboard proof

I used the corrected candidate at `http://127.0.0.1:3011` in actual Chromium. For Operations and Ecosystem at each 240, 375, and 1440 CSS-pixel viewport, I focused the selected first tab and pressed `ArrowRight`; I then measured the selected tab against the actual `.segmented-ribbon-scroll` viewport after the smooth reveal settled.

| Surface | Width | Selected tab fully within scroll viewport | Scroll position |
|---|---:|---|---:|
| Operations | 240 | `48.64–191.44` within `22–218` | 123 |
| Operations | 375 | yes | 213 |
| Operations | 1440 | yes | 0 |
| Ecosystem | 240 | `50.30–192.64` within `22–218` | 174 |
| Ecosystem | 375 | yes | 242 |
| Ecosystem | 1440 | yes | 35 |

The new explicit scroller ref/reveal path centers the selected keyboard target, and the mobile rail no longer relies on negative outer gutters. This resolves the prior review's deterministic clipped-tab failure. Today, Operations, and Ecosystem all had exact document/body containment at 240/375/1440, one selected control, usable 44 px-or-larger targets, and the expected neutral rail plus white selected capsule with yellow edge. The visual treatment remains consistent with the approved Order-585/586 Today and Order-587/588 Checkout ribbon language; it is not a status-colour LED treatment.

## Accessibility and boundaries

- Layering is opt-in (`layered = false` by default); Operations, Ecosystem, and the Yellow-Devices-only Market Lab opt in. Layered mode has exactly two `aria-hidden="true"`, pointer-inert backing nodes, behind the tab rail.
- Actual forced-colours and emulated reduced-transparency hide both depth nodes; reduced-motion produces `transition-duration: 0s` and no depth transform.
- Browser console/page error, failed-request, and bad-response sets were empty in the paced final run. The only non-read request was the existing automatic `POST /api/v1/auth/demo:enter`; no operational or financial command was sent.
- I captured independent repeatable-read/read-only fingerprints over all 129 public tables immediately before and after a guarded render. Both aggregate to `812cf83dd5d0c68204c2d0b33bede74070edecd174918710bd66f767dfa16fbc`; `tables=129`, `equal=true`.

## Commands personally executed

```text
Get-FileHash <all frozen files> -Algorithm SHA256
bun test tests/yellow-shared-ribbon-depth.test.ts
  6 pass, 0 fail, 30 assertions
bunx tsc -p frontend/yellow/tsconfig.json --noEmit
  exit 0
bunx vite build --config frontend/yellow/vite.config.ts --outDir D:/Yellow/temp/order590-independent-build-r2
  exit 0; 484 modules
bun run boundaries
  Import boundaries OK: 203 TypeScript files scanned
actual Chromium keyboard/responsive/fallback checks at 240/375/1440
repeatable-read/read-only 129-table fingerprint before/after guarded render
```

`bun run license-check` still exits 1 for the pre-existing installed `tslib@2.8.1` `0BSD` policy rejection. No dependency or lockfile changed in this order, so it is an inherited repository release gate, not an Order 590 regression.

## Approval boundary

This accepts only the isolated shared-ribbon UI/source change. It does not authorize public deployment, merge, schema/API/backend work, Market Lab activation, checkout state change, or any operational or financial action.
