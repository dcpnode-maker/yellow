# Order 195 independent static UI/accessibility review

**Verdict:** CHANGES REQUIRED  
**Reviewed candidate:** `8c15adfc342155d6a75e1d3915417f7934ebba96`  
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
3. **The standing suite is red.** Two retained tests still enforce the historical
   96 KiB gzip ceiling that D-526 retires. The candidate updates only one ceiling test;
   `tests/operator-folio-workspace.integration.test.ts:188` and
   `tests/operator-reservation-workspace.integration.test.ts:261` remain red. Those
   files are outside Order195's Scope list, so the builder must either amend scope
   through the documented question/decision process or choose an in-scope resolution.
4. **The required browser-geometry acceptance test is not present.** The new
   `tests/operator-appearance-geometry.test.ts` is a static regex test. It does not
   launch a browser, measure bounding rectangles, exercise 375/768/1020/1021/1440 or
   200%, prove <=1px reflow, detect clipping/overflow, or inspect focus. It cannot
   satisfy the order's executable geometry proof.
5. **Enterprise ERP does not yet implement its stated composition.** The candidate
   adds a token vector, a 232px rail, a uniform four-column metric grid and compact
   table typography. It does not add or rearrange the semantic shell into the required
   bounded command row containing title, filters and primary action, nor an asymmetric
   KPI/bento composition. Static signatures therefore prove a distinct palette and
   rail width, not the complete ERP composition required by the order.
6. **The exact-diff gate is not clean.** `git diff --check
   88abc3e..8c15adfc342155d6a75e1d3915417f7934ebba96` reports a new blank line at
   EOF in `handoff/orders/195-six-native-appearance-rebuild.md:109`.

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
  this review. D-526 allows this size, but the retained standing tests have not been
  reconciled.

## Personally executed commands and results

```text
git rev-parse HEAD
=> 8c15adfc342155d6a75e1d3915417f7934ebba96

git status --short
=> clean before review evidence

git diff --name-status 88abc3e..8c15adfc342155d6a75e1d3915417f7934ebba96
=> only DECISIONS.log, docs/DESIGN.md, handoff/LEDGER.md, Order195,
   operator HTML/CSS/JS and the named presentation tests

git diff --check 88abc3e..8c15adfc342155d6a75e1d3915417f7934ebba96
=> FAIL: Order195 line 109, new blank line at EOF

bun test tests/operator-material-themes.test.ts tests/material-theme-skins.test.ts \
  tests/operator-adaptive-experience.test.ts tests/operator-flagship-motion.test.ts \
  tests/operator-appearance-geometry.test.ts
=> 17 pass, 0 fail, 386 expectations

bun test
=> FAIL: 300 pass, 525 skip, 2 fail, 3701 expectations
   - Order 171 P5 / Order184: assets remain dependency-free and at most 96 KiB gzip
   - Order 168 / Order184: operator assets remain within the 96 KiB combined gzip budget

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
matrix, reconcile the retired byte ceiling across standing tests through valid scope,
complete the ERP composition rather than only its tokens/rail, and make `git diff
--check` clean. Then submit one new exact candidate hash for fresh static review before
any runtime/browser promotion work.
