# Orders 071–073 design QA — universal rate-plan workbench

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
policy, restriction and availability evidence.

## Order 072 AI-assisted extension

The AI-assisted mode now uses the same Step 1 identity and Step 5 canonical review surfaces as
Guided and Expert. It adds one clearly bounded intent panel with Changes, Assumptions, Questions,
Warnings and Always enforced evidence. The panel follows the existing tokens in both themes and its
result grid collapses to one column under the same 560px responsive boundary proven above. Disabled
actions now have an explicit reduced-opacity, desaturated and non-clickable visual state throughout
the workbench.

Executed browser evidence on the persistent founder stack:

- An exact request for fixed pricing, `14500` minor units, LEISURE segment, direct channel, maximum
  two adults and non-refundable treatment produced one ready proposal with all six changes visible.
- Interpretation left Apply disabled until the proposal was ready. A deliberate Apply moved the
  canonical `authoringMode: "ai"` command to Step 5 while stating that nothing was saved.
- A second deliberate action saved immutable release version 2; no preview, approval or publication
  was triggered automatically.
- `145 USD` plus minimum stay returned two clarifying questions: exact minor units and the
  authoritative Restrictions workspace. Apply remained disabled.
- A prompt-override, tax-bypass and auto-publication request rendered three explicit rejections and
  no proposal. Apply remained disabled.
- Apple calm and Pixel expressive rendered without clipping or style drift at the 1280 × 720 review
  viewport. The inherited 390 × 844 responsive contract is covered by the one-column CSS rule and
  the previous executed narrow proof; this browser surface did not expose a viewport-resize control
  during the Order 072 pass.
- Browser error/warning console: 0 entries.

## Order 073 applicability rules and per-cell evidence

The Step-3 single target was replaced by progressive, collapsible rule cards while retaining the
reference's “Who gets it” stage and Yellow's existing design tokens. Each card keeps its stable key,
include/exclude state, priority, physical scope and commercial-filter count visible when collapsed.
Detailed fields cover property, room class with exact membership, room type, sellable room, company,
market group, market, source party/source, channel, segment, agent and campaign. The selected preview
context is visibly separate from the server-owned winner.

Executed browser evidence on the persistent founder stack:

- Added a broad `property-default` include plus an exact Room 101 `direct-stop` exclusion with the
  direct channel dimension. The complete canonical command showed both rules before any save.
- Saved immutable release version 4. With the exclusion context selected, the server returned
  0 quoted / 1 unpriced / 0 conflicts / 11 bounded work units; the cell showed `excluded`, winner
  `direct-stop`, matches `direct-stop, property-default`, no conflicts and `rate:target_excluded`.
- Re-ran the same stored release with the broad context. The cell showed `quoted`, winner and match
  `property-default`, exact `USD 12500 minor units`, and nine server work units. The browser merely
  rendered these returned fields and hashes.
- Entered duplicate `property-default` keys and pressed Save. The local message named the duplicate,
  release history stayed at four versions, and no request-created successor appeared.
- Initial/failed preview placeholders remained readable. The focused live proof separately exercised
  an equal-rank conflict and exact-room exclusion; approval remained a separate action and no release
  was published.
- Apple calm and Pixel expressive both rendered the cards and evidence without clipping. At the
  available 766px in-app viewport, document scroll width was 752px (no horizontal overflow). The
  existing 390×844 proof remains the narrow baseline; new rule/evidence grids have explicit one-column
  rules below 560px because this browser surface does not expose viewport resizing.
- Browser error/warning console: 0 entries.
