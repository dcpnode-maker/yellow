# Independent review — Order 176 adaptive experience shell

**Verdict:** CHANGES REQUIRED  
**Reviewer:** independent non-implementing OpenAI Codex  
**Candidate:** `0aef0bb35f8eb2f00e882af1ff5771d09d54f035`  
**Branch:** `phase-5/adaptive-experience-shell`  
**Date:** 2026-08-26

## Finding

### F1 — 375px document overflow in every detail/theme combination

The mandatory real-browser matrix found root horizontal overflow at the 375px
viewport in all 18 combinations of Simple, Advanced and Expert with Yellow Ops,
Apple calm, Pixel expressive, Windows clear, Glass light and Aurora focus.

Exact repeated measurement:

- `innerWidth = 375`;
- `document.documentElement.clientWidth = 360` (vertical scrollbar present);
- `document.documentElement.scrollWidth = 379`;
- visible controls: 22 in Simple and 26 in Advanced/Expert;
- minimum visible target height: 44px; zero undersized targets.

The new app-bar controls escape the viewport: `.app-actions` ends at
`379.1375px`, and `#theme-select`/`.theme-control` share that right edge. This is
real document overflow (`379 > 375`), not the intentional locally scrolling domain
navigation. At 768, 1024 and 1440 the sampled root widths remain contained.

This violates Order 176 requirement 5 and its explicit 375px/zero-document-overflow
proof. The candidate is rejected. The reviewer did not change product code and did
not continue to an irreversible browser posting after the conclusive presentation
failure.

## Evidence executed before the stop

- scope/diff inspection: only the three permitted operator assets plus the additive
  focused test changed in the product commit; no backend, route, schema, migration,
  permission, dependency or protected-surface delta;
- focused operator/adaptive/reservation/folio/security suites: **34 passed, 0 failed,
  489 assertions**;
- complete repository suite: **216 passed, 480 skipped, 0 failed, 2,646 assertions**;
- typecheck: pass; import boundaries: **66 files**; licence policy: **23 packages**;
  dependency audit: no vulnerabilities;
- gzip level 9: HTML 18,723 + CSS 13,348 + JS 54,363 = **86,434 bytes**, below
  Order 176's 98,304-byte cap;
- protected SHA-256 remained exact: baseline
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`, referee
  `2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`, typed
  fixture `84d928488a2569b4115cec2a0ccb66edbcf80d33d87aa1248c7ee1685e81afb9`;
- sole isolated stack applied migrations 0001–0018, contained **85 public tables**,
  matched the exact schema and passed the fresh referee **11/11**;
- fresh database proofs: review seed **12/12 (40 assertions)**, complete founder
  reservation-to-folio authority journey **1/1 (210)**, folios **12/12 (90)**,
  postings **10/10 (111)** including 500 charges/1,000 balanced lines with zero
  drift, statements **9/9 (36)** and folio HTTP **13/13 (111)**;
- Browser login and safe Simple/Yellow defaults passed; the 72-case
  4-width × 3-detail × 6-theme matrix then produced F1 at every 375px case.

The canonical Bash setup could not start because Bun 1.3.14 is absent in WSL. The
Windows wrapper reproduced its inherited healthy-container `/proc/1/comm` readiness
false negative. The reviewer therefore executed the wrapper's remaining exact
provision/migrate/fixture/table/referee steps directly on the same sole stack. One
initial schema command supplied a URL where the gate requires a database name; it was
discarded and the corrected fresh command matched exactly. Neither precondition miss
is counted as green evidence.

## Required correction

Contain the 375px app bar without hiding root overflow, shrinking any interactive
target below 44px, changing control order/semantics, removing a theme/detail option,
disabling zoom or altering backend authority. Add a permanent exact 375px regression,
then submit a new immutable candidate for a complete independent restart of the
Order 176 Browser matrix and unchanged reservation-to-folio journey.

No merge, push, promotion, deployment or Phase-completion authority is granted.
