# ARCHITECT HANDOVER — Claude → Codex (build) → Fable (review, test, deploy)

**Written by:** Claude (architect role, `claude-opus-5`) · **Date:** 2026-08-21
**Handing over at:** `0bd9585` on `phase-2/restriction-evaluation`, 31 commits ahead of
`origin/main` (`61b0fd3`), strictly linear.

This closes my involvement. Codex continues the build. Fable reviews, tests and deploys.
Everything below is what the next architect needs and cannot reconstruct from the code.

---

## 1. The single most important fact

**Orders 001–044 are independently reviewed. The Gate-3 pass at `d0a2f2a` requires
corrections, and Orders 045–074 remain unapproved and unmerged. Nothing since Phase 0 is
on `main`.**

| | Count | State |
|---|---:|---|
| Orders written | 74 | 001–018 reviewed and merged; 019–044 reviewed but unmerged; **045–074 unmerged with corrections awaiting re-execution** |
| Reviews in `handoff/reviews/` | 8 | Phase 0, cumulative Orders 019–044, and Gate-3 CHANGES REQUIRED at `4cc791c` |
| Decisions in `DECISIONS.log` | D-1 → **D-263** | D-95 → D-160 reviewed under D-161; D-162 → D-262 ratified at Gate 3; D-263 records the correction boundary |
| Current Gate-3 manifest | 30 orders | 045–074, linear descendant stack, all explicitly `UNVERIFIED` until correction re-execution |

The original 019–036 debt described here was later discharged and extended through Order
044 by the review recorded in D-161. Gate 3 then executed against `4cc791c` and ratified
D-162 through D-262, but returned F11/F12 with CHANGES REQUIRED. That reviewed tip contains
Order 073's red pre-proof, not its completed implementation. Order 074 corrects both findings;
the completed Order 073 and Order 074 still require reviewer execution. Current debt is governed
by `handoff/GATE-3-REVIEW-CONTRACT.md`: it is recorded, non-blocking and never represented as
approval.

---

## 2. What is actually verified

Verified by a reviewer who executed it (D-84 standard):

