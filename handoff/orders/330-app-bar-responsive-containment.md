# Order 330 — App-bar responsive containment

**Status:** COMPLETE-APPROVED-D922
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

- [x] Intentional red reproduces the app-bar/document overflow at640/DSF2.
- [x] Minimal app-bar-scoped CSS produces zero document/body/header overflow at both
      required profiles while preserving controls and focus.
- [x] Focused/standing/static gates pass.
- [x] Fresh non-implementing Tier2 reviewer approves exact source/browser behavior.

## Fresh Tier 2 review — D922

Independent non-implementing Codex reviewer `/root/order330_fresh_tier2` approves
exact application candidate `75f3359`, governance head `124fbc7`, intentional-red
base `70178e6` and runtime base `f11440e`. The reviewer personally reproduced the
25 px 640/DSF2 red, passed corrected focused proof and a fresh 72-cell real-Chrome
full-shell matrix with real scrollbars, zero document/body/app-bar/workspace overflow,
local-only usable Folio rails, retained native controls/labels/brand/session and exact
Separate charges/ARIA/organize/correction identities. Static/source inspection found
only seven app-bar-scoped CSS declarations and no global overflow hiding or
HTML/JavaScript/API/business/data mutation. Port 3000 was not accessed or changed.

## Builder evidence — D921

- Intentional red was0 pass/1 fail/7 assertions:375 stayed document/body/header/
  workspace0 while640/DSF2 reproduced25 px document/body/header overflow and a
  contained workspace. Native controls,labels,brand,session,real scrollbar and local
  Folio rails were present.
- Seven app-bar-scoped responsive declarations wrap its action row at767 px, let both
  native controls shrink with44 px behavior intact, and move the session label onto a
  bounded row. No root/body overflow hiding or HTML/JavaScript change exists.
- Focused proof is31 pass/6 expected database skips/0 fail/325 assertions. Standing
  proof is1145 pass/890 expected database skips/0 fail/17410 assertions across2035
  tests/374 files. Typecheck,boundaries127,licences23,audit0 and diff pass.
- The live local was not changed. Fresh Tier2 browser review of exact candidate
  `75f3359` remains mandatory.
