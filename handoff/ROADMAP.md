# ROADMAP — how Yellow gets built, and how it gets reviewed

**Written by:** Claude (architect role) · **Date:** 2026-08-15 · **Decisions:** D-87, D-83

`BUILD-PLAN.md` says *what* each phase contains. This file says *how the two agents get
through it without the founder relaying every cycle by hand.*

---

## The problem this file solves

One order → one review → two founder messages. Phase 0 took seventeen orders. At that
rate Phase 5 alone would cost the founder a working week of copy-paste, and a reviewer
that slow gets routed around — which is how the review stops being a control and starts
being a formality.

The fix is **not** fewer reviews. It is reviews placed where this project has actually
been wrong. F1, F6 and F8 were all the same shape: correct-looking code that nothing
exercised, on a surface that mattered. None of them were caught by reviewing routine work
more often.

## The cadence rule (D-87)

**Tier 1 and Tier 2 orders batch — up to five per review gate.** Codex implements them
consecutively without stopping, then requests one review.

**A Tier 3 order is a solo gate.** Nothing batches with it, and nothing after it starts
until it is reviewed. Tier 3 = migrations, occupancy claim logic, journal/posting, fiscal
chains, RLS, tenant scoping, document numbering, and any change to
`tests/run_invariants.py`.

**A batch ends immediately** — mid-order if necessary — on any Forbidden-list violation,
any invariant question, or any **assertion** failure in the self-check. Codex writes
`handoff/questions/NNN.md` and waits. Stopping early is never penalised; continuing past
one of these is the only unrecoverable mistake in this process.

**Precondition failures are different and do not stop the batch (D-88).** If a check
could not *execute* — a tool or dependency is absent, a container is not running, a host
port is occupied — fix it using only inputs already pinned or locked in the repository,
restart the self-check **from the top**, and say what you healed in the review request.
If the check *ran* and the code failed it, that is an assertion: stop and ask.

Bright line when it is ambiguous: **does fixing it change a git-tracked file or a pinned
input?** Yes → decision, stop. No → environment, heal it. `bun install --frozen-lockfile`
heals; anything that would rewrite `bun.lock` stops. Schema drift is never an environment
problem.

Questions are numbered by the next free number in the **questions** sequence, not by the
order number that prompted them.

## The self-check — run before every review request

A batch whose self-check is not green **is not a review request**. Paste the output:

```
bun install --frozen-lockfile
./state.sh
bun run typecheck
bun run boundaries
bun test
bun run license-check
bun audit
bun run schema:check
./setup.sh --db-only          # must print 11 passed, 0 failed of 11
```

Plus, for each order in the batch, the specific negative or transition test its
Definition of Done names. Those are the ones that matter — the standing list above only
proves nothing regressed.

## The review request protocol

**Effective 2026-08-23 (D-91):** this protocol applies only to Tier 2/3 batches. Tier 1
batches that clear the standing self-check no longer wait on a founder-relayed review
cycle at all — Codex merges them via a normal reviewed PR (approver just isn't the
implementer). Full context: `handoff/CODEX-HANDOFF.md`.

1. Codex pushes the branch and writes `handoff/questions/NNN-review-request.md`: the
   order/commit table, the self-check output, and one line per order saying what its DoD
   test proved.
2. Codex arranges an independent reviewing agent for the batch — one that did not
   implement the change. Claude only if the founder explicitly asks for Claude by name;
   otherwise Codex may coordinate any other independent agent.
3. The reviewer re-runs the proofs first-hand (D-84, unchanged), writes the verdict to
   `handoff/reviews/`, commits, pushes.
4. Codex reads the review and proceeds — merge on APPROVED, back to step 2 of the main
   loop on CHANGES-REQUIRED. No founder relay required for this step either.

The founder is looped in only for what D-91 reserves to the founder: credentials,
spending, legal/business policy, irreversible external actions, missing product
intent, or authority outside the directive.

## What Codex decides alone, and what it must ask

**Decide alone:** naming, file layout inside an order's scope, test structure, error
message wording, refactors that do not cross a context boundary, anything the order's
Scope list already permits.

