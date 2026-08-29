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

## The cadence rule (D-92 — supersedes D-87's batching)

**Codex implements an entire phase without stopping**, then requests one review at the
phase exit gate.

**Tier 3 no longer blocks mid-phase.** Instead every Tier-3 order carries a
**pre-registered proof**: the order states in advance the exact executable test that would
fail if the invariant broke. Codex produces that proof; if it passes and scope held,
Codex continues. The architect re-executes every pre-registered proof at the exit gate.

The architect's effort moved from back-loaded review to front-loaded specification. What
caught F1, F6 and F8 was never review *frequency* — it was someone specifying what
execution had to prove. Writing that into the order is cheaper than discovering its
absence afterwards.

### The hard floor — these stop the phase immediately

Write `handoff/questions/NNN.md` and wait:

- any edit to an existing file under `migrations/`
- any edit to `tests/run_invariants.py`
- the referee dropping below `11 passed, 0 failed`
- **any pre-registered proof that fails** — never weaken an assertion to get green
- any Forbidden-list item, any invariant question, any new dependency

Those are the irreversible or invariant-defining surfaces. Everything else is recoverable
at a phase gate.

Stopping early is never penalised. Continuing past a floor item is the only
unrecoverable mistake in this process.

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

1. Codex pushes the branch and writes `handoff/questions/NNN-review-request.md`: the
   order/commit table, the self-check output, and one line per order saying what its DoD
   test proved.
2. For high-risk work, Codex assigns a concrete review to an independent agent that
   did not implement the change.
3. The reviewer re-runs the proofs first-hand (D-84), writes the verdict to
   `handoff/reviews/`, and records exact commands/results.
4. Codex repairs findings under a new bounded order or integrates approved work.

Routine work does not wait for a review cycle once its relevant gates pass. Claude is
used only if the founder explicitly invokes Claude.

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
# Current Phase 7 build

Order252 has independently approved exact quoted-tax hold-to-reservation/segment lineage.

Order253 is the current bounded status-only slice; it preserves the unfinished Phase7
state while making approved Order252 visible to the founder after a separate promotion.

Order254 independently approved exact applied migration0041 lineage restoration plus
forward-only migration0042. Sole-local promotion is the next bounded operational step;
no product scope or phase state changes.

Order255/D-663 independently verifies the approved sole-local backup, migration0042
and app-only promotion. Order256/D-666 independently approves the exact read/lock/recheck
quoted-tax primary-folio eligibility bridge. The next build dependency is configured
semantic tax-route policy before any positive posting writer.

Order257/D-668 is the bounded founder-visible status refresh through approved
Order256. It changes recorded status truth only; the sole local remains a separate
promotion concern and unfinished Phases5–7 remain active.

Order259/D-673 independently approves the explicit read-only semantic-route prerequisite: approved
Order256 eligibility and the Order251 plan resolve only exact configured
property/currency/jurisdiction revenue and tax credit routes, while policy blockers
perform no lookup and every heuristic fallback is rejected. Migration43 reaches
97 tables/87 policies with focused, acceptance, migration, schema and referee proof
green. The reviewer personally reproduced the complete proof with no finding. A
governed positive posting writer is now the next product boundary; India/document
allocation and taxed correction semantics remain later policy work.

Order260/D-674 is a bounded authenticated founder-status refresh through approved
Order259. It advances only recorded latest/current truth and the compact Phase7
milestone; runtime promotion is separate and unfinished Phases5–7 remain active.

Order262/D-680 independently approves the governed line-rounded non-India positive-
tax journal: exact configured semantic routes, balanced guest/base/tax postings,
insert-only canonical tax root and immutable attribution-to-journal binding commit
with atomic evidence. Order263/D-683 makes that exact truth founder-visible, and
Order265/D-690 closes the sole-local credential incident with logging-safe independent
approval while preserving both hotels and the complete database.

Order266/D-691 is the active next financial boundary: one exact complete immutable
contra journal may reverse an Order262 posting with database-derived full-reversal
tax lineage and verified post-seal authority. Partial/India/negative-tax correction,
refund/payment, fiscal document/IRP and Phase7 completion remain later work.

Order266/D-700 is independently approved. Exact
migration45/98 tables/88 policies/referee11/11, correction8/0, adjacent financial,
migration/schema/static and native standing846/0 proof is green; the sole local is
unchanged until a later separately governed status/lineage/promotion sequence.
Partial/India/negative-tax correction, refund/payment, fiscal document/IRP and
Phase7 completion remain later.

Order269/D-702 is the built-unreviewed authenticated status bridge through approved
Order266: exact latest266/current269/review91/active7, unchanged phase states and an
honest built-unverified aggregate. Order271 now serves that exact snapshot locally.

