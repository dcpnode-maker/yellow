# CODEX-HANDOFF.md — final operational handoff, Claude → Codex

**This file is the manifest for D-91 in `DECISIONS.log`.** It exists so that deleting
the Claude Cowork project that produced it loses no project-relevant context. Read it
once at the start of the first post-handoff session; after that, `DECISIONS.log` and
`handoff/LEDGER.md` are the durable record and this file need not be re-read in full.

> ## READ THIS FIRST — §2a supersedes §4's "next objective"
>
> This handoff was drafted against `C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow`
> (a Windows-mounted copy synced to `origin/main` at Phase 0 only). While finishing it,
> real, much more advanced, **unpushed-until-now** work was discovered in eight WSL
> worktrees on the founder's own machine — through roughly Order 091, Phases 3–4,
> dated as recently as the same day as this handoff. It has now been pushed to `origin`
> as non-destructive `backup/*` branches (nothing on `main` or any pre-existing branch
> was touched). All eight are confirmed **one single linear branch** (no competing
> lineages to pick between) — `backup/order-091-final-4874f5c` is the tip and already
> contains everything else. **§2a is the authoritative account of this, including the
> branch's own primary-source history (D-95, D-161, D-220/221, D-280, D-291) read
> directly from its `DECISIONS.log`, `ARCHITECT-HANDOVER.md` and
> `GATE-3-REVIEW-CONTRACT.md`. Do not start work from §4's "Order 019" without reading
> §2a first** — Phases 1 and 2 are done in that lineage (Phase 4 is well underway), and
> starting fresh at Order 019 would duplicate real, mostly independently-unreviewed work
> rather than continue it.

## 1. Founder directive and effective date

**Effective 2026-08-23.** The founder authorized complete operational ownership
transfer of Yellow to Codex. Full text is recorded verbatim in intent as `DECISIONS.log`
D-91. Summary: Codex becomes primary implementation and coordination owner —
authorized to create, revise, execute, and close scoped implementation orders; complete
every remaining phase in `BUILD-PLAN.md`/`handoff/ROADMAP.md`; make routine technical
decisions within the documented architecture; create branches, commits, tests, docs,
and PRs; coordinate multiple local or cloud LLM agents for parallel implementation and
independent review; choose models by risk/cost/speed/capability; and continue between
orders and phases without asking permission first. Claude is no longer required for
planning, implementation, order creation, intermediate review, or continuation, and may
review the finished application only if the founder explicitly asks. `PROJECT.md` is
unchanged and remains the canonical constitution — the Ten Invariants, scope
discipline, forward-only migrations, immutable records, tenant isolation, RLS,
occupancy choke point, balanced journals, fiscal chains, token-only payments,
transactional outbox guarantees, and every executable verification gate all still bind.

## 2. Current branch, head, phase, and project status

