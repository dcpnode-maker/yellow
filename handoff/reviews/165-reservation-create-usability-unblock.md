# Independent review — Order 165 reservation-create usability unblock

**Verdict:** APPROVED
**Reviewed candidate:** `c0fa84d202a20c593b8b994d367b681b38db2c79`
**Product commit:** `0479f980ee05932a33a6c03ac96b7488ba5d6fa7`
**Exact Base:** `fe8662a4cdfa7a9687abcffea1bcf8abd3542525`
**Reviewer:** OpenAI Codex, independent non-implementing reviewer
**Date:** 2026-08-26

## Scope and prerequisite

I did not implement Order165. I read `PROJECT.md`, ran `./state.sh`, read the order,
D-432 and the Order164 approval, and applied the UI/UX and Yellow PostgreSQL review
rules. Exact Order164 candidate `fe8662a` is an ancestor. The final metadata commit
adds the independently approved Order164 review with byte-identical blob
`82315a69eb3ed682bbca0c28752bbbee3840e6b4` and the identical ledger addition from
approval commit `be70133`.

The complete product diff is limited to the four admitted paths: operator browser
script, narrow operator HTTP adapter, asset oracle and founder reservation journey
oracle. There is no HTML, CSS, route, domain algorithm, schema, migration, seed,
permission, credential, event, financial, dependency or runtime replacement change.

The browser adds only two assignments inside the existing `initializeDates()` path.
They use the existing canonical UTC instant formatter, remain normal editable input
values, and leave all availability/rate/block/builder defaults and the existing
property/sign-out selection clearing unchanged. The HTTP adapter recognizes only
`RateEvaluationError` with the sole exact governed 0-to-730-property-local-day
message. It returns an actionable no-store 400; every other evaluator or
infrastructure failure remains the existing generic 503 with no internal text.

## Reviewer-executed UX and served proof

An independent extracted-production harness executed exact Base and candidate browser
helpers. Base left both reservation date inputs blank; candidate populated a positive
near-future UTC stay of approximately 48 hours. The inputs remain ordinary editable
form controls. The focused asset suite passed **14/14**, 190 assertions, including
server-authority, accessible feedback, touch-size and clearing/late-response canaries.

On a fresh PostgreSQL 16.15 database with distinct deployment/runtime authority and
process-only disposable review credentials, the canonical served founder journey
passed **1/1**, 70 assertions:

`login -> served operator asset -> Party create/replay/search -> current initialized
stay offer 200 with bookable server evidence -> 800-day stay 400 no-store with exact
recovery guidance -> unrelated RateEvaluationError 503 with internal message absent ->
hold/replay -> reservation commit/replay/confirmation`.

The proof also retained scope/property denials, exact database occupancy arbitration,
masked Party evidence and unchanged financial/fiscal artifact counts. No client-side
success or inventory promise was accepted.

## Full and protected gates

- standing `bun test`: **182 passed, 465 skipped, 0 failed**, 2,151 assertions across
  98 files;
- static UI/security/import/licence/image/token suite: **59/59**, 359 assertions;
- `bun run typecheck`; import boundaries over 64 TypeScript files; dependency licence
  policy over 23 installed packages; `bun audit`; exact image pins: all pass;
- fresh deployment acceptance: **6/6**, 13 assertions; live schema exactly matches
  `tests/schema/expected.sql`;
- fresh isolated, app-never-started `./setup.sh --db-only`: 85 public tables and
  referee **11 passed, 0 failed of 11**.

Protected SHA-256 values remain exact: baseline
`fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`, referee
`2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`, and fixture
`bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`.

## Discarded precondition and cleanup

The first served-test command was rejected by PowerShell parsing before credential
generation, test execution or database mutation. I restarted through a bounded Bun
child process that generated two disposable values into child environment only; no
value was printed or persisted. The exclusive reviewer PostgreSQL/Valkey containers,
network, volume and acceptance database on loopback ports 5652/6602 were removed. No
reviewer app started, and ports 3000/3002, founder credentials and Order163 runtime or
rollback resources were not touched.

## Verdict boundary

Order165 is approved only at immutable candidate
`c0fa84d202a20c593b8b994d367b681b38db2c79`. This approves the narrow human booking
unblock; it does not approve a reservation board/read model/drawer, local replacement,
merge, push, deployment, broader UI completion or Phase5 completion.
