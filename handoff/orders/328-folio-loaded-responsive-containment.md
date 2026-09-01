# Order 328 — Loaded Folio responsive containment

**Status:** READY-D914
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

- [ ] Intentional red reproduces the document overflow at both required viewports.
- [ ] Minimal component-scoped CSS produces zero document overflow while retaining a
      usable local tab rail.
- [ ] Focused/standing/static gates pass.
- [ ] Fresh non-implementing Tier2 reviewer approves exact source/browser behavior.