- **Branch:** `main` (`.git/HEAD` → `ref: refs/heads/main`).
- **Head commit:** `61b0fd3c7cea0944c2bf5fed164064001a94c899` — **verified** with
  `git log`/`git status` (WSL git, via `C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow`,
  which tracks `origin/main` and is up to date, clean working tree apart from this
  handoff's own edits). Message: `Phase 0: cumulative integration (Orders 001-018) (#17)`.
- **Phase 0 — Bootstrap:** complete. Orders 001–018 all carry `## MERGED` markers in
  `handoff/orders/`; `DECISIONS.log` D-90 records a single linear branch chain
  (`main → … → d6f5c3e (015) → e34fa40 (016) → 30b9491 (017) → a423497 → 7f1d7c3 (018)`,
  40 commits, verified at authoring time with `git merge-base --is-ancestor` at every
  link) integrated to `main` in one cumulative merge rather than three sequential PRs.
  `main`'s current head (`61b0fd3c…`) differs from the chain tip `7f1d7c3` recorded in
  D-90 because it **is** the merge commit (PR #17) — confirmed by `git log`.
- **Phase 1 — Kernel:** planned in `handoff/PHASE-1-PLAN.md` (orders 019–026), **not
  issued on `main`/`origin`**. Hard prerequisite (Phase 0 merged to `main`) is
  satisfied. **However — see §2a: real work well past Phase 1 already exists,
  unmerged, on the founder's machine. Do not issue order 019 without reading §2a.**
- **Phases 2–12:** named, budgeted, and their Tier-3 surfaces identified in
  `handoff/ROADMAP.md`; not decomposed into orders (by design — each phase decomposes
  at the prior phase's exit review).
- **Open handoff items on `main`:** zero. Every file in `handoff/orders/` carries
  `## MERGED`; every file in `handoff/questions/` (007, 008, 010) carries
  `## RESOLVED`/`## RATIFIED` (verified by grep this session). `./state.sh` should
  report `orders_open=0`, `questions_open=0` if run against this head. **This does not
  mean the project has no open work — see §2a for orders and reviews that exist and are
  outstanding in unmerged branches, invisible to `main`.**

## 2a. CRITICAL — unpushed advanced work found and preserved, 2026-08-23

**This section was added after discovery mid-handoff and is the most important thing
in this file for whoever reads it next.**

### What was found

The founder's WSL environment (`~/projects/`) holds eight additional full clones of
this same repository (`origin` = `https://github.com/dcpnode-maker/yellow.git` in every
one of them — confirmed, not a different project) beyond the canonical `~/projects/yellow`
and the Windows-mounted copy this handoff was drafted against. All eight are **far**
ahead of `origin/main`'s Phase-0-only tip (`61b0fd3c…`), all had **clean working trees**
(no uncommitted changes — nothing was at risk of being lost, only of being unreachable
because it had never been pushed), and none of their commits existed on `origin` until
this session pushed them (see "What was done" below). Timestamps run from 2026-08-22
20:50 UTC to 2026-08-23 16:15 IST — the most recent commit is from the **same day** as
this handoff.

| Directory | Branch (HEAD) | HEAD commit | Commits ahead of `61b0fd3c…` | Working tree |
|---|---|---|---:|---|
| `yellow-order-089-baseline` | *(detached)* | `1cac9b5` "record order 089 self-check correction" | 204 | clean |
| `yellow-order-090` | `phase-4/portable-ai-provider-contract` | `956508a` "record Order 090 evidence" | 207 | clean |
| `yellow-order-091` | `phase-4/rms-economic-metric-contract` | `51d46f7` "add canonical RMS room economics" | 210 | clean |
| `yellow-order-091-final-5d3f137` | `phase-4/rms-economic-metric-contract` | `4874f5c` "record Order 091 builder evidence" | 212 | clean |
| `yellow-phase-1` | `phase-3/local-review-published-rate` | `12ba636` "finalize Order 078 evidence" | 157 | clean |
| `yellow-phase-4` | *(last touched)* `phase-4/direct-reservation-commit-http`, HEAD at push time on `phase-4/complete-availability-offer-search` | `383c98f` "record Order 082 remote CI" | 179 | clean |
| `yellow-phase4-review-080-086` | `phase-4/strict-http-calendar-instants` | `1cac9b5` (same commit as order-089-baseline) | 204 | clean |
| `yellow-review` | *(detached)* | `d3f6ee4` "record order 085 remote CI" | 193 | clean |

(There is also `~/projects/yellow.zip`, 132 KB, dated 2026-08-14 — not inspected, likely
an early Phase-0-era archive given its size and date; not a git repository.)

Two of the clones (`yellow-order-091` and `yellow-order-091-final-5d3f137`) sit on a
branch with the *same name* (`phase-4/rms-economic-metric-contract`) but different tips
12 minutes apart — they are **independent clones**, not linked `git worktree`s (each has
its own full `.git` directory).

**Update — fully resolved, not just catalogued.** Fetching all eight `backup/*` refs
into one clone and running `git merge-base --is-ancestor <each> backup/order-091-final-4874f5c`
proved every other branch — `backup/phase-1-12ba636`, `backup/phase-4-383c98f`,
`backup/order-091-51d46f7`, `backup/order-090-956508a`, `backup/order-089-baseline-1cac9b5`,
`backup/review-d3f6ee4` — **is a strict ancestor of `backup/order-091-final-4874f5c`**.
There is no divergence and nothing to reconcile between lineages: this is **one single
linear branch**, and the eight directories were sequential local checkpoints of the same
ongoing work (matching the founder's own note in that lineage's `ARCHITECT-HANDOVER.md`:
canonical build work happens in a fresh `~/projects/yellow-<slug>` Linux-filesystem
worktree per milestone, never `/mnt/c`, per D-49's I/O-penalty finding).
**`backup/order-091-final-4874f5c` is simply the single furthest tip. Nothing else needs
picking between.**

### The real history — read from the lineage's own primary sources, not inferred

Two authoritative documents exist *inside that branch* and were read in full — a prior
Claude architect's handover (`handoff/ARCHITECT-HANDOVER.md`, 2026-08-21) and the
founder's own standing instruction to Codex (`handoff/GATE-3-REVIEW-CONTRACT.md`,
2026-08-22). Together they give an exact, primary-sourced timeline that supersedes any
inference in the rest of this section:

| Date | Event |
|---|---|
| 2026-08-14/15 | Phase 0 (Orders 001–018) — identical to this handoff's `main`, merged at `61b0fd3c`. |
| 2026-08-15 | **D-95** (that branch's own `DECISIONS.log`): founder-authorized *temporary* architect exception — Codex may write/amend orders and implement while Claude is unavailable "for approximately one week." Explicit: "temporary authority is not independent review… all accumulated Phase 1 work still requires Claude's independent exit review." References an *even earlier* D-71 exception. |
| 2026-08-15 → ~08-21 | Codex builds Orders 019–044 (Phase 1 Kernel *and* apparently Phase 2/3 material folded in — far more than this handoff's `handoff/PHASE-1-PLAN.md`, which only sequenced 019–026) under D-95, accumulating decisions to D-160. |
| 2026-08-21 | Claude (`claude-opus-5`, architect role) returns, independently executes and discharges the Orders 019–044 / D-95→D-160 debt (**D-161**), then writes `handoff/ARCHITECT-HANDOVER.md` formally stepping back: *"Claude → Codex (build) → Fable (review, test, deploy)."* At handover: 44 orders written, 8 reviews on file, D-1→D-263, Orders 001–018 merged, **019–044 independently reviewed but still unmerged to `main`**. |
| 2026-08-21→22 | Codex continues Orders 045–073 without per-order blocking. Claude executes a **Gate-3** review at commit `4cc791c`, ratifying decisions D-162–D-262 but returning **CHANGES REQUIRED** (findings F11 and F12 — not a clean pass). Order 074 is written specifically to correct F11/F12. |
| 2026-08-22 | Founder gives Claude a *new* standing instruction, recorded in `handoff/GATE-3-REVIEW-CONTRACT.md`: *"Claude reviews the application at a later gate. Until then Codex proceeds continuously."* Codified as **D-220**, with Codex's acknowledgment as **D-221** — the order-091 file's "founder-authorized temporary architect/builder under D-95/D-115/D-221" citation refers to exactly this chain. **This is the same shape of instruction as the founder directive behind this handoff's own D-91 — given to a different Claude session, one day earlier, independently.** |
| 2026-08-22→23 | Codex continues Orders 075–091 under that non-blocking rule, recording each as `UNVERIFIED` review debt in `handoff/GATE-3-MANIFEST.md` rather than waiting — reaching **D-291** by Order 091 (today). |

**F11 was not simply "fixed and done."** `DECISIONS.log` D-280 (2026-08-23, read from the
same branch) records that re-executing Gate-3 finding F11 *after* Order 082 found a
**second, different regression** (a fixture/seed issue in Order 050's proof, caused by
Order 078's changes), corrected in Order 083. Treat F11/F12's status as "corrected at
least once, re-verify from scratch" rather than "resolved."

### `handoff/GATE-3-MANIFEST.md` — the exact, complete review backlog at Order 091

Copied in full (source: `backup/order-091-final-4874f5c:handoff/GATE-3-MANIFEST.md`).
Every row is `UNVERIFIED` — "built, proofs builder-asserted, not executed by the
reviewer." **Orders 087 and 088 do not appear** — not built yet, built under a different
scheme, or the manifest is behind; this session could not determine which and did not
guess. Protected hashes (immutable baseline + referee) are re-quoted as unchanged
throughout: `migrations/0001_init.sql` = `fe2a9fc9…b30923`, `tests/run_invariants.py` =
`3228279b…befa1` — **identical to the hashes on `main`**, i.e. the immutable baseline
was never touched by any of this.

| Order | Tier | Title |
|---|---|---|
| 045 | 2 | Fail-closed Windows handoff-state reporting |
| 046 | 3 | Reproducible local-review demo inventory |
| 047 | 3 | Durable API idempotency foundation |
| 048 | 3 | Operator inventory management |
| 049 | 3 | Operator restriction management |
| 050 | 3 | Operator rate-plan management |
| 051 | 3 | Operator rate-price management |
| 052 | 3 | Operator rate-price correction |
| 053 | 3 | Operator OOO/OOS lifecycle |
| 054 | 2 | Operator OOS sellability policy |
| 055 | 3 | Operator cart-hold management |
| 056 | 3 | Audited hold-expiry worker |
| 057 | 3 | Operator bulk exclusive-room creation |
| 058 | 3 | Truth-derived availability projection rebuild |
| 059 | 3 | Durable availability-projection event consumer |
| 060 | 3 | Operator-controlled availability-projection bootstrap |
| 061 | 2 | Availability work-scaling proof |
| 062 | 3 | Operator-managed offline capacity lease pool |
| 063 | 1 | Universal rate-plan product contract |
| 064 | 2 | Founder project progress and live system-health dashboard |
| 065 | 3 | Versioned rate-model catalogue and draft selection |
| 066 | 3 | Versioned rate applicability and commercial targeting resolver |
| 067 | 3 | Typed exact-money rate-model evaluators |
| 068 | 3 | Guest, promotion, package, policy and distribution composition |
| 069 | 3 | Atomic rate draft simulation, approval, publication and versioned undo |
| 070 | 3 | Universal stay quote resolution and governed RMS/API evidence |
| 071 | 2 | Guided and expert universal rate-plan workbench |
| 072 | 3 | Secure AI-assisted rate intent |
| 073 | 3 | Rate applicability rules and versioned bulk preview |
| 074 | 2 | Gate-3 browser-proof and founder-status corrections (fixes F11/F12) |
| 075 | 3 | Selected-release policy evidence at the operator boundary |
| 076 | 2 | Immutable rate-release inspection and safe reuse |
| 077 | 3 | Two-operator rate-publication approval inbox |
| 078 | 3 | Reproducible local-review published rate and live quote |
| 079 | 2 | Reproducible Phase-3 and Gate-3 database proofs |
| 080 | 2 | Executable reservation state contract |
| 081 | 3 | Atomic cart-hold to reservation commit |
| 082 | 3 | Direct reservation commit and racing HTTP contract |
| 083 | 2 | Review-seed fixture isolation and inherited Gate-3 proof coverage (F11 regression #2) |
| 084 | 3 | Complete availability offer search |
| 085 | 3 | Reservation modify, cancel and reinstate commands |
| 086 | 3 | Atomic reservation segment move, extend and shorten |
| 089 | 2 | Strict HTTP calendar instants |
| 090 | 3 | Portable AI intent provider contract |
| 091 | 3 | Canonical RMS room-economics metric contract |

(Exact impl/order/red-proof commit hashes for every row are in the manifest file itself —
omitted here for length; fetch `backup/order-091-final-4874f5c` and read
`handoff/GATE-3-MANIFEST.md` directly rather than trusting a second-hand copy of 47 hashes.)

### `handoff/GATE-3-REVIEW-CONTRACT.md` — the exact rule Codex has been building under

This is the operative, founder-authorized, already-proven-in-use version of what this
handoff's §11 tries to establish independently. Quoted because it should very likely
**replace or merge with** this handoff's §11 language rather than compete with it — it
is more precise and has already governed 47 orders successfully:

> **§3 — The only things that still stop you** (write `handoff/questions/NNN.md` and wait,
> **only** for these): any edit to an *existing* file under `migrations/` (a new numbered
> file is not an edit) · any edit to `tests/run_invariants.py` · the referee dropping
> below `11 passed, 0 failed of 11` · any pre-registered proof that fails and cannot be
> fixed without weakening an assertion · any Forbidden-list item, any invariant question,
> any new dependency · anything touching money, occupancy, RLS, tenant context, or the
> audit/outbox envelope that is not already explicit in an order and `DECISIONS.log`.
>
> Everything else is recoverable at a gate. Stopping early has never been penalised;
> continuing past a floor item is still the only unrecoverable mistake.

And its §2, on what replaces a blocking review request: append one row to
`handoff/GATE-3-MANIFEST.md` per completed order and keep going — "A completed order
with green proofs is not [something only an architect can resolve]; it is review debt,
and review debt is recorded, not awaited."

### Two things that need the founder's or an architect's attention, not Codex's

1. **`DECISIONS.log` numbering collides across the two lineages.** This handoff's `main`
   copy has `D-1`–`D-90` (Phase 0) then this session's own `D-91` (founder directive) and
   `D-92` (this WSL discovery). The advanced branch also has `D-1`–`D-90` identical up to
   the Phase-0 merge, then **diverges** with its *own*, different `D-91` onward (its
   `D-95` is dated 2026-08-15 and is about the temporary-architect exception, not this
   handoff's founder directive). **Do not concatenate or fast-forward-merge the two
   `DECISIONS.log` files without renumbering one side** — the same decision numbers
   currently mean two different things on the two branches.
2. **The "Fable" identity is inconsistent and unresolved.** `ARCHITECT-HANDOVER.md`'s
   title reads "Claude → Codex (build) → Fable (review, test, deploy)" as if Fable were a
   separate downstream reviewer role, but `GATE-3-REVIEW-CONTRACT.md` (written one day
   later) has the Gate-3 review executed directly by "Claude Opus 5 (architect role,
   independent reviewer)" — no separate "Fable" identity appears there. This session
   could not determine whether "Fable" was a planned-but-unused role, an informal name for
   Claude's most capable model (matching this handoff's own `CLAUDE.md`/`ROSTER.md` usage
   of "Claude Fable 5" as a model name, not a separate agent), or something else. Don't
   silently pick an interpretation — ask.

### What was done (this session, non-destructively)

### What was done (this session, non-destructively)

With the founder's explicit direction to preserve rather than merge, reset, rewrite, or
fabricate: verified `git push --dry-run` succeeded (network + auth to `origin` both
work from this WSL environment), then pushed each clone's exact HEAD, unmodified, to a
**new** branch name on `origin` — additive only, nothing force-pushed, nothing existing
overwritten, `main` untouched, none of the local worktrees touched or altered:

| New branch on `origin` | = local clone HEAD |
|---|---|
| `backup/order-089-baseline-1cac9b5` | `yellow-order-089-baseline` |
| `backup/order-090-956508a` | `yellow-order-090` |
| `backup/order-091-51d46f7` | `yellow-order-091` |
| `backup/order-091-final-4874f5c` | `yellow-order-091-final-5d3f137` |
| `backup/phase-1-12ba636` | `yellow-phase-1` |
| `backup/phase-4-383c98f` | `yellow-phase-4` |
| `backup/phase4-review-080-086-1cac9b5` | `yellow-phase4-review-080-086` |
| `backup/review-d3f6ee4` | `yellow-review` |

Verified present on `origin` afterward via `git ls-remote origin refs/heads/backup/*`
— all eight hashes match exactly what is listed in the table above (structurally
guaranteed identical by git's own hash verification; nothing was rewritten in transit).
The local WSL worktrees were left exactly as found — this was a preservation copy, not
a migration; the founder still has the originals.

To fetch these anywhere:
```bash
git fetch origin 'refs/heads/backup/*:refs/remotes/origin/backup/*'
git log --oneline origin/backup/order-091-final-4874f5c -20
```

### What Codex must do with this before touching Phase 1

1. **Do not issue Order 019.** `backup/order-091-final-4874f5c` already contains
   everything else found (confirmed by ancestry, see above) — this is not a "which
   lineage" decision any more, it's the one branch to read.
2. **Fetch and read `backup/order-091-final-4874f5c` directly** — `handoff/orders/`,
   `handoff/LEDGER.md`, `DECISIONS.log` (D-95 onward), `handoff/GATE-3-MANIFEST.md`, and
   both `handoff/ARCHITECT-HANDOVER.md` and `handoff/GATE-3-REVIEW-CONTRACT.md` in full —
   this section is a summary of primary sources that already exist in that branch, not a
   replacement for reading them.
3. **Before doing anything else on that branch, run its own standing self-check
   yourself** — `./setup.sh --db-only` on a fresh isolated Compose project per
   `GATE-3-REVIEW-CONTRACT.md` §5.2, full typecheck/boundaries/licence/audit/schema-drift
   — this handoff did not execute any of it; every "green"/"passed" figure above is
   builder-asserted, exactly as its own manifest says.
4. **Do not represent Orders 045–091 as reviewed or mergeable.** They are real,
   substantial, disciplined work (comprehensive red-first TDD, exact-hash protected
   floor, explicit Forbidden lists per order) but every one is self-labeled `UNVERIFIED`
   in its own manifest, and the one Gate-3 pass that did execute (`4cc791c`) returned
   CHANGES REQUIRED, not approval, on the portion it covered (Orders 045–073).
5. **Resolve the `DECISIONS.log` numbering collision and the "Fable" identity question**
   above before any merge is even contemplated — both are landmines for a naive
   fast-forward or concatenation.
6. **Ask the founder** which branch is authoritative going forward — `main` (Phase 0
   only, this handoff's governance changes) or the advanced lineage (`backup/order-091-final-4874f5c`,
   Phases 1–4 substantially built, D-291, review debt through Order 091) — before treating
   either as the base for new work. That is a product/process decision (§11's "missing
   product intent" carve-out), not a routine one, and this handoff deliberately does not
   make it.

## 3. Completed and merged work

- Phase 0 in full: repo scaffold (Bun/Elysia/TypeScript strict), Docker Compose
  (PostgreSQL 16 + Valkey, pinned digests), immutable `migrations/0001_init.sql`
  (80-table baseline; runner adds `schema_migration` for 81), Bun-SQL migration runner
  with per-file checksums and session lock (D-73), deterministic `yellow-demo`
  bootstrap seed (D-74), CI (typecheck + test + fresh-DB migrate + RLS referee) on
  pinned Postgres (D-75), the 11-test invariant battery (`tests/run_invariants.py`),
  license-check gate, dependency-audit gate, security-header gate, schema-drift check,
  worktree-safe `setup.sh`/`state.sh` (and Windows `setup.ps1`/`state.ps1` for
  `state.ps1` only — see §7), CI port/DSN resolution through Compose (D-81/Order 016),
  and `state.sh` open-vs-total accuracy (D-82/Order 017).
- 18 orders (001–018), 4 review documents (`handoff/reviews/001-006-phase-0-stack.md`,
  `008-015-phase-0-cumulative.md`, `016-017-ci-ports-and-state-accuracy.md`,
  `018-powershell-coverage.md`), 3 question threads (007, 008, 010) all resolved.
- Decisions D-1 through D-90 in `DECISIONS.log`, covering architecture, dependency
  doctrine, the dual-agent workflow later amended by this handoff, and multiple
  self-corrections (D-72 corrects D-69; D-80 corrects D-69's stated mechanism; D-86
  closes D-85; D-88 amends D-87).

## 4. Exact next implementation objective

**Read §2a before acting on this section.** Taken in isolation from `main`, the next
unissued order in the documented plan is **Order 019 — Transaction-local tenant context
middleware** (Tier 3, per `handoff/PHASE-1-PLAN.md`): every later order writes through
it, so if it is wrong every RLS guarantee is decorative, and the plan names a deferred
decision due first (JWT claim shape and scope vocabulary). **But §2a shows work already
exists through roughly Order 091**, several phases past this — so the real next
objective is almost certainly *reconciling* which lineage (`main`, or one of the
`backup/*` branches in §2a) is the one to continue, not issuing Order 019 fresh. Order
019 is documented here only so the plan-of-record is not lost; treat it as superseded
in practice until §2a's reconciliation (its item 2) is done.

## 5. Remaining roadmap and dependencies

Full detail in `handoff/ROADMAP.md` and `BUILD-PLAN.md`. Summary:

| Phase | Content | Tier-3 surfaces | Status |
|---|---|---|---|
| 1 — Kernel | tenancy, auth, extension registry, outbox, fact_log | tenant context (019), auth (020), outbox relay (023) | Planned (019–026), not issued |
| 2 — Inventory & Occupancy | space/unit_type CRUD, occupancy choke point live, holds, availability projection | occupancy choke point (2–3 gates expected) | Decomposed at Phase 1 exit review |
| 3 — Rates & Policies | rate_price bitemporal, packages, promotions, policy engine | rate_price insert-only chain | Named only |
| 4 — Reservations | search/hold/commit, lifecycle, waitlist | hold→commit transition, search correctness | Named only |
| 5 — Financials | ledger, journal balance, invoicing, trust | **densest Tier-3 phase**: ledger, journal balance, invoice numbering | Named only |
| 6 — Stay ops & Housekeeping | check-in/out, vehicles, HK task sheets | day-close/seal | Named only |
| 7 — Tax + India IRP | tax engine, GST slabs, gapless numbering, IRP | fiscal chain, GST slabs | Named only |
| 8 — Statutory + ZATCA | statutory adapters, ZATCA Phase 2 | fiscal chain, identity encryption | Named only |
| 9 — Distribution | direct OTA (Booking.com, Expedia), ARI push | bed-level OTA mapping | Named only |
| 10 — PWA | 7 surfaces, offline front desk, ALTCHA | CSP relaxation for ALTCHA WASM | Named only |
| 11 — Groups & Blocks | linked/block/share, allotment | block→reservation occupancy | Named only |
| 12 — UAE ASP + AR + migration | provider-routed fiscal, AR, legacy import | ASP routing, legacy migration | Named only |

Dependency ordering: each phase's exit review produces the next phase's order-level
decomposition — this is deliberate (`handoff/ROADMAP.md` "Detail level, and why it
stops where it does"), not a gap to fill in advance.

## 6. Open orders, reviews, questions, and decisions

**On `main`: none open.** All 18 orders MERGED; all 3 question threads
RESOLVED/RATIFIED; 4 reviews authored and closed; D-1 through D-91 recorded, none
marked OPEN (D-85 was OPEN and was closed by D-86). Confirm with `./state.sh`.

**Outside `main` (§2a): a real backlog exists.** The `backup/*` branches' own ledgers
self-report independent review outstanding from roughly Order 044 through Order 091,
with multiple `BUILT-UNREVIEWED` and `REMOTE-CI-GREEN … UNVERIFIED and unmerged`
entries. This is not resolved by anything in this handoff — see §2a items 1–5.

## 7. Known defects, risks, and technical debt

- **F9 / D-85 / D-86 / D-89 — PowerShell coverage is structurally partial.** `state.ps1`
  has real CI coverage (`windows-state` job). `setup.ps1` does not and cannot on
  `windows-latest` GitHub runners (no Linux-container Docker); its parity claim is
  downgraded to "best-effort, unverified" in `START-HERE-WINDOWS.md` per D-86. D-89
  additionally records that even `state.ps1`'s red-proof (Actions run
  `31849373292`) is a CI record, not reviewer-executed, because the reviewing agent had
  no git-on-Windows to reproduce it — accepted as low-consequence (a convenience
  script, not an invariant surface), but any future order that puts something
  Tier-2/3-adjacent behind PowerShell inherits this same verification gap and should
  not inherit the "accepted" judgment without re-examination.
  founder's Windows host reportedly still has no `git` on PATH as of D-85 — unverified
  this session; confirm before relying on native Windows execution for anything.
- **Deferred decisions, due before specific Phase 1 orders** (`handoff/PHASE-1-PLAN.md`):
  JWT claim shape/scope vocabulary (before 019), `pg_cron` as a dependency for
  `expire_holds`/`prune_outbox` (before 021/022, needs the DEPENDENCIES.md permissive-
  licence/governance/standard-protocol test applied), and the outbox dedupe idempotency
  key definition (before 022).
- **Two open Phase-1/2 architecture A/B decisions already flagged in `BUILD-PLAN.md`:**
  whether to keep PG-outbox-bus vs. introduce NATS JetStream (trigger: first
  out-of-process consumer or second app node), and Valkey vs. NATS JetStream KV for the
  Phase-2 availability-projection cache (decide via the stated p99 benchmark).
- **Merge-with-existing-PMS (D-56, `docs/MERGE-PLAN.md`)** starts no earlier than Phase
  5; legacy schema dump/screenshots/feature inventory should already be captured in
  `docs/legacy/` — confirm this is still current before Phase 5 planning.
- **The §2a discovery itself is the largest open item.** Eight branches' worth of work
  (through ~Order 091) needs reconciliation against `main` before Phase 1 work resumes
  — see §2a in full. This was not present in `main`, `origin` (until this session
  pushed `backup/*`), or the Windows-mounted folder this handoff was otherwise scoped
  to, and would not have been discovered without deliberately checking `~/projects/`
  in WSL for other clones of the same `origin`. If similar unpushed local clones exist
  on the founder's other machines (the co-founder's Mac is mentioned in
  `START-HERE-WINDOWS.md`), they were not checked this session.

## 8. External services, credentials, approvals, and founder actions still required

- **Forgejo mirror** — required before first deployment (D-68), not yet created as far
  as this session's file-only view can tell; founder action (account/instance).
- **Cloudflare Tunnel** — deferred until OCI hosts exist (D-68); founder action when
  hosting is provisioned.
- **OCI Always Free ×2 tenancies** (primary + replica) — founder action, not
  verifiable from repo files.
- **R2/B2 encrypted backup targets** — founder action; zero-cost doctrine requires at
  least one off-provider target.
- **GITHUB_TOKEN** — required in the shell that launches any agent using the `github`
  MCP server (`.mcp.json`, `.codex/config.toml`); a credential, not something an agent
  provisions.
- **India IRP/GSP access** — needed before Phase 7; founder/business action
  (registration with an Indian GSP).
- **UAE ASP vendor selection** — needed before Phase 12 (`ae-asp:<vendor>` sandbox);
  founder/business decision (2-yr operational solution accreditation requirement noted
  in D-22 equivalent doctrine).
- **Saudi ZATCA Phase 2 onboarding** — needed before Phase 8; founder/business action.
- **"Claude for Startups" / AWS Activate applications** — mentioned in
  `START-HERE-WINDOWS.md` as founder-track items alongside installer setup; status not
  verifiable from repo files, not blocking any engineering phase.
- No secret values are recorded anywhere in this handoff or in the files it touched.

## 9. Essential context exported from Claude

- **Rejected alternatives worth remembering:** schema-per-tenant multi-tenancy
  (rejected for ops cost/migration fan-out — shared-schema RLS chosen); partial
  occupancy constraint per mode (rejected — failed stress test T2, double-sell; claim
  ranges + one GIST EXCLUDE chosen instead); Kafka/CDC/logical-replication for event
  delivery (rejected — WAL-retention footgun for a 2-person team; transactional outbox
  chosen); cross-vendor Tier-3 review (D-59, later amended by D-84 and this handoff).
- **Founder preferences captured in decisions, not just this directive:** D-84 records
  the founder personally overruling the architect's recommendation to keep two Tier-3
  reviewers, on a two-person team where a second vendor doesn't exist — a preference
  for pragmatic unblocking over ceremony, now extended by this handoff to routine work
  generally. D-71 shows the founder previously authorized a temporary Codex-as-architect
  exception when Claude was unavailable, with explicit ratification required
  afterward — this handoff supersedes the need for that pattern by making the ownership
  transfer permanent rather than a temporary exception.
- **The founding incident, cited repeatedly as the reason the review discipline exists
  at all:** a cross-tenant leak through Postgres views (missing `security_invoker`) was
  reviewed and missed by two separate AI models reading the same diff on paper, and was
  only caught by a two-tenant fixture that actually executed. This is why D-84 (and now
  D-91) keep the reviewer-executed proof rule non-waivable even while relaxing who the
  reviewer is.
- **Unresolved disagreement on record:** the architect (Claude) recommended against
  D-84's amendment (dropping the second cross-vendor reviewer) and was overruled by the
  founder; `handoff/ROSTER.md` and D-84 record both positions rather than only the
  outcome. No other standing disagreement is on record as of D-90.
- **Nothing else material** was found in this session's context beyond what is already
  in `DECISIONS.log`, `handoff/LEDGER.md`, and the order/review/question files — this
  handoff is a transfer of *process ownership*, not a rediscovery of undocumented
  product intent.

## 10. Categories checked with no additional Claude-only context

- Architectural decisions and rejected alternatives beyond §9: none known — everything
  found is already in `DECISIONS.log`.
- Security and compliance concerns beyond what's in `docs/SECURITY.md`,
  `docs/DEPENDENCIES.md`, and the decisions cited above: none known.
- Assumptions from previous reviews beyond what's recorded in `handoff/reviews/*`: none
  known.
- Unexecuted commands or proofs beyond §7's PowerShell/CI gap: none known.
- Pending orders, reviews, or acceptance criteria beyond §4–§6: none known.

## 11. Replacement review and multi-agent rules

Superseding `DECISIONS.log` D-53/D-54 (original Codex-builder/Claude-architect split)
and narrowing D-84 (Tier-3 identity requirement), effective 2026-08-23:

1. **Routine work** (Tier 1): Codex implements and completes it once relevant tests and
   repository gates pass — no review-cycle wait, no founder relay required.
2. **High-risk work** (Tier 2/3 — migrations, RLS, tenant scoping, occupancy,
   journals/posting, fiscal chains, payments, document numbering, new tables/events,
   state transitions, statutory reporting, trust accounting, destructive data
   handling): requires an **independent agent that did not implement the change** to
   inspect it and personally execute the relevant proof. D-84's non-waivable,
   reviewer-executed rule is unchanged — a result pasted by the implementer is still not
   proof.
3. Codex records the reviewer, findings, commands, and results in Git
   (`handoff/reviews/`, `handoff/LEDGER.md`, `DECISIONS.log` as applicable).
4. Claude is not required as the independent reviewer; any other agent that did not
   implement the change qualifies.
5. Codex asks the founder only for: credentials, spending, legal/business policy,
   irreversible external actions, missing product intent, or authority outside this
   directive.
6. Claude's absence is never treated as a blocker.
7. Multi-agent coordination bounds (unchanged from the directive): every delegated task
   concrete and bounded; Codex maintains one authoritative plan; agents do not make
   conflicting edits without coordination; every agent follows repository instructions
   and scope; review agents never review their own implementation; Codex integrates and
   verifies all delegated work; parallelism never replaces executable verification;
   sensitive data is not shared externally without authorization.

Updated files (this handoff): `AGENTS.md`, `CLAUDE.md`, `docs/WORKFLOW.md`,
`handoff/ROSTER.md`, `handoff/ROADMAP.md`, `handoff/PHASE-1-PLAN.md`,
`handoff/ORDER-TEMPLATE.md`, `handoff/REVIEW-TEMPLATE.md`, `DECISIONS.log` (D-91
appended), this file. `PROJECT.md` was **not** modified — it already carried no
Claude-specific mandatory-approval language (verified by search this session) and
remains the canonical constitution unchanged, as the directive requires.

## 12. Existing uncommitted files and how they must be preserved

`git status --porcelain` (WSL git, verified this session) at the point this handoff was
finalized:

```
M AGENTS.md
 M CLAUDE.md
 M DECISIONS.log
 M PROJECT.md
 M docs/WORKFLOW.md
 M handoff/ORDER-TEMPLATE.md
 M handoff/PHASE-1-PLAN.md
 M handoff/REVIEW-TEMPLATE.md
 M handoff/ROADMAP.md
 M handoff/ROSTER.md
?? .agents/
?? .codex/hooks.json
?? handoff/CODEX-HANDOFF.md
```

The ten `M` files plus `handoff/CODEX-HANDOFF.md` are this session's governance commit
(§11). `.agents/` and `.codex/hooks.json` are **pre-existing, untracked, and were left
alone** — not staged, not committed, not deleted, not inspected for correctness beyond
a read-only look. Specifically:

- `AGENTS.md` — pre-existing content ended with an "Imported Claude Cowork project
  instructions" section reading `overview work done by other ai models.` This line was
  **preserved verbatim** at the end of the updated file; only the role/authorization
  sections above it were rewritten.
- `.codex/hooks.json` and `.codex/config.toml` — read and left **completely untouched**,
  per the directive's explicit instruction to preserve possible user changes to
  `.codex/hooks.json`. Do not let any future agent "clean these up" without the
  founder's separate say-so. (`.codex/config.toml` is tracked and unmodified — it did
  not appear in `git status` above.)
- `.agents/skills/yellow-*/SKILL.md` (mirrors of `.claude/skills/yellow-*/SKILL.md`) —
  read only, not modified, not staged.
- Nothing was deleted, reset, reverted, stashed, or overwritten. `.agents/` and
  `.codex/hooks.json` remain uncommitted after this handoff's commit — that is
  deliberate, not an oversight; commit them separately once their provenance/intent is
  understood, not folded silently into the governance commit.
- **Separately, and far more significant: §2a.** Eight WSL clones with real unmerged
  work were found and their tips pushed to `origin` as `backup/*` branches. Nothing in
  those clones was altered.

## 13. Commands Codex should run to establish the baseline

Already run and verified this session (WSL git against the Windows-mounted copy):
`git status`, `git log --oneline -15` (head confirmed `61b0fd3c…`, message "Phase 0:
cumulative integration (Orders 001-018) (#17)"), `git diff --check` (clean, no
whitespace/conflict-marker issues), `git push --dry-run` (confirms `origin` push access
works), and the full §2a discovery (`git log`, `git rev-list --count`, `git status`,
`git push` across eight additional clones, `git ls-remote origin refs/heads/backup/*`
to confirm all eight landed intact). **Not run this session** — these need Docker
containers and a `bun` toolchain wired to this specific checkout, which this session
did not set up (no side effects were introduced beyond the additive `backup/*` pushes):

```bash
./state.sh                                   # ground truth: branch/head/dirty,
                                              # last ledger lines, last decisions,
                                              # open orders/questions (should read 0/0
                                              # for main; see §2a for the real backlog)
bun install --frozen-lockfile
bun run typecheck
bun run boundaries
bun test
bun run license-check
bun audit
bun run schema:check
./setup.sh --db-only                         # must print 11 passed, 0 failed of 11
git fetch origin 'refs/heads/backup/*:refs/remotes/origin/backup/*'   # §2a's finds
```

If `main`'s head differs from `61b0fd3c7cea0944c2bf5fed164064001a94c899`, treat §2–§6
of this file as stale for that part and re-derive current status from `./state.sh` and
`git log` directly. Regardless, read §2a before issuing any Phase 1 order.

## 14. Declaration

Claude is no longer an operational dependency for Yellow. Per founder directive D-91
(`DECISIONS.log`, effective 2026-08-23), Codex is authorized to plan, implement,
review-coordinate, decide routine matters, and continue across every remaining phase
without Claude's participation, subject only to the independent-review requirement for
high-risk work (§11) and the founder-reserved decisions (§11.5). Claude's involvement
from this point forward is optional and founder-invoked only.

This declaration is about *operational dependency*, not about *readiness to proceed*:
§2a's reconciliation (which lineage continues, the Order 044–091 review backlog, the
Gate-3/Tier-3 terminology question) is real outstanding work, is not resolved by this
handoff, and does not require Claude to resolve it — it requires Codex (or the
founder) to read §2a and decide. Do not treat this handoff as clearance to issue Order
019 or otherwise treat `main` as the frontier of the project.
