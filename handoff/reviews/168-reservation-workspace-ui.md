# Independent Tier-2 review — Order 168 reservation workspace UI

**Verdict:** APPROVED
**Reviewed candidate:** `ca024eeeebe6560e3e7983c155ee2b344beb1c1d`
**Exact Base:** `0e88417faf17fded2f519d29c4732002891bb159`
**Reviewer:** OpenAI Codex, independent non-implementing reviewer
**Date:** 2026-08-26

## Admission, ancestry and scope

I did not implement Order168. I read `PROJECT.md`, ran `./state.sh`, read Order168,
D-435, the final Order166 approval and the full UI/accessibility guidance named by the
order. Exact Base `0e88417` is an ancestor. The integrated Order166 order and review
blobs are byte-identical to approved source evidence, and the Order141 aggregate series
remains the approved composition recorded by Order166.

The complete Base-to-candidate diff is confined to admitted governance, the three
operator assets and one additive workspace test. It changes no package or lockfile,
Compose file, migration, schema, database query, domain command, grant, permission,
worker, payment, fiscal, check-in or check-out path. The sole installed dependency
remains Elysia.

I rejected four earlier immutable candidates before approving this one:

- `1ad2421`: dirty Back bypass, stale create/PII state, unbounded cursor DOM and visible
  confirmation-number GET management paths;
- `6b832dc`: lifecycle human authority was over-hidden and direct/Forward create routes
  could restore impossible Offer/Review states;
- `2df921e`: an in-flight drawer close/property switch could fall back to legacy
  confirmation-number GET refresh;
- `2a5697c`: Browser measurement found narrow confirmation overflow/link overlap and a
  40px theme selector.

Candidate `ca024eee` closes the final CSS findings without changing the approved JS:
fixed bounded table layout, shrinkable/wrapping confirmation controls and cards, and an
explicit 44px theme selector. Its parent already captures lifecycle origin property,
UUID, route and detail generation, suppresses refresh after any stale change, gates
Edit/Cancel/Reinstate only from UUID-detail server flags, normalizes restored create
routes against prerequisites, resets new-journey PII/state and replaces rather than
appends each bounded cursor page.

## Reviewer-executed functional and served proof

On an isolated loopback stack (app 3001, PostgreSQL 5654, Valkey 6604; workers off), I
proved authenticated login and one-property scope, default board, status filter, empty
overlap, and two disjoint cursor pages of 50 then 6 rows. UUID detail returned only its
approved aggregate and server actions; direct deep-link shell returned 200; hostile PII
GET search returned 400 and missing UUID returned generic 404. Served HTML/CSS/JS
SHA-256 values exactly matched both the candidate files and exact built container.

After removing only disposable prior-run fixtures, the real unprepared PostgreSQL
founder journey passed **1/1 with 70 assertions**: canonical Party creation, five live
offers, temporary hold, reservation commit, exact replay, changed-key 409, confirmation
readback, least-scope/property denial, complete redacted idempotency evidence and no
financial side effects.

## Browser, responsive and accessibility proof

The coordinating independent Browser reviewer personally exercised the exact candidate
at 375/768/1024/1440. Exact final measurements were:

- 375: document `360/360`, card `334/334` inside 336px, confirmation right 238 before
  card right 348, theme target 44px;
- 768: document `753/753`, confirmation right 124 before Guest left 136, theme 44px;
- 1024: document `1009/1009`, confirmation right 398 before Guest left 410;
- 1440: document `1425/1425`, confirmation right 436 before Guest left 448.

The same exact JS (the final commit changes only CSS and its regression) passed semantic
cards below 768 and dense table at/above 768, four-step Stay→Party→five offers→Review,
dirty Back dismissal with state restoration, full-width narrow drawer with server-gated
Edit/Cancel, 50→6 cursor page replacement, status filtering, j/k row focus, Escape
close/focus restore, explicit states and no client persistence/authority. Screenshots:
`C:\Users\astha\AppData\Local\Temp\yellow-order168-final-375.png` and
`C:\Users\astha\AppData\Local\Temp\yellow-order168-final-768.png`.

## Gates and protected evidence

- focused workspace/assets/workbench/booking/founder suites: **27 passed, 0 failed**
  (database-disabled cases skipped there; the live journey above ran separately);
- standing `bun test`: **199 passed, 471 skipped, 0 failed**, 2,381 assertions;
- security/JWT/image/schema/UI/calendar static suite: **47/47**, 355 assertions;
- typecheck, 66-file boundaries, 23-package licence policy, audit, image pins and
  `git diff --check`: green;
- combined operator gzip: **81,864 bytes**, below 90 KiB, with no dependency change;
- live schema exactly matches `tests/schema/expected.sql`; runtime/app-role authority
  remained non-superuser, non-BYPASSRLS, zero runtime direct table grants and zero
  forbidden protected-table DML grants;
- fresh exact `./setup.sh --db-only`: 17 migrations, 85 tables and protected referee
  **11 passed, 0 failed of 11**.

Protected SHA-256 values remain exact: baseline
`fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`, referee
`2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`, fixture
`bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`, and expected
schema `df2d78c5d65545acb04529aacc1af1cfe18a5fece1047ce1dde104c9597c1edf`.

## Disclosed reviewer incidents

The local Browser connector had no installed browser, so the coordinating reviewer with
the project Browser binding executed and returned the required measurements. An initial
Compose start omitted explicit review flags/ports: the 3000 bind failed before exposure,
and a later health-only workbench-off start returned NOT_FOUND before being replaced.
Wrong script aliases, wrong public asset paths, and incomplete schema environment names
were corrected and rerun.

One invalid schema invocation echoed the disposable deployment password. I immediately
rotated that isolated role password in database and ignored authority file, restricted
the file to `ASTHA\astha:(F)`, verified the replacement without printing it and reran
schema proof green; no runtime/operator or founder credential was exposed. Retained
journey fixtures caused two precondition-only failures (duplicate Party and historical
idempotency rows); exact disposable fixtures were removed and the clean 70-assertion
journey passed. Direct referee attempts first used Windows non-UTF8 and then stateful or
wrong databases; the canonical fresh setup dropped/recreated only `yellow_test` and
passed 11/11. Founder containers on 3000/3002 were never changed.

After proof, the exclusive reviewer app, PostgreSQL, Valkey, network and volume were
removed, along with both ignored reviewer credential files. Founder 3000/3002 and all
unrelated resources remain intact.

## Verdict boundary

Order168 is approved only as the dependency-free reservation workspace UI at exact
candidate `ca024eee`. This is no merge, push, local founder-stack replacement,
production deployment or broader Phase-5 completion claim.
