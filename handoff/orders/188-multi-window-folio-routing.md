# Order 188 — Multi-window folio routing

**Status:** READY — D-492
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
- contracts/UI specification/Phase-5 plan, this order, decision/ledger and independent
  review evidence.

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
7. Appearances remain exactly Apple, Android, Win95/98 and Glass. Motion is bounded
   transform/opacity spatial continuity, interruptible, at most 400ms, with immediate
   reduced-motion, coarse-pointer, forced-colour and no-backdrop fallbacks.

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
  375/768/1024/1440, 200%, reduced motion and forced colours; four appearances × three
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
