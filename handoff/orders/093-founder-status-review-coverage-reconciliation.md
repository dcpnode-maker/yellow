# Order 093 — Founder-status review-coverage reconciliation

**Phase:** 4 · Governance and review-coverage alignment  
**Branch:** `phase-4/reconcile-founder-status-review-coverage`  
**Base:** `phase-4/reconcile-order-091-frontier` at `9a2919a`  
**Tier:** 2 — proof fidelity, review-coverage derivation, and founder status alignment; no product-domain behavior  
**Written by:** Google Gemini Antigravity as planning agent under the founder directive  
**Status:** APPROVED at `af588ff`

## Outcome

Reconcile the review-coverage derivation script, generated review-coverage module, project-status snapshot, and founder-status integration tests with the completed and approved Orders 045–091 review discharge recorded at commit `9a2919a` (D-294). The order updates `scripts/derive-review-coverage.ts` to recognize both `architect role` and authorized `independent non-implementing reviewer` reviews, fixes cross-platform directory scanning on Windows, verifies exact approved order membership across review waves without inferring full coverage from partial wave headers, preserves the exclusion of CHANGES REQUIRED reviews and absent 087/088 sequence gaps, updates `src/generated/review-coverage.ts` to reflect the approved wave reviews (`045-091-wave-{a,b,c,d}.md`) and `INDEPENDENTLY_REVIEWED_THROUGH_ORDER = 91`, aligns `src/project-status.ts` (zero remaining Gate-3 debt, Phase 3 `reviewed`, Phase 4 `active`), and aligns `tests/founder-status.integration.test.ts`. The historical Gate-3 manifest and review evidence remain immutable; no product code, database migrations, or core context logic is modified.

## Why now

Order 092 established the frontier reconciliation and four non-implementing, reviewer-executed waves (`045-091-wave-a.md`, `b.md`, `c.md`, `d.md`), which exclusively and collectively discharged all 45 Gate-3 manifest rows for Orders 045–091 at commit `9a2919a` (D-294). However:
1. `scripts/derive-review-coverage.ts` only recognizes reviewers matching `/architect role/i` (ignoring `OpenAI Codex independent non-implementing reviewer` under D-91 / D-292 / D-294 governance).
2. It assumes a monolithic `# REVIEW <start>–<end>` range and would risk inferring full 045–091 coverage from a single partial wave header if not checked for exact order membership.
3. It fails on Windows environments because `directory.pathname` passed to `Bun.Glob` creates invalid URL paths with leading slashes (`/C:/...`).
4. `src/generated/review-coverage.ts` remains frozen at Order 044.
5. `src/project-status.ts` and `tests/founder-status.integration.test.ts` still report 45 unverified debt rows and Phase 3 as `built_unverified`.

Reconciling founder status and review coverage is the smallest safe Phase 4 continuation before implementing further reservation capabilities (Orders 087/088).

## Natural-Solution Test

- Review authority under D-91, D-292, and D-294 includes both `architect role` and `independent non-implementing reviewer`. `scripts/derive-review-coverage.ts` must recognize both while continuing to reject builder-authored self-reviews.
- Multi-wave reviews (`045-091-wave-a.md` through `d.md`) each declare an exclusive discharge scope over a subset of orders. The coverage derivation must track the exact union of approved orders or verify that all 45 manifest rows are covered before advancing the continuous boundary to 91. It must never treat a single wave file with a `045–091` title as approving the entire range.
- Reviews with verdict `CHANGES REQUIRED` (such as `045-073-gate-3.md`) must strictly remain excluded.
- Orders 087 and 088 are reserved sequence gaps, not unreviewed debt, and must not prevent continuous review coverage through Order 091.
- The historical `handoff/GATE-3-MANIFEST.md` and review documents under `handoff/reviews/` are immutable records of historical debt and reviewer execution; they must not be rewritten.
- On Windows, `new Bun.Glob("*.md").scan({ cwd: fileURLToPath(directory) })` avoids URL pathname encoding bugs.

## Scope

