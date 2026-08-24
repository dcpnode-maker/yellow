# QUESTION 012 — Phase 0 boundary assertions forbid Phase 1 source files

**Status:** OPEN
**Phase:** 1 · **Order:** 019 · **Branch:** `phase-1/tenant-context-middleware`
**Raised by:** Codex (builder) · **Date:** 2026-08-15
**Hard floor:** D-92 scope/Forbidden conflict after a standing self-check assertion failure

## What happened

Order 019 is implemented locally within its listed Scope and all seven amended
pre-registered proofs pass against the real PostgreSQL fixture. The standing self-check
then reached `bun test` and failed two assertions in
`tests/import-boundaries.test.ts`:

```text
context layout > contains exactly 13 empty context indices and one empty kernel index
Expected: ""
Received: exports from src/kernel/index.ts

context layout > the real source tree obeys the boundary rule
Expected filesScanned: 14
Received filesScanned: 16

2 tests failed; 41 passed; 29 skipped
```

The executable boundary checker itself is green:

```text
$ bun run boundaries
Import boundaries OK: 16 TypeScript files scanned
```

So this is not an import-boundary violation. The two Phase 0 layout assertions encode
Order 009's temporary scaffold state as a permanent condition:

- every context index and `src/kernel/index.ts` must be byte-empty; and
- the whole context/kernel source tree must contain exactly the original 14 index files.

Order 009 explicitly said the public surfaces were empty **"for now"** and forbade
inventing Phase 1 implementation in that Phase 0 order. Order 019 now explicitly scopes
exports in `src/kernel/index.ts` and adds two kernel implementation files, so satisfying
both orders simultaneously is impossible.

## Why the builder stopped

`tests/import-boundaries.test.ts` is outside Order 019 Scope. Silently changing it would
widen scope, and leaving it unchanged makes Order 019's required full self-check red.
D-92 requires the phase to stop on a Forbidden/scope conflict rather than weakening or
skipping the assertion.

No existing migration or `tests/run_invariants.py` was edited. The phase-start referee
was green:

```text
RESULT: 11 passed, 0 failed of 11
```

## Architect decision requested

Please amend Order 019 (or issue an architect correction commit) to add
`tests/import-boundaries.test.ts` to Scope and replace only the obsolete scaffold
assertions with phase-stable checks:

1. the exact 13 canonical context directories still exist;
2. every canonical context and kernel public `index.ts` exists, without requiring it to
   remain empty;
3. the real-tree checker scans the discovered TypeScript files rather than asserting a
   fixed count of 14; and
4. the real tree still has zero boundary violations.

The negative fixtures that prove deep cross-context and kernel-to-context imports fail
should remain unchanged. This preserves Order 009's actual invariant while allowing the
source tree the build plan requires.

After the amendment, may the builder update that one test file, restart the standing
self-check from the top, commit Order 019 if green, and continue Orders 020–026 under
D-92?

## RESOLVED

Answered **YES** by `handoff/questions/012-ARCHITECT-RESPONSE.md` under the
founder-authorized temporary-architect exception recorded in D-95.
