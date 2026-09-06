# Order 442 — Profile cards and three workspace skins

Status: BUILT — code review passed; rendered visual review and release remain blocked.
Date: 2026-09-06. Owner: Codex coordinator. Phase7 integration/design lane.

## Founder direction

The founder supplied Synthex and Sophie Bennett references, then explicitly
clarified that they are inspiration and Astra should improve the design. The
right-hand Sophie card is the primary reference for guest profiles and staff or
management user identities, not for operational task cards. All three previous
concepts — Calm Workbench, Precision Desk and Service Timeline — must be selectable
skins of one app. Changing skin must preserve the selected subject and entered
work. This supplements Order440; it does not replace the fiscal roadmap or change
the18 phases and approved11→13→17 priority.

## Scope and ownership

- Coordinator: this order, append-only DECISIONS.log/handoff/LEDGER.md evidence,
  handoff/reviews/442-workspace-skins.md, README.md, PROJECT.md current-release
  pointer only, docs/PROJECT-STATUS.md current verified integration evidence,
  docs/design/UIUX-DIRECTION.md, docs/design/STAFF-WORKBENCH-SPEC.md,
  docs/UI-SPEC.md, docs/DESIGN.md and design-qa.md.
- Coordinator: existing docs/design/staff-workbench/index.html, workbench.css,
  workbench.js, preview.mjs, package.json, design-qa.md; new assets/ with only
  generated fictional profile portraits, self-hosted licensed font/icons and
  provenance/notices; actual new browser captures and QA evidence in that folder.
  Existing comparator routes/arithmetic remain unchanged and their previous
  browser-policy block must not be bypassed.
- Bounded operator worker: src/http/operator/index.html, operator.css,
  operator.js; tests/operator-workspace-skins.test.ts. Add three presentation-only
  skins using existing authorized DOM/data and the existing six appearance
  families. No duplicate app, framework replacement or domain-state mutation.
  Identity-card styling may apply to existing authorized profile content; no
  fictional photo may be attached to a real user or guest identity.
- Bounded asset workers: generated profile image files and provenance notes only;
  public source references may remain scratch analysis. Do not ship the designer's
  portrait/artwork as a product asset. No purchase, designer contact or new account.

## Acceptance and boundaries

1. Three native labelled skin choices; skin change updates presentation without
   re-rendering forms, resetting drafts, changing the selected task, sending an
   API request, changing permissions or invalidating an idempotency identity.
   Unknown saved skin values fail to the default. Preference persistence, if
   used, contains only a validated skin identifier and tolerates unavailable
   storage. No sensitive guest/staff record goes into preference storage.
2. Profile reference: nested translucent rim, continuous portrait surface, gently
   frosted lower details and raised action pill. Product identity remains Yellow.
   The prototype uses explicitly fictional guest/staff IDs. Profile actions are
   meaningful; management badges never imply additional authorization.
3. Existing14 fictional cases and16 department views keep their actual ownership,
   privacy and evidence gates. Personally exercise YC01, YC09 and YC11, including
   wrong-payer rejection, plus skin-switch draft preservation and keyboard/phone
   behavior. Production skin controls must have meaningful DOM behavior proof.
4. Browser-render all three skins and the profile card; compare the selected
   source and implementation in a combined input. Record intentional adaptation
   and exact capture dimensions. No pixel-equality, real-device, live backend or
   physical laptop proof may be claimed without that evidence.
5. No applied migration, database/schema/seed, domain command, role grant, provider,
   financial operation, new operational API or weakened CSP. No portrait-upload
   capability or new access-control scope is introduced by this visual work.
6. Relevant tests, types/boundaries and exact-source CI remain required. A draft PR
   may obtain the real PostgreSQL referee where local PG is unavailable; it is not
   reviewable until11/11 and all five CI jobs pass. A different non-implementing
   reviewer must approve and integrate; the coordinator never self-merges.

Baseline: independently merged PR85 main
b5ef70842b658183f7b5b4c650c8e78c7a0b513d, CI187 all five green;77 migrations,
127 public base tables including schema_migration. Release images passed at that
exact source. No cloud-serving or laptop refresh receipt exists in this session.

## Implemented and independently checked

All three page-session skins are selectable in production and the fictional study.
The six appearance families and all14 case definitions remain intact. Source icons,
licensed Urbanist and two generated fictional portraits have exact-byte provenance.
The [independent review](../reviews/442-workspace-skins.md) personally executed46
production tests, the actual prototype script's key ownership/payer flows, both
comparator arithmetic tests, types and171-file boundaries. Its four material CSS
findings were repaired. No material code finding remained at the final check.

The new cloud preview could not render: browser URL policy explicitly blocked its
root. No workaround was attempted. [Current QA](../../design-qa.md) records the
missing screenshot/comparison evidence. Existing Order440 images are historical.
Code approval does not discharge that gate. The author must not self-merge, and
this UI candidate must not be labelled released until the remaining proof passes.

The first published candidate `9337c560` in [PR86](https://github.com/dcpnode-maker/yellow/pull/86)
failed three standing final-forced-colours checks in
[CI34003844519](https://github.com/dcpnode-maker/yellow/actions/runs/34003844519).
Local review and Windows state passed; database and container jobs were skipped.
The repair moves the existing consolidated management/pickup/HK guard into the
last forced-colours block alongside the new skin rules, preserving every guard
declaration and all existing test expectations. The targeted four suites pass
19/19 with259 assertions; type checking also passes. This is repair evidence,
not a substitute for fresh exact-source CI or the blocked rendered review.

## Handoff to the already authorized laptop Codex session

The founder explicitly requested this handoff. It is prepared in this same branch
and will be posted on its draft PR; that proves availability, not laptop receipt or
execution. No callable laptop terminal/browser is exposed to this coordinator.

1. Read PROJECT.md, AGENTS.md, current status, this order and the review. Inspect
   the laptop checkout and running app first; preserve unrelated fiscal work and
   the working local installation. Fetch `phase-7/profile-cards-and-workspace-skins`
   from the same repository. Review the exact PR head, not an earlier screenshot.
2. Use a clean checkout or an isolated worktree if necessary. In
   `docs/design/staff-workbench`, `npm run dev -- --host 127.0.0.1 --port 4173`
   runs the static fictional study. Use the laptop's own authorized browser and
   applicable instructions. Do not route around the blocked cloud browser.
3. Review Calm, Precision and Timeline at the same fixture state; inspect both
   Profiles cards. Try View stay/View shift, the partly checked skin-switch path,
   all six YC01 steps, changed-BEO YC09 and wrong-payer YC11. Check900px as well as
   desktop/390px, keyboard, zoom, reduced motion and forced colors.
4. In a supported disposable review runtime, inspect the actual production skin
   selector and Glass parking/check-in/HK/finance/profile surfaces. Preserve all
   existing six appearances and detail modes. Do not refresh a retained hotel
   database merely to produce a screenshot.
5. Capture actual source and implementation, record viewport/state/DPR and compare
   whole views plus the corresponding profile region in one input. Update both
   QA records with real evidence; fix any remainingP0/P1/P2 and repeat. Intentional
   portrait/content changes are adaptations, not pixel equality.
6. Confirm exact-head all-five CI, database catalogue77/127 and referee11/11. A
   non-implementing reviewer may then approve and merge; post-merge CI and release
   receipts identify the exact source. Cloud serving and laptop runtime refresh
   need their own actual receipts and must not be inferred from image publication.