- `scripts/derive-review-coverage.ts`
- `src/generated/review-coverage.ts`
- `src/project-status.ts`
- `tests/founder-status.integration.test.ts`
- `handoff/orders/093-founder-status-review-coverage-reconciliation.md`
- `handoff/LEDGER.md`
- `DECISIONS.log`
- `handoff/questions/` (if any ambiguity requires escalation)

## Required work

1. **Update review-coverage derivation (`scripts/derive-review-coverage.ts`):**
   - Extend reviewer validation to accept both `architect role` and `independent non-implementing reviewer` (case-insensitive). Reject any unapproved, builder, or unrecognized role.
   - Enforce verdict check: require explicit verdict starting with `APPROVED` (continue rejecting `CHANGES REQUIRED` such as `045-073-gate-3.md`).
   - Derive exact approved order membership: parse either explicit ranges or exclusive discharge lists across all approved review files. For wave reviews spanning `045–091`, require that the union of approved wave files covers all 45 manifest rows (045–086, 089–091, accounting for 087/088 sequence gaps) before advancing `throughOrder` to 91.
   - Fix cross-platform directory resolution using `fileURLToPath` so `Bun.Glob` executes portably on Windows and Linux without `ENOENT` / NUL path errors.
2. **Regenerate review-coverage module (`src/generated/review-coverage.ts`):**
   - Run `bun scripts/derive-review-coverage.ts --write` to emit `APPROVED_REVIEW_FILES` containing all 8 approved review files (`008-015-phase-0-cumulative.md`, `018-powershell-coverage.md`, `019-026-phase-1-cumulative.md`, `027-044-phase-2-cumulative.md`, `045-091-wave-a.md`, `045-091-wave-b.md`, `045-091-wave-c.md`, `045-091-wave-d.md`) and `INDEPENDENTLY_REVIEWED_THROUGH_ORDER = 91`.
   - After the independent Order-093 review is recorded, regenerate once more so its
     review file joins the catalogue without advancing the continuous boundary past 91.
3. **Reconcile project status snapshot (`src/project-status.ts`):**
   - Update `PROJECT_BUILD_SNAPSHOT.review`:
     - `gate3Debt`: `0` (all 45 Gate-3 manifest rows are approved).
     - `state`: `"reviewed"` (or verified).
     - `independentlyReviewedThroughOrder`: reflects `INDEPENDENTLY_REVIEWED_THROUGH_ORDER` (91).
   - Update `PROJECT_BUILD_SNAPSHOT.phases`:
     - Phase 0: `reviewed`
     - Phase 1: `INDEPENDENTLY_REVIEWED_THROUGH_ORDER >= 26 ? "reviewed" : "built_unverified"` (`reviewed`)
     - Phase 2: `INDEPENDENTLY_REVIEWED_THROUGH_ORDER >= 44 ? "reviewed" : "built_unverified"` (`reviewed`)
     - Phase 3: `INDEPENDENTLY_REVIEWED_THROUGH_ORDER >= 79 ? "reviewed" : "built_unverified"` (now evaluates to `reviewed` since 91 >= 79)
     - Phase 4: `"active"`
     - Phases 5–12: `"planned"`
   - Set `roadmap.latestBuiltOrder` and `currentOrder` to `92` (or `93`).
4. **Update founder-status integration test (`tests/founder-status.integration.test.ts`):**
   - Assert `reviewCoverage.throughOrder` equals `91`.
   - Assert `reviewCoverage.approvedReviewFiles` contains all four wave review files and excludes `045-073-gate-3.md`.
   - Assert `PROJECT_BUILD_SNAPSHOT.review.gate3Debt` equals `0` and `review.independentlyReviewedThroughOrder` equals `91`.
   - Assert Phase 0, 1, 2, and 3 are `reviewed`, Phase 4 is `active`, and Phases 5–12 are `planned`.
   - Verify that `deriveIndependentReviewCoverage()` runs cleanly without throwing cross-platform filesystem errors.
5. **Verify and record:**
   - Execute `bun scripts/derive-review-coverage.ts --check` and `bun test tests/founder-status.integration.test.ts`.
   - Execute the standing self-check and invariant referee (`./setup.sh --db-only`).

