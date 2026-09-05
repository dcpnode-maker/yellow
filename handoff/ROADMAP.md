# ROADMAP — how Yellow gets built, and how it gets reviewed

**Historical authorship:** Claude (architect role) · 2026-08-15 · D-87, D-83

**Current coordination:** Codex under PROJECT and the applicable agent adapter.

**Status reconciled:** 2026-09-05. Orders438/439 merged the operational baseline
through PR82. Order434 passed independent whole-candidate Tier-3 proof and exact
CI178, then merged through PR83 as main443e3826 (77 migrations /127 public tables).
All five post-merge CI179 jobs and image publication33995471357 passed. Order440
continues the same Codex task with hotel/staff journeys, schema clarity and a design
study. A retained local runtime and cloud deployment require separate evidence.
Historical sections below retain their original meaning; PROJECT-STATUS is current.

[PROJECT-STATUS](../docs/PROJECT-STATUS.md) records what is current now.
[BUILD-PLAN.md](../BUILD-PLAN.md) says what each phase contains. This file records
delivery/review practice and its historical milestones. Current authority is
[PROJECT.md](../PROJECT.md), [AGENTS.md](../AGENTS.md) and the active scoped order;
older cadence text cannot waive required independent high-risk proof. Codex is the
sole development and coordination owner and may assign independent internal reviewers.

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

## Historical cadence rationale — D-92 superseded D-87's batching

The following records the D-92 build-first cadence at that checkpoint. Read it
alongside the current review protocol and active order, not as permission to omit
Order434's fresh independent Tier3 review or to claim unverified completion.

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

Routine work does not wait for a review cycle once its relevant gates pass. Codex may
assign internal models; no particular vendor is an operational dependency.

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
on `main`. The explicit founder feature priority is `[11, 13, 17]`,
then Phases 14–16. Phase 11 therefore follows required Phases 8–10; Phase 12 remains
the mandatory gate between Phase 11 and Phase 13; Phase 17 follows Phase 13. The
executable sequence from active Phase 7 is `7 → 8 → 9 → 10 → 11 → 12 → 13 → 17 → 14
→ 15 → 16`. Every declared prerequisite and exit gate still applies; this is
sequencing, not authority to skip work.

## Release source history — Order434/D1330, superseded as current status

This section preserves the development evidence that Orders438/439 inherit. The
canonical current task and lifecycle are in
[PROJECT-STATUS](../docs/PROJECT-STATUS.md).

Order 429 is independently approved and closed under D1300 as a read-only India IRP
fiscal-action readiness boundary. Independent review D1323 **rejected Order430**:
its complete canonical database provenance was not authenticated.
[Order434](orders/434-native-fiscal-source-completion.md) is the preserved unfinished
repair under D1330 and the unchanged D1302/D1304 policy. Its intended outcome is the first
native invoice without a prior external invoice, with governed original evidence,
actual-date atomic issuance, immutable accounting and no duplicate revenue.
It is not fully accepted or released; remaining implementation/proof and a
different non-implementing Tier3 review remain required.

