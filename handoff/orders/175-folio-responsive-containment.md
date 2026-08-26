# Order 175 — Folio responsive containment correction

**Status:** APPROVED — independently reviewed candidate `6870692`
**Phase:** 5
**Branch:** `phase-5/folio-responsive-containment`
**Base:** `b8c1b94c73c1f3b491794cead03c658113e8892c`
**Risk tier:** 2 — founder-critical responsive shell; no financial-authority change
**Owner:** Codex implementation; independent Order171 reviewer restarts P1–P6

## Trigger and outcome

The mandatory real-browser P5 review stopped Order174: the UUID folio workspace is
clean at 375 and 1440 CSS pixels, but at 768 it expands the document from 768 to 934
pixels and at 1024 expands it to 1214 pixels. The fixed 900-pixel statement table
escapes through grid-item intrinsic sizing instead of scrolling only inside
`.folio-table-wrap`.

Contain the folio grid item and its table wrapper so the document never overflows at
375/768/1024/1440 or 200% zoom, while preserving the semantic table on desktop/tablet
and the existing equivalent cards below 768.

## Scope

- `src/http/operator/operator.css` — only folio workspace/table containment rules;
- `tests/operator-folio-workspace.integration.test.ts` — permanent exact CSS
  containment/breakpoint/budget regression;
- this order plus additive `DECISIONS.log` and `handoff/LEDGER.md` evidence;
- Order171/173/174 governance may be updated only after independent approval.

No HTML, client JavaScript, route, API, domain/store, financial effect, permission,
schema, migration, dependency, runtime, credential, container or live port is in scope.

## Pre-registered proof

- **P0:** exact Base served UUID folio page reproduces root widths 934 at viewport 768
  and 1214 at viewport 1024, with visible document horizontal scrolling.
- **P1:** candidate at 375/768/1024/1440 has
  `document.documentElement.scrollWidth <= innerWidth`, zero visible control below 44
  pixels, bounded statement rows and no clipped workspace heading/tabs/summary.
- **P2:** the 900-pixel semantic table remains inside the independently scrollable
  `.folio-table-wrap`; below 768 the equivalent card view remains active.
- **P3:** 200% zoom, Apple/Pixel themes and reduced motion preserve containment; normal
  reservation→folio navigation and direct UUID refresh/re-login remain green.
- **P4:** focused/full/typecheck/boundaries/license/audit/gzip/schema/referee pass with
  no product delta outside the two named files.
- **P5:** independent reviewer restarts the complete Order171 P1–P6 oracle on the new
  immutable candidate; stopped evidence is diagnostic only.

## Definition of done

- [x] P0 is reproduced on exact Base.
- [x] P1–P4 pass with permanent regression evidence.
- [x] Independent reviewer executes and approves complete Order171 P1–P6.

## Independent approval — 2026-08-26

The complete P1-P6 restart passed on exact candidate `6870692`. Browser proof at
375/720/768/1024/1440, explicit 200% scale, both themes and reduced motion showed no
document overflow or undersized controls; the unchanged 900-pixel semantic table
scrolled only inside its local wrapper. Full evidence is in
`handoff/reviews/171-reservation-folio-journey.md`.

## Builder evidence

Product commit `453a2b6c08e74f05d1ec841949074333cc76ec51` adds only intrinsic-size
containment to the folio statement grid container, its direct `#folio-statement`
grid item and the existing local table scroll wrapper, plus a permanent exact CSS
regression. The 900-pixel semantic table, all columns, the below-768 card breakpoint,
HTML, JavaScript and routes remain unchanged.

Headless Chrome reproduced exact Base document widths 934 at viewport 768 and 1214
at viewport 1024. Candidate widths are 753/1009 respectively (the 15-pixel difference
is the vertical scrollbar and remains below `innerWidth`); 375, 720 and 1440 are also
contained. At 768/1024 the wrapper client widths are 686/652 while its scroll width
and table width remain exactly 900, proving local rather than document scrolling.
Apple and Pixel themes, reduced motion, unclipped workspace head/tabs/summary and
visible control minimums of 45 pixels or more passed; 375/720 activate the existing
card view, covering effective narrow layout at 200% zoom.

Focused proof passed 8/8 with 90 assertions. Standing proof passed 213, skipped 480
environment-gated tests and failed zero with 2,612 assertions. Typecheck, 66-file
boundaries, 23-package licence policy, dependency audit, diff check, protected hashes
and the 85,658-byte combined gzip budget passed. One sequential isolated PostgreSQL
and Valkey stack applied 18 migrations, matched the exact schema, loaded 85 public
tables with 75 RLS tables and passed the referee 11/11. The inherited Windows
`/proc/1/comm` setup readiness check rejected the healthy pinned container; the same
stack's exact remaining provision/migrate/fixture/schema/referee steps were therefore
run directly. Its containers, network, volume and generated authority file were
removed; ports 3000/3002 were untouched. Complete independent Order171 P1–P6 restart
remains required.

## Forbidden

Hiding document overflow globally, shrinking/removing statement columns, lowering the
900-pixel table semantics, disabling zoom, moving the mobile breakpoint to conceal the
bug, catch-all CSS, UI redesign, assertion-only fix, stale proof reuse, scope widening,
live-port replacement, merge, push or deployment.
