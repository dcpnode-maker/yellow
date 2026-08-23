# ORDER 027 — make Yellow Codex-led without weakening its safeguards

**Phase:** 0 · **Branch:** `phase-0/phone-idle-worker-rfc`  
**Written by:** OpenAI Codex (primary lead, by direct founder instruction)  
**Date:** 2026-08-23 · **Tier:** 1  
**Source:** Founder instruction: "consider Claude dead now ur the main"

## Goal

Remove Claude/Fable as an operational dependency and make OpenAI Codex the primary
architect and builder while preserving the controls that protect Yellow: written
orders before implementation, narrow scope, executable evidence, append-only
decisions, protected `main`, and no self-merge.

This order changes project governance and onboarding documentation only. It does not
authorize Android-worker implementation; that receives its own order after this one.

## Scope — files Codex may change

- `AGENTS.md`
- `CLAUDE.md`
- `docs/WORKFLOW.md`
- `handoff/ROSTER.md`
- `handoff/ROADMAP.md`
- `handoff/PHASE-1-PLAN.md`
- `README.md`
- `START-HERE.md`
- `USAGE.md`
- `docs/CODEX.md`
- `DECISIONS.log` (append only)
- `handoff/LEDGER.md` (append only)
- `handoff/orders/027-codex-lead-governance.md`

## Required changes

1. Record the founder's decision as D-91: Claude roles are inactive; Codex is the
   primary lead and may write orders, make architecture decisions, implement, and
   append decisions.
2. Keep the order-before-code rule. A Codex-authored order must label itself and must
   contain Scope, Forbidden, Definition of Done, and evidence requirements.
3. Separate planning from implementation in git history: commit the order/governance
   before the implementation commit it authorizes.
4. Preserve `PROJECT.md`, the Ten Invariants, phase boundaries, and all STOP surfaces.
5. Preserve PR-only `main` and the rule that Codex does not merge its own work.
6. For Tier 2, require a falsifying/negative test plus an explicit decision note. For
   Tier 3, require an explicit founder decision before implementation, full executable
   proof, and founder-controlled merge.
7. Make Claude-facing documentation explicitly inactive so a later Claude session
   cannot silently reclaim architect authority.
8. Update active onboarding/runbooks so they start Codex, not Claude. Historical
   order/review attribution remains untouched.

## Definition of done

- [ ] Current governance files name Codex as primary lead and contain no active step
      that requires Claude/Fable.
- [ ] `CLAUDE.md` is an inactive adapter with no order/review/decision authority.
- [ ] Active onboarding paths direct users to Codex and `AGENTS.md`.
- [ ] Order-before-code, scoped branches, green checks, PR-only `main`, and no
      self-merge remain explicit.
- [ ] D-91 and one ledger line are appended; no historical decision is rewritten.
- [ ] `PROJECT.md`, `BUILD-PLAN.md`, production code, tests, schema, and dependencies
      are byte-unchanged.

## Forbidden

- Editing `PROJECT.md`, `BUILD-PLAN.md`, migrations, application code, tests, CI, or
  dependencies.
- Rewriting or deleting historical Claude-authored orders, reviews, or decisions.
- Granting Codex permission to merge its own PR.
- Weakening any Ten Invariant, STOP surface, or executable proof requirement.
- Starting Android implementation inside this governance order.

## Review protocol

Codex performs a fresh diff review after the documentation changes and proves the
active workflow contains no Claude dependency. The founder remains the final product
and merge authority.
