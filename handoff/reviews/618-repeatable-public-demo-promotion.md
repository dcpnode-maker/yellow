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

## Laptop live hosting status update — 2026-10-02

This dated addendum records later laptop-controller verification. It supersedes
the earlier forward-looking statements above about a named tunnel being absent;
those statements remain accurate for the original Order 618 review date.

- Laptop remains Yellow's authoritative source and main controller. Reported live
  source: e27da80e2e4a55dc653f455adc7b2d271253d20b, branch
  phase-7/resource-receiving-20261001.
- Fixed public app URL: <https://yellow-live-app.yellow-dcpnode-1676cc6f.workers.dev/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today?lane=in_house>
- Reported Cloudflare path: worker yellow-live-app, account
  1676cc6f7dc7847cfd92a6a07aa70dcd, deployed version
  28d63793-f5a6-4c28-928f-89f19c3b0636, service binding YELLOW_LAPTOP_APP;
  named tunnel f4287b20-a271-46f3-8861-f47392a77fda to HTTP VPC service
  01a0f977-8944-7cb1-8f0b-c11ec92b6f3e, targeting laptop
  http://127.0.0.1:3184.
- The laptop controller reports the app and named connector running. The user started the local database in an independent background process. The old temporary Quick Tunnel was retired after the permanent route passed.
- Reported post-deploy proof: 16 login/cookie/database/asset checks passed; proof
  SHA-256 fbb178b19c345b698bcab4514fe9741f9431ac4e1fd50a6eb0ca4a3f9f881167.
  Independent public ready and UI checks also passed.
- Browser visual acceptance and restart/reboot recovery remain unverified. This record does not claim a database backup or restore drill. Laptop credentials stay on the laptop and are intentionally omitted.

The laptop controller supplied this status on 2026-10-02. This cloud worker did
not independently probe or change the live endpoint, tunnel, worker or laptop
database.

## Receiving-source and session-navigation successor — 2026-10-02

The laptop controller later reported the exact active receiving source as
93bf7f94ce36bbe67404853661ed40f641b5db01 on
phase-7/resource-receiving-20261001 (draft PR99). The same fixed public URL and
named tunnel/VPC service above remain in use. This supersedes e27da80 as the
latest source reference; it does not change the prior Cloudflare deployment ID.

The session/navigation successor retains same-property workspace navigation,
authentication state and URL history, uses neutral initial cookie verification,
and keeps the 900-second session lifetime and role/property access controls.
Controller-reported proof on exact source93bf: focused115/0 and independent102/0,
types/import boundaries/build passed,16 public real-PostgreSQL checks and22 asset
hashes passed. The controller says the app and named connector remain running.

Two browser fixtures remain failing or unaccepted; browser visual acceptance and
restart/reboot recovery remain open. The source and checks above are laptop
controller evidence, not an independent cloud verification.
