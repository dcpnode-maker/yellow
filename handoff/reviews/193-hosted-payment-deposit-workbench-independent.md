# Order 193 hosted payment and deposit workbench independent review

**Conclusion:** CHANGES REQUIRED

**Corrected product candidate:** `bb87e680d1abf9b34790127ed10e3b632dbc66fc`

**Prior rejected product candidate:** `102563e99300f329388dc857c13a88140f2f2552`

**Builder governance:** `ec85b18fc3d8892c326e12c42e5831f9c003025a`

**Reviewer:** independent non-implementing OpenAI Codex Tier-3 reviewer

## Corrected-candidate blocking P6 finding

The D-516 mobile-containment repair is effective, but the corrected candidate fails
the existing non-waivable 96 KiB initial operator-shell gzip ceiling. Fresh reviewer
execution measured the three initial assets at **98,352 bytes** against the **98,304
byte** maximum. The same exact failure is independently asserted by:

- `tests/material-theme-skins.test.ts`;
- `tests/operator-folio-workspace.integration.test.ts`; and
- `tests/operator-reservation-workspace.integration.test.ts`.

The complete standing run therefore finished **288 passed, 521 intentionally
environment-gated skipped, 3 failed** with 3,612 assertions. The candidate is 48
bytes over budget and cannot be approved. This reviewer did not implement a
compression repair.

## D-516 repair verification

The prior 375-pixel product defect is repaired without hiding overflow. At native
375x900 the reviewer measured root `360/360`, folio workspace `334/334`, deposit
panel `302/302`, and tablist `302/302` client/scroll widths. The same exact workspace
remained contained at 768, 1024 and 1440 CSS pixels and at 200% page scale. Focus,
reduced-motion and clean-exit behavior were green; dirty exit raised its required
confirmation. The earlier `419px` root and `390.475px` intrinsic track no longer
occur.

## Prior candidate blocking P5 finding

The authenticated operator deposit workspace has real document-level horizontal
overflow at the mandatory native 375 CSS-pixel viewport. On the exact synthetic
review folio, after selecting **Deposits**, the browser measured
`innerWidth=375`, `document.documentElement.scrollWidth=419` and therefore 44 pixels
of horizontal overflow.

Computed geometry isolates the defect inside `#folio-workspace`: the card is 336
pixels wide with a 334-pixel client box, but its grid resolves an intrinsic
`390.475px` column. `.folio-workspace-head`, `#folio-workspace-back`,
`#folio-statement`, `#folio-deposit-panel` and the deposit form all occupy that same
390.475-pixel track from x=28.8 to x=419.275. The document root consequently expands
beyond the viewport. The parent `#folio-workspace` itself records
`grid-template-columns: 390.475px` and `scrollWidth=406` despite `min-width:0` and
`max-width:100%`.

Minimal reproduction on the immutable candidate:

1. Run one isolated app/provider/PostgreSQL/Valkey stack from the candidate.
2. Authenticate a property-scoped operator and load a real folio.
3. Set the native browser viewport to 375x900 and select the Folio **Deposits** tab.
4. Compare `document.documentElement.scrollWidth` with `innerWidth` and inspect the
   computed boxes above.

This fails Order193 P5's explicit 375-pixel responsive requirement. It is product
behavior, not the separately disclosed browser harness limitation below. Approval
stopped at this blocker; the remaining authenticated operator 768/1024/1440, 200%
zoom, keyboard/focus, reduced-motion and no-JavaScript matrix is not claimed.

## Personally executed evidence

- Exact candidate and builder-governance identity were verified; the worktree was
  clean before governance recording and no product file was edited by this reviewer.
- A fresh isolated `setup.ps1 -DbOnly` stack applied migrations 0001-0022 and proved
  exact 89 public tables, 79 tenant RLS policies and referee 11/11.
- Pinned Linux Bun 1.3.14 migration security passed 23/23 with 118 assertions.
- Hosted-deposit HTTP/assets/UAT/operator/security proof passed 48 tests with six
  intentional environment skips and zero failures (520 assertions). A separate real
  authenticated operator HTTP run passed 22/22 (245 assertions).
