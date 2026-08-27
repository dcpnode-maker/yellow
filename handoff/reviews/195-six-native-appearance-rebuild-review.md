# Order 195 independent static UI/accessibility review

**Verdict:** CHANGES REQUIRED

**Reviewed candidate:** `8c15adfc342155d6a75e1d3915417f7934ebba96`

**Reviewed governance/test tip:** `3bd750f8654b22d04004f4bf11df5fd564f1c3aa`

**Reviewer:** OpenAI Codex independent non-implementing reviewer (`order195_static_review`)

**Review date:** 2026-08-27

**Scope:** static source, tests and repository gates only; no browser, local runtime,
database, credentials, ports, image promotion, merge, push or deployment was touched.

## Blocking findings

1. **The non-reflowing workspace disclosure is desktop-only.** The new anchored
   overlay rule exists only inside `@media (min-width: 1021px)`. At 768–1020px the
   retained rule is `.secondary-workspaces:not([hidden]) { display: contents; }`, and
   below 768px the retained grid disclosure remains in normal flow. This contradicts
   the order's explicit 375/768/1020 geometry matrix and its <=1px disclosure-reflow
   requirement. The focused test slices only the desktop media block, so it cannot
   detect this failure.
2. **Focus is not contained in the open workspace sheet.** The candidate focuses the
   first domain tab on open and returns focus on Escape, but has no Tab/Shift+Tab
   containment. That does not meet the order's explicit focus-containment contract.
   The focused geometry test asserts Escape text only and therefore misses this
   requirement.
3. **The required browser-geometry acceptance test is not present.** The new
   `tests/operator-appearance-geometry.test.ts` is a static regex test. It does not
   launch a browser, measure bounding rectangles, exercise 375/768/1020/1021/1440 or
   200%, prove <=1px reflow, detect clipping/overflow, or inspect focus. It cannot
   satisfy the order's executable geometry proof.
4. **Enterprise ERP does not yet implement its stated composition.** The candidate
   adds a token vector, a 232px rail, a uniform four-column metric grid and compact
   table typography. It does not add or rearrange the semantic shell into the required
   bounded command row containing title, filters and primary action, nor an asymmetric
   KPI/bento composition. Static signatures therefore prove a distinct palette and
   rail width, not the complete ERP composition required by the order.
## Verified green properties

- Exact ordered selector and allowlist are Apple iOS, Android/Material 3,
  Windows95/98, Glassmorphism, Neomorphism and Enterprise ERP, with Apple as the
  fail-closed default and one semantic `#workbench-view`.
- The Windows95 desktop rule uses explicit `nav/chrome/head/content` grid areas; the
  static auto-placement defect is corrected for the >=1021px layout.
- Glass includes a deep navy/cobalt environment, three distinct light volumes,
  translucent navigation/content materials, specular borders, three depth planes and
  more opaque financial/table surfaces. Reduced-motion, coarse-pointer,
  forced-colours and no-backdrop blocks disable its stage animation.
- Existing Android 48px targets, general 44px targets, focus-visible rules and solid
  fallback blocks remain present.
- The candidate changes no migration, schema, API, context/domain service, database,
  permission, credential, dependency or server-authority file. Protected product diff
  check over `migrations`, `src/contexts`, `src/http/server.ts` and `src/server.ts`
  returned exit 0 with no paths.
- Combined operator source measured 483,251 raw bytes and 99,332 gzip bytes during
  this review. D-526 allows this size.
- D-528 validly expands scope only to the two obsolete ceiling assertions. Governance
  commit `9cabadfa55f24ffae65c6e056326bc555fd12d4a` changes only the order, decision and
  ledger; correction `3bd750f8654b22d04004f4bf11df5fd564f1c3aa` removes only the two
  unused `gzipSync` imports and their superseded byte conditions. Dependency identity,
  responsive, security and workflow assertions remain intact, and product source is
  byte-identical to `8c15adf`.

## Personally executed commands and results

