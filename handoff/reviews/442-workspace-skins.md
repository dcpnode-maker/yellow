# Order 442 — independent bounded code review

Date: 2026-09-06. Reviewer: `/root/skins_independent_review`, a non-implementer.
Scope: Order 442 product/source diff, tests, asset provenance and current QA docs.
Baseline: `b5ef70842b658183f7b5b4c650c8e78c7a0b513d`; working branch
`phase-7/profile-cards-and-workspace-skins`. This receipt identifies uncommitted
candidate bytes below, not a new merged commit or a deployed application.

**Code findings resolved; merge/release approval WITHHELD.** No remaining material
code finding was found in this bounded review. Authorized rendered review of all
three skins and identity cards, exact-source CI with all five jobs and the
canonical 11/11 PostgreSQL referee remain mandatory. Code/DOM test-double proof
does not satisfy visual, browser, accessibility, physical-device or laptop proof.

## Review findings and corrections

1. **P2 corrected in source — Precision intermediate widths.** The original
   `330+310+25px` grid needed 665px where a 900px viewport left about 636px of content.
   Minima are now `260+280+25px`; actual 851–928px rendering still needs inspection.
2. **P2 corrected in source — Glass parking select.** Its older class selector
   outranked the generic new light-input rule. The explicit final
   `.vehicle-parking-select` rule now supplies dark ink, white background and a
   stronger border at equal specificity, later in the stylesheet.
3. **P2 corrected in source — small text contrast.** Metric notes, upcoming
   stages, navigation labels and footer now have declared solid-background ratios
   of 5.27:1, 5.84:1, 5.42:1 and 5.37:1. Profile IDs increased from 8px to 10px and changed
   to `#24362b`. Actual contrast where text overlaps portraits remains a rendered
   acceptance condition; sampled image pixels cannot establish the final minimum.

Both selectors change only a validated root skin attribute and their own native
select value. The three values are consistently `calm`, `precision`, `timeline`.
No request, browser storage, form replacement, subject/property/command identity
change or permission change was added. Production still uses one mounted app and
the six existing appearances. Identity styling targets existing authorized Party,
attendant and assignee content; generated portraits occur only in the explicitly
fictional study. No database, migration, seed, operational API or domain command
was changed by Order 442.

The 14 cases, 16 department definitions and journey definitions remain byte-identical
to the baseline. The full prototype script's code execution preserves the original
owner/evidence gates and omits guest identity/stay context from the designated
minimized Profiles views. Department exploration remains explicitly unauthenticated
fictional behavior, not a production authorization mechanism.

## Reviewer-personal execution

All commands below ran from the repository root on the candidate identified below.
`BUN` in this transcript abbreviates the actual executable
`/workspace/scratch/f5e55c64023f/order112-runtime/node_modules/@oven/bun-linux-x64-baseline/bin/bun`
(Bun 1.3.14). It is not a substituted system environment variable.

```text
BUN test tests/operator-workspace-skins.test.ts tests/operator-material-themes.test.ts tests/operator-adaptive-experience.test.ts tests/operator-ui-foundation.test.ts tests/operator-assets-security.test.ts tests/operator-flagship-motion.test.ts tests/security-headers.test.ts tests/local-login-prefill.security.test.ts
46 pass; 0 fail; 767 assertions; 8 files. New Order 442 checks: 5/5.

node /workspace/scratch/1c0b0b3cfbd2/order442-review/prototype-state-proof.cjs
PASS YC01 six steps, separate cleaning/inspection and owned acknowledgements.
PASS YC09 every existing version-specific department handoff.
PASS YC11 wrong-payer rejection, original attempt and P-8726 finance completion.
PASS three-skin partly checked form and original attempt/state preservation.
PASS all 16 department Profiles visibility rules.
PASS phone-toggle/back-to-queue state behavior; no layout claim.

node --test docs/design/staff-workbench/compare-core.test.cjs
2 pass; 0 fail. Numeric RGBA/dimension checks only.

BUN run typecheck
tsc --noEmit; exit 0.
BUN scripts/check-import-boundaries.ts
Import boundaries OK: 171 TypeScript files scanned.

node --check src/http/operator/operator.js
node --check docs/design/staff-workbench/workbench.js
node --check docs/design/staff-workbench/preview.mjs
git diff --check
All exit 0.
```

