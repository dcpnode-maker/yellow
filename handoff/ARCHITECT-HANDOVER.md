# ARCHITECT HANDOVER — Claude → Codex (build) → Fable (review, test, deploy)

**Written by:** Claude (architect role, `claude-opus-5`) · **Date:** 2026-08-21
**Handing over at:** `0bd9585` on `phase-2/restriction-evaluation`, 31 commits ahead of
`origin/main` (`61b0fd3`), strictly linear.

This closes my involvement. Codex continues the build. Fable reviews, tests and deploys.
Everything below is what the next architect needs and cannot reconstruct from the code.

---

## 1. The single most important fact

**Orders 019–044 were independently reviewed at `6bfd2c5`; Orders 045–060 remain
unverified, and nothing since Phase 0 is on `main`.**

| | Count | State |
|---|---:|---|
| Orders written | 60 | 001–018 reviewed and merged; 019–044 reviewed but unmerged; **045–060 built, unverified and unmerged** |
| Reviews in `handoff/reviews/` | 7 | Phase 0 plus cumulative Orders 019–044 review; Gate 3 is deferred |
| Decisions in `DECISIONS.log` | D-1 → **D-221** | D-95 → D-160 reviewed under D-161; **D-162 → D-221 await Gate-3 ratification or amendment** |
| Current Gate-3 manifest | 16 orders | 045–060, linear descendant stack, all explicitly `UNVERIFIED` |

The original 019–036 debt described here was later discharged and extended through Order
044 by the review recorded in D-161. Current debt begins at Order 045 and is governed by
`handoff/GATE-3-REVIEW-CONTRACT.md`: it is recorded, non-blocking and never represented as
approval. Treat every Gate-3 manifest row as builder-asserted until the founder schedules
that application review.

---

## 2. What is actually verified

Verified by a reviewer who executed it (D-84 standard):

- **Phase 0, Orders 001–018.** Four reviews in `handoff/reviews/`. Battery re-run
  first-hand: `11 passed, 0 failed of 11`. Immutable baseline SHA-256
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923` confirmed identical
  at both ends of the range. Per-PR diffs read. F1–F7 closed with reproduced proofs.
- **`migrations/0001_init.sql` is untouched** through Phase 0. Fable must re-confirm this
  across 019–036; it is Invariant-level and cheap to check:
  `git log --oneline -- migrations/0001_init.sql` should still show only `bc0e492`.

Everything else is assertion.

## 3. Known limits in my own review — inherited, not solved

- **D-89: the `windows-state` CI job cannot be reviewer-executed.** I ordered coverage on
  a surface no reviewer on this machine can re-run — no `git` on Windows, and a GitHub
  Windows runner is not reproducible locally. Its red proof is a CI record, not
  reviewer-executed. If that job ever guards something that matters, the tier is wrong.
- **D-84 traded the second vendor for reviewer-executed proof.** Single-reviewer Tier 3 is
  now doctrine. Fable is that reviewer. The executable half is non-waivable — a result
  pasted by the builder is explicitly not proof.
- **My orders carried defects at a rate that matters.** Order 019 alone produced three:
  mutually unsatisfiable proofs (P1 vs P3), a missing `/health` public boundary, and an
  incomplete Scope list. All three were caught by Codex reading before building. If Fable
  writes orders, front-load the proof spec and expect the builder to audit it.

## 4. Where to look first — current Gate-3 blast radius

Orders 019–044 and decisions through D-160 were discharged by D-161. For the current
045–060 manifest, review in this order:

1. **Order 047 — durable API idempotency.** Every later operator mutation relies on its
   hash-only request identity, atomic claim/command commit, replay and rollback behavior.
2. **Orders 055–057 — holds, expiry and bulk rooms.** These touch the occupancy choke
   point or create many sellable mappings atomically; re-run concurrency, rollback and
   exact-scope proofs before trusting the workbench.
3. **Orders 058–060 — projection rebuild, durable convergence and operator bootstrap.**
   Verify projection-safe shape filtering, DST/local-date envelopes, poison-event rollback,
   deployed cursor movement and the rule that projection data never authorizes a hold or
   booking.
4. **Orders 048–054 — operator mutation surfaces.** Read their idempotency, grant, scope,
   money-string and audit/outbox assertions against the API and themed browser controls.
5. **The protected floor.** Confirm `migrations/0001_init.sql` and
   `tests/run_invariants.py` against the hashes in `handoff/GATE-3-MANIFEST.md`, then run the
   isolated 11/11 referee before any Gate-3 approval.

## 5. Housekeeping that has drifted — small, but fix it before it compounds

- **`handoff/LEDGER.md` stops at Order 026.** CLAUDE.md says one line per order, always.
  Orders 027–036 have none. The ledger is the shared memory; a ten-order gap is the kind
  of thing nobody notices until they need it.
- **`./state.sh` prints `Phase: 0 · cumulative review pending`.** Stale since Phase 0
  merged. Every session reads that line first (D-58), so a wrong one is worse than none.
- **`orders=18 open (36 total)`** — correct under D-82's marker rule, since nothing since
  018 has merged. When Phase 1/2 integrate, mark 019–036 `## MERGED` in the same commit,
  or the counter drifts the other way.
