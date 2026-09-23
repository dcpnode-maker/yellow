# Review 440 — independent hotel-journey and staff-workbench review

**Order:** 440, including Question196

**Reviewer:** Codex `/root/journey_review`, independent of the implementation

**Date:** 2026-09-05

**Reviewed source:** shared working tree on
`phase-7/staff-journeys-and-schema-guide` after integration of remote
`main` `443e3826b47025106d1829fcbb406ce6302fbbba`

**Disposition:** **BOUNDED PASS for the written guides and exercised fictional
interaction prototype. ORDER440 ACCEPTANCE REMAINS BLOCKED on visual-source
fidelity, final committed-source binding and exact-head CI.**

The reviewer did not author the journey guides, research synthesis, casebook,
schema guide, prototype, QA record or governance reconciliation. This receipt
does not approve a production application, authentication model, hotel-domain
command, database mutation, phase completion, deployment or merge.

## Findings and corrected behavior

The initial independent browser review found one material interaction defect in
YC-11. A user could assert exact-account, request and receipt reconciliation with
checkboxes even though the prototype showed no concrete source or target identity.
That made the fictional evidence easier to claim than to inspect.

After the correction, the reviewer personally repeated the flow. The outlet view
showed original attempt `POS-1842-A`, source check `1842`, INR2450 and recorded
target Mira Shah / personal folio `F-412-M`. Selecting Rohan Shah / company folio
`F-412-R` and checking every acknowledgement left the action disabled and displayed
the inline blocker that the account differed from the original request. Selecting
Mira enabled reconciliation. Finance then received fictional receipt `P-8726`,
accepted at 13:38 IST, with the same attempt, check, account and amount and the
explicit result “One existing posting. No new posting or tender.” Both handoff
receipts remained visible through completion. No further material functional
finding remained in this flow.

## Personally executed interaction evidence

The reviewer used the authorized cloud-browser session against the loopback preview
and exercised meaningful paths rather than inspecting screenshots alone.

- **YC-09 BEO version4:** Banquets reviewed the +15-person delta and acknowledged
  it; Kitchen reviewed menu/dietary impact and acknowledged it; Stores reviewed the
  revised supply need and acknowledged it. All three version-specific receipts
  remained visible and the case reached review complete.
- **YC-11 outlet timeout:** The reviewer performed the wrong-account denial,
  correct-account reconciliation and finance receipt completion described above.
  The action remained fail-closed until the concrete recorded target matched.
- **Phone and keyboard containment:** In the 390 CSS-pixel layout, the app shell and
  main region each measured 388 client and scroll pixels, with no horizontal
  overflow. The focused detail supplied a back-to-queue control. Escape returned
  focus to the selected queue task, and `/` focused search.
- **Runtime surface:** The fresh reviewer tab reported zero application console
  warnings or errors in the exercised states. Browser-extension metadata failures
  observed by the coordinator were outside the prototype and are not represented as
  application fixes.

The coordinator separately reports a completed six-step YC-01
FO→HK→cleaning→inspection→FO sequence, prerequisite blocking and retained receipts.
That is useful corroboration but is not relabeled here as this reviewer's personal
execution.

## Documentation, source distinctions and schema truth

The reviewed research uses primary vendor or regulator material for concrete
operational distinctions and labels the resulting queue, timeout and evidence model
as design synthesis. It does not claim property interviews, measured performance,
field validation or universal policy. The casebook consistently separates its 16
written cases from the 14 prototype cases: YC-07 and YC-12 remain documentation-only
until authenticated domain commands and failure evidence exist.

The workbench documents and renders itself as a fictional in-memory study. The
reviewer found no network request, browser storage, cookie, authentication or domain
write path in the prototype. Department selection is explicitly described as a
design role rather than authentication. Guest names, folio references, receipts and
financial amounts are synthetic and purpose-bound to the relevant handoffs. The
production mapping points to existing Yellow contexts without claiming those
contexts already implement these proposed workflows.

The schema guide now keeps four different counts distinct:

| Source | Migrations | Public tables | Meaning |
|---|---:|---:|---|
| Immutable `0001_init.sql` | 1 | 80 | Historical application-table baseline |
| Phase-0 runner catalogue | 1 | 81 | Baseline plus `schema_migration` ledger |
| Earlier main `5879e2b7` | 75 | 125 | Historical reviewed catalogue |
| Remote main `443e3826` | 77 | 127 | Current reviewed catalogue after PR83 |

The reviewer personally read the current commit object and counted 77 numbered SQL
migrations and 126 migration-declared tables; adding the runner-owned ledger yields
127. Migration76 adds the two new tables and migration77 adds no table. The local
`main` branch name remained at `5879e2b7` during this review, while
`origin/main` resolved to `443e3826`; the documents correctly describe the reviewed
remote main rather than the stale local branch pointer.

Coordinator-supplied remote evidence records PR83 source `92346674`, CI178 run
`33993977811` with all five jobs green, deployment acceptance23/23, exact normalized
schema and referee11/11. It also records post-merge main CI179 run `33994717854`,
database job log `101383330884`, and release run `33995471357` green. The reviewer
did not initiate those runs and does not treat them as proof for a later Order440
head. Historical CI175/176 failures remain valid drift evidence and are not presented
as the current state.

## Visual evidence and blocked fidelity gate

The reviewer inspected `preview-desktop.jpg` and `preview-phone-layout.jpg`. Both are
actual 1348×926 JPEG captures. The desktop composition is coherent and the phone
image honestly shows a 390-pixel simulated app container inside a desktop capture;
it is not described as a physical-device screenshot.

There is no independently selected source screenshot or mockup for this new
department workbench. The one authorized navigation to the inert reference page
failed with:

