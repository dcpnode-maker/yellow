# Review 618 — Repeatable public demo promotion

Date: 2026-09-23 10:19:56 +05:30
Reviewer: Codex root, script and live promotion verification

## Change

Added 	ools/promote-public-demo.ps1 to make the current live source promotion path repeatable:

1. optional focused tests/typecheck/boundaries,
2. Vite Yellow Next production build,
3. required mirror from rontend/yellow/public/yellow-next to Docker packaged public/yellow-next,
4. app-only Docker rebuild/restart using the existing runtime env/compose/tunnel files,
5. local and public health checks.

## Verification

``powershell
bun test tests/order618-repeatable-public-demo-promotion.test.ts tests/order617-cashier-search-bounded-read-workbench.test.ts
powershell -ExecutionPolicy Bypass -File .\tools\promote-public-demo.ps1 -SkipTests
``

Results:

- Focused script/read-workbench tests: 7 pass, 0 fail, 29 assertions.
- Promotion script ran successfully.
- Production build transformed 484 modules.
- Docker app rebuild/restart completed.
- Local health: HTTP 200.
- Public health: HTTP 200.

## Scope note

This order improves repeatability of live demo promotion only. It does not make the
candidate a Git repository, push to GitHub, create a permanent Cloudflare named tunnel,
or perform any database cutover.