Order270/D-705 is independently approved. Exact historical
migration0044 bytes are restored in Git and only the later deterministic join repair
moves to forward0046. Fresh and real historical-upgrade executable proof preserves
ledger/data truth, reaches46/98/88, reruns no-op and passes referee/schema/standing and
static gates. A fresh non-implementing reviewer reproduced the proof without a finding.
Order271/D-707 has promoted only migrations45/46 and the clean status descendant to
the retained sole local: binary ledger1–44, all97 non-ledger counts, both hotel
identities, PostgreSQL, Valkey, network, volume and protected sign-in remain exact;
healthy loopback3000 now serves exact266/269/review91/active7. Fresh independent non-
operating verification approved the exact backup, database, retained identities,
sole-local topology and protected press-only two-hotel status result without a
finding. Phase7 remains active; partial/India/negative-tax correction, fiscal
documents/IRP and Phase completion remain later work.

Order272/D-711 is independently approved. Exact configured India
GST supplier-registration evidence is bound to the frozen jurisdiction identity with
SELECT-only runtime authority, canonical validation, deterministic hashing and zero
writes. Fresh reviewer-executed PostgreSQL reaches47 migrations/99 tables/89
policies/referee11/11; place-of-supply, tax decomposition, documents and IRP remain later work.

Order273/D-713 is the built-unreviewed authenticated status bridge through approved
Order272: exact latest272/current273/review91/active7, unchanged phase states and an
honest built-unverified Orders237–272 aggregate. Sole-local visibility remains a
separate guarded promotion; no product or runtime change is claimed here.

Order274/D-716 independently approves the operation that applied only migration47 and replaced only the app after a
restricted verified backup and rollback capture. The retained two-hotel database,
PostgreSQL, Valkey, network, volume, credentials and all97 prior table counts are
preserved; sole healthy loopback3000 serves exact272/273/review91/active7. Fresh
non-operating verification reproduced the complete read-only proof with no finding.

Order275/D-719 is the independently approved current product slice. It may project only the exact
approved Order272 supplier-registration result into notified IRP 1.1 `SellerDtls`,
with strict field/checksum/state/PIN validation, null-only trade-name omission,
fixed-order deterministic JSON/SHA-256, isolated registration/evidence lineage and
recursive freeze. Buyer, place-of-supply, supply type, CGST/SGST/IGST, items, values,
documents, numbering/hash chains, submission/providers, database and UI remain out of
scope. Fresh non-implementing Tier-3 execution approves the exact immutable candidate
with no finding; Phase7 remains active.

Order276/D-725 is independently approved. Its typed tenant/RLS Party GST-registration
root plus exact read-only registration-id resolver provide only active registered-
recipient candidate evidence. Exact48-migration/100-table/90-policy PostgreSQL,
referee11/11, hostile, standing and static proof are green. It grants no legal invoice-
buyer, folio-window, `BuyerDtls`, place-of-supply, decomposition, document,
submission, UI or local authority. Independent review at D-722 found no product
defect but withheld approval for the stale setup count; independently approved
Order277 corrected only that oracle and D-725 approves the exact descendant.

Order277/D-725 is independently approved. It changes only the canonical
`setup.sh` exact count/message from99 after migrations1–47 to100 after migrations1–48,
and has rerun the complete isolated setup/referee and standing/static gates green at
exact48 migrations/100 tables/referee11/11. No product, migration, schema, test,
referee, runtime or local change is admitted. Fresh independent Tier-3 execution
approves both the exact repair and corrected Order276 candidate-evidence descendant
with no remaining finding.

Order278/D-728 is independently approved. It projects only exact
approved Order276 recipient evidence into fixed-order notified IRP1.1 `BuyerDtls`
identity/address fields with Party/registration/evidence lineage outside deterministic
JSON. It grants no legal invoice-window buyer, separate `Pos`, supply type, tax
decomposition, document, submission, database, API, UI or local authority. Intentional
red0/1, focused/adjacent22/0+10 database-only skips, standing879/0+798 database-only
skips and every static gate are green; fresh independent Tier-3 execution reproduced
the complete proof with no finding.

Order279/D-730 is built pending independent review. It resolves only a read-only,
exact association between an explicit folio window and explicit approved recipient
registration, reusing approved Order278 BuyerDtls bytes. Shared-account sibling windows
remain distinct, and no account/reservation/Party/window inference is allowed. No
persistence, legal designation, `Pos`, tax, document, submission, API, UI or local
authority is admitted. Corrected fresh PostgreSQL proves focused/adjacent33/0 and
exact48/100/90/referee11/11; standing884/0+805 skips and all static gates are green.
Independent Tier-3 execution is mandatory.
