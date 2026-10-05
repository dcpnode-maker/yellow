# Order713 independent review — code and focused proof accepted

Reviewer: Codex independent agent `/root/review709`. I did not implement the Today loader, App integration, or tests.

I read Order713 and D-TODAY-BUSINESS-DAY-713, inspected the new loader/filter, App wiring, source-contract tests, existing reservation-board collector and backend stage SQL/HTTP response. The backend's `arrival` stage includes checked-in-today reservations while `in_house` also retains them. The new Today view uses the three canonical stage responses and their server `businessDate`; the selected table and dashboard counts share those responses. Past-due status-wide reads run only on explicit selection and filter by the property-local stay boundary against the same authoritative business date. Existing assistant/operational status queues remain separate.

Findings sent to the implementers and resolved before acceptance:

1. The loader originally accepted a missing `nextCursor`, which the shared collector would interpret as an ended list and could silently truncate a count. It now requires the backend's explicit `null|string` cursor, with a negative regression.
2. A missing property timezone could leave Past-due on an indefinite loading state. The App now presents an unavailable error and a metadata retry.
3. The shared grid initially rendered a `0 reservations` control/footer on failed or loading reads. It now suppresses those labels in those states.
4. The Past-due table initially had a selected ribbon count from the business-day response. Its selected ribbon count now comes from the Past-due response and is labelled accordingly; other tabs return to the business-day scope.
5. Today now labels its dashboard movements with the server business date, and an inline reservation command settling invalidates the Today query family.

Personally executed final safe proof in `D:/Yellow/git-live-order611-source-v2`:

- `bun test tests/order713-today-business-day.test.ts tests/order713-today-integration.test.ts tests/order692-reservation-journey.test.ts tests/order692-reservation-journey-http.test.ts tests/yellow-reservation-board-pages.test.ts tests/yellow-today-workspace.test.ts tests/order643-today-server-owned-business-mix.test.ts` — **31 pass, 0 fail, 161 expect() calls** across seven files. The Order713 loader tests exercise server-date agreement and failure, page bounds, missing cursor, checked-in overlap, on-demand overdue reads, timezone boundaries, and no browser/travel-date substitution. The App integration tests are source-wiring guards, not browser behavior tests.
- `bun run typecheck` — root and frontend TypeScript checks passed.
- `bun run boundaries` — passed, 208 TypeScript files scanned.

**Independent code/focused-proof verdict: accepted for release build and bounded read-only browser verification.** I did not run PostgreSQL fixtures, mutate a hotel, publish the candidate, or personally verify the deployed mobile/desktop UI. The root owner must perform and record the live read-only count/date and Past-due browser checks after app-only cutover; this review is not that release proof.

## Scoped mobile control follow-up

After the initial live functional check, the root owner reported that the new scope buttons appeared as unstyled native controls on mobile. Order713 and Q713 were amended to allow a small addition to the existing imported `ui/movement-ribbon.css`; no new stylesheet or flow change was needed. I independently inspected the final CSS import, `movement-date-scope` selectors, wrapping, pressed/focus/disabled states, 44px minimum targets, and the refresh button's accessible label/title with decorative icon. The selectors are scoped to the Yellow Today movement control and do not alter the loader or other workspaces. The two date-scope buttons may wrap on narrower screens; the icon control retains a 44px target.

Personally reran `bun test tests/order713-today-integration.test.ts tests/order713-today-business-day.test.ts` — **9 pass, 0 fail, 69 expect() calls** — and `bun run typecheck` — root and frontend passed. The style follow-up is accepted for rebuild and mobile visual recheck. This source review does **not** claim that I observed the rebuilt controls in a browser; that check remains with the root owner.
