# Order 188 — Multi-window folio routing

**Status:** READY — D-492 / founder visual corrections D-493–D-495
**Phase:** 5 · folios, postings and settlement
**Branch:** `phase-5/folio-charge-correction-resumed`
**Base:** `29f8489` (Order187 static-approved/browser-pending governance head)
**Risk tier:** 3 — immutable financial routing, schema, authority and concurrency
**Owner:** Codex implementation; independent non-implementing Tier-3 financial reviewer

## Outcome

Let an authorized operator organize one reservation account into multiple named folio
windows such as Business, Personal and Corrections. Staff may move whole governed
charge groups between those windows without editing, deleting or reassigning any
existing journal or posting row. Every move is a new balanced `transfer` journal with
typed lineage, durable idempotency, fact/outbox evidence and server-derived balances.

This is the smallest natural solution to the founder's invoice-separation intent. It
organizes future document inputs; it does not issue, number, tax-finalize or print an
invoice.

## Natural-solution test

The current schema already models a folio as a presentation window over one account,
and `folio_balance` derives each window balance from immutable posting lines. Routing
must therefore append equal-and-opposite guest-account posting pairs between sibling
folios. Updating `posting_line.folio_id`, deleting history, hiding rows only in the
browser, or storing hot lineage in untyped JSON contradicts the financial and JSON
invariants and is forbidden.

## Exact scope

- new additive migration `migrations/0020_multi_window_folio_routing.sql` plus exact
  expected schema, migration acceptance and runtime-DML/definer tests;
- `src/contexts/financials/folios.ts`, one new bounded transfer service and its context
  export;
- `src/contexts/financials/statements.ts` and `corrections.ts` only for safe sibling
  projection, server-owned groups and correction/routing arbitration;
- existing operator HTTP/application routes and canonical DTOs;
- existing operator HTML, CSS and JavaScript for one multi-window workbench;
- canonical review seed permission additions only;
- focused domain, HTTP, authority, UI, accessibility and founder-journey tests;
- contracts/UI specification/Phase-5 plan, `docs/DESIGN.md`, this order,
  decision/ledger and independent review evidence.

No file outside the exact paths named by the committed order may change without a
written question and additive decision.

## Schema and authority contract

Migration 0020 must:

1. Add a tenant-coherent candidate key on `posting_line (tenant_id, id)` and nullable
   `folio_transfer_root_line_id uuid` with a tenant-leading self foreign key to the
   canonical original guest posting line. Add the exact tenant-leading partial lookup
   index and checks required to forbid self-reference and invalid transfer lineage.
2. Keep original charge/correction rows byte-identical. Transfer lines inherit one
   canonical root; transfer lines never become roots. Do not use `journal.reverses`,
   which remains correction-only, and do not encode lineage in `journal.source` JSON.
3. Add one bounded `yellow_owner`-owned, safe-search-path SECURITY DEFINER command
   capability. Exact `app_role` alone may execute it after the real runtime role and
   transaction-local tenant are verified; `PUBLIC`, direct runtime and raw hostile
   callers remain denied.
4. Accept one source folio, one destination sibling folio, 1–50 typed root UUIDs,
   bounded actor/reason inputs and no client amount/account/date/currency/kind/source.
   The capability deterministically locks and derives the open same-tenant,
   same-property, same-reservation, same-account, same-currency family, current open
   business day and each root's exact whole current allocation.
5. Append exactly one `transfer` journal and two lines per selected root: the signed
   source contra and equal destination allocation on the same account, tx code,
   description, quantity, business date and typed root. The journal balances at zero
   and returns no customer/Party data.
6. Fail closed, with no header or partial artifact, when any root is stale, split,
   corrected without its contra companion, moved concurrently, sealed, closed,
   foreign, forged or otherwise ineligible. No new table, event, role, credential or
   dependency is admitted.

Direct `UPDATE`/`DELETE` of journals/posting lines and direct write access to the new
lineage column remain absent.

## Command contracts

### Open an additional window

`FolioService.openAdditional` uses the existing `financials.folios:open` property
permission and a retained idempotency key. It serializes on the reservation/account,
derives the next gap-free `window_no` and human folio reference on the server, creates
one open sibling over the exact same account/reservation/property/currency family and
emits the existing `folio.opened` evidence. Names are trimmed, 1–80 visible characters,
unique within the family and limited to 20 total windows. Presets are Business,
Personal and Corrections; custom names are allowed.

### Preview and commit routing

