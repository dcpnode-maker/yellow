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