## Forbidden

- Modifying `migrations/0001_init.sql`, adding new migrations, or altering database schema snapshots
- Modifying `tests/run_invariants.py` or weakening the `11 passed, 0 failed of 11` referee battery
- Modifying any product-domain context code (`src/contexts/*`), HTTP routing, or business logic
- Modifying `handoff/GATE-3-MANIFEST.md` or any existing review file in `handoff/reviews/`
- Hardcoding `src/generated/review-coverage.ts` manually without generating it via `scripts/derive-review-coverage.ts`
- Inferring full 045–091 coverage from an individual partial wave review
- Counting `CHANGES REQUIRED` reviews as approved
- Shipping `handoff/` into the production runtime container or inspecting Git at runtime
- Self-reviewing or self-merging

## Pre-registered proof

### P0 — pinned red baseline
- `bun scripts/derive-review-coverage.ts --check` fails on the current tree (rejects Wave A–D reviewers; `src/generated/review-coverage.ts` has stale order 44).
- `bun test tests/founder-status.integration.test.ts` fails due to path scan error and stale coverage/debt expectations.

### P1 — cross-platform review-coverage derivation proof
- `bun scripts/derive-review-coverage.ts --check` passes cleanly across platforms (Windows and Linux).
- It verifies exact approved membership across Waves A–D, confirms `045-073-gate-3.md` is excluded, and outputs `throughOrder = 91` with all 8 approved review files.

### P2 — founder-status integration proof
- `bun test tests/founder-status.integration.test.ts` passes with all assertions green:
  - `reviewCoverage.throughOrder` is `91`
  - `reviewCoverage.approvedReviewFiles` contains all four wave files
  - `PROJECT_BUILD_SNAPSHOT.review.gate3Debt` is `0`
  - `PROJECT_BUILD_SNAPSHOT.phases[3].state` is `"reviewed"`
  - `PROJECT_BUILD_SNAPSHOT.phases[4].state` is `"active"`

### P3 — standing gate and referee integrity
- `bun install --frozen-lockfile`
- `bun run typecheck`
- `bun run boundaries`
- `bun test`
- `bun run license-check`
- `bun audit`
- `bun run schema:check`
- `./setup.sh --db-only` prints `11 passed, 0 failed of 11`

## Definition of done

- [x] `scripts/derive-review-coverage.ts` recognizes both `architect role` and `independent non-implementing reviewer` approvals.
- [x] `scripts/derive-review-coverage.ts` enforces exact order coverage across wave reviews without inferring full coverage from partial wave titles.
- [x] `scripts/derive-review-coverage.ts` resolves review paths portably across Windows and Linux.
- [x] `src/generated/review-coverage.ts` is regenerated with `INDEPENDENTLY_REVIEWED_THROUGH_ORDER = 91` and checked in.
- [x] `src/project-status.ts` accurately reports 0 Gate-3 debt, Phase 3 as `reviewed`, and Phase 4 as `active`.
- [x] `tests/founder-status.integration.test.ts` passes green.
- [x] Full standing suite and invariant referee (11/11) pass with zero errors.
- [x] `handoff/GATE-3-MANIFEST.md` and all pre-existing review evidence remain unchanged.
- [x] Implementation stayed inside the defined Scope; the required independent review artifact is recorded separately.

## Final evidence

- Implementation: `8e6c6e8`; reviewer correction: `af588ff`.
- Independent review: `handoff/reviews/093-founder-status-review-coverage.md` — APPROVED.
- Focused proof: 5 pass, 2 inherited database-gated skips, 0 fail, 54 assertions.
- Standing default suite: 120 pass, 326 database-gated skips, 0 fail, 1,544 assertions.
- Schema drift exact; license policy and audit green; protected surfaces unchanged.
- Generated catalogue contains the eight prior approvals plus this order's review;
  the continuous independently-reviewed boundary remains Order 091.
- Fresh isolated referee: `11 passed, 0 failed of 11`.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