Latest implementation evidence is [Order434 genuine execution](orders/434-native-fiscal-source-completion.md#genuine-native-invoice-execution--d1363):
the real runtime now commits charge-to-invoice accounting without duplicate revenue
and permanently replays the receipt. Ordinary, rounded-zero and genuine rate-change
cases pass, along with current authority, partial-COMMIT rollback,100 same-key
requests and replay after temporary receipt/event removal. Independent bounded
proof is now11/0,897 assertions: real payment/settle/close/audited-seal replay and
100 distinct sources on one series add to the preceding cases. All100 invoices
have contiguous1..100 numbers, counter101, a recomputable chain and effect-free
replays. Remaining source-family/bounds/winner-schedule coverage,0076 migration
integration and complete Tier3 acceptance remain outstanding.
Fragments remain outside the migration runner; no new phase, main integration or
local-app promotion is claimed.

The existing 18-phase vector is unchanged: 0–3, 5 and 6 reviewed; 4 built pending final
integration/review; 7 active; 8–17 planned. The 13 bounded contexts and all phase
dependencies remain unchanged. Orders438/439 consolidate the releasable operational
application while containing this unfinished capability; they do not approve native
issuance or complete Phase7. [The project map](../docs/PROJECT-MAP.md) distinguishes
the separate evidence states.

## Historical order-budget estimates and gate map

The counts and batch estimates below are retained planning history, not today's
completed/remaining order counts or a delivery forecast. The Phase0–12 figures
come from the early roadmap; Phase13–17 placeholders were added later. Their
high-risk surfaces remain relevant, while current proof requirements come from
PROJECT, the adapter and each active order.

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
| 13 — Voice + conversational commands | 7 | TBD at Phase-12 exit | authorized retrieval/command gateway, tenant/PII evaluation |
| 14 — Adaptive RMS | 9 | TBD before activation | evidence/optimizer, guarded publish, causal evaluation |
| 15 — CRM + CRS + direct booking | 8 | TBD before activation | consent/profile merge, booking/payment journey |
| 16 — Reporting + forecasting | 7 | TBD before activation | financial reconciliation, portfolio grants |
| 17 — Events + outlets + interfaces | 8 | TBD after Phase-13 exit | space occupancy, outlet money, interface privacy/replay |

### Phase 13 — Voice and Conversational Command Layer

Plan only after approved Phase-10 surfaces and domain commands: classified intent/query
catalogue; tenant/property-authorized cited read retrieval; typed command-draft gateway;
local-first multilingual speech ports and deterministic text fallback; accessible UI;
adversarial evaluation and exit proof. No raw SQL, model tenancy or shared raw-tenant
training.

### Phase 14 — Adaptive RMS and Revenue Intelligence

Plan bounded canonical metrics/readiness, model/backtest, channel/campaign economics,
optimizer, explanation/approval, guarded publish, causal outcomes and champion/challenger
orders after their rates/reservation/finance/distribution/group prerequisites. Phase 16
later productizes broader reporting and is not a Phase-14 prerequisite.

### Phase 15 — CRM, CRS and Direct Booking

Plan consent/profile/loyalty, multi-property CRS, direct-booking journey and guest-service
workbench orders after Party, reservation, rate, payment, distribution and PWA authority.

### Phase 16 — Reporting, Forecasting and Executive Intelligence

Plan reconciled operational/financial/USALI, pace/pickup, forecast and portfolio reporting
after each source context and access scope is approved.

### Phase 17 — Events, Outlets and Hotel Interfaces

Plan classified interface inventory; outlet catalogue/routing; spa/service lifecycle;
function-space, event/catering/BEO authority; governed outlet-to-folio ingress; minimized
replay-safe adapter ports; UI and integrated exit proof. Reuse Phase11 group/block truth;
do not duplicate it. Provider protocols, credentials, retention and certification remain
separate decisions.

The historical Phase 0–12 estimate was roughly 88 orders and 33 review gates. The
later Phase 13–17 rows added 39 planning-order placeholders; these are not a count
of outstanding work. The earlier emphasis on Phases 2 and 5 recorded the risk in
occupancy and money, not the location of today's active review queue.

## Historical decomposition rationale

These notes describe the planning granularity at their original checkpoints, not
the current completion state of Phases1–12. Use the current status above and the
named phase/order evidence for present work.

- **Phase 1 is decomposed** in `handoff/PHASE-1-PLAN.md` — orders 019–026, with tiers,
  dependencies, and three decisions deliberately deferred to just before their order.
- **Phase 2 gets decomposed at Phase 1's exit review**, not now.
- **Phases 3–12 are named, budgeted, and their Tier-3 surfaces identified. Phases 13–17
  have capability-level founder outcomes and an explicit priority, but their estimates
  remain planning figures.** Writing implementation orders far ahead would be inventing requirements
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

# Historical implementation chronology — Phase7 and its dependencies

The entries below preserve successive order checkpoints, including then-current
product, review, catalogue and local-promotion observations. “Current,” “next,”
“pending” and “built-unreviewed” in this chronology are relative to the cited
order/decision, not today's status or a new runtime receipt. For present work use
the PROJECT-STATUS current-task record and the latest decision/ledger.

Order252 has independently approved exact quoted-tax hold-to-reservation/segment lineage.

At the Order253 checkpoint, the bounded status-only slice preserved unfinished
Phase7 while making approved Order252 visible after a separate promotion.

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

At D-691, Order266 was the active next financial boundary: one exact complete immutable
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

At D-719, Order275 was the independently approved product slice. Its scope projects only the exact
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

Order279/D-731 is independently approved. It resolves only a read-only,
exact association between an explicit folio window and explicit approved recipient
registration, reusing approved Order278 BuyerDtls bytes. Shared-account sibling windows
remain distinct, and no account/reservation/Party/window inference is allowed. No
persistence, legal designation, `Pos`, tax, document, submission, API, UI or local
authority is admitted. Corrected fresh PostgreSQL proves focused/adjacent33/0 and
exact48/100/90/referee11/11; standing884/0+805 skips and all static gates are green.
Fresh independent Tier-3 execution reproduces the complete proof with no finding.

Order280/D-734 is independently approved. It adds only exact tenant/RLS
SELECT-only Indian physical-property fiscal-location evidence and a deterministic
read-only resolver, separately from supplier/recipient registration and mutable org/
property/profile truth. It emits no `Pos`, supply type, classification, decomposition,
document, submission, API, UI or local authority. Intentional red0/1 preceded
focused12/0, acceptance14/0, runtime-DML5/0, migration39/0, exact49/101/91/
referee11/11 and standing889/0+815 skips; all static gates are green. Fresh independent
Tier-3 execution reproduced the complete proof with no finding.

Order281/D-735 is admitted. It may add only one exact tenant/RLS SELECT-only Indian
GST accommodation-classification assignment and deterministic read-only resolver,
explicitly bound to the frozen positive-tax jurisdiction. The launch set is exactly
`996311`, `996312`, `996313`, `996321`, `996322`, `996329` as `SAC` service evidence.
No commercial/operational inference, `ItemList`, `Pos`, `SupTyp`, tax, document,
submission, API, UI or local authority is admitted. Fresh PostgreSQL/referee and
independent Tier-3 execution are mandatory.
The exact Order281 candidate was built under D-736. Intentional red0/1
preceded focused12/0, adjacent28/0, acceptance15/0, runtime-DML5/0, migration39/0,
exact50/102/92/schema/referee11/11 and standing894/0 plus 825 database-only skips;
all static gates are green and the stable local is unchanged. Fresh non-implementing
Tier-3 execution at D-737 independently reproduced the full proof with no finding and
approved Order281. No later item/tax/document/submission, local promotion, Phase-7 or
application-complete authority is implied.

Order282/D-738 is admitted as the smallest safe next prerequisite. It may compose only
approved seller-registration, explicit folio/buyer, physical-property location and
accommodation-classification evidence into an exact read-only lodging place-of-supply
candidate. The prospective `pos` comes only from the property's state under IGST Act
section12(3)(b); no supplier/recipient/guest/config fallback, intra/inter-state
conclusion, decomposition, `SupTyp`, `ItemList`, item amount, document, submission,
API, UI or local authority is admitted. No schema is added. Exact composition proof,
canonical referee and fresh independent Tier-3 execution remain mandatory.
The exact Order282 candidate was built under D-739. Intentional red0/1
preceded focused12/0, adjacent roots42/0 plus eligibility6/0, acceptance15/0,
runtime-DML5/0, migration39/0, exact50/102/92/schema/referee11/11 and standing905/0
plus828 database-only skips; all static gates are green and the stable local is
unchanged. Fresh non-implementing Tier-3 execution at D-740 independently reproduced
the full proof with no finding and approved exact candidate `4047684`. No
intra/inter-state, decomposition, `SupTyp`, item, document, submission, local,
Phase-7 or application-complete authority is implied.

Order283/D-742 is built-pending-review as the exact next statutory prerequisite. It
purely compares approved Order272 property-bound supplier-registration state with approved
Order282 property-derived lodging `pos`, returning only same/different state-or-UT
relationship evidence and a deterministic tenant-bound hash. It must not call that
relationship intra/inter-State: SEZ accommodation overrides ordinary same-code
treatment under IGST sections7(5)(b)/8(2) and CBIC Circular48/22/2018, and current
truth does not model the exception. Recipient state and every fallback are forbidden.
No schema, lock, write, tax-component, `SupTyp`, item, document, submission, API, UI or
local authority is admitted. Intentional red0/1 preceded focused12/0, four-root50/0,
Order28212/0, SellerDtls9/0, eligibility7/0, acceptance15/0, runtime-DML5/0,
migration39/0, exact50 migrations/102 tables/92 RLS-enabled tenant tables/92 policies/
2 FORCE-RLS tables/schema/referee11/11 and standing916/0 plus831 skips;
all static gates are green and the sole local is unchanged. Fresh Tier-3 remains
mandatory.
Fresh Tier-3 execution at exact `1cea37f` returned CHANGES REQUIRED under D-743 for
one proof-wording defect only: all product and executable gates are green, but the
candidate overstates FORCE-RLS coverage. The corrected descendant must say exact 92
RLS-enabled tenant tables, 92 policies and 2 FORCE-RLS tables, then receive fresh
independent review.
The exact mutable claim is corrected under D-744 with no product, test, schema or
runtime change. Order283 is again built-pending-review; fresh independent approval
remains mandatory.
Fresh non-implementing Tier-3 review approves exact corrected candidate `2b4d2d8`
with no finding under D-745. Reviewer-personal law, ancestry, product-byte identity,
exact50/102/92/92/2 catalogue, schema/referee11/11, focused/adjacent/database/
standing/static/scope and stable-runtime proof are green; disposable proof is
removed. Approval is bounded to registered-state/property-Pos relationship evidence
and grants no supplier-location, intra/inter-State, SEZ, levy, item, document,
submission, local, merge, deploy, Phase-7 or application completion.

Order284/D-746 is ready as the smallest foundational next prerequisite: one explicit
tenant/RLS/SELECT-only IGST section2(15)(a) assignment bound to exact current Order272
registration/hash, returning frozen tenant-bound supplier-service-location evidence.
It must not infer the establishment from GSTIN/address/property/org/config or
Order283 equality, support section2(15)(b–d), classify SEZ/supply nature, or emit
levy, `SupTyp`, item, document, API/UI/local authority. Intentional red, exact
51/103/93/93/3 PostgreSQL/schema/referee, hostile zero-write proof and fresh Tier-3
execution are mandatory.
The Order284 candidate is built under D-747: intentional red0/1 preceded focused
18/0(238), migration39/0(187), acceptance16/0, runtime-DML5/0, exact51/103/93/93/3
normalized schema/referee11/11 and standing927/0 plus841 skips. All static gates are
green, disposable proof is removed and the sole stable local is exact, healthy and
unchanged. Fresh non-implementing Tier-3 review remains mandatory.

Order289/D-767 is independently approved as the exact current supplier GST-registration-status
prerequisite: one tenant-leading forced-RLS SELECT-only exact-date snapshot of active
GST Portal status/type, bound to complete approved Order284/272 lineage. Its date is
evidence time only and cannot decide statutory time of supply. Historical Form-G and
renewed Form-F2 evidence remain separate. Intentional red, exact55/107/97/97/7
schema/setup/referee, hostile zero-write proof and fresh Tier-3 are mandatory; no
effective renewed status, supply-nature V2, zero rating, levy, document/API/UI/local
authority is admitted. Intentional-red precedence, focused `10/0`, acceptance
`20/0`, runtime-DML `5/0`, migration `39/0`, exact `55/107/97/97/7` normalized
schema/setup/referee `11/11`, standing `976/0` plus `865` skips and all static gates
are green. The stable port-3000 local is unchanged; fresh non-implementing Tier-3
review is green on exact candidate `35ad434`; no finding remains and no downstream
authority is granted.

Order290/D-770 is independently approved as the next honest time-of-supply
prerequisite: one explicit
externally evidenced service-provision date bound to complete approved Order252/240
accommodation tax lineage. It grants no section13 result and cannot reuse supply,
quote-night, reservation, operational, checkout, posting or clock dates. Exact
56/108/98/98/8 schema/setup/referee and hostile zero-write/non-substitution proof are
green; fresh Tier3 approves exact candidate `4476cc5` with no finding. Invoice/payment,
Order289 consumption, levy, document,
API/UI/local authority remain separate.

Order291/D-773 is approved as the next honest section13 prerequisite: one explicit
externally evidenced full-attribution payment-receipt root bound to approved
Order290/252/240 truth. It preserves both statutory source dates and their earlier
date while granting no payment ingestion, partial/cash/refund allocation, invoice
timeliness or time-of-supply result. Existing payment/provider/journal/document/
operational timestamps cannot substitute. Exact `57/109/99/99/9` schema/setup/
referee, hostile zero-write/non-substitution proof and fresh Tier3 are mandatory.
Builder proof is focused8/0(105), acceptance22/0(63), runtime-DML5/0(116),
migration39/0(187), exact57/109/99/99/9 schema/setup/referee11/11, standing992/0
plus869 skips(15377), type/114-boundary/23-license/audit0/diff green, schema SHA
`400a7da729b8fad3c0def0a22f0a8eda43a68021898ed495060c158ce7b81dbe`;
fresh independent Tier3 approval under D-773 found no issue for exact candidate `10e9adf`; approval remains limited to the full-attribution payment-receipt evidence input;
tax/document/API/UI/local authority remain separate.

Order292/D-774 is ready as the next prerequisite after approved Order291: one
externally evidenced full-attribution accommodation tax-invoice issue-date input
bound to Order290/252/240 truth. It preserves invoice series, serial and issue date
only for later Rule47/section13 composition; it does not issue an invoice or decide
validity, numbering, timeliness or time of supply. Exact `58/110/100/100/10`
schema/setup/referee and fresh independent Tier3 proof are mandatory; writer,
rendering, IRP and API/UI/local authority remain excluded. D-775 records builder
proof: intentional red0/1(1), focused7/0(78), acceptance23/0(65), runtime-DML5/0(117),
migration39/0(187), exact58/110/100/100/10 schema/setup/referee11/11, standing
998/0 plus871 skips(15449;1869 tests/328 files), type/115-boundary/23-licence/
diff green, schema SHA `227cba82339bc69d9c9263b854ea7954dc82a0dc16e19ca852304dc0d2eab19d`.
Fresh non-implementing Tier3 review approves exact candidate `cc7d44b` with no product
finding under D-776. The reviewer-recorded duplicate three-line BUILD-PLAN paragraph
was removed as nonblocking documentation cleanup; approval remains limited to invoice
identity/issue-date evidence.
Fresh non-implementing Tier-3 review approves exact candidate `8630639` with no
finding under D-751. Reviewer-personal official-law, exact52/104/94/94/4,
schema/setup/referee11/11, focused/database/standing/static and stable-runtime proof
are green; disposable proof is removed. Approval grants only affirmative recipient
registration/SEZ-status evidence and no downstream authority.

Order286/D-752 is ready as the matching supplier exception prerequisite: one
explicit tenant/RLS/SELECT-only status root bound to exact current Order272 supplier
registration/hash and reached through approved Order284 service-location evidence.
It admits only affirmative active regular, SEZ-unit/Form-G or SEZ-developer/Form-B-
or-C evidence at an explicit as-of date; absence never means non-SEZ. Form-F2 renewal,
bilateral supply nature, authorized operations/zero rating, levy, `SupTyp`, item,
document, API/UI/local authority remain separate. Intentional red, exact
53/105/95/95/5 PostgreSQL/schema/referee, hostile proof and fresh Tier-3 are mandatory.
The D-753 candidate is built: intentional red0/1 preceded focused16/0(317), migration
39/0(187), acceptance18/0(52), runtime-DML5/0(112), exact53/105/95/95/5 normalized
schema, canonical setup/referee11/11 and standing945/0 plus861 skips. All static gates
are green, disposable proof is removed and the sole stable local remains exact,
healthy and unchanged. Fresh non-implementing Tier-3 review remains mandatory.
Fresh non-implementing Tier-3 review approves exact candidate `03d68cc` with no
finding under D-754. Reviewer-personal official-law/Form-F2 boundary, exact
53/105/95/95/5, schema/setup/referee11/11, focused/database/standing/static and
stable-runtime proof are green; disposable proof is removed. Approval grants only
affirmative supplier registration/SEZ-status evidence and no downstream authority.

Order287/D-757 is built as the first lawful bilateral supply-nature composer: the
pure exact function over approved Orders283–286 requires both affirmative status
dates to equal an explicit supply date and applies the to-or-by-SEZ inter-State
override before ordinary same/different-state rules. Intentional red0/1 preceded
focused12/0(398), exhaustive18-way hostile proof and standing957/0 plus861 skips;
all static gates are green and approved-base exact53/105/95/95/5 schema/referee is
unchanged. Fresh Tier-3 remains mandatory. No schema/write, levy/decomposition,
`SupTyp`, authorized operations/zero rating, item, document, API/UI/local authority.
Fresh non-implementing Tier-3 review approves exact candidate `4f25f8e` with no
finding under D-758. Reviewer-personal official-law, exhaustive18-way, adjacent,
standing/static, approved-base schema/referee and unchanged stable-local proof are
green. Approval remains bounded to pure accommodation supply-nature evidence.

Order288/D-763 is built as the first-renewal SEZ-unit LoA continuity prerequisite:
the exact tenant-leading forced-RLS SELECT-only Form-F2 root is bound through
complete approved Order286 and supports only a directly contiguous five-year or
shorter issued period at an explicit status date. Intentional red0/1 preceded
focused10/0(227), exact54/106/96/96/6 schema/setup/referee11/11 and standing967/0
plus863 skips; all static gates are green. Form-F1, later chains, AO/specified-
officer/BLUT, GST substitution, zero rating, tax, document/API/UI/local authority
remain separate. Fresh Tier-3 is mandatory.
Fresh non-implementing Tier-3 review approves exact candidate `d65c236` with no
finding under D-764. Reviewer-personal official-law, database/schema/setup/referee,
adjacent/standing/static and stable-preservation proof are green. Approval remains
bounded to first directly contiguous Form-F2 continuity.
Fresh non-implementing Tier-3 review approves exact candidate `9c222c4` with no
finding under D-748. Reviewer-personal official-law, no-inference, exact
51/103/93/93/3, schema/setup/referee11/11, focused/database/standing/static and
stable-runtime proof are green; disposable proof is removed. Approval remains
bounded to section2(15)(a) evidence and grants no downstream authority.

Order285/D-749 is ready as the smallest recipient exception prerequisite: one
explicit tenant/RLS/SELECT-only status root bound to exact current Order276 recipient
registration/hash, admitting only affirmative active regular, SEZ-unit/Form-G or
SEZ-developer/Form-B-or-C evidence at an explicit as-of date. Absence never means
non-SEZ. Supplier-side SEZ, authorized operations/zero rating, supply nature, levy,
`SupTyp`, item, document, API/UI/local authority remain separate. Intentional red,
exact52/104/94/94/4 PostgreSQL/schema/referee, hostile proof and fresh Tier-3 are
mandatory.
The D-750 candidate is built: intentional red0/1 preceded focused16/0(301), migration
39/0(182), acceptance17/0(49), runtime-DML5/0(111), exact52/104/94/94/4 normalized
schema/referee11/11 and standing936/0 plus851 skips. All static gates are green,
disposable proof is removed and the sole stable local remains exact, healthy and
unchanged. Fresh non-implementing Tier-3 review remains mandatory.

Order293/D-777 is ready as the next pure prerequisite: compose approved Order290
service-provision and Order292 invoice-issue dates with affirmative governed ordinary-
Rule47 evidence into only timely/late evidence using the fixed inclusive 30-calendar-
day boundary; every exception regime fails closed. No migration, regime inference,
invoice issuance/validity, section13 result, tax/document/API/UI/local authority is
admitted; fresh independent Tier3 proof is mandatory. D-778 builder proof is
intentional red0/1(1) before implementation, focused including intentional11/0(124),
adjacent40/0+3 skips(834), unchanged setup58/110/100/100/referee11/11,
standing1009/0+871 skips(15573;1880 tests/330 files), type/boundaries116,
licences23, audit0 and diff clean; no migration/schema change. Disposable setup
resources were removed and stable local remains stopped by founder authorization.
Independent review of candidate `95e43a5` under D-779 is CHANGES REQUIRED: Date.UTC
low-year/overflow arithmetic and incomplete Order290/292 invoice identity/evidence
rehash binding. D-780 records refreshed REPAIRED-PENDING-REREVIEW proof: focused
including intentional15/0(146), adjacent44/0+3 skips(856), unchanged setup
58/110/100/100/referee11/11, standing1013/0+871 skips(15595;1884 tests/330
files), typecheck/boundaries116/licences23/audit0/diff green. Repair is explicit
proleptic-Gregorian no-Date arithmetic with low-year/leap/century/month/year
regressions and overflow fail-closed, plus complete invoice series/serial and
invoice/service evidence hash binding in result/hash. No migration/schema change;
fresh Tier3 re-review remains pending and no approval is claimed.
# Order294 roadmap entry

Next Phase 7 evidence slice: independently review the one-read ordinary India GST
accommodation time-of-supply composer after focused, adjacent, type, boundary, licence,
and standing validation.

## Order295 roadmap entry

Compose approved Order289 supplier registration status and Order294 ordinary
accommodation time-of-supply evidence only when the status snapshot is dated exactly
at the selected time of supply. No effective interval, rate, levy or tax computation.

## Order296 roadmap entry

Compose approved Order285 recipient registration/status and complete Order294 ordinary
accommodation time-of-supply evidence only at exact status/time date equality. Require
complete predecessor hash replay and produce only frozen, tenant/GSTIN/address-hidden
affirmative evidence; legal buyer, place-of-supply, supply-nature, tax and document
composition remain future bounded slices.

## Order297 roadmap entry

Compose the complete approved Order287 supply-nature result with the approved
Order295 supplier and Order296 recipient active-at-time results. Require exact shared
transaction, lineage, registration/service-location and date equality plus complete
predecessor hash replay. Return only frozen tenant-hidden applicability evidence;
buyer/B2B, `Pos`, `SupTyp`, `IgstOnIntra`, levy, rate, tax, document, IRP, API/UI,
database and local authority remain separate. Fresh Tier-3 proof is mandatory.

## Order298 roadmap entry

Correct the quarantined 2026 India hotel-accommodation extension to sourced 12%/18%
value-of-supply bands using the existing effective-dated extension and evaluator.
Prove exact INR7,500 boundary behavior; do not infer section14, SEZ zero-rating,
decomposition, fiscal document, API/UI or local authority.

## Order299 roadmap entry

Expose and preserve the exact effective-period bounds of the already-selected tax
extension through a narrow tenant-safe runtime capability. This is evidence plumbing,
not date-to-instant applicability or tax computation; all downstream fiscal behavior
remains separately ordered.
Fresh non-implementing Tier-3 review approves exact candidate `6b943bb` with no finding
under D-819 after reviewer-personal tenant/global, role-assumption, temp-shadow,
microsecond, schema/setup/referee, standing and static proof.

## Order300 roadmap entry

Bind the exact active same-tenant property's database-owned IANA timezone and
PostgreSQL-derived local-midnight-to-next-local-calendar-midnight UTC bounds into both
resolved and unassigned tax-jurisdiction evidence. Prove canonical instants across DST
23/25-hour days and awkward offsets without JavaScript, host-clock or fixed-24-hour
derivation. This supplies property-day instant evidence only: extension containment,
overlap, start-instant, split-day, section14 and every other applicability/legal rule
remain explicitly forbidden for a later bounded slice. Fresh Tier-3 proof is mandatory.
Fresh Tier-3 review at D822 requires changes: exact candidate `bfdda8e` passes live
PostgreSQL temporal/tenant/zero-write, isolated 59/110/referee11/11, standing and
static gates, but a hostile mutation removing the business-day upper instant from
both evidence hashes still passes the committed focused proof. Add independent
timezone-only, lower-only and upper-only evidence-reference assertions, rerun all
gates and obtain a fresh review before closing Order300.

## Order301 roadmap entry

Consume approved Order299 extension bounds and Order300 property-day bounds through
one migration-free whole-day containment gate. Preserve half-open exact instants,
accept equal/unbounded edges and reject every partial-day relation. Correct the India
2026 fixture temporal bound to the UTC instant of Kolkata civil midnight. Section14,
working-day policy, old/new rate pairing and all downstream tax/fiscal/UI behavior
remain separate.

## Order302 roadmap entry

Add a pure, migration-free fail-closed classifier for section14's payment-date proviso:
retain ordinary earlier-of-books/bank truth only when bank credit is on/before an
explicitly asserted rate-change date; otherwise require governed four-working-day
calendar evidence and produce no statutory receipt-date conclusion. Governed
rate-change applicability and the complete six-case matrix remain later bounded work.

## Order303 roadmap entry

Retain Order298 as historical predecessor evidence and urgently correct the
2026/default India hotel-accommodation extension content for Notification15/2025,
effective 22 September 2025: 5% without ITC through INR7500 and 18% with ITC above.
The notification does not restore the below-INR1000 exemption. Prove exact evaluator,
quote and production-seed parity while
leaving historical old/new version pairing and section14 composition to later orders.

## Order304 roadmap entry

Compose one exact retired-predecessor/active-successor `in-gst-lodging` pair through
the existing tenant-visible registry and selected-extension effective-period
projection. Require exact Kolkata-midnight adjacency and the sourced 12%-to-5% lower-
band/ITC transition while preserving the 18% upper band. Return frozen pair evidence
only; production seed conversion, retired historical resolution, section14, tax,
fiscal documents, IRP and operator surfaces remain later bounded work.
Build evidence under D837 is green: intentional red preceded production; focused
hostile and live PostgreSQL proof, schema, standing/static and fresh 59-migration /
110-table / referee-11/11 preservation all pass. Fresh independent Tier-3 review
D838 approves exact candidate `bb746f202a53bedc997519262bcffda14db7025f` with no
finding; mutation, live 2/0(19), standing1077/0+885 skips, static, schema and
referee11/11 proof are recorded in `handoff/reviews/304-india-gst-accommodation-rate-version-pair-independent.md`.
The disposable proof project was removed and the founder local was untouched. Approval
is limited to this frozen evidence pair; no downstream authority is claimed.

## Order305 roadmap entry

Replace the flattened fresh-bootstrap India lodging seed with the exact approved
retired-v1/active-v2 history, deterministic ids and adjacent Kolkata-midnight periods.
Prove exact first insert, byte-equivalent replay, collision rollback and preservation
of active-only v2 resolution. Existing installed data conversion, historical stay
selection, section14, tax, fiscal documents, IRP and operator surfaces remain later
bounded work.
Build D840 completes the implementation side with red-before-production, exact
catalogue/fixture proof, live first-seed/replay/seven-collision rollback and active-v2
resolution, existing seed integration10/0, standing/static/schema and fresh
59-migration/110-table/referee11/11 preservation. The exact disposable project was
removed and the founder local remained untouched. Fresh Tier3 remains mandatory.
Fresh independent Tier3 review D841 approves exact candidate
`1640a82806b367b12a90d2d8f04c2678d4f1debd` with no product finding after reviewer
source mutations, live2/0(72), seed10/0(63), standing1079/0+887 skips and fresh
59/110/referee11/11. The schema comparison was attempted but precondition-blocked
by a Docker daemon exec hang; D840's schema evidence remains recorded. Disposable
cleanup is pending daemon recovery, and no founder-local resource was touched.
## Order306 roadmap entry

Resolve one exact historical India lodging version for an active same-tenant property
and canonical business date. Reuse PostgreSQL-owned property-local day bounds, the
exact lodging assignment and the complete approved retired-v1/active-v2 pair; require
one version to contain the whole day and fail closed for gaps, overlaps or a
cross-cutover local day. Return frozen tenant-hidden evidence only. Installed-data
conversion, section14/calendar, tax, fiscal documents, IRP and operator surfaces
remain later bounded work.
Build D843 is green: intentional red preceded production; focused hostile and live
PostgreSQL proof covers exact cutover selection, tenant/property concealment, DST,
awkward offsets, cross-cutover rejection, frozen/hash-bound evidence and zero writes.
Standing/static plus fresh 59-migration/110-table/exact-schema/referee11/11
preservation pass. Fresh independent Tier-3 approval remains mandatory.
**D844 independent approval:** Exact candidate
`1d14b36a4b5433a58dcfa31461e0946f22c42de0` is approved against base
`1fca2ce3711a5742a1c63c98056369e8a010c6e9` with no finding. Reviewer-owned permanent
mutations of both containment bounds, ID/status/version/content/source truth,
assignment, tenant concealment and evidence hashing fail red and were restored;
direct-port live3/0(30), focused/adjacent27/0(538), standing1088/0+890 skips(16652),
static gates and fresh59/110/referee11/11 pass. No migration, schema snapshot or
protected referee delta exists; the Docker-backed normalized snapshot remains
precondition-blocked. All reviewer disposable databases were dropped and the founder
local remained untouched. Approval is only this historical evidence boundary.
## Order307 roadmap entry

Bind the exact approved India lodging predecessor/successor pair to the fixed
Notification15/2025 statutory rate-change date `2025-09-22`. Derive that date from
the source-bound Kolkata-midnight transition and return frozen evidence only; caller
dates, clocks, calendars and section14/tax conclusions remain forbidden. A governed
working-day calendar remains a later policy-authority order.
Build D846 completes the implementation side with red-before-production, exact
tenant-bound pair-hash recomputation, complete governed-content revalidation and
hostile fully rehashed semantic mutants. Focused/adjacent17/0(349), standing1097/0
plus890 skips(16743), type/boundary124/licence23/audit0/diff pass. No schema or
runtime-writer path changed; approved fresh59/110/referee11/11 evidence is preserved.
A fresh direct-port rerun was precondition-blocked by PostgreSQL28P01 before any
mutation. Fresh Tier3 approval remains mandatory.

## Order308 roadmap entry

Derive only the statutory component family from complete approved India accommodation
supply-nature evidence: inter-State/SEZ to IGST; ordinary intra-State to CGST+SGST or
CGST+UTGST using the exact current UTGST Act code set04/26/31/35/38. Rate, value,
amount allocation, posting, zero-rating, document and IRP remain later boundaries.
Build D849 completes the implementation side with red-before-production and exact
tenant-bound upstream revalidation. Focused/adjacent21/0(474), standing1107/0 plus
890 skips(16822), type/boundary125/licence23/audit0/diff pass; unchanged D844
fresh59/110/referee11/11 evidence is retained. Fresh Tier3 approval is pending.
D850 records remediation of the fresh-review taxpayer-type/SEZ-status pairing finding
on both supplier and recipient. Candidate8a02c464 was rejected; fresh rereview is pending.
D851 records fresh independent approval of exact remediated candidate
`b6590425c563a0da17517454c7b028dc282cba58`, preserving the rejected candidate history.
Separate reviewer supplier/recipient guard mutants each turned fully rehashed proof red;
focused/adjacent21/0(476), standing1107/0+890 skips(16824), static gates and unchanged
D844 fresh59/110/referee11/11 lineage pass. No downstream authority is granted.
**D847 independent approval:** Exact candidate
`6e0824df2a6afff5a83573d463bbee4cf73b436e` is approved with no finding after
reviewer-owned tenant/pair, identity/period, complete GST_ROOM, source/date,
freeze/evidence-hash and no-SQL mutation proof. Focused9/0(91), adjacent8/0(258),
standing1097/0+890 skips(16743), static gates and unchanged D844 database lineage
pass. No calendar, section14, tax/fiscal or operator authority is granted.

## Order309 roadmap entry

Bind approved historical accommodation aggregate-rate evidence to approved GST-family
evidence for the same property, civil day and jurisdiction. Return frozen lineage only;
component splits, values, amounts, rounding, Section14 and downstream fiscal work remain excluded.
D853 adds complete approved supply-nature evidence so the family is re-derived and
exact-matched rather than trusted through a caller-reproducible public hash.
Build D854 passes focused/adjacent38/0(716), standing1117/0 plus890 skips(16981)
and all static gates. Fresh Tier3 approval remains pending.
D855 adds direct coherent property/date/jurisdiction join-conjunct mutation proof after
the first reviewer correctly withheld approval. Fresh Tier3 rereview remains pending.
D856 adds direct D850 ancestry, whole-day member and family byte-order mutation proof
after the second reviewer withheld approval. Fresh Tier3 rereview remains pending.
D857 independently approves exact candidate `7e1c5f492e2d5876935fdf1e762c07f4c27b2759`.
Nine separate join, ancestry, D850 pairing, containment and order-insensitive-family
mutations each made permanent proof red and were restored exactly; focused/adjacent,
full standing/static and unchanged D844 database lineage pass. No downstream authority.

## Order310 roadmap entry

Revalidate complete approved Order309 evidence and derive only ordered statutory levy
identities. Preserve the aggregate GST_ROOM schedule once: IGST is the sole component,
while CGST+SGST and CGST+UTGST remain explicitly blocked on future numeric split
authority. No value, amount, rounding, Section14, posting, document or IRP authority.
Build D859 completes the implementation side after intentional red. Exact family
tuples, readiness, byte ancestry and single aggregate schedule pass focused6/0,
adjacent25/0, standing1124/0 and all static gates. Fresh Tier3 approval remains pending.
D860 independently approves exact remediated candidate
`41fb7f01263476aa524106aef6ea7c1470c02eee`. The first review withheld approval because
tenant removal from the final hash was not mutation-pinned; permanent proof now makes
that mutation red5/1 and independently passes focused/adjacent25/0(369), standing1124/0
plus890 skips(17117), static, ancestry and scope gates. Approval remains bounded to
component identities and one aggregate schedule; numeric splits and every downstream
fiscal surface remain future work.

## Order314 roadmap entry

Make the already-built management workspace catalogue legible in Simple mode without
changing the progressive-disclosure model: name the seven secondary workspaces in a
compact preview bound to the existing disclosure. Advanced/Expert keep the same direct
controls. No new application behavior or completion authority is introduced.
D870 completes the static product slice after intentional red. Focused22/0,
standing1126/0 plus890 skips and static gates pass; the sole local is unchanged until
a separate guarded app-only refresh.

## Order315 roadmap entry

Refresh only the sole loopback management-demo app from complete Order314, retain the
prior app rollback and preserve every database, credential and companion identity.
Acceptance covers one-click login, both properties, all twelve routes, truthful status
and the visible workspace catalogue under fresh non-operating review.
D872 records the guarded app-only cutover as builder-green: exact Order314 is healthy
on the sole loopback3000, the prior app is retained stopped, companions and database
truth are unchanged, and browser plus24/24 route acceptance pass. Fresh independent
non-operating Tier3 approval remains pending.
D873 independently approves exact candidate d08eff4 after full runtime and live-browser
acceptance, including the initially unavailable connected-browser evidence. The sole
management-demo local is current and approved; phase/review/status truth remains
unchanged and unfinished product phases remain future work.

## Order316 roadmap entry

Fine-tune only the presentation of completed journeys: make Today the root command
centre, add a compact index of existing Reservations/Financials/Stay-operations
workspaces and ensure Simple secondary navigation closes its fixed overlay and focuses
the destination. No new authority, data, status or post310 statutory work is admitted.
D875 records the implementation side as green after intentional red. Root/default,
exact seven-destination catalogue, Simple overlay settlement/focus, explicit routes,
Advanced/Expert and six-appearance preservation pass focused19/0, broad78/0 plus1
environment skip, standing1131/0 plus890 skips and all static gates. Fresh Tier2
browser approval remains mandatory; the sole founder local is unchanged.
D876 records the first browser review's approval-blocking root-read finding and the
bounded remediation: canonicalize only authenticated bare root to the selected
property's Today path before starting its guarded reads. Focused46/0 and standing1131/0
pass; fresh Tier2 rereview and separate local-refresh authority remain mandatory.
D877 independently approves exact d81de9c after personal browser proof of the repaired
root Today settlement and every navigation, dirty-guard, history, appearance,
responsive and accessibility requirement. Order316 is complete; sole-local promotion
remains a separately admitted app-only operation.

## Order317 roadmap entry

Reflect independently approved Order316 in the sole founder local through a guarded
app-only cutover. Retain Order315 for rollback; preserve database, companions,
credentials and truthful status; verify live root Today settlement and existing
journey navigation under fresh non-operating Tier3 review.
D879 records the guarded runtime cutover as builder-green: exact approved source is
the sole healthy port3000 app, Order315 is retained stopped, login/two properties/all
routes/root Today and source assets pass, and status, database and companions remain
unchanged. Fresh non-operating Tier3 browser approval remains pending.
D880 independently approves exact fd1f7a6 and the sole live app after read-only
runtime, database, route, byte-identity and live-browser acceptance. Port3000 now
reflects the approved Order316 management-navigation fine-tune without changing
unfinished-phase truth or granting broader authority.

## Order318 roadmap entry

Make the already-built reservation-to-Folio route discoverable from the empty Folios
lookup with one eligibility-qualified secondary action. Preserve direct lookup,
contextual return precedence and all existing financial authority; no new request,
data, status or post310 work is introduced.
D882 records the implementation side as green after intentional red. One semantic
bridge, eligibility copy, dirty confirmation and canonical Reservations navigation
pass focused49/0, standing1134/0 plus890 skips and static gates. Fresh Tier2 browser
review remains mandatory; the sole approved local is unchanged.
D883 records a review-evidence precondition failure only: automated/source proof is
green, but the malformed disposable harness never launched a browser. Candidate e46af12
is unchanged and requires fresh isolated-browser retry; the approved local is untouched.
D884 independently approves unchanged exact e46af12 after a fresh reviewer personally
passes the complete isolated two-property/detail-mode, Folio navigation, dirty/history,
responsive/theme/accessibility and zero-mutation browser matrix. Order318 is complete;
sole-local reflection remains a separately admitted app-only operation.

## Order319 roadmap entry

Reflect approved Order318 in the sole founder local through an app-only guarded cutover.
Retain Order317 for rollback; preserve database, companions, credentials and status; and
prove the live Folios bridge across both properties and all detail modes under fresh
non-operating Tier3 review.
D886 records the guarded app-only cutover as builder-green: exact approved source is the
sole healthy port3000 app, Order317 is retained stopped, protected prefilled login, both
properties, all routes and served bridge pass, and database/companions remain unchanged.
Fresh non-operating Tier3 live approval is pending.
D887 independently approves exact587cdf6 and the sole live app after read-only runtime,
database, route, status and full live-browser acceptance. Port3000 now reflects the
approved Folio discoverability fine-tune without changing unfinished-phase truth or
granting broader authority.

## Order320 roadmap entry

Correct only stale financial presentation copy so management users can see that an
eligible loaded Folio may expose the already-built governed deposits, corrections,
organization, direct billing and zero-balance settlement surfaces. Preserve explicit
tax/invoice/fiscal/check-out boundaries and every behavior; local reflection is separate.
D889 records implementation green after intentional red. Only two static paragraphs,
one exact-copy assertion and the UI specification changed; focused38/0 plus6 skips,
standing1137/0 plus890 skips and all static gates pass. Fresh presentation review is
pending and the approved local remains unchanged.
D890 independently approves exact94e76a8 after authority tracing, focused57/0 plus6
skips and a153-assertion isolated responsive/theme/accessibility browser matrix. Order320
is complete; sole-local reflection remains a separately admitted app-only operation.

## Order321 roadmap entry

Reflect approved Order320 in the sole founder local through a guarded app-only cutover.
Retain Order319 for rollback and preserve database, companions, credentials and truthful
status under fresh non-operating Tier3 review.
D892 records builder-green local reflection: exact approved source is the sole healthy
port3000 app, Order319 is retained stopped, both copy surfaces and all preserved runtime/
data/topology checks pass. Fresh non-operating Tier3 approval remains pending.
D893 independently approves exact608bc00 and the sole live app after complete read-only
runtime/database/status and live-browser acceptance. Port3000 now truthfully exposes the
already-built eligible-Folio capabilities without changing authority or unfinished truth.
## Order337 roadmap entry

Resume the remaining build plan after the founder explicitly lifted D-869. Revalidate
complete approved Order310 evidence and derive only numeric per-component rate
schedules: IGST preserves the sole aggregate GST_ROOM schedule, while CGST+SGST and
CGST+UTGST receive equal ordered halves of each exact even aggregate basis-point rate.
Taxable value, amount, rounding, Section14, posting, documents and IRP remain later
bounded dependencies. D942 admits intentional-red, hostile ancestry proof,
preservation gates and fresh non-implementing Tier-3 executable review.
Build D943 is green on exact candidate4f29fd5: intentional red preceded the pure
component-rate boundary; focused/adjacent/standing/static proof passes and database
lineage is unchanged. Fresh non-implementing Tier-3 executable approval remains
mandatory before Order337 can close.

D944 withholds Order337 on permanent-proof sensitivity only. The implementation and
statutory source semantics are green, but the permanent proof must equality-bind both
component rate and basis points for every historical/active slab and both dual
families; sum-only assertions do not prove equal12% and18% halves. A different fresh
Tier-3 rereviewer remains mandatory after repair.

D945 independently approves Order337 after exact proof repair5923908. The permanent
proof now binds ordered identity,decimal rate and basis points for every component of
historical12%/18% and active5%/18% schedules across both dual families; explicit
599+601 and899+901 unequal mutants fail. Focused/adjacent/standing/static gates pass.
Approval closes only numeric component-rate decomposition; all taxable-value,amount,
rounding,posting,document,IRP and runtime dependencies remain bounded future work.

## Order338 roadmap entry

Close Order302's fail-closed calendar prerequisite without guessing Indian weekends or
holidays. Validate a dense externally governed civil-day sequence after the asserted
rate-change date and derive only the first four working dates and fourth-working-day
evidence. D946 admits a pure tenant-bound, frozen, hostile-input boundary; no database,
ingestion, payment-date conclusion, section14 matrix, tax, fiscal, API/UI or local
authority. Intentional red and fresh non-implementing Tier3 review are mandatory.
D947 records the implementation side green: intentional red preceded a pure exact
boundary; focused21/0, permanent8/0, standing1162/0 plus890 expected skips and all
static gates pass. No database/runtime artifact changed. Fresh Tier3 approval remains
mandatory before the evidence can compose with Order302.

## Order339 roadmap entry

Compose approved rate-change, fail-closed payment-proviso and governed working-day
evidence into only the Section14 payment-receipt-date result. D949 requires complete
predecessor replay, strict after-four-working-days substitution and calendar coverage
of bank credit. No applicability/six-case matrix, tax, fiscal, API/UI or local authority
is admitted. Intentional red and fresh Tier3 review are mandatory.
D950 records the implementation side green after intentional red. Complete predecessor
replay and exact through-fourth/strictly-after boundaries pass focused27/0,
standing1169/0 plus890 expected skips and all static gates without DB/runtime change.
Fresh Tier3 executable approval remains mandatory.

D951 withholds Order339 on permanent-proof sensitivity only. Product/statutory
semantics and all normal gates are green, but an unrelated returned calendar source
digest survives because proof self-hashes the mutant body without equality-binding
the returned authority/source to rederived Order338 truth. The explicit
calendar-required guard is also not independently mutation-sensitive because valid
bank coverage currently implies that branch. Repair the permanent proof and obtain a
different fresh Tier3 rereview; no downstream authority is admitted.

D952 records the bounded permanent-proof repair. Returned calendar authority and
source are now exact-bound to both admitted calendar input and completely rederived
Order338 evidence. The explicit calendar-required guard is structurally pinned because
valid Order338 coverage independently implies the same branch and would otherwise mask
its removal. Focused27/0(240),standing1170/0 plus890 skips(17693),typecheck,
boundaries130,licences23 and audit0 pass without product/runtime/database/local change.
A different fresh Tier3 rereviewer must kill both reported mutants before approval.

D953 independently approves repaired Order339 with both D951 mutants and the wider
strict-boundary/replay/hash challenge set killed. D954 admits Order340 as the smallest
next dependency: one transaction-bound exact six-case Section14 composer that
revalidates governed service/invoice/payment evidence, derives books/bank only from
Order291, privately normalizes the approved safe or calendar payment branch and selects
only predecessor/successor version identity. No separate adapter, numeric rate/value/
amount, posting, document, IRP, API/UI or local authority is admitted.
D955 records Order340 builder-green after intentional red. The transaction-bound
composer and hardened proof cover all six cases, both earlier-of directions, every
equality position, non-enumerated arrangements, safe/calendar normalization, complete
predecessor replay and exact version/hash/freeze containment. Focused6/0(70),standing
1176/0 plus890 skips and all static gates pass without DB/runtime/local change. Fresh
Tier3 executable review remains mandatory.
D956 records the fresh Tier3 withholding on permanent-proof sensitivity only. The
product and statutory semantics have no finding, but20 of72 reviewer mutants survive
where the committed proof does not independently bind invoice equality, hash-preserved
predecessor bodies, Order291 safe/calendar provenance, calendar predecessor hashes,
the exact transaction handle and explicit outer property/lineage/amount/currency
guards. Bounded permanent-test repair and a different fresh Tier3 rereview are next;
no downstream authority is admitted.
D957 records the bounded test-only repair at eb315f9. It adds isolated invoice-equality,
hash-preserving seven-result replay, exact calendar hashes/final preimage, hostile
lineage and structural provenance/transaction/guard bindings. Focused11/0(122),
dependencies40/0(570),standing1181/0 plus890 skips(17815) and all static gates pass.
Product source,DB,runtime and stable local are unchanged; different fresh Tier3
execution of all20 mutants is pending.
D958 records a different fresh Tier3 rereview:19/20 exact mutants die, but M04 still
survives because a shared source fragment does not distinguish the calendar Order339
call from the earlier Order302 derivation. D959's two-line test-only repair exact-counts
both fresh Order291 books/bank uses; clean focused10/0(123),M04 red9/1,standing1181/0
plus890 skips(17817) and static gates pass. Another different fresh Tier3 must approve.
D960 independently approves exact Order340 headcdb12ef/implementation67cd364/proof
fc02337 with no finding. Exact M04 and seven high-value sampled faults die; focused,
dependencies,broad-India,standing1181/0 plus890 skips(17817),static,ancestry,scope,
protected and blob checks pass. Approval grants six-case Section14 version identity
only; numeric applicability and every downstream fiscal authority remain separate.
D961 admits Order341 as the non-duplicative quoted per-room-night applicability
partition over approved Orders340/337 and persisted Orders240/244/252. It must preserve
Section14-selected version precedence and classify each existing positive INR unit-day
amount independently; stay total/average/date override and final taxable value,tax
money,rounding,posting,document/IRP remain forbidden. Fresh Tier3 review is mandatory.
D962 supersedes D961's impossible direct equality of historical supply-date and
Section14-selected versions. Order341 instead replays the shared pair/component-family
ancestry, chooses the exact pair member only through Order340, and applies the unchanged
Order337 numeric decomposition through one shared scheduler. Cases1 and5 must prove the
opposite-side result; no extra prerequisite order or broader authority is admitted.
D963 withholds exact Order341 candidate9731aa8 on permanent-proof sensitivity only,
not product/statutory semantics. Repair must exact-bind every copied component across
six cases/three families/two bands and independently pin all selected-side,source,
status,lineage,amount,INR,transaction,tenant/predecessor-hash and freeze guards before
a different fresh Tier3 rereview.
D964 narrows the Order341 review debt to one proof surface:15/16 D963 mutants die at
531fc4c, while removing only outer `frozen(raw)` survives. Test-only cb73daf isolates
an otherwise-valid mutable outer envelope and hostile wrappers; a third fresh Tier3
must kill that exact mutant before approval.
D965 independently approves exact reviewed Order341 head7aab21e after the third fresh
Tier3 kills the final outer-freeze mutant and sampled repaired faults. Clean adjacent
44/0(1356),standing1187/0 plus890 skips(18388),static,ancestry and scope gates pass.
The approved output remains quoted rate applicability only; final Section15 taxable
value, tax money, rounding, posting, documents and IRP remain later work.

D998 builds Order350's governed final-valuation evidence on migration0062. Four
insert-only forced-RLS tables preserve exact locked sources, room nights, signed
allocations, legal buyer, ordinary/manual disposition and superseding generations.
Fresh62/115/105/14/2 plus executable atomic-command proof is green; independent Tier3
review is pending. The next Phase7 slice remains component tax/rounding over approved
evidence, not a document or IRP shortcut.

D966 admits review-only Order342 as the smallest honest Phase-6 continuation. The
documented Phase-6 journeys are built across Orders200–236 but lack their required
fresh independent executable exit proof. The reviewer must execute the checkout,
cadence-sheet, discrepancy, hostile-authority, standing/static/schema and referee11/11
matrix on the exact integrated head without product/test/migration/runtime/local
change. Findings return to a separate repair order; unresolved discrepancy,queue and
message policy remains outside.

D967 independently approves exact Order199 candidatef138f99 after fresh PostgreSQL
execution of both financial journey paths, hostile approvals, concurrency, exact
migration1–25 schema93/83 and referee11/11 plus standing/static gates. The approval is
bounded to the Phase-5 journey gate; owner-trust negative authorization and audited
continuous day-close remain substantive Phase-5 work.

D953 independently approves exact repaired head26682ab/implementationea190dd with no
finding. Official CBIC section14 semantics, strict ancestry/scope and all gates pass.
Reviewer-owned disposable mutants kill both D951 regressions plus >=,always-bank,
always-earlier,missing-coverage,omitted-Order338-replay and tenant-free-hash faults.
Focused27/0(240),standing1170/0 plus890 skips(17693),typecheck,boundaries130,
licences23,audit0 and diff hygiene pass. No runtime/DB/local or downstream authority.

D948 independently approves exact Order338 implementation1d81944/governance53a495a
with no finding. Official CGST section14 authority, exact source/ancestry/scope,
focused23/0,standing1162/0 plus890 skips and static gates pass. Reviewer-owned
in-memory mutants kill off-by-one start, non-working count, last-date selection,
trailing/source/tenant hash omissions and a valid contiguous367-day acceptance. The
4..366 bound is exact technical containment, not inferred statutory policy. Approval
closes only governed calendar evidence; payment-date conclusion,section14 matrix and
all downstream tax/fiscal/runtime work remain bounded future orders.

D970 readies Order344 after Order343 approval: implement the ratified accounting-only
owner-trust negative guard with derived credit-normal availability and exact one-use
four-eyes authorization. It is service/database only and grants no payout, statement,
split, reconciliation, UI, tax/fiscal, checkout, day-close or local authority.

D977 builds Order344 after an intentional red. Migration0060 and the trust service
prove exact locked credit-normal availability, a distinct-checker one-use negative
authorization, balanced immutable accrual, replay and atomic rollback on fresh
PostgreSQL at catalogue111/101/10/2. Fresh non-implementing Tier3 review remains open;
there is still no payout, statement, split, reconciliation, UI, tax/fiscal, checkout,
day-close, local or Phase-complete authority.

D968 WITHHOLDS Order342 Phase6 exit approval solely on three stale permanent
migration0059/runtime-capability oracles; all product journeys, hostile boundaries,
schema, standing and referee proof pass. D969 opens Order343 as the exact test-only
repair, followed by a different fresh Tier3 complete exit rereview. The sole local and
all product/schema/authority surfaces remain unchanged.

D972 WITHHOLDS Order343 exact candidate04e5e12 on one masked stale permanent oracle.
The intended migration0059 and thirteenth-capability repairs are exact and all other
Order343/342 proof is green, but the runtime-authority suite still expects old exact
RLS catalogue totals94/84/0/84 instead of current110/100/10/100 after its earlier
capability assertion is repaired. A bounded test repair plus different fresh Tier3 is
required; Phase6 and Order344's prerequisite remain unapproved.

D973 opens Order345 as that exact four-integer, one-assertion repair. It retains the
catalogue query and strict equality, changes no behavior, and requires another
different fresh complete exit rereview.

D974 independently approves exact Order345 candidatee1b030e and supersedes the
D972/D968 withholdings. Fresh runtime authority10/0, migrate39/0, acceptance23/0,
effective2/0, seed24/0, exact schema, complete Phase6 journey/hostility112/0,
standing/static and referee11/11 pass. Orders345,343,342 and documented Phase6 are
complete; deferred queue/message/discrepancy-resolution, Phase7/8 and application
completion remain outside the approval. Order344's recorded after-Order343
prerequisite is now satisfied, without reviewing or approving Order344 itself.

D978 WITHHOLDS Order344 solely on a stale exact review-login scope oracle. D979 opens
Order346 to add the operator post scope and separate approver negative-approval scope
to their respective expected strings, with exact equality and no behavior change.

D981 independently approves exact Order346 candidate37cb8cf and discharges D978,
thereby approving Order344's accounting-only owner-trust guard. Fresh role/login,
60/111/101/10/2 database, trust hostility, permanent, standing/static/schema and
referee11/11 evidence is green. No payout, UI/local, day-close, Phase5 or application
completion is claimed.

Order347 builds the bounded automatic property-local current-day roll without seal,
readiness or catch-up authority. Its opt-in runtime worker discovers only due
tenant/property scopes; the service derives the date in PostgreSQL and atomically
records the single winning day/fact/event effect.

Order382 repairs the fresh-review contention failure with forward-only migration0065.
The unchanged capability uses targetless conflict handling across exactly the current
property/date and tenant/property/date uniqueness arbiters; no broader behavior is added.
Fresh independent PostgreSQL16.15 proof approves and closes this repair at D1110;
the separate Phase5 exit gate remains outstanding.

D989 independently approves Orders348 and347 after exact parent-red reproduction and
fresh corrected cancellation, finance, schema, authority, standing/static and
referee11/11 proof. This closes automatic current-day roll only; seal/readiness/carry,
local promotion and the Phase5 exit remain separate.

Order349 is the first D990 close slice: one immutable exact-day readiness snapshot,
strict `<5m` oldest exact-target outbox lag, typed relational blockers and explicit
unknown/fail-closed incomplete interface attribution. It is read-only and migration-
free; discrepancy carry, audited seal and Phase5 exit remain subsequent reviewed
closures.

Orders352/355 supply the separately reviewed carry mutation and exact carried-lineage
readiness semantics. Order356 now implements only the next audited-seal closure. One
active authenticated same-tenant actor with property-scoped `business_day.seal` may
act directly; no checker is introduced. The database locks all mutable
authorization/readiness sources and the exact open day, reruns complete readiness at
one transaction timestamp, and admits only one `open -> sealed` winner. Durable
service idempotency, one immutable fact and one canonical event share that transaction;
replay is write-free and every divergent/already-sealed/concurrent loser conflicts.
The candidate adds no route, UI, local promotion, automatic/batch/reopen behavior or
Phase5/application completion. Fresh independent Tier3 executable approval and the
separate Phase5 exit gate remain required.

D1112 independently approves and closes Order375 after a distinct fresh from-item1
PostgreSQL16.15 review passes the complete Phase5 financial/trust/payment/cashier/
receivable/day-roll/readiness/carry/seal contract, exact65/116/106/106/15/2 catalogue,
schema, migration39/0, acceptance23/0, standing1225/0, static gates and referee11/11.
Phase5 domain work is reviewed complete. The four trust/readiness/carry/seal services
remain unwired in operator API/UI/status/local truth, so application completion and
founder-visible integration remain separately governed work.