```text
Browser Use cannot open http://terminal.local:4173/reference.html in tab 4.
Browser reported: net::ERR_BLOCKED_BY_CLIENT
```

A subsequent attempt to inspect that blocked tab was rejected by the browser URL
policy, which explicitly prohibited workaround, indirect execution, raw browser
commands or alternate browser surfaces. The reviewer stopped and did not retry or
circumvent the restriction. Source code and general Yellow tokens can guide an
original design, but they cannot establish pixel equality for a new full-screen
queue.

Accordingly, the saved implementation images are valid functional and layout
evidence, while typography, spacing, color, wrapping, DPR and changed-pixel fidelity
remain unverified against a source. The offline comparator is built as a bounded
utility. Static review confirmed that it reads only user-selected raster files,
rejects unequal dimensions, performs strict decoded RGBA equality without resize,
crop, masking or tolerance, and reports changed pixels, per-channel positions,
alpha-only differences, overlay and a binary difference map. It caps each file at
20 MiB and each decoded image at 8,500,000 pixels, revokes its temporary object URL,
and has no fetch, browser-storage, cookie or messaging path. The preview keeps a
fixed file allowlist and a CSP with `connect-src 'none'`; local-file markup also
states the comparison boundary.

The reviewer personally ran the comparator core's two Node tests. They passed the
strict 2×2 RGBA/channel/alpha accounting case and fail-closed dimension-mismatch
case. Syntax checks for `compare-core.js`, `compare.js` and the revised preview
server also passed. The cloud browser refused `/compare.html` with the same
`net::ERR_BLOCKED_BY_CLIENT` class before page load. At the coordinator's direction,
the reviewer did not retry through a file URL, alternate route or browser surface.
The comparator is therefore **statically reviewed and numerically unit-checked but
browser-unverified** in this receipt. It cannot turn a missing source into a
pixel-match pass.

## Recorded-status reconciliation

The Question196 status amendment sets `currentOrder` to 440 and records the already
independently approved Order434/PR83 source without changing the historical
all-orders review frontier, phase count, active phase or individual phase states.
It keeps provider activation, operator invoice UI, retained local runtime, cloud
hosting and Phase 7 completion outside the approved receipt.

The first stable status diff added recorded order 434 without adding 434 to the
`ProjectRecordedWorkSnapshot["order"]` union. The reviewer reported that compile
blocker, and the coordinator added the missing literal before the final static pass.
No further status-structure or capability-truth mismatch remained in the reviewed
working tree. The coordinator's focused status result is seven passed, two explicit
database skips and zero failures with 143 assertions; the reviewer could not rerun
that Bun suite because Bun is not installed in this review shell, so that result is
not relabeled as personal execution.

## UX benchmark, design direction and preliminary naming

The final Order440 scope adds `HOSPITALITY-UX-BENCHMARK.md`,
`UIUX-DIRECTION.md` and `APP-NAME-SHORTLIST.md`. The reviewer found their evidence
boundaries suitable for integration:

- Vendor/help-centre behavior is labeled as published documentation. Yellow's queue,
  drawer, retry, mobile and measurement rules are labeled as inferences or proposals,
  without first-hand usability, staff-preference, speed or revenue claims.
- The direction preserves governed commands and distinguishes clean, inspected,
  occupied, assignable, delivered, billed and settled facts. It proposes three
  layouts to compare rather than claiming a selected or shipped design.
- The design-source inventory records only upstream licensing signals, adds no
  package or copied asset, and requires exact revision/provenance and separate asset
  checks before reuse.
- The name list is explicitly preliminary. It records obvious collision/search
  uncertainty, rejects close hospitality uses, keeps Yellow only as a continuity
  option, and requires later trademark, company-name, app-store, domain and
  native-language clearance. It performs no rename, registration or purchase.

The reviewer personally sampled the linked Cloudbeds daily-operations, Apaleo group
charge-routing, Linear triage and W3C target-size sources and found the cited claims
accurate at review time. Yellow.ai and Stayloom pages supported the documented
collision caution. The Mews page did not expose readable content through this
reviewer's web reader, so its row is not relabeled as personally revalidated. The
documents' broader primary-source desk-research provenance remains author evidence.
No material source-attribution, privacy or capability-truth finding remained.

## Static checks and remaining gates

The reviewer personally ran and passed:

```text
git diff --check
node --check docs/design/staff-workbench/workbench.js
node --check docs/design/staff-workbench/preview.mjs
node --check docs/design/staff-workbench/compare-core.js
node --check docs/design/staff-workbench/compare.js
node docs/design/staff-workbench/compare-core.test.cjs
bash -n setup.sh
```

A local-relative-link scan of the Order440 guides, research, specification and QA
found no missing target. The prototype server retains an explicit file allowlist and
restrictive CSP, with no repository browser or credential surface.

Before Order440 can receive an unqualified approval, the complete Order440 source
must be committed to an exact candidate head and that exact head must pass the
required CI/referee gate. The comparator's interactive browser path also remains
unverified in this environment.
Pixel-fidelity approval additionally requires a selected source image, matched
viewport/state/DPR/fonts, lossless captures, measured full-view and focused-region
results, concrete corrections and a repeat comparison. Until then, the honest final
visual result is **blocked**, even though the bounded documentation and exercised
fictional interaction behavior pass this review.

Subject to binding this unchanged reviewed content to the final candidate and its
green exact-head CI, the reviewer **approves bounded integration of the Order440
journey, schema, status, UX research, preliminary naming and fictional interaction
study**. That approval deliberately leaves the selected-reference/pixel-fidelity and
laptop execution task pending as separate evidence.
