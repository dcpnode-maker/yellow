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
