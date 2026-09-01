# Order 328 — Loaded Folio responsive containment

**Status:** BUILT-PENDING-FRESH-TIER2-REVIEW-D915
**Phase:** 7 — founder-visible presentation of already-built financial journeys
**Branch:** `phase-7/folio-loaded-responsive-containment`
**Base:** `ec85c5d` (Order327 review-withheld governance head)
**Runtime source base:** `5c37533ae2feebcc59f201d0f53fca2c7671818c`
**Risk tier:** 2 — presentation-only responsive CSS; fresh independent browser review mandatory

## Outcome

Close the real narrow-screen document overflow found by Order327 review while
preserving the already-built loaded-Folio workflow and every financial authority.

## Exact scope

- constrain the loaded-Folio workspace, header, summary and tab rail to the available
  inline size at 375 CSS pixels and 640 CSS pixels with device scale factor 2;
- keep the Folio tab rail locally usable through bounded scrolling or wrapping;
- add an intentional-red browser geometry regression and focused responsive proof;
- preserve exact tab identities, labels, ARIA, routing, keyboard/focus/Back behavior,
  requests, eligibility, organize/correction mechanics and appearances.

## Forbidden

No global overflow hiding; no HTML/JavaScript/API/domain/database/data/financial/
permission/status/authority/post310 change; no second/public local, merge, push or
deployment. Local reflection remains a separate guarded Tier3 order.

## Definition of done

- [x] Intentional red reproduces the narrow-screen document overflow and exercises
      both required viewport profiles.
- [x] Minimal component-scoped CSS produces zero document overflow while retaining a
      usable local tab rail.
- [x] Focused/standing/static gates pass.
- [ ] Fresh non-implementing Tier2 reviewer approves exact source/browser behavior.

## Builder evidence — D915

- Intentional red was0 pass/1 fail/2 assertions and reproduced141 px document plus
  154 px workspace overflow at375 CSS pixels/DSF2 while retaining640/DSF2 as the
  companion profile. The corrected geometry measurement includes the real scrollbar
  gutter and requires local tab-rail usability.
- Component-only CSS gives the workspace and its direct children explicit shrink
  containment, and makes both Folio tab rails bounded local horizontal scrollers.
  No global overflow hiding or HTML/JavaScript/business change exists.
- Focused proof is40 pass/6 expected database skips/0 fail/428 assertions. Standing
  proof is1144 pass/890 expected database skips/0 fail/17406 assertions across2034
  tests/373 files. Typecheck, boundaries127, licences23, audit0 and diff hygiene pass.
- The sole local on port3000 was not changed. Fresh independent Tier2 browser review
  of exact source candidate `f11440e` remains mandatory.
