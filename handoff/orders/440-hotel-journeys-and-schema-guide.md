# Order 440 — Hotel journeys, staff workbench design and schema clarity

Status: ACTIVE — research and design integration; no new operational capability claimed.

## Authority and purpose

Ankit's follow-up to the 2026-09-05 Astra takeover asks Codex to explain the
80-versus-127 table count in GitHub, independently document the guest and staff
journey across hotel departments, develop case studies and use those findings for
Yellow UI/UX. This is a continuation of the one Codex Yellow task, alongside the
Order434 fiscal source (now merged through PR83) and the reviewed Orders438/439
operational baseline.

## Scope

- Current schema-count explanation in README.md, PROJECT.md, START-HERE.md,
  START-HERE-WINDOWS.md, USAGE.md, setup.sh and docs/PROJECT-STATUS.md; add
  docs/SCHEMA-GUIDE.md. Preserve immutable baseline and exact released/candidate
  distinction; do not relabel historical counts or change executable assertions.
- Expand docs/design/STAFF-JOURNEYS.md; add docs/design/HOTEL-CASEBOOK.md,
  docs/design/STAFF-WORKBENCH-SPEC.md and docs/research/HOTEL-OPERATIONS-REVIEW.md.
  Use dated primary sources, original synthesis and explicitly synthetic cases.
  The founder's later UI/UX and naming directive additionally admits
  docs/research/HOSPITALITY-UX-BENCHMARK.md,
  docs/research/APP-NAME-SHORTLIST.md and docs/design/UIUX-DIRECTION.md for current
  design benchmarks, reusable-source provenance, measurable design choices and
  preliminary name research. Names remain proposals until selected; no account,
  domain registration, brand replacement or unlicensed asset copying is admitted.
- A dependency-free, locally viewable interaction prototype under
  docs/design/staff-workbench/ with fictional records and explicit design status.
  Extend the existing Yellow design language. The founder's later pixel-match and
  laptop-handoff requests add an offline screenshot comparison utility and an
  explicit local-session capture brief in this order; never retrieve a blocked page
  through another surface. No API, database, credential,
  operational-state or provider mutations; no substitution for the main app.
- Link these requirements into BUILD-PLAN.md, docs/UI-SPEC.md, docs/DESIGN.md,
  docs/FEATURE-REGISTER.md, docs/PROJECT-MAP.md, docs/research/README.md,
  docs/PROJECT-STATUS.md and handoff/PHASE-7-PLAN.md. The explicit
  [Question196 amendment](../questions/196-order440-current-guide-reconciliation.md)
  adds current-frontier summaries in docs/CODEX.md, handoff/ROADMAP.md,
  docs/LOCAL-REVIEW.md, docs/RELEASE.md, docs/CONTRACTS.md and docs/EVENTS.md,
  plus the recorded app status in src/project-status.ts and its two existing
  status tests. No domain command or event contract changes.
- This order, its independent review receipt under handoff/reviews/, and append-only
  handoff/LEDGER.md and DECISIONS.log evidence. Preserve older entries.

## Acceptance

1. Explain 80 baseline tables, 81 with the runner ledger, and exact branch-specific
   release/candidate totals with commit and CI evidence. `bun init` is not an
   instruction to recreate this existing project. Applied migrations stay unchanged.
2. Cover reservation, arrival, stay, departure and after-stay experience; workday and
   handoffs for FO, HK, engineering, concierge/bell/transport, security, reservations,
   sales/groups, banquets, F&B/kitchen, spa, purchasing/stores, finance/night audit,
   management/revenue and STR ownership. Name owner, acknowledgement, context,
   deadlines, evidence, exception and guest communication responsibility.
3. Cases specify trigger, competing needs, recovery and observable acceptance.
   Business-policy choices remain configurable; medical, financial and personal
   details are disclosed only to roles needing them. No invented field studies,
   performance statistics or production capability.
4. Prototype shows department queues, context, a guest journey and acknowledged
   handoff through a complete fictional case. Main controls work, browser errors
   and keyboard/mobile layout are checked; simulation does not imply live writes.
