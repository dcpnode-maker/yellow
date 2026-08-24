# Order 080 — Executable reservation state contract

**Phase:** 4 · Reservations  
**Branch:** `phase-4/reservation-state-contract`  
**Tier:** 2 — pure domain contract and drift proof; no persistence or transition execution  
**Written by:** OpenAI Codex, autonomous architect/builder under D-95/D-115/D-221

## Outcome

Start Phase 4 with one exhaustive, typed reservation lifecycle definition that is mechanically
checked against `docs/STATE-MACHINES.md`. Later reservation commands must ask this contract whether
a transition is permitted; they must not reconstruct status rules in HTTP handlers, SQL branches
or operator JavaScript.

This order defines and proves the existing lifecycle only. It performs no transition, writes no
reservation or occupancy row, emits no event and changes no founder-visible behavior.

## Natural-Solution Test

- The immutable schema already owns the nine reservation statuses, while
  `docs/STATE-MACHINES.md` owns the exhaustive allowed transitions, guards and emitted event names.
- `src/contexts/reservations/index.ts` is empty. There is no competing reservation service or state
  table to adapt.
- A frozen TypeScript transition registry is the smallest useful runtime boundary. An independent
  test can parse the canonical Markdown table, expand combined source cells such as
  `reserved/due_in`, and compare every `(from,to,event)` tuple with the registry.
- Parsing the canonical document in the proof avoids copying the same expected transition list
  into both implementation and test. Exhaustively checking all status pairs proves unlisted
  transitions fail closed.

## Scope

- `handoff/PHASE-4-PLAN.md`
- `handoff/orders/080-reservation-state-contract.md`
- `src/contexts/reservations/state-machine.ts`
- `src/contexts/reservations/index.ts`
- `tests/reservation-state-machine.test.ts`
- `src/project-status.ts`
- `tests/founder-status.integration.test.ts`
- `handoff/GATE-3-MANIFEST.md`
- `handoff/LEDGER.md`
- `DECISIONS.log`
- `handoff/questions/`

## Required work

1. Add the bounded Phase-4 plan in `handoff/PHASE-4-PLAN.md`, mapping Orders 080–087 to the
   canonical search → hold → commit, lifecycle, guest/share, alert and waitlist requirements.
2. Export the exact schema statuses as a readonly tuple and derived union; do not invent aliases,
   intermediate statuses or a second waitlist lifecycle.
3. Export one deeply immutable transition registry for every row in the Reservation table in
   `docs/STATE-MACHINES.md`, expanding slash-separated source states into distinct edges. Preserve
   the exact emitted event slug and a stable guard identifier for later command services.
4. Export a pure lookup that accepts typed source/target statuses and returns the matching
   descriptor or `undefined`. An unlisted pair must never default to allowed.
5. Re-export only the public reservation contract from the context index.
6. Add an always-run proof that parses the canonical Markdown table rather than carrying a second
   handwritten transition oracle. Prove exact statuses, exact edges/events, uniqueness, deep
   immutability, exhaustive fail-closed behavior across all 81 pairs and deterministic lookup.
7. Advance only the builder snapshot to Order 080 and Phase 4 active. Keep independent review
   through Order 044, preserve the CHANGES-REQUIRED Gate-3 record, and record Order 080 as
   UNVERIFIED review debt only after focused and standing checks pass.

## Forbidden

- Any edit under `migrations/`, `tests/run_invariants.py`, schema snapshots, package/lock files,
  Compose, CI, application routes, operator HTML/CSS/JS or generated review coverage
- Any reservation, segment, guest, hold, occupancy, account, folio, journal, payment, waitlist,
  alert, fact, outbox, approval or idempotency read/write
- Any new status, transition, event, database function, table, column, RLS rule, permission, scope,
  HTTP endpoint, runtime worker or dependency
- Editing `docs/STATE-MACHINES.md` to make the proof agree; weakening exact tuple equality; testing
  only happy paths; allowing a transition absent from the canonical table
- Marking Orders 045–080 independently reviewed, approved or merged; editing Claude's review;
  merging

## Pre-registered proof

### P0 — missing executable contract is red

Add `tests/reservation-state-machine.test.ts` first. It must parse the Reservation Markdown table
and import the absent runtime module, then fail because `state-machine.ts` does not exist. Preserve
that intentional red commit before implementation.

### P1 — canonical table equality

`bun test tests/reservation-state-machine.test.ts` passes without PostgreSQL. It proves exact
schema statuses; exact expanded `(from,to,event)` equality with the Markdown table; unique edges;
deep immutability; and that every unlisted pair among the nine statuses returns `undefined`.

### P2 — standing gate

From the top: frozen install; state; typecheck; import boundaries; complete default tests; Phase-3
database gate; licence; audit; schema drift; protected hashes; fresh isolated app-never-started
`./setup.sh --db-only` 11/11. Confirm the persistent localhost stack was not stopped or reseeded.
Refresh the disposable Graphify code map and record its parser/semantic limits.

## Definition of done

- [x] P0 intentional red evidence is committed before implementation.
- [x] P1 proves one exact executable lifecycle and exhaustive fail-closed lookup.
- [x] P2 is fully green and protected hashes remain exact.
- [x] Phase 4 is active, while independent review remains truthfully bounded at Order 044.

## Evidence

- Intentional red `1cc620e`: test runner failed only on the absent executable module.
- Implementation `0c02a6a`: focused 5/5 with 131 assertions; TypeScript and 50-file import
  boundaries clean after the D-276 proof-parser correction.
- Standing gate: 100 pass / 0 fail / 1,336 assertions; exact isolated Phase-3 gate 60/60 and 1,020
  assertions; dependency licences and audit clean; schema exact; no leftover Phase-3 databases.
- Fresh isolated `yellow-order-080` referee: 11 passed / 0 failed, app never started.
- Protected hashes remain `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`
  and `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.
- Graphify's disposable code-only map contains 2,106 nodes, 5,906 edges and 104 communities,
  with zero missing, dangling, duplicate or collapsed edges and ten inherited self-loops. Its
  explicit limitation is that 394 non-code documents and semantic labeling were skipped; the
  canonical Markdown was therefore validated by the executable proof, not by the graph.
- Draft PR 61 GitHub run 32600316017 passed quality, Windows state, container smoke and the exact
  database job. The order remains UNVERIFIED and unmerged.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
