# Order 193 hosted payment and deposit workbench independent review

**Conclusion:** CHANGES REQUIRED

**Exact product candidate:** `102563e99300f329388dc857c13a88140f2f2552`

**Builder governance:** `ec85b18fc3d8892c326e12c42e5831f9c003025a`

**Reviewer:** independent non-implementing OpenAI Codex Tier-3 reviewer

## Blocking P5 finding

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

## Re-review gate

Repair the 375-pixel intrinsic grid expansion without hiding document overflow or
weakening the semantic deposit/folio content. A new immutable product candidate then
requires a fresh independent Tier-3 P1-P6 execution, including the complete operator
375/768/1024/1440, 200% zoom, keyboard/focus, reduced-motion and no-JavaScript proof.

Candidate `102563e` is not approved and is not eligible for local promotion,
integration, merge, push, public or production deployment, or Phase-wide completion.
The isolated reviewer stack and volume were removed; the sole
`yellow-local-current` stack on port 3000 remained healthy and untouched.