- Hosted-deposit database proof passed 10/10; inherited financial payment proof
  passed 10/10; app-role/runtime authority passed. Canonical database acceptance was
  rerun against the correct freshly seeded database and passed 6/6 (13 assertions).
  An earlier invocation against the browser-fixture database produced the expected
  fixture-count mismatch and is not counted as evidence.
- Standing tests passed 290 with 521 intentional database skips and zero failures
  (3,614 assertions). Typecheck, 71-file boundaries, 23-package licence policy,
  exact-range diff, gzip budgets (98,300/98,304 initial and 3,701/8,192 lazy), and
  `bun audit --production` all passed.
- Guest and synthetic-provider pages had zero document overflow at native
  375/768/1024/1440 widths. Their visible copy stayed bounded to the approved
  property, folio, amount, currency and expiry surfaces.
- The in-app browser aborted the direct guest POST while handing navigation to the
  distinct provider origin. This is recorded only as a harness limitation. A direct
  server check proved the exact 303 and signed provider location; the supported
  browser then navigated the real provider origin, selected **Approve**, completed the
  signed callback and returned to guest server truth. Replaying the same provider
  result returned again without duplicating the financial effect.
- Exact browser/database accounting after that journey was one hosted request, one
  provider receipt, one successful 5,000-minor-unit capture, two applications totaling
  5,000, three distinct balanced journals, zero deposit-liability remainder, and a
  folio balance of 5,000 across three immutable lines. Receipt, capture and capture
  journal cardinality were each one; bearer storage was a 64-character hash only.
- Native partial application of 2,000 reduced the folio from 10,000 to 8,000 and
  native final application of 3,000 reduced it to 5,000. Clean Back exited without a
  dialog. Dirty Back produced the required confirm; dismiss preserved the draft and
  accepting discarded it. Final warning/error console collection was empty.

## Corrected-candidate evidence

- Exact repair diff `e25a62c..bb87e68` and `git diff --check` were clean; only the
  admitted operator CSS and permanent focused regression changed.
- A fresh isolated migrations 0001-0022 setup proved 89 tables, 79 RLS policies and
  referee 11/11. Canonical database acceptance passed 6/6, app-role authority 5/5,
  runtime authority 10/10, and pinned Linux Bun 1.3.14 migrations passed 23/23.
- Focused hosted/payment/operator proof passed 69 tests with six intentional
  environment skips and zero failures; the separately required authenticated
  operator HTTP execution passed 23/23 with 248 assertions.
- A real distinct-origin guest-to-synthetic-provider Approve flow returned through
  the signed callback to fresh guest server truth. Replaying the same provider
  result retained one durable receipt. Partial 2,000 and final 3,000 applications
  left one hash-only hosted request, two immutable applications totalling 5,000,
  folio balance 5,000, and zero unbalanced journals.
- Browser warning/error collection on the corrected folio/deposit surface was empty.
  The in-app automation connection timed out while its native dirty-exit dialog was
  open; the dialog itself appeared as required and the exact current-candidate
  executable dirty-family oracle passed. This harness limitation is not the blocker.
- The first authority aggregate invocation was deliberately discarded because
  mutually stateful database suites were incorrectly started together. The isolated
  stack was destroyed and rebuilt, and all claimed database results above were then
  executed serially on fresh resources.

## Re-review gate

Reduce the exact initial-shell gzip total to at most 98,304 bytes without removing
the D-516 containment, semantic content, accessibility, security or operator
behavior. A new immutable product candidate requires fresh independent verification
of the exact repair and the complete standing gate; prior passing evidence cannot
waive the failed executable ceiling.

Candidates `102563e` and `bb87e68` are not approved and are not eligible for local promotion,
integration, merge, push, public or production deployment, or Phase-wide completion.
The isolated reviewer stack and volume were removed; the sole
`yellow-local-current` stack on port 3000 remained healthy and untouched.