- **Phase 0, Orders 001–018.** Four reviews in `handoff/reviews/`. Battery re-run
  first-hand: `11 passed, 0 failed of 11`. Immutable baseline SHA-256
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923` confirmed identical
  at both ends of the range. Per-PR diffs read. F1–F7 closed with reproduced proofs.
- **Orders 019–044 and D-95–D-160.** Claude executed 133 pre-registered proofs plus the
  whole-tree checks and isolated referee at `6bfd2c5`; D-161 discharges that debt. These
  orders are reviewed but still unmerged.
- **Gate-3 inspection through the Order-073 red pre-proof.** Claude executed the baseline,
  operator suites and decision scan at `4cc791c`, ratifying D-162–D-262 and finding F11/F12.
  This is a changes-required review, not approval of Orders 045 onward.
- **The protected baseline remains exact** at the Gate-3 review: `migrations/0001_init.sql`
  still has SHA-256 `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`,
  and `tests/run_invariants.py` is byte-identical to main.

The completed Order-073 implementation and Order-074 corrections are builder-asserted until an
independent reviewer executes them at their descendant tip.

## 3. Known limits in my own review — inherited, not solved

- **D-89 is narrowed.** `state.ps1` itself was later reviewer-executed natively and that
  execution found F10; only the GitHub-hosted `windows-state` runner remains infrastructure
  evidence the reviewer cannot reproduce on this machine.
- **D-84 traded the second vendor for reviewer-executed proof.** Single-reviewer Tier 3 is
  now doctrine. Fable is that reviewer. The executable half is non-waivable — a result
  pasted by the builder is explicitly not proof.
- **My orders carried defects at a rate that matters.** Order 019 alone produced three:
  mutually unsatisfiable proofs (P1 vs P3), a missing `/health` public boundary, and an
  incomplete Scope list. All three were caught by Codex reading before building. If Fable
  writes orders, front-load the proof spec and expect the builder to audit it.

## 4. Where to look first — current Gate-3 blast radius

Orders 019–044 and decisions through D-160 were discharged by D-161. Gate 3 ratified
D-162–D-262 but did not approve Orders 045 onward. For the current 045–074 manifest, review
in this order:

1. **Order 074 — F11/F12 corrections.** Re-run the always-on SQL-syntax canaries, all five
   inherited operator suites and the document-derived status proof. Confirm ordinary UI copy is
   preserved, real SQL syntax stays red, and CHANGES REQUIRED review files do not advance coverage.
2. **Order 073 completed implementation.** The previous Gate-3 worktree stopped at its red
   pre-proof. Execute the final multi-rule compiler, live authenticated include/exclude preview,
   duplicate refusal, browser cell evidence and both-theme review against the completed commits.
3. **Orders 045–072 findings baseline.** Gate 3 found no defect in occupancy, money, RLS,
   tenant context or audit/outbox, but approval remains withheld until F11/F12 are re-executed at
   the descendant tip.
4. **The protected floor.** Confirm `migrations/0001_init.sql` and
   `tests/run_invariants.py` against the hashes in `handoff/GATE-3-MANIFEST.md`, then run the
   isolated 11/11 referee before approval.

## 5. Housekeeping that has drifted — small, but fix it before it compounds

- **No handoff counter is currently a blocker.** `state.sh` reports Phase 3 and zero open
  questions; open orders are expected because nothing after Order 018 is merged.
- **The ledger and Gate-3 manifest are current through Order 074.** Their UNVERIFIED rows
  are review debt, not approval and not a reason for the builder to wait.
- **The founder dashboard is now document-derived for review coverage.** Approved architect
  review files produce Order 044; the 045–073 CHANGES REQUIRED review cannot advance it.
- **Canonical build work remains in the Linux worktree** `/home/astha/projects/yellow-phase-1`.
  Avoid `/mnt/c` copies for watch-mode work because the measured filesystem penalty and missing
  inotify behavior remain real.

## 6. Recommendations to Codex for the rest of the build

**Keep doing the preflight.** Reading every order in a phase against the executable
baseline before writing code found nine defects in one pass, two of which would have
stopped you mid-implementation and one of which would have committed a permanent invented
migration. That is the single most valuable practice in this project. It should survive
the change of architect.

**Keep stopping.** Questions 011 and 012 were both correct stops. D-92's hard floor —
existing `migrations/`, `tests/run_invariants.py`, referee below 11/11, any failing
pre-registered proof, any Forbidden item, any new dependency — is not advisory. Stopping
early has never been penalised here and should not start being.

**Keep correcting the architect.** D-72 corrected my D-69 on both its mechanism and my
proposed fix, and was right on both counts. Under D-84 that challenge is one of the two
things standing in for the reviewer diversity the project gave up. Do not soften it for a
new reviewer.

**Never weaken an assertion to get green.** D-138 through D-141 show you iterating against
failing proofs instead — including the Order 031 performance proof at 1770 ms against a
fixed limit. That is the right instinct. A green result from a weakened instrument is the
exact failure F6 existed to prevent.

**Batch by phase, request review at the gate.** D-92 stands. One review request per phase
with the order/commit table, full self-check output, and every pre-registered proof.

## 7. For the next independent reviewer

1. **Start from the current correction tip, not `4cc791c`.** Confirm it contains Claude's
   review commit plus the completed Order-073 implementation and Order-074 corrections.
2. **Re-run Order 074 first.** Execute the always-on SQL-syntax canaries, the five dedicated
   operator databases, the generated review-coverage check and the founder-status suite.
3. **Execute Order 073's completed proofs.** Its final work landed after Claude's reviewed tip,
   so run both the pure compiler/rendering file and live authenticated database suite rather than
   relying on the earlier intentional red.
4. **Repeat the protected floor and standing battery.** Require exact protected hashes, fresh
   app-never-started referee 11/11, schema drift, typecheck, boundaries, licence, audit and full CI.
5. **Approve or return precise findings.** Builder-green evidence remains unverified until this
   execution. Integration and deployment remain separate founder-authorized steps.

## 8. Historical handover decision

D-142 is already present in `DECISIONS.log`; later D-161, D-221 and D-263 supersede its old
review-debt counts while preserving its no-self-review and no-self-merge rules.
