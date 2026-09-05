# Order440 staff workbench — design QA evidence

Date: 2026-09-05. Scope: fictional department interaction study and offline visual
comparison support. This is not an operational app release or a pixel-match receipt.

**final result: blocked**

## Visual source and implementation

- Source visual truth path: **unavailable**. The existing Yellow operator code and
  CSS are the design-language input, but there is no independently selected screenshot
  or mockup for the new department workbench in this repository.
- An attempted inert source-reference page was denied by browser URL policy. It was
  not retried through another path or browser. The unused preview route was removed.
  Product Design's design-qa gate requires an accessible visual source and rendered
  implementation together; source code alone cannot satisfy that comparison.
- Implementation: `index.html`, served by `preview.mjs`; captured in the authorized
  cloud browser. [Desktop capture](preview-desktop.jpg) and
  [phone-layout capture](preview-phone-layout.jpg) are actual browser screenshots.
- Both captures are1348×926 raster pixels. Desktop app width measured1348 CSS px.
  The phone study is a390 CSS px container inside that desktop viewport, with388 px
  client/scroll width and no horizontal overflow. It is a layout simulation, not a
  physical-device capture or a cropped393×852 device screenshot.
- Source pixel size, source viewport, source DPR and source font rasterization:
  unavailable. Implementation density was not independently normalized against a
  reference; no exact image-diff result is claimed. JPEG captures document observed
  behavior; use lossless matched PNG inputs for future strict pixel comparison.
- State: light appearance, fictional Harbour House, FO queue, YC-01 before action,
  sample business date5 September2026,13:40 IST. Desktop and phone retain the same
  fixture. No real guest, credential or hotel database appears in these captures.

## Functional findings and corrected iterations

1. **Resolved P1 — outlet account identity was too easy to assert.** The first review
   found that a checkbox could claim exact-payer reconciliation without inspecting
   a concrete target. The revised YC-11 shows original attemptPOS-1842-A, check1842,
   INR2450 and recorded guest folioF-412-M. Selecting company folioF-412-R leaves the
   action blocked even when all checkboxes are checked. Selecting the recorded
   Mira account permits review. Finance then sees accepted receiptP-8726 tied to the
   exact original attempt. The independent reviewer personally repeated wrong-payer,
   correct-payer and finance completion states and passed the revised behavior.
2. **FO→HK→inspection→FO flow passed.** Root personally completed all six YC-01 steps.
   Both prerequisite checks block the first action until confirmed. HK acknowledges;
   attendant marks cleaning complete; inspection remains required; supervisor
   records inspection; FO acknowledges and completes arrival review. Six distinct
   fictional receipts remain visible. The simulation never checks in a real guest.
3. **BEO and department handoffs passed independent review.** Revised version4 needs
   acknowledgements from all three affected departments; an unchanged service does
   not silently get a fresh acknowledgement requirement. Department transitions,
   history, case navigation and reset remain functional.
4. **Phone/keyboard checks passed for the exercised states.** The390 px layout has
   no horizontal overflow; a focused task offers a back-to-queue control. Search,
   queue filters, department selection, native checkboxes and labelled buttons are
   operable. This is scoped interaction evidence, not a complete WCAG conformance
   audit or physical-device matrix.
5. **Console review:** root observed browser-extension metadata errors originating
   in a `chrome-extension://` content script, with no application error in the
   captured results. Independent reviewer reported no application warnings/errors
   in its fresh tab. Browser-extension failures are not counted as app fixes.

## Required fidelity surfaces

| Surface | Observed implementation | Comparison result |
|---|---|---|
| Fonts and typography | Existing system-font direction, clear heading/body/control hierarchy in the saved renders | Source image and its loaded font are missing; exact family/rasterization/wrapping match unverified |
| Spacing and layout | Desktop department rail, queue/detail layout and390 px phone study inspected | No same-state visual reference; numerical spacing fidelity unverified |
| Colors and tokens | Existing Yellow paper/ink/blue-action/yellow-brand direction | Source image color samples unavailable; no pixel-equality claim |
| Image and asset fidelity | No product imagery or third-party brand assets substituted in this original study | No selected source artwork to compare |
| Copy and content | Fictional guest promise, owner, evidence, acknowledgement and receipt states were read in browser | New research-driven content; a login screen is not a matching queue-content reference |

## Full-view and focused-region comparison

Implementation evidence is saved above. A combined source/implementation view does
not exist because the source visual is missing. Consequently no full-view comparison,
focused-region comparison or accepted visual deviation is invented. The functional
YC-11 repair above is a real interaction iteration, not a substitute for that gate.

## Completion path

The founder requested handing local-only work to the running laptop Codex session.
[Order440's laptop handoff](../../../handoff/orders/440-hotel-journeys-and-schema-guide.md#laptop-session-handoff--visual-reference-and-measured-fidelity)
records the exact task and its dispatch status. Once connected, that session can
use an independently authorized local app capture or selected design export.
The offline `compare.html` tool accepts those two screenshots without any URL access,
upload or automatic resizing. Its numeric unit checks establish the comparison
arithmetic only, not the fidelity of this workbench. Its two numeric tests passed
(known2×2 RGB/alpha differences and dimension rejection). The independent reviewer
also attempted the comparator page once; cloud browser policy blocked navigation
before load. No alternate-route retry was made. File selection, decode and overlay
interaction in the comparator therefore still require an authorized local-browser
check; static checks and numeric tests are not relabeled as browser proof.

Required next evidence: identified/selected source, matched viewport/state/DPR/font,
lossless source and implementation images, combined full-view and region review,
measured difference count, concrete fixes and repeat captures. Keep this result
blocked until that evidence exists. Existing functional research and Git integration
may be reviewed with this explicit visual limitation.
