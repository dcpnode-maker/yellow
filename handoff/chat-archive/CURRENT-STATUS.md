# Yellow build resumption status

Verified 2026-08-23 in the Windows checkout.

## Authority

- Founder directive D-91 makes Codex the primary implementation and coordination
  owner. Claude is not an operational dependency.
- High-risk work still requires an independent agent that did not implement the
  change to inspect it and personally execute the relevant proof.
- `PROJECT.md` and the Ten Invariants remain binding.

## Preserved Git state

- Windows `main`: `5f49c82` (`[claude] D-93: full Order-091 lineage context for
  Codex`), two commits ahead of `origin/main` at last check.
- Handoff backup: `refs/heads/backup/final-codex-handoff-5f49c82` exactly at
  `5f49c82d308a5f1732c9a066b478713c97b66f77`.
- Advanced build frontier: `refs/heads/backup/order-091-final-4874f5c` at
  `4874f5c`; all seven other discovered backup checkpoints are strict ancestors.
- The advanced history is one linear lineage, not eight competing implementations.
- Immutable baseline/referee hashes were reported unchanged, but must be verified
  again by execution.

## Actual frontier and debt

- Work exists through Order 091 across Phases 1–4; do not restart at Order 019.
- Orders 019–044 were reported independently reviewed and discharged by D-161.
- Orders 045–091 are recorded in the advanced lineage's Gate-3 manifest as review
  debt; Orders 087 and 088 are absent and require direct history/order inspection.
- A prior Gate-3 review returned CHANGES REQUIRED (F11/F12). Order 074 addressed
  them; F11 later regressed after Order 082 and Order 083 reportedly corrected it.
  Re-execute the proofs rather than trusting status text.
- The handoff branch and advanced branch both allocate decision numbers from D-91.
  Reconcile by preserving provenance and renumbering the later handoff decisions
  after the advanced lineage's last decision; never concatenate colliding IDs.
- “Fable” reviewer naming is historically inconsistent but no longer operationally
  blocking: D-91 permits any independent non-implementing agent.

## Existing checkout state

- `.agents/` and `.codex/hooks.json` were untracked in the Windows checkout at the
  last check. They are user-owned and must be inspected, not deleted or silently
  absorbed.
- The local Windows Git installation could not use its HTTPS remote helper during
  one verification attempt. The WSL environment previously pushed and verified the
  backup refs. Prefer the canonical WSL/Linux-filesystem worktree for build and DB
  checks.

## First work in the fresh task

1. Read `PROJECT.md`, `AGENTS.md`, `handoff/CODEX-HANDOFF.md`, this file, and the
   advanced branch's `ARCHITECT-HANDOVER.md`, `GATE-3-REVIEW-CONTRACT.md`,
   `GATE-3-MANIFEST.md`, ledger, decisions and Orders 087–091.
2. Fetch and prove the backup refs and ancestry locally.
3. Create a safe continuation branch from `4874f5c`; do not mutate `main` or backup
   refs.
4. Reconcile D-91+ decision collisions with explicit provenance.
5. Run the standing baseline from the advanced tip: frozen install, typecheck,
   boundaries, tests, license check, audit, schema drift and `setup.sh --db-only`.
6. Turn failures and the Gate-3 manifest into a risk-ordered independent-review and
   repair plan. Do not claim Orders 045–091 are merge-ready before reviewer-executed
   evidence exists.
7. Continue the roadmap only after the advanced frontier and review debt are
   accurately established.
