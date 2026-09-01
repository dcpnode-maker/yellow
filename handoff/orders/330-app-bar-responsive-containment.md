# Order 330 — App-bar responsive containment

**Status:** READY-D920
**Phase:** 7 — founder-visible presentation of already-built journeys
**Branch:** `phase-7/app-bar-responsive-containment`
**Base:** `1d89bd9` (Order329 review-withheld governance head)
**Runtime source base:** `f11440e9f0f0fd78dbe4c1a8b9fedc4b09330aee`
**Risk tier:** 2 — presentation-only responsive CSS; fresh independent browser review mandatory

## Outcome

Close the remaining full-shell 640 CSS-pixel/DSF2 overflow without changing any
workflow, control, appearance identity or authority.

## Exact scope

- compact/wrap only the app-bar brand, appearance/detail controls and session label
  before their combined intrinsic width exceeds the available inline size;
- retain every native select, label, brand and session semantic in the DOM and keep
  each control keyboard/touch usable;
- add an intentional-red full-shell browser geometry regression at375 and640/DSF2;
- preserve exact loaded-Folio containment and local tab-rail behavior from Order328.

## Forbidden

No global overflow hiding; no HTML/JavaScript/API/domain/database/data/financial/
permission/status/authority/post310/local change; no merge, push or deployment.

## Definition of done

- [ ] Intentional red reproduces the app-bar/document overflow at640/DSF2.
- [ ] Minimal app-bar-scoped CSS produces zero document/body/header overflow at both
      required profiles while preserving controls and focus.
- [ ] Focused/standing/static gates pass.
- [ ] Fresh non-implementing Tier2 reviewer approves exact source/browser behavior.