`FolioTransferService.preview` and `.transfer` require new exact property permission
`financials.transfers:write`. The canonical body contains source folio, exactly one
existing destination folio or one new-window name, 1–50 server group IDs, reason,
generation and preview revision. It contains no amount, account, date, currency,
journal kind or authority field.

Preview is read-only and returns exact server money strings, before/after source and
destination balances, unchanged stay total and immutable member effects. Commit
recomputes every guard, uses durable operation `financials.folio.transfer`, calls the
owner capability once, and emits existing `journal.posted` fact/outbox evidence.
Identical replay is byte-equivalent; a changed body conflicts.

## Statement and group contract

The safe folio workspace response adds open sibling windows (id, window number, human
reference, name, status and exact server balance only), exact stay/account total and
currency, and per-row server-owned `transferGroup` metadata (opaque id, member count,
eligibility/reason and current window id). It exposes no account, Party or PII.

A normal charge is one whole transferable group. An original charge plus its immutable
contra correction is one indivisible two-root group and may be moved together to a
Corrections window. The browser never groups by inference and never sums money.
Correction remains allowed only while the original root's outstanding allocation is
fully restored to its original folio; transfer and correction races have exactly one
coherent outcome.

## One-workbench UI contract

1. The header shows server-derived stay total, active-window total, currency and window
   count. A roving `Folio windows` tablist exposes each sibling's number, name,
   reference, balance and status; arrows wrap, Home/End and Enter/Space work, only the
   active tab has `tabindex=0`, and the selected folio UUID stays deep-linked.
2. Active-window tasks are Statement, Add charge and Organize charges. Correction is a
   contextual action on an eligible immutable row, not a permanently focusable dead
   tab. One global operation-status live region remains outside hidden panels.
3. New-window and organize flows are inline review tasks, not modal stacks. Organize
   selects whole server groups, a sibling or new destination, a 1–500 character
   reason, then server preview and explicit acknowledgement before commit. Advanced
   and Expert drag affordances may only populate this review; keyboard/buttons remain
   complete equivalents.
4. Copy states: “Financial history is never edited. Yellow adds a balanced transfer.”
   and “No invoice is generated here; this organizes folio windows for later document
   issue.”
5. Simple shows View bill, Separate charges and Correct a wrong charge. Advanced keeps
   the window rail and batch selector visible. Expert adds dense lineage and shortcuts.
   All three use one DOM and the exact same canonical command.
6. Appearance/detail changes preserve property, active window, selection, destination,
   preview, reason, acknowledgement, idempotency and logical focus. Window/property/
   route/back/sign-out/beforeunload exits guard dirty drafts. Failed writes retain the
   key and focus the error. Stale responses paint and navigate nothing. Success
   refreshes server truth, announces globally and focuses the new/target window.
7. D-494 supersedes D-493's temporary three-value catalogue. Appearances are exactly
   Apple iOS, Android 17 / native Pixel, Windows 95/98, Glassmorphism and Neomorphism.
   Apple remains the fail-closed default. A skin is a complete composition, control,
   depth and motion system, never a palette alias.

## Founder visual correction — D-493

The current approved local and static Order187 candidate are not accepted as the final
visual standard. D-494 supersedes only D-493's temporary catalogue reduction; all
quality, performance and proof requirements remain. Order188 must prove five original
Yellow systems:

1. **Apple iOS** — content-first reduction, native system typography, large-title to
   compact-title continuity, grouped/inset planes, precise icon-only system controls,
   spring-like navigation, tactile press states and a spatial sheet/workbench model.
   It must feel like a current first-party Apple operations application, not rounded
   white ERP cards.
2. **Android 17 / native Pixel** — current Pixel information architecture, edge-to-edge
   adaptive layout, Material 3 Expressive shape and motion hierarchy, tonal surfaces,
   predictive-back continuity, 48dp controls, state layers, navigation rail/bar
   adaptation and native-feeling emphasized/decelerated easing. It must not be Apple
   with Pixel colours or generic Material cards.
3. **Windows 95/98** — authentic desktop grammar: taskbar/start affordance, application
   title bar, menu strip, overlapping/inset MDI work areas, system-grey controls,
   exact light/dark bevels, dotted focus, pressed pixels, classic status bar and
   immediate no-easing interaction. It must not be modern cards with square corners.
4. **Glassmorphism** — a luminous spatial environment rather than transparent cards: original
   layered ambient scene, stable refractive shell, three visibly separated depth
   planes, edge/specular light, subtle parallax at point of intent, document-to-detail
   continuity and dense opaque financial glass. Backdrop blur supports hierarchy but
   never constitutes the design by itself.
