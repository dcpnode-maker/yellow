# Question 011 — Public-demo runtime source authority

## Observed state

The active passwordless public demo is served from the standalone directory
`D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.
It is not a Git worktree. It contains the full operator application and the
implemented public-demo changes (synthetic fixture, operator UI, Yellow/Jarvis
adapter and the temporary deployment configuration).

The canonical repository at
`C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow` is a different,
minimal bootstrap source tree: it has no `src/http/operator` directory and its
`src/app.ts` / `src/server.ts` are not compatible with a file-by-file patch from
the runtime tree. Copying the runtime tree into it would be a broad, unreviewed
replacement rather than a scoped Order 418 change.

## Risk

The demo can remain live and is synthetic-only, but its newest implementation is
not yet represented in the canonical Git history. Blindly overwriting the
canonical tree could discard unrelated founder or prior-agent work and would
bypass the repository order/review process.

## Decision needed

The registered full-app worktree has now been identified as
`C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order175-folio-responsive-containment`
on `phase-7/operator-invoice-workflow`. Git proves runtime revision
`41415cc5c6953f71d9b3baada6fd9c7853567128` is an ancestor of that worktree's HEAD.

However, that worktree currently has uncommitted overlapping modifications in
`src/app.ts`, `src/http/operator.ts`, `src/http/operator/operator.js`, and
`src/http/operator/operator.css` from other ongoing work. The safe next step is a
new scoped import/integration order against that worktree after those owners have
committed or isolated their changes; do not copy over the files while they are dirty.
Until then, continue reversible runtime/demo QA only and do not claim Git handoff
completion.
