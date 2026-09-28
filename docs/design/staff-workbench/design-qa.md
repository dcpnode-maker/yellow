# Order442 — profile cards and three workspace skins

Date: 2026-09-06. Scope: three presentation-only production skins and an updated
fictional staff workbench. No operational module, real profile photo or database
change is introduced by the study.

**final result: blocked**

## Findings

- **Blocking evidence gap:** the authorized cloud browser rejected reloading the
  new preview root before it rendered. Its URL-policy rejection explicitly bars
  alternate paths, browser surfaces and indirect workarounds. None was attempted.
  The preview process reports running, but that is not visual proof or a usable
  browser handoff. No new screenshot or combined comparison exists.
- **Resolved P2, source-level:** Precision Desk needed665px inside about636px of
  main space at900px viewport. Its column minima are now260+280+25px. This fixes
  the identified arithmetic; actual851–928px rendering still needs inspection.
- **Resolved P2, source-level:** an older Glass parking-select selector retained
  white-on-translucent-blue styling above a new light card. An explicit selector
  now overrides that rule with dark text, white background and a stronger border.
- **Resolved P2, source-level:** small metric, stage, navigation and footer text
  lacked contrast. The reviewed replacements measure5.27:1,5.84:1,5.42:1 and5.37:1
  respectively against their declared solid backgrounds. Profile IDs were also
  increased from8px to10px and darkened to#24362b. Image-backed text still needs an
  actual rendered minimum-contrast check; sampled assets are not that check.

These are code-review corrections, not fabricated screenshot iterations.

## Source and implementation state

- Source visual truth: [Profile Card by Tran Mau Tri Tam / UI8](https://dribbble.com/shots/26033069-Profile-Card), original
  `https://cdn.dribbble.com/userupload/43340767/file/original-16d08bd1b355d0ba8118a7d3090c5905.png`.
  The coordinator and reference worker opened the3200×2560 image locally at
  `/workspace/scratch/1c0b0b3cfbd2/synthex-reference-research/sophie-source.png`.
- The right card is approximately1120×1912 source pixels. A4× interpretation gives
  a280×478 CSS component, an8px rim and40–44px outer radius. These are measured
  appearance estimates, not original Figma metadata or proven browser DPR.
- The founder expressly changed the brief from exact cloning to an improved
  original design, then clarified that the card is for guest and staff/management
  identities. All three earlier workspace concepts are selected as skins.
- Secondary source: [Synthex by Jack R. / RonDesignLab](https://dribbble.com/shots/27131881-Synthex-UI-Analytics-SaaS-Dashboard).
  Its inspected board confirms Urbanist and a blue/mint palette. The perspective
  dashboard render is not an exact flat-app or hotel-queue reference.
- Candidate: this folder's `index.html`, `workbench.css`, `workbench.js` and fixed
  preview server; production changes are in `src/http/operator/`.
- Intended review state: fictional Harbour House, FO, YC01 before its first action;
  Profiles view with Mira Shah G-20451 and Aditi Rao HH-STAFF-014; business date
 5Sep2026. Compare all three skins at the same state.
- Implementation screenshot path: **unavailable for this revision**. Actual
  viewport, raster size and DPR: **unverified**. Target desktop1348px, phone390px,
  and intermediate900px are requests for the next review, not executed measurements.
- Existing `preview-desktop.jpg` and `preview-phone-layout.jpg` are historical
  Order440 captures from the preceding design. They do not show this revision.
  [The historical QA record](https://github.com/dcpnode-maker/yellow/blob/b5ef70842b658183f7b5b4c650c8e78c7a0b513d/docs/design/staff-workbench/design-qa.md)
  remains in Git with its original limitations.

## Required fidelity surfaces

| Surface | Source/candidate evidence | Outstanding rendered evidence |
|---|---|---|
| Fonts and typography | Self-hosted Urbanist, variable100–900; role/profile titles and operational copy have separate hierarchies | Loaded font, wrapping, small-text clarity, zoom and portrait-text contrast |
| Spacing and layout | Profile target280×478,8px rim,42px radius; three skins retain the same mounted controls | Desktop proportions, intermediate widths, real phone containment, focus visibility |
| Colors and tokens | Muted sage/ivory study, dark ink; light Glass production overrides; reviewed declared-color contrast | Actual compositing, hover/disabled/forced colors and all six appearance interactions |
| Image quality and assets | Two distinct fictional1024×1536 portraits inspected directly; source Phosphor icons and Urbanist notices retained | Real crop, continuous lower surface, profile detail legibility and image loading |
| Copy and content | Original hotel context, unchanged case definitions and owner/evidence gates; profiles are explicitly fictional | In-context reading order and whether density supports a real shift |

## Executed code proof

Independent reviewer executed the actual full workbench script in a DOM test double
without a browser, layout engine or HTTP request. That proof covered YC01's six
steps and independent inspection, YC09's required revision acknowledgements,
YC11's wrong-payer block and exact original attempt/P-8726 finance completion,
three-skin partly checked form preservation, all16 department profile visibility
rules, and phone-toggle/back action state. It does **not** prove browser rendering,
accessibility, focus geometry or device behavior.

Production's actual skin handler and listener are executed by
`tests/operator-workspace-skins.test.ts`: changing presentation preserves field
values, check state, subject, property, request key and the mounted workspace;
invalid values return to Calm. The existing no-storage, no-new-network-asset and
six-appearance contracts remain. The reviewer ran46 focused production checks,
typecheck and171-file boundary scan. The unchanged comparator's two arithmetic
tests also pass; its previously blocked browser page was not retried.

Current application console errors: **not observable**, because the new page did
not render. Historical browser-extension messages are not new-app findings.

## Full-view and focused comparison

Neither a combined whole-view input nor a source/card region comparison is available
for this revision. They are required before visual acceptance. Do not compare the
source to an image-generator portrait alone, use old screenshots, or call the
implementation its own independently selected reference. A changed portrait and
hotel identity are intentional; the reference's layered profile surface is the
component-level target. Whole-app composition is an original adaptation.

## Laptop acceptance checklist

1. Use the authorized laptop session and its own applicable browser policy; preserve
   unrelated work. Follow Order442's exact-source handoff.
2. Render the three skins and both Profiles cards; exercise YC01,YC09,YC11 with the
   wrong-payer branch, search/empty/reset, profile actions and department changes.
3. Partly complete a checklist, switch all skins and verify input/selection/request
   identity remain. Check production's actual app bar, Glass parking selector,
   check-in/HK/finance surfaces and the six appearance families.
4. Capture source and candidate at explicitly recorded dimensions/state. Combine
   the full views and the corresponding profile region; inspect all five fidelity
   surfaces. Check390px,900px, desktop, keyboard,200% zoom, reduced motion and
   forced colors using supported tools.
5. Fix anyP0/P1/P2 finding, repeat the same-state capture and comparison, then update
   this report. Required exact CI/referee11/11 and independent merge still apply.

No pixel-equality, cloud-serving, user-device or release completion claim is made.