- **`handoff/questions/011-ARCHITECT-RESPONSE.md` reads as open.** Architect responses
  have no status marker, so `state.sh` counts an *answer* as outstanding work. Either add
  `## RESOLVED` to responses or amend D-82 to close `*-ARCHITECT-RESPONSE.md` on
  authorship the way reviews already are. Cosmetic, but it is the ground-truth script.
- **Repo copies.** Canonical is `~/projects/yellow` plus Linux-side worktrees. The Windows
  copies at `C:\Users\astha\Documents\Codex\...\yellow` and `...\yellow-phase-1` should be
  deleted once you confirm nothing unpushed remains — the second has a `.git` pointing at
  a `C:/` path that WSL cannot resolve, so it is not a git repository from Linux at all.
  Measured cost of working on `/mnt/c`: tree walk **2,406 ms vs 20 ms**, and `inotify`
  produces **no events**, so `bun --watch` is silently dead. D-49 predicted it; it is now
  measured.

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

## 7. For Fable — the sequence I would follow

1. **Stop new feature work.** Eighteen unreviewed orders is already more debt than the
   process was designed to carry.
2. **Re-run the Phase 0 baseline** to establish that the foundation still holds:
   `./setup.sh --db-only` → `11 passed, 0 failed of 11`, and the migration SHA check.
3. **Review Phase 1 (019–026) as one gate**, executing every pre-registered proof
   yourself. Then Phase 2 (027–036) as a second gate.
4. **Ratify or amend D-95 → D-141** in one pass, the way I did D-71→D-79 in review
   008–015. Forty-seven decisions is a lot, but they were made in sequence and most will
   be routine; the ones to read closely are any that touch occupancy, holds, availability,
   rates or RLS.
5. **Then integrate**, one cumulative PR per phase, per D-76 and D-90.
6. **Only then deploy.** `docs/DEPENDENCIES.md` and D-68 both note that Forgejo mirroring
   and Cloudflare Tunnel are founder actions requiring credentials — no agent creates
   accounts or exposes ports.

## 8. Decision to append when the next architect takes over

Append verbatim to `DECISIONS.log`. I have deliberately not appended it myself: the file
has uncommitted builder edits in flight, and mixing an architect append into a builder's
working commit is how a shared append-only log gets tangled.

```
2026-08-21 · D-142 · Architect role hands over from Claude to Fable; Codex continues as builder. State at handover: 0bd9585 on phase-2/restriction-evaluation, 31 commits ahead of main (61b0fd3), strictly linear. VERIFIED: Phase 0 only — Orders 001-018, four reviews in handoff/reviews/, battery re-run first-hand at 11/11, baseline SHA fe2a9fc9 confirmed unchanged, per-PR diffs read, F1-F7 closed. NOT VERIFIED: Orders 019-036 (18 orders, Phases 1 and 2) and decisions D-95 through D-141 (47 entries) — all builder-asserted, none reviewer-executed, none merged to main. This is review debt, not a defect finding; the incoming architect must discharge it before new feature work, per D-84's rule that a builder-pasted result is not proof. Order of attack recorded in handoff/ARCHITECT-HANDOVER.md §4, highest blast radius first: 019 tenant context (P3 pooled-connection leak and P5 error-path release), 020 auth (alg:none and algorithm confusion), 023 relay (SIGKILL mid-batch), then Phase 2's occupancy and availability surfaces where double-bookings live. Inherited limits carried forward unsolved: D-89's windows-state job cannot be reviewer-executed on any machine this project owns, and D-84's single-vendor Tier 3 makes the executable half non-waivable. Rejected: merging Phases 1 and 2 before review to reduce the backlog, which would put 47 unratified decisions and 18 unreviewed orders on main and make the debt permanent instead of visible; rejected: appending this entry into the builder's in-flight working tree.
```
