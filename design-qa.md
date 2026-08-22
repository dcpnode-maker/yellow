# Order 071 design QA — universal rate-plan workbench

Date: 2026-08-22  
Reference: founder-supplied “Universal rate plan flow” screenshot  
Implementation: `http://localhost:3200/p/4518a22f-b455-54c6-a50a-4584383749b9/rates`

## Comparison result

The reference and final implementation were inspected together in one side-by-side comparison. The
implementation retains the reference's five stages—Create rate, Pricing, Who gets it, Where/when and
Review—inside Yellow's existing Apple-calm/Pixel-expressive design system. The reference's “God
mode” is named Expert in the product, with the same intent but clearer operator language.

Coverage is visible and progressive rather than presented as one dense table:

- all ten server-catalogued models render as selectable cards;
- company, market group, market, source, channel, segment, agent and campaign are explicit;
- property, class, room type and exact sellable scope are explicit, including exclude exceptions;
- dates, DOW, booking window, LOS, occupancy, guests, cancellation/deposit/guarantee/no-show,
  refund treatment, package/meal, promotion and distribution controls are present;
- CTA/CTD, closed-to-sale and minimum/maximum stay/advance remain visibly linked to the authoritative
  Restrictions workspace;
- deterministic `sellable > type > class > property` precedence and equal-rank publication blocking
  are stated before publication;
- bulk preview, four-eyes approval, immutable history, versioned undo and the published live-quote
  evidence path are visible in Review.

## Executed browser evidence

- Authenticated with the local review account and created four realistic reusable policies plus one
  `FLEX` USD plan through the rendered workbench.
- Counted 5 navigable builder steps and 10 server-returned model choices.
- Exercised Simple fixed, Calendar, RMS/API and Expert composition progressive controls.
- Switched Guided → Expert, opened the complete typed command and confirmed the emitted JSON carried
  `authoringMode: "expert"`; the pure compiler proof covers semantic Guided/Expert parity.
- Saved immutable release version 1 through the rendered browser and ran a server preview: 1 quoted,
  0 blocked, 0 unpriced, 0 conflicts, 15 bounded work units, with content and preview hashes returned
  by the server. Publication was deliberately not attempted because the requester cannot approve
  their own release.
- Switched both Apple calm and Pixel expressive themes successfully.
- At a 390 × 844 viewport, `scrollWidth` was 375 for `innerWidth` 390; the rate-builder shell stayed
  within x=16…359. The first pass exposed invisible radio controls retaining global 100% width;
  those controls were reduced to a 1px accessible focus target and the complete narrow check was
  repeated green.
- Browser error/warning console: 0 entries.

## Findings

No unresolved P0, P1 or P2 design/accessibility findings remain. The local draft preview is labelled
as hypothetical and pre-tax; the separate active-release quote is the only UI claim of current tax,
policy, restriction and availability evidence. AI-assisted authoring remains visibly marked “next”
and has no browser mutation path in this order.