```text
git rev-parse HEAD
=> 8c15adfc342155d6a75e1d3915417f7934ebba96

git status --short
=> clean before review evidence

git diff --name-status 88abc3e..8c15adfc342155d6a75e1d3915417f7934ebba96
=> only DECISIONS.log, docs/DESIGN.md, handoff/LEDGER.md, Order195,
   operator HTML/CSS/JS and the named presentation tests

git diff --quiet 8c15adf..3bd750f -- operator source, package/dependency,
  migration, context/domain, server and authority paths
=> PASS: no product, dependency, API, schema, data or authority change

bun test tests/operator-material-themes.test.ts tests/material-theme-skins.test.ts \
  tests/operator-adaptive-experience.test.ts tests/operator-flagship-motion.test.ts \
  tests/operator-appearance-geometry.test.ts
=> 17 pass, 0 fail, 386 expectations

bun test
=> PASS at governance/test tip 3bd750f: 302 pass, 525 intentional skips,
   0 fail, 3710 expectations

bun test [five focused appearance files plus the two D-528 workspace files]
=> PASS: 34 pass, 0 fail, 655 expectations

bun run typecheck
=> PASS

bun run boundaries
=> PASS: 71 TypeScript files scanned

bun run license-check
=> PASS: 23 installed packages

bun audit
=> PASS: no vulnerabilities found
```

## Required correction before re-review

Make disclosure non-reflowing at every required breakpoint, implement and test actual
focus containment, add a real geometry/browser harness that measures the complete
matrix, and complete the ERP composition rather than only its tokens/rail. Then submit
one new exact product candidate hash for fresh static review before any runtime/browser
promotion work.

---

## Fresh static re-review

**Verdict:** APPROVED FOR D-527 GUARDED BROWSER CANDIDATE

**Exact product candidate reviewed:** `74e9452a01ba748b712dce93a3f1f8eec9186f11`

**Reviewer:** OpenAI Codex independent non-implementing reviewer
(`order195_rereview`)

**Re-review date:** 2026-08-27

**Boundary:** source, scoped diff and committed Chromium/CDP proof only. The reviewer
did not touch the local runtime, database, browser session, credentials, Docker,
ports, merge, push or deployment. This approval admits only D-527's guarded app-only
candidate step; it is not the mandatory authenticated six-appearance/200% visual and
accessibility approval.

### Prior blockers resolved

1. The disclosure material is now a global `position: fixed` viewport overlay, and
   the <=1020px `display: contents` rule is removed. Opening portals the menu to
   `document.body`; measured anchor coordinates are clamped to an eight-pixel edge,
   recomputed after layout, and maintained on resize/scroll without changing the
   command shelf's document geometry.
2. The open menu now contains keyboard focus: Escape closes and returns focus to the
   disclosure control, Tab wraps last-to-first, and Shift+Tab wraps first-to-last.
   Outside pointer interaction closes the menu.
3. `tests/operator-appearance-geometry.test.ts` is no longer regex-only. On this
   reviewer host it discovered installed Chrome, launched a fresh isolated headless
   process, connected through its DevTools WebSocket, set device metrics, loaded the
   actual operator stylesheet, and measured disclosure/root geometry at 375, 768,
   1020, 1021 and 1440 CSS pixels. The test did not skip and passed.
4. Windows95/98 retains explicit `nav/chrome/head/content` named grid placement.
   Enterprise ERP now has a bounded two-column title/primary-command band, styled
   dense filter toolbar, and a 12-column asymmetric KPI grid whose lead metric spans
   twice a normal metric.

### Scope and correctness inspection

- `git diff --name-status 88abc3e..74e9452` contains only Order195 governance/design,
  the three scoped operator assets, and the named presentation/workspace tests.
- Protected API/domain/schema/data/authority and dependency paths are byte-unchanged;
  `git diff --quiet` over `migrations`, `src/contexts`, both server composition files,
  `package.json`, `bun.lock` and `docker-compose.yml` passed.
- `git diff --check 88abc3e..74e9452` passed.
- The final correction `f509c48..74e9452` changes exactly operator CSS/JS and three
  scoped appearance tests; no runtime or server surface is present.

### Personally executed commands and results

```text
git rev-parse HEAD
=> 74e9452a01ba748b712dce93a3f1f8eec9186f11

git status --short
=> clean before review evidence

git diff --name-status f509c48..74e9452
=> operator.css, operator.js, material-theme-skins.test.ts,
   operator-appearance-geometry.test.ts, operator-flagship-motion.test.ts only

git diff --check 88abc3e..74e9452
=> PASS

bun test tests/operator-appearance-geometry.test.ts \
  tests/material-theme-skins.test.ts \
  tests/operator-flagship-motion.test.ts \
  tests/operator-assets-security.test.ts \
  tests/operator-reservation-booking.integration.test.ts
=> 28 pass, 0 fail, 405 expectations; Chromium/CDP matrix executed and passed

bun run typecheck
=> PASS
```

