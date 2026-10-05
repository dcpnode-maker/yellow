# Order 673 — Reference theme and AI atmosphere delivery

2026-09-24. Actual serving source: D:/Yellow/git-live-order611-source-v2. Canonical order and independent review share this receipt's numeric prefix in handoff/orders and handoff/reviews.

## Delivered
- Shared neutral canvas, white cards, grey grouped rails, quiet shadows and sans-serif headings across the operator shell and core workspace surfaces. Normal mode no longer uses an ambient yellow wash; status colors retain their meanings.
- Shared segmented ribbon: optional compact disclosure, expanding rail, single measured white moving pill, keyboard arrows/Home/End, Escape to collapse and return focus. Adopted by Operations, Ecosystem, internal Market Lab and property settings. Existing Today and checkout rails share the new visual treatment; their commands are unchanged.
- Mounted content dissolve (170ms opacity) and rail expansion/selection (200ms); no delayed command execution, no remount keyed to the animation, no hidden interactive clone.
- AI-ready/result states use a static warm app-wide atmosphere; listening/thinking adds a slow opacity-only shell-edge animation. No provider or model changes. This is an existing assistant-mode indicator, not proof that a hosted LLM is running.
- Mobile disclosure stays outside the horizontal tab scroller. Immediate keyboard reveal with preventScroll avoids competing native/smooth scrolling. Header navigation now scrolls within its available space, keeping universal search visible.

## Reference reviewed
Founder link: https://www.youtube.com/watch?v=EcbgbKtOELY, Every UI/UX Concept Explained in Under 10 Minutes. Read full exported auto-generated English transcript; visually inspected 0:15 grouping and 0:20 white selection frames alongside all supplied ribbon stills. Applied grouping, hierarchy, whitespace, restrained shadows and interaction feedback. The 170/200ms implementation timings are design choices, not measurements of the video's exact timing. No frame-perfect clone claim.

## Executable proof
- Root `bun run typecheck`: strict root/frontend pass; `bun run boundaries`: 206 files pass.
- Seven targeted suites: order673 ribbon/theme, shared ribbon depth, order672 navigation/folio workbench/folio statement, order671 mapping UI: 28 pass, 0 fail, 196 assertions. Final header CSS adds one assertion; the two Order673 suites re-run at 8 pass, 0 fail, 64 assertions.
- Vite production build: 496 modules pass. No new runtime dependency.
- Independent non-implementer `/root/reference_theme_review` personally ran frontend typecheck, focused suites, then subsequent CSS/mobile-focus correction proofs. Exact commands/results in the review. These source-contract tests are not financial end-to-end proof.
- A stale test asserting a removed JavaScript media-query check failed after immediate-scroll correction; it was changed to assert the intended immediate scroll behavior. Reduced motion remains implemented through CSS and RibbonPanel, then verified in-browser. Final scoped suites green.

## Actual browser proof
- Public final entry asset `/yellow-next/assets/index-BnasvUBw.js`; CSS `/yellow-next/assets/index-QQEfL5ba.css`.
- Desktop 1280px: Operations compact/expand, Arrivals selection, End to Sources, Escape collapse retained Sources and restored disclosure focus. Ecosystem expanded and selected Commercial. Pill changed its measured position; CSS transition reads 0.2s.
- 375x812: document width360; selected Sources fully within scroller (left179/right329), disclosure left22/right183 remains visible. A real initial smooth-scroll race and hidden disclosure were caught and repaired.
- 812x375: document width797, no page overflow.
- Reduced-motion emulation: capsule transition0s, rail animation none; forced-colors highlight border present. Browser overrides reset after tests.
- Settings local-only draft: changed OTA_RETAIL field, collapsed/re-expanded ribbon, selected overview, received unsaved-mappings dialog, chose Keep editing, verified original edited value survived; restored field to OTA_RETAIL. Save was never pressed, no mapping/DB write.
- Folio retained SAR25.00 selected and stay balances; existing tools remain. No financial mutation submitted.
- Ask Yellow: existing ready class + static edge confirmed; background/card variables change; read-only `show arrivals today` returned11 arrivals; Exit restored normal mode. No microphone permission or external-provider test.
- Today loaded65% occupancy,13 room nights,20 capacity,SAR9,394 revenue from existing review data. Full-header universal search fully visible at desktop and375px, opens its dialog, Escape closes it. Browser errors/warnings empty.

## Deployment and limitations
Replaced only `yellow-public-demo-app-1`, preserving database/cache/tunnel containers. Final healthy image `sha256:9eca2e4ce16d2793de1efef8d3022580da945acbb1bc3f94d192447f85b871df`; loopback3010 health returns ok. Rollback `yellow-public-demo-app:before-order673` retains Order672 image `144dfc5a3cfc9b5968a7c4423b3a3c2cb9ef62be9db8f90d9f10eec4758c2ec9`.

Review app: https://lying-jones-terminal-church.trycloudflare.com/ (temporary tunnel, not permanent production). No new app instance, GitHub push/PR/merge, migration, dependency cleanup or provider spend. Pre-existing dirty source preserved. Internal Market Lab adoption is typechecked but not browser-activated. No OS dark theme is added or certified. This does not complete every cross-module search, room-history timeline, table grouping or business relationship requirement; those remain separate feature work.

UI/UX skill informed semantic selection, restrained motion, readability and accessibility; React guidance informed reuse without animation-driven remounts; frontend testing guidance informed real mobile/desktop checks.
