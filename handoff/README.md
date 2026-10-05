# handoff/ — how the two agents talk

- `orders/NNN-slug.md` — Fable → Codex. What to build, what not to touch.
- `reviews/NNN-slug.md` — Fable → Codex. Verdict + precise directions.
- `questions/NNN.md` — Codex → Fable. Raised when an invariant question appears.
- `LEDGER.md` — one line per order, append-only, the shared memory of what happened.

Templates: `ORDER-TEMPLATE.md`, `REVIEW-TEMPLATE.md`. Copy, don't edit in place.

## Status markers

Handoff files remain in place as evidence. A question is closed by a line beginning
`## RESOLVED` or `## RATIFIED`; an order is closed by a line beginning `## MERGED`;
a review is closed when it is authored. `state.sh` and `state.ps1` report open counts
first, totals second, and list every open order or question by filename.

Full loop and git conventions: `docs/WORKFLOW.md`.

Why files instead of chat: neither agent remembers the other's sessions. These files
ARE the shared memory, and they're versioned with the code they describe.
