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
> was touched). **§2a is the authoritative account of this. Do not start work from §4's
> "Order 019" without reading §2a first** — Phases 1 and 2 are almost certainly already
> done in that lineage, and starting fresh at Order 019 would duplicate real, mostly
> unreviewed work rather than continue it.

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
its own full `.git` directory), so this is not a shared-ref collision, just two snapshots
of the same in-progress branch taken minutes apart.

**Substance, read from each clone's own `handoff/LEDGER.md` and `handoff/orders/`**
(not independently verified beyond reading these files — treat as reported, not
architect-confirmed):
- Order numbering runs through **091**, on top of the original `BUILD-PLAN.md` phase
  scheme (branch names `phase-3/…` = Rates, `phase-4/…` = Reservations — consistent
  with §5's table), meaning **Phase 1 (Kernel) and Phase 2 (Inventory & Occupancy) are
  almost certainly already complete** in this lineage, not merely planned.
- A review-tier concept called **"Gate-3 reviewer"** appears throughout these ledgers,
  distinct from the Tier 1/2/3 language in `handoff/ROSTER.md` as this handoff left it.
  Whether Gate-3 supersedes, replaces, or sits alongside Tier 1/2/3 is **not
  determinable from this session** — reconcile by reading the advanced lineage's own
  `PROJECT.md`/`handoff/ROSTER.md` (they may already differ from the versions on `main`
  that this handoff edited).
- Repeated ledger lines read **`BUILT-UNREVIEWED`** and **`REMOTE-CI-GREEN … remains
  UNVERIFIED and unmerged`**, and multiple entries state **"independent review remains
  through Order 044"** — i.e., as of Order 091, independent review is reported as
  outstanding for a large span of orders (044 through at least 091). This is a
  significant open-review backlog, not a clean, merge-ready branch.
- Order 091's own ledger line ("establish one exact bigint/rational room-economics
  language for gross, named distribution deductions, net, contribution, displacement
  and bid-price comparison") reads as Tier-3/financial-adjacent (money/economics
  surface) — exactly the kind of change this handoff's §11 requires independent
  reviewer-executed proof for, and by its own status line (`BUILT-UNREVIEWED`) has not
  yet received that.

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

1. **Do not issue Order 019.** Read `backup/order-091-final-4874f5c` (the most advanced
   tip found) and `backup/phase-1-12ba636` / `backup/phase-4-383c98f` (the other
   lineages) to determine the actual current state of the project — very likely far
   past Phase 1.
2. Determine whether these branches share a common recent ancestor with each other and
   with `main`, and which one (if any) represents the single line of work to continue —
   this session found them but did not reconcile them; that reconciliation is
   implementation/architecture work, explicitly out of scope for this governance-only
   handoff.
3. Resolve the outstanding independent-review backlog these branches' own ledgers
   report (Order 044 through 091) under the review rules in §11 before treating any of
   this work as mergeable — several money/economics-adjacent orders (091 named
   explicitly) are self-reported as `BUILT-UNREVIEWED`.
4. Reconcile the "Gate-3 reviewer" terminology found in these branches against
   `handoff/ROSTER.md`'s Tier 1/2/3 language as this handoff left it — one of the two
   is stale and it was not possible to determine which from this session alone.
5. Ask the founder to confirm intent before deciding whether any `backup/*` branch
   becomes the new basis for `main`, is merged, or is intentionally superseded — that is
   a product/process decision, not a routine one, per §11's "missing product intent"
   carve-out.

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
