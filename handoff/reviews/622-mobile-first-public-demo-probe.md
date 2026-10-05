# Review 622 — Mobile-first public demo probe

Timestamp: 2026-09-23T10:38:57.8963393+05:30

## Scope reviewed

Order 622 adds a read-only probe against the live public app shell and built assets. It verifies:

- bottom safe-area mobile navigation
- mobile content bottom clearance and horizontal overflow containment
- Today colleague demo path mobile scrolling
- Overwatch launcher mobile offset and active state
- bundled colleague path copy
- bundled multilingual, confirmation-gated assistant copy

## Commands executed

`powershell
bun test tests/order622-mobile-first-public-demo-probe.test.ts
bun tools/probe-mobile-public-demo.ts
bun run typecheck
bun tools/probe-colleague-demo-readiness.ts
bun tools/probe-public-demo-performance.ts
`

## Results

Focused mobile probe test:

- 4 pass
- 0 fail
- 13 expectations

Live mobile public-demo probe:

| Check | Result | Evidence |
|---|---|---|
| mobile shell uses bottom safe-area navigation | pass | 1 CSS asset inspected |
| mobile content clears nav and clips horizontal overflow | pass | root overflow and workspace bottom clearance present |
| Today colleague path remains mobile-scrollable | pass | demo path is horizontally contained for phone widths |
| Overwatch launch avoids bottom navigation | pass | assistant launcher has mobile offset and active state |
| public shell exposes colleague path copy | pass | 4 JS assets inspected |
| public shell exposes multilingual confirmation-gated assistant copy | pass | assistant copy and confirmation flag are bundled |

Cross-gates also passed:

- 	sc --noEmit
- live colleague readiness probe
- public speed probe, including public app shell 99ms and largest JavaScript chunk 218,840 bytes

## Conclusion

The current public demo has repeatable mobile-first asset/runtime contract evidence. This still does not replace full visual screenshot QA, but it prevents the main mobile shell, demo path, and Overwatch affordance from silently regressing before the colleague share.