### Remaining mandatory gate

D-527 still requires a fresh non-implementing reviewer to exercise the authenticated
sole-local candidate across all six appearances, all required widths plus 200%,
keyboard/focus/fallback/error/console checks and settled screenshots. Port 3000 may be
changed only through the documented app-only rollback guard, and the candidate may be
retained only if that separate browser gate approves it.

---

## Fresh authenticated D-527 live-browser review

**Verdict:** CHANGES REQUIRED — DO NOT RETAIN THIS IMAGE

**Exact product candidate:** `74e9452a01ba748b712dce93a3f1f8eec9186f11`

**Exact candidate image:**
`sha256:6be6919c6e5eb637f7ecb8ece0e3eb208e5d27ea40206f2c0cc3abc146e971d2`

**Reviewer:** OpenAI Codex fresh non-implementing browser reviewer
(`order195_live_browser_review`)

**Review date:** 2026-08-27

**Boundary:** authenticated read-only UI actions and browser emulation against the
sole loopback app on port 3000. The reviewer did not edit source, change database or
provider state, replace an image/container, open port 3002, merge, push or deploy.
Settled screenshots were captured only in a temporary review directory and were not
committed.

### Blocking product findings

1. **Opening the secondary-workspace overlay scrolls the page on desktop and moves
   the visible workbench by more than the permitted one pixel.** With every case
   isolated at the top of the page, 375, 768 and 1020 passed for all six appearances.
   At both 1021 and 1440 CSS pixels, however, Windows95/98 changed `scrollY` from 0 to
   7.2 and moved workbench viewport Y from 64.15 to 56.95; Glass changed `scrollY`
   from 0 to 14.4 and workbench Y from 64.15 to 49.75; Neomorphism changed by about
   14.4 pixels; and ERP changed by 14.4 pixels while its domain bar also moved from
   80.15 to 72. Apple showed a residual 1.6-pixel shift at 1440 in the isolated run.
   Focus containment itself works; the defect is focus-induced auto-scroll during
   open/return/wrap. This violates Order195's <=1px visible-geometry contract.
2. **The primary availability action is not visible in the settled 375x900 DPR2
   viewport in any appearance.** Its measured top edge was 1065.71px (Apple),
   1031.06px (Android), 1077.11px (Windows95/98), 1028.71px (Glass), 1027.91px
   (Neomorphism), and 1116.71px (ERP). Root/body overflow is zero and the action is
   present in document flow, but it is below the initial viewport, so the explicit
   live-review requirement for a visible primary action is not met.

### Verified live properties

- Thirty base cases (six appearances x 375/768/1020/1021/1440) executed in the
  authenticated real app. Every case had zero root/body horizontal overflow, a fixed
  disclosure within the eight-pixel viewport boundary, initial focus containment,
  Shift+Tab last-item wrap, Tab first-item wrap, and Escape close plus return focus.
- The additional 375x900 DPR2 matrix executed for all six appearances with effective
  DPR 2.0, zero root/body overflow, bounded fixed disclosure and the same complete
  keyboard results.
- Live computed signatures prove distinct presentation systems: Apple uses a 1280px
  inset horizontal shelf and 20px surfaces; Android uses 48px expressive controls,
  pill geometry and a 1320px shelf; Windows95/98 uses teal desktop, zero-radius bevels
  and explicit `\"nav chrome\" \"nav head\" \"nav content\"` grid areas; Glass uses
  32px/28px saturated backdrop filters plus specular multi-plane shadows; Neomorphism
  uses coherent paired raised/inset shadows; ERP uses a 232px dark rail and compact
  seven-pixel controls.
- On the live project-status route, ERP's command heading computed as a two-column
  grid (`908.487px 153.913px`) and its 12-column KPI bento measured 554/271/271px,
  a 2.044 lead-card ratio, with zero root overflow.
- Theme and Expert detail survived navigation into Reservations and browser Back.
- Reduced motion matched and reduced sampled transition/animation durations to
  `0.00001s`; forced-colours matched with zero root overflow; coarse pointer matched
  with no visible target under 44px in the sampled active surface. Browser console
  warnings/errors were empty.