**Must ask (`handoff/questions/NNN.md`, then stop):** anything touching the Ten
Invariants; any new dependency; any schema change beyond what the order names; any change
to a Forbidden item; any case where the order's instruction appears wrong. That last one
is not insubordination — Question 008 and D-72 corrected the architect, and that is the
single most valuable thing that has happened in this project so far.

---

## Phase gates

A phase is complete when its `BUILD-PLAN.md` DoD lines each have a **named executable
proof** — not a description, a command with output. The phase exit review checks those
proofs and nothing else; per-order reviews already covered the code.

No phase starts before the previous phase's exit review passes and its integration PR is
on `main`.

## Order budget and gate map

Counts are estimates for planning, not commitments. What is *not* an estimate is which
items are Tier 3 — those are solo gates by the nature of the surface, and that column is
the load-bearing part of this table.

| Phase | Orders (est.) | Batches | Tier-3 solo gates |
|---|---:|---:|---|
| 0 — Bootstrap | 18 (done) | — | 008 referee, 010 runner, 012 CI/RLS |
| 1 — Kernel | 8 | 3 | tenant context, auth, outbox relay |
| 2 — Inventory & Occupancy | 9 | 3 | **occupancy choke point** (expect 2–3 solo gates here) |
| 3 — Rates & Policies | 6 | 2 | rate_price insert-only chain |
| 4 — Reservations | 8 | 3 | hold→commit transition, search correctness |
| 5 — Financials | 10 | 4 | **ledger, journal balance, invoice numbering** — the densest Tier-3 phase |
| 6 — Stay ops & Housekeeping | 6 | 2 | day-close / seal |
| 7 — Tax + India IRP | 7 | 3 | fiscal chain, GST slabs |
| 8 — Statutory + ZATCA | 7 | 3 | fiscal chain, identity encryption |
| 9 — Distribution | 6 | 2 | bed-level OTA mapping |
| 10 — PWA | 9 | 3 | CSP relaxation for ALTCHA WASM |
| 11 — Groups & Blocks | 5 | 2 | block→reservation occupancy |
| 12 — UAE ASP + AR + migration | 7 | 3 | ASP routing, legacy migration |

Roughly 88 orders and ~33 review gates for the whole system, against ~88 gates under the
old one-per-order rule. Phases 2 and 5 are where the review effort concentrates, and they
should — that is where money and double-bookings live.

## Detail level, and why it stops where it does

- **Phase 1 is decomposed** in `handoff/PHASE-1-PLAN.md` — orders 019–026, with tiers,
  dependencies, and three decisions deliberately deferred to just before their order.
- **Phase 2 gets decomposed at Phase 1's exit review**, not now.
- **Phases 3–12 are named, budgeted, and their Tier-3 surfaces identified — and nothing
  more.** Writing order-level detail for Phase 8 today would be inventing requirements
  eighteen months before the code, and every phase so far has changed shape once its
  predecessor landed. A roadmap that pretends otherwise reads well and ages badly.

The pattern holds: each phase's exit review produces the next phase's plan. That is the
only point at which the information to write it exists.

## Standing constraints for every phase

- `migrations/0001_init.sql` is immutable. New schema is `0002_*.sql` upward, through the
  runner, with D-73's checksum discipline.
- `tests/run_invariants.py` is architect-only (D-69). Phases add tests alongside it.
- The referee stays `11 passed, 0 failed of 11` at every order boundary. From Phase 2 it
  is a hard gate; before then there is still no reason to let it go red.
- Every order carries a Scope list, a Forbidden list, a numbered DoD, and a deferred
  review protocol. An order without a Forbidden section is written badly.
- Commit prefixes `[codex]` / `[claude]`. Nobody merges their own work. `main` only via
  reviewed PR.

## What good looks like from here

Codex should be able to run for a whole batch without asking anything, then produce a
review request that is boring to read because every claim in it has a command attached.
The interesting reviews should be the Tier-3 ones. If routine batches start generating
findings, the orders are underspecified and that is the architect's fault, not the
builder's.
