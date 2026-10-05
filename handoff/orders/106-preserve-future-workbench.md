# Order 106 — Preserve the Future Workbench product-design artifact

**Phase:** 5 governance interruption; no financial capability change  
**Branch:** `phase-5/preserve-future-workbench`  
**Base:** `26d2812`  
**Risk tier:** 1 — exact documentation/design-artifact preservation only  
**Owner:** Codex

## Outcome

Preserve the founder-approved Yellow Future Workbench as first-class repository
product-design evidence: the exact standalone browser artifact, its original handoff,
and the complete minimal React/Vite source required to reproduce it. Keep its boundary
explicit: this is the proper target-state UX reference, while the separately running
operator workbench remains the production-backed incremental application.

## Natural-Solution Test

The recovered source already exists and its packaged page runs at the founder's exact
URL. The natural solution is a byte-for-byte, checksum-verifiable repository copy—not a
rewrite, screenshot, generated approximation, dependency installation, or replacement
of the live operator application. Generated dependencies and build caches add no design
authority and are excluded.

## Recovered provenance

Source directory:
`C:\Users\astha\.codex\visualizations\2026\08\14\01a00071-140f-7570-b203-f5d094544777`

The original handoff identifies Codex as preparer on 2026-08-23 and classifies the
artifact as a standalone interactive target-state prototype. The founder explicitly
confirmed on 2026-08-24 that this is the proper ChatGPT/Codex UI/UX deliverable and
ordered it found, retained, and not dismissed or replaced.

## Scope

- `docs/mockups/future-workbench/Yellow-Future-Workbench.html`
- `docs/mockups/future-workbench/HANDOFF.md`
- `docs/mockups/future-workbench/README.md`
- `docs/mockups/future-workbench/SHA256SUMS`
- `docs/mockups/future-workbench/source/bun.lock`
- `docs/mockups/future-workbench/source/index.html`
- `docs/mockups/future-workbench/source/package.json`
- `docs/mockups/future-workbench/source/tsconfig.json`
- `docs/mockups/future-workbench/source/vite.config.ts`
- `docs/mockups/future-workbench/source/src/App.tsx`
- `docs/mockups/future-workbench/source/src/index.css`
- `docs/mockups/future-workbench/source/src/main.tsx`
- `docs/mockups/future-workbench/source/src/vite-env.d.ts`
- this order, `handoff/PHASE-5-PLAN.md`, `handoff/LEDGER.md`, and `DECISIONS.log`

## Required work

1. Copy every scoped recovered artifact byte-for-byte. Preserve the original standalone
   filename so the founder's URL can be served unchanged from the preserved directory.
2. Record uppercase SHA-256 for the standalone artifact, original handoff, lockfile,
   build configuration and all source files. Recompute from the repository copy and
   require an exact manifest match.
3. Add a concise README that distinguishes:
   - proper target-state product/UX evidence;
   - synthetic illustrative prototype data and interactions;
   - the production-backed operator workbench and APIs;
   - unbuilt public/guest, AI, finance, tax/fiscal and other destination capabilities.
4. Document zero-cost local serving with an already-installed static HTTP server and
   the exact `Yellow-Future-Workbench.html` path. Do not add a runtime dependency or
   alter application routing.
5. Keep the original handoff intact except for its filename. Do not silently revise
   its historical status, estimates, limitations, or verification claims.
6. Renumber the still-unbuilt Phase-5 financial orders from 106–111 to 107–112 without
   changing their sequence, risk, outcomes, or proofs. This founder-directed preservation
   order occupies 106 and does not imply financial progress.

## Forbidden

- Editing, redesigning, minifying, reformatting or regenerating the recovered artifact
- Copying `node_modules`, `dist`, `tsconfig.tsbuildinfo`, temporary files or unrelated
  PR-body files from the visualization directory
- Installing packages, using paid services, fetching network content, or changing locks
- Wiring prototype controls to production APIs or presenting synthetic data as live
- Replacing, deleting, redirecting or weakening the production operator workbench
- Claiming the public/guest app, AI workforce, tax, fiscal, payment, settlement or full
  target-state product is implemented because its prototype screen exists
- Schema, migration, application, test, dependency or infrastructure changes
- Touching user-owned `.agents/`, `.codex/hooks.json` or `handoff/chat-archive/`

## Pre-registered proof

### P0 — intentional absence

Before copying, the exact destination files do not exist. The recovered files are read
and hashed in place; no repository artifact is substituted for them.

### P1 — byte identity

For every scoped recovered file, source and destination lengths and SHA-256 values match.
The checked-in `SHA256SUMS` independently matches every destination file it governs.

### P2 — browser artifact

A zero-cost local static server returns HTTP 200 for
`/Yellow-Future-Workbench.html`; the response length is 327,579 bytes and the document
title is exactly `Yellow — Future Workbench`.

### P3 — preservation boundary

Repository diff contains only Scope files, no generated dependencies/caches, and no
application/schema/test mutation. The README and original handoff both state the
target-state/production boundary.

### P4 — project gates

Typecheck, boundaries, standing tests, exact schema and `setup.sh --db-only` remain
green. This documentation-only order requires no independent high-risk approval.

## Definition of done

- [x] Order exists before the repository copy.
- [x] Exact standalone page, original handoff and minimal source are preserved.
- [x] Repository checksums match the recovered source byte-for-byte.
- [x] Exact page serves locally with the original URL filename and title.
- [x] Production/prototype boundary and zero-cost launch are clear.
- [x] No generated dependency/cache or out-of-scope file is copied.
- [x] Relevant standing gates remain green.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