5. Existing phase priorities, six appearance families, governed command boundary,
   tenant/inventory/financial invariants and evidence gates remain intact.
6. Independent source/interaction review and green CI before main merge. A draft PR
   may obtain genuine PostgreSQL CI proof; it is not reviewable until the canonical
   referee reports 11 passed, 0 failed. The author never self-merges.

## Integration boundary

This order designs across Phases6/10/11/12/15/17 while execution remains Phase7.
Phase17 departments are planned; a design prototype does not complete that phase.
Order434 CI repairs remain on its existing development lineage and separate scope.
No force push, branch deletion, runtime grants, applied SQL edits, cloud host,
payment, message sending or new vendor account is admitted here.

## Laptop session handoff — visual reference and measured fidelity

**Dispatch status:** prepared in Git; no remote laptop-session connection is exposed
in the coordinating Work Mode session. This file does not prove receipt or execution.
Ankit explicitly authorized handing local-only visual tasks to the already running
laptop Codex session. Continue this order and the same Yellow roadmap.

Read PROJECT.md, AGENTS.md, docs/PROJECT-STATUS.md and this order. Inspect branch,
head and dirty files first; preserve existing laptop work. Fetch reviewed main and
use an isolated `phase-7/` worktree if the active checkout has unrelated changes.
Do not switch or reset a dirty checkout, start a competing roadmap or overwrite
ongoing work. Current native source baseline is main443e3826 from PR83 (77/127).

The visual task is to establish an independently chosen source image and then make
its corresponding implemented screen match. The new staff workbench extends
Yellow's existing language; an existing login screen is not the same design state
as a department queue and cannot be a full-screen pixel-match target for that queue.
If the founder has a selected mockup/frame, use its original export. Otherwise,
capture the locally authorized existing app for component/style reference and obtain
selection of the intended new screen before treating it as a full visual target.
Never call a screenshot of the implementation its own independently approved target.

1. Use the laptop's authorized local browser and its applicable browser instructions.
   Capture only a local app the session is already allowed to access. No proxy,
   alternate route or remote browser is to be used to retrieve the cloud-blocked
   reference page. A capture of the user's existing local app or an independently
   supplied design export is a new, explicit source artifact.
2. Start the actual app only through docs/RELEASE.md and its supported launcher;
   report serving SHA, expected migration77, readiness and login separately from the
   design preview. Preserve hotel data and credentials. Use fictional/redacted
   records in screenshots committed to this public repository.
3. Open the design study using its local instructions. Record route, role, fixture,
   selected case and step, viewport, browser/OS versions, loaded font, DPR, theme,
   zoom and scroll position for source and implementation. Prefer lossless PNG.
   Capture both at the exact same viewport and state; never rescale one silently.
4. Use `docs/design/staff-workbench/compare.html` offline with the two images. It
   requires equal dimensions, reports strict decoded RGBA differences and supplies
   side-by-side, overlay and difference views. Zero differences prove equality of
   those supplied decoded images only. Different fonts/OS rasterization, JPEG
   compression or different content must not be relabeled as a pixel-perfect pass.
5. Fix actionable differences in typography, spacing, tokens, real assets and copy;
   recapture and compare after each iteration. Test FO→HK→inspection→FO, BEO version
   acknowledgement and exact-payer outlet reconciliation, keyboard use and mobile
   overflow. Preserve all functional and domain boundaries.
6. Add source/implementation images and a provenance note under this prototype's
   directory; update its `design-qa.md` with combined full-view and focused-region
   evidence, dimensions, changed-pixel counts, fixes and remaining differences.
   If the target is unavailable, record `final result: blocked`; do not invent a pass.
7. Return changes by a scoped PR, green exact-source CI and independent review. The
   implementing laptop session must not merge its own PR. Update this dispatch
   status only after actual receipt, then execution evidence, are available.

Copyable instruction for the running laptop session:

> Continue Yellow Order440's “Laptop session handoff — visual reference and measured
> fidelity” from the latest reviewed Git source. Preserve the active checkout and
> ongoing work, establish the reference image, complete local screenshot comparisons
> and return fixes plus design-qa evidence through the same Codex Yellow review flow.