5. **Neomorphism** — a dedicated tactile environment with one coherent virtual light
   source, concave/convex control states, pressed wells, raised command clusters,
   restrained low-chroma surfaces and unmistakable focus/error/disabled semantics.
   Depth communicates function; shadows never replace borders, contrast or hierarchy.
6. Native CSS perspective, View Transitions and Web Animations may be used with
   feature-detected fallbacks. A dependency, WebGL or external asset is admitted only
   if executable evidence proves native technology cannot meet the result and the
   added cost remains within Yellow's low-latency/offline/security boundaries. No such
   dependency is presumed by this decision.
7. Interaction must remain smooth at a measured 60fps target on the founder laptop:
   transform/opacity only during routine transitions, no layout thrash or animated
   blur, no long task over 50ms, no permanent GPU hint, full interruption and exact
   reduced-motion/coarse-pointer/forced-colour/no-backdrop fallbacks.
8. Settled screenshots and recorded transitions at authenticated real workflows—not
   isolated mock cards—must make the five products recognizably different with the
   colours removed. Theme switching preserves route, property, window, draft, preview,
   idempotency and logical focus.
9. D-495 admits one canonical `docs/DESIGN.md` evidence and implementation atlas. It
   maps the founder-supplied screenshots and both local reference videos to original
   Yellow composition, control, depth, motion, accessibility and performance rules;
   it may link public source pages but must not copy or commit third-party assets,
   duplicate the supplied media, or expand product authority.

## Required intentional red and executable proof

- **P0 red:** exact Base lacks additional-window command, typed routing lineage,
  route authority/API/UI, roving folio tabs and beforeunload coverage. Commit bounded
  failing regressions before product implementation.
- **P1 schema/authority:** migration/replay/schema hashes, FK/check/index/ACL/owner/
  search-path/pg_temp proofs; raw lineage DML and forged calls leave zero artifact.
- **P2 windows:** exact family derivation; 20 concurrent creates serialize to gap-free
  unique numbers/references; replay is byte-equivalent; rollback leaves no gap; cap,
  name, status, tenant/property/reservation/account/currency attacks fail.
- **P3 routing:** ROOM to Business, SPA/ALCOHOL to Personal and one corrected pair to
  Corrections append balanced transfers; original hashes/counts stay unchanged; each
  window balance changes exactly and stay/account total is zero-net.
- **P4 reroute/concurrency:** Business→Personal repeated routing keeps exact typed
  history; 20-way same-group race has one winner; changed-body conflict, injected
  evidence/idempotency failure and transfer-versus-correction race are atomic.
- **P5 sealed/hostile:** sealed day, closed folio, cross-tenant/property/reservation/
  account/currency/source/destination/group, raw DML and authority forgery fail with
  zero mutation.
- **P6 HTTP/UI:** exact bodies/status/replay/safe responses; every detail mode emits
  the same command bytes; no Party/PII/account leak or client money math.
- **P7 real browser:** keyboard create/move/correct/isolate and pointer review;
  retry/same-key, stale, back/refresh, draft/focus/theme/detail preservation at
  375/768/1024/1440, 200%, reduced motion and forced colours; five appearances × three
  details; 44px targets, no root overflow or runtime/request error.
- **P8 complete gates:** focused/standing suites, typecheck, boundaries, licences,
  audit, protected hashes, exact schema/database acceptance and fresh referee 11/11.
  A non-implementing Tier-3 reviewer personally executes P1–P8 on the exact candidate.

## Forbidden

- editing/deleting/reassigning history or using `journal.reverses` for moves;
- arbitrary account/amount/date/currency/kind/source or client-derived money/routing;
- partial-charge allocation, cross-account/company/AR transfer, payment, settlement,
  cashier, deposit, trust, fiscal/tax/document/invoice issuance or business-day close;
- JSON-only hot lineage, new table/event/role/credential/dependency or 0001 edit;
- guard/test/referee/security weakening, second local, public bind, credentials,
  active-local mutation before approval, merge/push/production claim.

## Definition of done

- [ ] Additional windows and whole-group routing are governed, immutable and usable.
- [ ] Business/personal/correction separation preserves one exact account-wide truth.
- [ ] All proof P0–P8 passes on the exact candidate.
- [ ] Independent Tier-3 review approves the exact candidate.
- [ ] Only an independently approved candidate may replace the sole local app.
