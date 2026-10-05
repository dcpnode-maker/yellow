# Yellow Future Workbench

This directory preserves the founder-approved, ChatGPT/Codex-authored target-state
Yellow product and UI/UX artifact recovered on 2026-08-24. It is a proper design
deliverable and product reference; it must not be dismissed, overwritten, or silently
substituted with a different page.

## What is preserved

- `Yellow-Future-Workbench.html` — the complete standalone interactive page.
- `HANDOFF.md` — the original 2026-08-23 Codex design/architecture handoff, unchanged
  apart from its repository filename.
- `source/` — the minimal React/Vite source, build configuration and exact Bun lockfile.
- `SHA256SUMS` — byte-identity hashes for every recovered file above.

Generated `node_modules`, `dist`, `tsconfig.tsbuildinfo`, and unrelated PR-body files
are deliberately excluded because they are reproducible output or unrelated state, not
design authority.

## Run the standalone page locally at no cost

From the repository root, using the already-installed Python runtime:

```powershell
python -m http.server 4174 --bind 127.0.0.1 --directory docs/mockups/future-workbench
```

Then open:

`http://127.0.0.1:4174/Yellow-Future-Workbench.html`

No package installation, paid service, cloud account, or network fetch is required to
serve the preserved standalone page.

## Truth boundary

The Future Workbench is the target-state experience reference. Its hotel records,
metrics and interactions are illustrative synthetic prototype data. A rendered screen
does not by itself mean its domain command, authorization, tenant isolation, accounting,
tax, payment, fiscal, AI-agent or integration behavior is production-built.

The separately served `Yellow · Operator Workbench` is Yellow's current incremental,
production-backed staff application. Its dashboard and enabled controls must continue
to derive from the real local application/database state. Neither surface replaces the
other:

- Future Workbench: complete product/UX direction and architecture communication.
- Operator Workbench: currently implemented and verified operational slices.

Public/guest self-service and other future surfaces remain planned until they are
implemented through authorized domain commands and executable proofs.