The prototype harness executes the actual full script using a deliberately limited
DOM test double; it uses no browser, layout engine, HTTP request or persistence.
It is a scratch review aid, not a newly shipped browser test. Its SHA-256 is
`4c45a35247528b1712352c02768a1b7570690ed9d7b7b17d5706bfbf540f6982`.
The asset-manifest check independently recomputed byte sizes and SHA-256 for all 20 delivered assets:
every entry matched and no delivered asset was omitted.

For transparency, an earlier focused batch mistakenly included the existing
`operator-appearance-geometry.test.ts`. It returned 49 passes and one environment
failure: `Chrome or Chromium is required for Order195 geometry proof`. No browser
launched. That failure is retained as unavailable proof; the final code-only batch
above excludes that browser suite. No browser policy bypass, alternate rendering
surface or comparator-page retry was attempted by this reviewer.

## Reviewed candidate bytes

SHA-256 values, in the manifest order used by this review:

| File | SHA-256 |
|---|---|
| `src/http/operator/index.html` | `5fb9baa3a7a5a8af136b1370040e74d955975266d0ba249d0dd9e5b2d55f406d` |
| `src/http/operator/operator.css` | `7e1fbd362918838b81f3792192c115f94f96f242dd62fd683af4b9bf50f1a569` |
| `src/http/operator/operator.js` | `198e36399188d9716e2bc193ee8a88dd17f72fb93e20204db7aa5a2004f11f16` |
| `tests/operator-workspace-skins.test.ts` | `12fb205b3d8f263ae07928632e113d6ef1750f26f0f446a61dc6d121404ef0e8` |
| `docs/design/staff-workbench/index.html` | `d499e487726b21f330d018512c392ab0e67d154820b91fb0e861ccad953f8027` |
| `docs/design/staff-workbench/workbench.css` | `fb0269de616d210ac426374f48dc7c7f269f4b5732156c4070826a3a011757e9` |
| `docs/design/staff-workbench/workbench.js` | `edb16e7db9e64d5d6ae611b470b8c1a43d94cd8db7d132dc7d6ebbc8aa83610a` |
| `docs/design/staff-workbench/preview.mjs` | `2beedc0c2dfdba708149367817aec36d503d057ceda80228859280bea718001c` |
| `docs/design/staff-workbench/package.json` | `f964b46a7042dc7d8f8f59bb1da5f43956b14efaabe20f8fbe00d03ebf3e0281` |

Manifest SHA-256: `2599eb92b6a63ccdadfe01b314a4600b273ef8a013b2e784a3c6a94befe95996`.
Construction: concatenate each table row as `<sha256><two spaces><path><LF>` in
the order above, then hash the resulting UTF-8 bytes. Asset bytes are separately
enumerated in [the verified provenance manifest](../../docs/design/staff-workbench/assets/README.md).

## Remaining release evidence

The root and workbench QA records now both say **blocked**. They identify the
selected Sophie reference, distinguish original adaptation from exact cloning,
label prior Order 440 captures as historical, and state that no current rendered
capture/combined comparison exists. Current source pointers correctly identify
the reviewed PR85 baseline; they do not claim Order 442 is merged or deployed.

An independently authorized laptop session must execute the documented same-state
three-skin/profile review, including intermediate width, phone, zoom, focus,
forced colors, real image/text compositing and the three case flows. Resolve any
P0/P1/P2 finding and retain actual matched captures before visual acceptance.
Fresh candidate CI/referee and independent integration are still required. This
review authorizes no merge, release or deployment. The reviewer changed only this
review file; no product edit, commit or publication was made.