### Proof not promoted by this failed candidate

Because the candidate already fails two executable requirements, it receives no
retention approval. A corrected exact product/image must be promoted under the same
rollback guard and a fresh reviewer must rerun the entire matrix, including the live
no-backdrop branch, opaque Glass financial-surface comparison and request-failure
capture; those checks were not used to infer approval after the blocker was found.

---

## Corrected candidate independent static re-review

**Verdict:** APPROVED FOR D-527 GUARDED BROWSER CANDIDATE

**Exact corrected product candidate:**
`400c406412f7b217c77228026de82ea05537637a`

**Reviewer:** OpenAI Codex fresh independent non-implementing reviewer
(`order195_corrected_static_review`)

**Review date:** 2026-08-27

**Boundary:** source, scoped diff and committed Chromium/CDP proof only. The reviewer
did not edit product source, touch the local runtime or database, inspect credentials,
replace a container/image, open a port, merge, push or deploy. This approval admits
only a newly labelled exact app image into D-527's guarded same-port browser review;
it is not retention or completion approval.

### Failed live findings corrected in source

1. The disclosure open, Escape/close return-focus, forward-Tab wrap and Shift+Tab
   wrap calls now all use `focus({ preventScroll: true })`. The correction therefore
   preserves the existing focus trap while removing the browser's focus-induced
   document scroll at each reachable focus transition that failed the prior live
   matrix.
2. At `max-width: 600px`, the availability form keeps its one-column flow but places
   its one existing authoritative `Search availability` submit control in grid row
   one. The exact HTML still contains a single submit action and the later theme
   systems contain no competing `search-button` or `grid-row` override. Thus at the
   required 375px width the action precedes the four field rows that previously put
   it at 1027.91–1116.71px. This is static admission evidence only; the fresh DPR2
   authenticated reviewer must still measure it above the 900px fold in all six
   appearances.

### Scope and standing-proof inspection

- `git diff --name-status 74e9452..400c406` changes only the two governance evidence
  files, `operator.css`, `operator.js` and the scoped geometry test.
- `git diff --quiet 74e9452..400c406` over migrations, contexts, server composition,
  dependency manifests and Compose passed. No API, domain, schema, seed, data,
  permission, credential or runtime-authority surface changed.
- `git diff --check 88abc3e..400c406` passed, and the complete base-to-candidate file
  list is contained by Order195's explicit scope.
- The combined operator HTML/CSS/JS is 486,588 raw bytes and 99,839 gzip bytes. D-526
  intentionally removed the historical visual-shell byte ceiling; no dependency or
  external asset was added.

### Personally executed commands and results

```text
git rev-parse HEAD
=> 400c406412f7b217c77228026de82ea05537637a

git status --short
=> clean before review evidence

git diff --check 74e9452..400c406
git diff --check 88abc3e..400c406
=> PASS

git diff --quiet 74e9452..400c406 -- migrations src/contexts \
  src/http/server.ts src/server.ts package.json bun.lock docker-compose.yml
=> PASS: protected product, dependency and runtime-composition paths unchanged

bun test tests/operator-appearance-geometry.test.ts
=> 4 pass, 0 fail, 46 expectations; the isolated Chromium/CDP matrix executed at
   375/768/1020/1021/1440 and did not skip

bun test [seven focused appearance/security/booking files]
=> 37 pass, 0 fail, 640 expectations

bun test
=> 304 pass, 525 intentional skips, 0 fail, 3748 expectations

bun run typecheck
=> PASS

bun run boundaries
=> PASS: 71 TypeScript files scanned

bun run license-check
=> PASS: 23 installed packages

bun audit
=> PASS: no vulnerabilities found
```

### Remaining mandatory gate

A fresh non-implementing reviewer must still execute D-527's full authenticated
six-appearance matrix against an exact image labelled with
`400c406412f7b217c77228026de82ea05537637a`, including every contract width, 375x900
DPR2, <=1px open/wrap/Escape geometry, primary-action visibility, no-backdrop,
opaque Glass financial-surface comparison, request-failure capture, reduced motion,
forced colours, coarse pointer, state preservation and console/request checks. Retain
that image only if the fresh live review approves it.
