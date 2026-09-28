# handoff/ — scoped work and durable evidence

- `orders/NNN-slug.md` defines bounded work, exclusions and acceptance.
- `reviews/NNN-slug.md` records an independent verdict and executed proof.
- `questions/NNN.md` records a missing decision or scoped clarification.
- `LEDGER.md` is the append-only chronological record.

Templates are `ORDER-TEMPLATE.md` and `REVIEW-TEMPLATE.md`; copy them rather than
editing them in place. Codex owns the current task and may assign bounded internal
builders and independent reviewers. The complete loop and Git conventions are in
`docs/WORKFLOW.md`.

## Current status and historical markers

`docs/PROJECT-STATUS.md` is the single current-task record. `state.sh` and
`state.ps1` print its task, lifecycle, order files and phase first. They report legacy
order/question markers only as historical counts, because older independently closed
records do not all use the same heading and therefore cannot define the live backlog.

Historical files stay in place as evidence. A line beginning `## RESOLVED` or
`## RATIFIED` is a legacy question-resolution marker; a line beginning `## MERGED`
is a legacy order-integration marker. A review is evidence once authored, but its
existence does not itself prove the current candidate, local app or deployment.

These files are versioned project memory. Append new evidence and preserve earlier
failed or superseded states; never rewrite history to make the current build look
cleaner.
