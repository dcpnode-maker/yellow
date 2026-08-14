# ORDER 009 — context layout and import boundaries

**Phase:** 0 · **Branch:** `phase-0/context-import-boundaries`
**Written by:** OpenAI Codex, acting as temporary architect by founder authorization
**Date:** 2026-08-15 · **Tier:** 2

## Goal

Create the canonical 13-context/kernel layout and an executable guard that makes
`index.ts` the only cross-context import surface.

## Why now

This closes the Phase 0 module-layout requirement before migration and seed tooling
add more source structure. D-67 already resolves the names and dependency direction.

Start from the reviewed head of Order 008. Do not start from `main` or combine this
with Order 010.

## Scope — files Codex may create or change

- `src/contexts/identity/index.ts`
- `src/contexts/inventory/index.ts`
- `src/contexts/rates/index.ts`
- `src/contexts/reservations/index.ts`
- `src/contexts/stay-operations/index.ts`
- `src/contexts/housekeeping/index.ts`
- `src/contexts/financials/index.ts`
- `src/contexts/crm/index.ts`
- `src/contexts/groups/index.ts`
- `src/contexts/distribution/index.ts`
- `src/contexts/tax-fiscal/index.ts`
- `src/contexts/statutory-privacy/index.ts`
- `src/contexts/reporting/index.ts`
- `src/kernel/index.ts`
- `scripts/check-import-boundaries.ts`
- `tests/import-boundaries.test.ts`
- `package.json`

Anything not listed is out of scope. Stop and write `handoff/questions/009.md` rather
than adding aliases, shared types, context internals, or configuration files.

## Contracts to honour

- `PROJECT.md` — Module boundaries
- `DECISIONS.log` — D-67
- `handoff/questions/007-ARCHITECT-RESPONSE.md` — Decision A

## Required implementation

1. Create exactly the 13 context directories named in Scope. Each `index.ts` is an
   empty public surface for now; do not invent exports.
2. Create empty `src/kernel/index.ts`. Kernel is platform code, not context 14.
3. Implement a zero-**new**-dependency static checker using `Bun.Glob` plus the
   already-pinned TypeScript compiler API to inspect syntax nodes.
4. Scan `src/contexts/**/*.ts` and `src/kernel/**/*.ts`.
5. Resolve relative import specifiers for static imports, `export ... from`, and
   literal dynamic imports.
6. From one context into another context, allow only the target directory root,
   `<target>/index`, or `<target>/index.ts`. Reject every deeper path.
7. Allow imports within the same context and imports from a context into kernel.
8. Reject every import from kernel into any context, including the target root.
9. Ignore bare package specifiers and paths outside `src/contexts`/`src/kernel`.
10. The CLI exits nonzero and prints source file, specifier, and reason for every
    violation. It exits zero silently or with one concise success line otherwise.

Do not add a parser or other dependency; `typescript` is already installed, locked,
licensed, and audited. The checker may expose pure functions for tests, but its
real-tree scan must use `Bun.Glob`. Do not use regex as the source parser.

## Required tests

`tests/import-boundaries.test.ts` must create isolated temporary fixtures and prove:

- all 13 real context indices and the kernel index exist;
- the real source tree passes;
- `../inventory` and `../inventory/index.ts` are allowed cross-context surfaces;
- `../inventory/repository` is rejected;
- same-context deep imports are allowed;
- context → kernel is allowed;
- kernel → context root and kernel → context deep path are both rejected;
- static import, re-export, and literal dynamic-import forms are inspected;
- comments and ordinary string literals that merely contain import-like text are
  ignored;
- a deliberately illegal fixture makes the checker fail, proving the guard is live.

Temporary fixtures must be removed in `finally` cleanup and must not live under
`src/`.

Add a package script named `boundaries` that runs the real-tree checker.

## Definition of done

- [ ] Exactly 13 context directories plus one kernel directory exist.
- [ ] No context implementation or shared boundary type is invented.
- [ ] `bun run boundaries` passes on the repository.
- [ ] The negative fixture fails for the expected reason.
- [ ] `bun run typecheck` passes.
- [ ] `bun test` passes.
- [ ] The full database referee reports `11 passed, 0 failed of 11`.
- [ ] `git diff --check` is clean and no file exists outside Scope.

## Forbidden in this order

- Editing `migrations/`, `tests/run_invariants.py`, RLS, tenant scoping, or domain SQL.
- Adding branded types, repositories, handlers, events, status values, or context code.
- Creating a 14th context or placing kernel under `src/contexts`.
- Adding path aliases or third-party parser/lint dependencies.
- Implementing migration, seed, database CI, or schema drift work.

## Review requirement

Tier 2: Claude reviews the directory map and must see the deliberately illegal import
fixture fail before the cumulative integration PR merges.
