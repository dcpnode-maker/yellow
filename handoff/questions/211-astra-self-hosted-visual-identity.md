# Question211 — Astra self-hosted visual identity

Accepted bounded technical direction, 2026-09-07, under Order444. Astra's
definitive handoff requests licensed Urbanist and Phosphor. Root personally read
the complete pinned OFL/MIT licences and the project's dependency policy. This
implements typography and truthful navigation icons, not the full journey design.

## Exact scope and ownership

```text
native_resume_builder:
  src/app.ts (two explicit static GET registrations only)
  src/http/operator.ts (two explicit static asset responses only)
  src/http/operator/index.html
  src/http/operator/operator.css
  src/http/operator/vendor/urbanist-v1.330/Urbanist[ital,wght].woff2 (new binary)
  src/http/operator/vendor/urbanist-v1.330/OFL.txt (new, full upstream licence)
  src/http/operator/vendor/phosphor-core-2.1.1/phosphor-nav-regular.svg (new)
  src/http/operator/vendor/phosphor-core-2.1.1/LICENSE (new, full upstream licence)
  src/http/operator/vendor/ASTRA-VISUAL-ASSETS-NOTICE.md (new)
  tests/operator-visual-identity.test.ts (new)
  tests/operator-workbench.integration.test.ts
  tests/operator-workspace-layout.browser.test.ts
coordinator:
  handoff/questions/211-astra-self-hosted-visual-identity.md
  handoff/orders/444-partner-review-and-astra-ui-integration.md
  docs/DEPENDENCIES.md
  docs/design/ASTRA-IMPLEMENTATION-HANDOFF.md
  docs/design/BUILT-CAPABILITY-MANIFEST.md
  docs/PROJECT-STATUS.md
  .gitattributes
  DECISIONS.log
  handoff/LEDGER.md
```

## Asset and architectural boundary

Pin Urbanist to upstream commit549716453f76335ccc5a9e537cbe0da03d6fed34 and
Phosphor core2.1.1 to2b75f3ad12b420c9504ef05df8d2564a28f8500e. Preserve full
licences, individual source URLs, SHA-256, original version and transformation
provenance. Font bytes remain unmodified. D1416 admits the font-only OFL1.1
exception; it does not expand the package licence allowlist. No paid assets,
CDN/font calls, remote runtime origins, package dependencies or CSP widening.

Use one same-origin variable WOFF2 (58,004 bytes) with visible system fallback
and font-display:swap, applied only to the three selected public workspaces.
Use one small regular Phosphor sprite with fifteen meaningful navigation glyphs;
retain textual accessible labels and visible focus. Rates uses a currency-neutral
glyph, not a rupee sign in a multi-country app. Sprite paths derive from pinned
upstream SVGs; no script, event handler, foreignObject, remote reference or filter.
Explicit routes: /static/fonts/urbanist-v1.330.woff2 and
/static/icons/phosphor-nav-2.1.1.svg. No wildcard filesystem exposure.

Keep financial/API/permission/DTO/state/command behavior and all mounted layouts
unchanged. Do not add profiles, fake portraits, departments, events or neomorphism.
This narrowly supersedes historical external-font/asset prohibitions D435/D472/
D486 for these self-hosted licensed assets only. Record actual payload size; do
not silently weaken unrelated existing payload/security assertions. If a legacy
oracle requires edits outside this list, report it before touching it.

## Proof before delivery

Add regression tests before implementation: exact pinned hashes/licences, fifteen
unique safe symbols and route mappings, same-origin MIME/CSP and missing-path
behavior. Actual Chromium must load the font and sprite, render computed Urbanist
and visible currentColor glyphs, retain 44px targets, labels/focus and forced-colour
usability across all three layouts. Recheck desktop/tablet/phone overflow and
existing no-remount/no-layout-only-command behavior. Font failure must retain
readable system text. If external-use rendering fails, report before adopting an
inline-symbol fallback. Preserve failures as evidence; no screenshot-only proof.

This work does not alter the frozen a1085178 preview archive, helpers, database,
runtime or existing CI. Coordinator may promote that independently tested preview
in parallel. Publish and serve the later visual slice only with its own evidence.

## Rendered-test correction and selected inline representation

The initial Chromium proof failed0/1 in7.24s, but the worker subsequently found
its predicate included seven intentionally hidden secondary-workspace buttons.
That run does not establish an external-use browser incompatibility. The proof
now opens the existing disclosure before inspecting all15 glyphs. Retain the
failed oracle honestly; neither fetch success nor a hidden element's zero bounds
proves the visible icons rendered or failed.

Root retains the selected markup-only representation for one synchronous,
network-independent navigation sprite: embed fifteen pinned symbol definitions once in
index.html's hidden SVG and use local fragments. Keep canonical vendor sprite
and exact same-origin route for attribution/proof, but do not fetch that route
from the product page. Test exact semantic/path equality between vendored sprite
and embedded symbols to prevent drift, and prove no duplicate IDs.

No operator.js expansion or client fetch/HTML injection is admitted. The small
static markup cost is preferable to a new asynchronous navigation dependency.
Record actual compressed payload and permanent real nonzero rendered-glyph proof;
all other scope, licence, fallback, contrast and focus requirements remain.

Two discovered legacy-oracle paths are additionally admitted to the same worker:
tests/operator-adaptive-experience.test.ts and
tests/operator-flagship-motion.test.ts. Replace only old invoice glyph reuse and
nine-symbol assumptions with the exact new fifteen unique local Phosphor mappings.
Preserve all behavioral, no-layout-command, motion and security assertions.

The same narrowly scoped compatibility correction permits exactly the standard
SVG XML namespace and the pinned same-origin font URL in old blanket resource
assertions, including the already admitted workbench integration test. It must
continue rejecting remote runtime resources, arbitrary url() and @import. Keep
this guard executable without a database as well. Actual browser font-failure
interception must prove readable fallback text; a CSS declaration alone is not
a rendered fallback proof.

The first staged diff check caught one upstream trailing space in OFL.txt:21.
Preserve the exact licensed notice and pinned hash. Admit only that file's
.gitattributes whitespace=-blank-at-eol exception; all other whitespace checks
and paths remain enforced. This is not a licence-content modification.

## Remaining legacy resource oracles — test-only admission

The final standing run reproduced the same blanket resource prohibition in three
additional paths. Admit only their resource assertions to the assigned test worker:

- tests/material-theme-skins.test.ts
- tests/operator-material-themes.test.ts
- tests/operator-today-command-centre.integration.test.ts

Require exactly the one pinned same-origin font URL and the one non-fetch SVG
namespace; reject every other URL or @import. Keep operator.js and the Today
module resource-free, and preserve all behavior, responsive, accessibility,
byte-presence and trademark assertions. This is no UI redesign or promotion.
Q214 still holds all new visual integration for founder approval.
