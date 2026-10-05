# Order 666 - Restore the single live operator app

Date: 2026-09-23. Status: COMPLETE for single-app restoration only. Owner: Codex.

Receipt: `handoff/receipts/666-single-live-app.md`. Browser verified Today,
reservation filtering/detail, linked guest history and assistant launch. This is
not acceptance of complete check-in, universal search, metrics or the whole PMS.

## Goal

Founder asks to run one existing live app, preserve the fuller latest UI and
stop delivering a JSON/proof dashboard as a completed staff journey.

## Observed targets

- Full app: `yellow-public-demo-app-1`, loopback 3010; Compose source
  `D:/Yellow/git-live-order611-source-v2`, branch `codex/live-order611-source-v2`.
- Existing Cloudflare tunnel targets 3010. No new tunnel or app is needed.
- Redundant bootstrap/demo app: `yellow-app-1`, port 3000; preserve its code/data.
- Browser fails before render: missing `loadCommercialContribution` binding.
- Existing frontend typecheck reproduces that error plus undefined
  `setAssistantOpen` and an optional-statement narrowing error.

## Exact scope

- This order and `handoff/receipts/666-single-live-app.md` in the coordination repo.
- Matching order in `D:/Yellow/git-live-order611-source-v2/handoff/orders/`.
- In that source only: `frontend/yellow/src/App.tsx`,
  `frontend/yellow/src/workspaces/ReservationWorkspace.tsx`, `package.json`.
- Q017 admits `tests/order666-reservation-render-safety.test.ts` and repairs
  the conditional timeline hook found by the reservation browser check.
- Q017 also admits correction of the stale handler expectation in
  `tests/order620-today-colleague-demo-path.test.ts`.
- Generated frontend assets under that source's `public/yellow-next` only.
- Retain current app image as rollback tag; rebuild/recreate only the existing
  public app using its existing Compose files/environment. No env values printed.
- Stop (not remove) `yellow-app-1` once the full app renders and is checked.
- Inspect existing obsolete link/proxy without creating another app instance.
- Q016 records discovered targets under the founder's one-app instruction:
  stop exact Vite PID 12304 on 3015 and old Localtunnel PID 16704 targeting 3000,
  only after rechecking their command identity. Do not kill other node processes.

## Validation and restrictions

Use the existing failing frontend compiler gate before changes, then require
frontend/root typecheck, relevant Today tests, static build and rendered public
browser identity, nonblank screen, console, search/detail interaction and screenshot.
No database migrations, reseed, financial/occupancy changes, credential changes,
volume/container deletion, new service, paid provider call or blanket PMS completion.
Preserve all pre-existing uncommitted edits. Do not commit or deploy unrelated new
features. Compare backend tree with the running container before app recreation;
if it differs, stop rather than silently publish unrelated backend changes.

Review handoff must name working steps and known blockers with a recovery path.
The current tunnel is temporary; do not represent it as permanent hosting.
