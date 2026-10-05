# Order 674 — independent shared-shell review

Reviewer: Codex `/root/kole_design_lead` (GPT-6 Astra), 2026-09-24.

Independence: reviewer implemented the movement-table slice, not the shared shell reviewed here. No shell implementation was edited by this reviewer. This record does not independently approve the reviewer's own movement implementation.

## Scope and disposition

Reviewed `frontend/yellow/src/ui/OperatorHeader.tsx`, `frontend/yellow/src/ui/OptionsDrawer.tsx`, the Order 674 shell rules in `frontend/yellow/src/ui/reference-theme.css`, and `tests/order674-shell.test.ts`. Read the existing drawer baseline CSS and active workspace call sites to trace interaction effects.

Source review and personally executed automated proofs: **PASS after correction**. Browser acceptance remains separate: the root implementer is verifying live mobile focus, background inertness, property switching, and layout. SSR/source assertions do not establish those runtime outcomes. No deployment or complete-ecosystem acceptance is claimed.

## Findings and correction verification

1. **P2 — drawer rerenders interrupted keyboard focus (corrected).** Initially the modal lifecycle depended on `[onClose, open]`, while `OperationalHub.tsx:228` and `EcosystemHub.tsx:268` supply inline callbacks. A parent rerender changed the callback identity, ran cleanup (`close()` and previous-focus restoration), then called `showModal()` and focused the close button again. This could interrupt keyboard navigation or future detail editing without any user request to reopen the drawer. Reported to the implementer before completion. Re-read the correction: `OptionsDrawer.tsx:20` keeps the latest callback in a ref; its modal lifecycle at line 54 depends only on `[open]`. Escape uses the current callback and prevents default, avoiding duplicate native cancellation for the same key. Callback-only rerenders no longer tear down the dialog.

2. Earlier **mobile property access** finding is corrected: `OperatorHeader.tsx:102` places the preserved property-switcher child inside the navigation panel, with property identity fallback. The mobile hiding rule targets the header context, not this panel control. Existing caller callbacks retain switching authority.

3. Earlier **recovery-lock home navigation** finding is corrected: `OperatorHeader.tsx:96` prevents the anchor's ordinary navigation and calls the existing navigation callback only when unlocked. Workspace buttons are disabled when locked; cashier retains its dedicated callback.

4. Earlier **mobile touch target** finding is corrected: `reference-theme.css:168` gives the navigation trigger a 44px square target; line 262 gives mobile filter chips a 44px minimum height. Navigation close and destinations also retain at least 44px targets.

No additional definite source-level defect remained in this bounded re-review. The mobile panel effect explicitly sets header siblings inert, locks body scrolling, focuses its close control, traps Tab, handles Escape, and restores prior inert/overflow state and trigger focus. The native options dialog is portaled to the body and uses `showModal()` rather than a visually modal non-modal section. Reduced-motion rules cover shell/sidebar/dialog transitions.

## Personally executed proof

Working directory: `D:/Yellow/git-live-order611-source-v2`.

- `bun test tests/order674-shell.test.ts tests/order673-ribbon.test.ts tests/order673-theme.test.ts` — **11 passed, 0 failed, 77 assertions**, exit 0. Executed again after the callback-lifecycle correction.
- `bun run typecheck` — root `tsc --noEmit` and frontend `tsc --noEmit -p frontend/yellow/tsconfig.json` both completed, exit 0. Executed again after correction.
- `git diff --check -- frontend/yellow/src/ui/OperatorHeader.tsx frontend/yellow/src/ui/OptionsDrawer.tsx frontend/yellow/src/ui/reference-theme.css tests/order674-shell.test.ts` — no errors, exit 0.

The test suite proves server-rendered navigation composition/locked destinations and selected structural requirements. It does not mount effects or synthesize browser focus events. In particular, final live-browser checks must confirm mobile `data-mobile=true`, `aria-modal=true`, close-control focus, background `inert`, Tab/Shift-Tab containment, Escape dismissal/focus return, drawer focus persistence during a parent rerender, and accessible property selection. A browser observation of failed focus or inertness must be resolved before runtime acceptance, even with the automated proofs green.

## Integration review addendum

Additional independent scope: `table-query.ts`, `ui/TableControls.tsx`, `ui/TableColumnMenu.tsx`, `ui/FolioStatementTable.tsx`, `ui/BusinessMappings.tsx`, `hotel-search.ts`, and `ui/HotelSearch.tsx`. These implementations belong to other agents, not this reviewer. `folio-statement-view.ts` and the active App call sites were read for integration context.

No blocking query, draft-identity, or lock regression was identified in source review:

- Query operations are local to supplied rows, do not mutate source arrays/objects, preserve stable ties, retain exact bigint money ordering, and fail closed on unsupported fields/operators or invalid/duplicate sorts. Header sort changes retain precedence, while explicit reorder changes precedence. Filters compose with AND semantics; header replacement clearly discloses replacement of multiple rules on the same column.
- Folio rows keep `lineId` identity and server-provided running balances. Sorting/filtering does not recalculate financial balances or invoke a financial command. The minor-unit filter convention is explicitly described.
- Business mappings construct display rows with `originalIndex` (`BusinessMappings.tsx:215`) and retain stable draft keys in the rendered table (line 325). Input/select/removal callbacks address the original draft row, not its sorted display position. Save serializes complete `content`, not the filtered view; query changes cannot remove hidden mappings from the payload. `editable` still requires write permission and no busy/loading operation; menu controls are disabled while saving. Dirty reporting, before-unload protection, reload/removal confirmation, expected-version save, and unchanged company/room-class payloads remain intact.
- Search query keys include property identity; profile keys also include the submitted query. Only successful source reads supply candidates. The current-query guard suppresses stale visible results when text changes or navigation is locked. Locks close the modal and disable the trigger/submit; result navigation also checks the lock. App retains all ten property-keyed search instances and both existing recovery locks. Profile destinations arise only from authorized profile candidates, not from stay records. Masked hints alone are copied into results; UUID route guards, truthful hotel-local/UTC dates, identity deduplication, and per-type caps remain covered.

### Regression test finding

The first independent integration run returned **42 passed, 1 failed** (203 assertions): `order668-search-surface.test.ts` counted the superseded literal topbar markup. Reported this to root. A header-only correction exposed the second obsolete assumption: the same test required `propertyId` and `locked` props to be adjacent, although `timezone` is now between them. The second run, including the existing folio proof, returned **45 passed, 1 failed** (217 assertions). Actual source retains ten correctly locked search entries; the failure is a brittle inventory assertion, not absent search or lost locks. Final corrected-test rerun is required before declaring the expanded proof green.

Additional personally executed checks: `bun run typecheck` passed (both root and frontend); scoped `git diff --check` on all seven integration implementation files plus `TableControls.tsx` and the Order668 assertion passed. No database integration test was run: this is a frontend-view review with no backend/permission/migration changes. The Order671 service unit tests exercised validation, optimistic-concurrency rejection, and bounded reads; they are not represented as database/RLS proof.

### Final corrected integration proof — PASS

Root corrected the Order668 assertion to inspect all ten complete `OperatorHeader` branches, require exactly one `HotelSearch` within each, and independently check property key, property ID, timezone, and both recovery locks. The assertion remains protective rather than merely reducing expected counts.

Personally reran:

`bun test tests/order674-table-query.test.ts tests/order674-search-context.test.ts tests/order671-table-query.test.ts tests/order671-business-mappings-ui.test.ts tests/order671-commercial-mappings.test.ts tests/order668-hotel-search.test.ts tests/order668-search-surface.test.ts tests/order672-folio-statement.test.ts`

Result: **46 passed, 0 failed, 256 assertions**, exit 0. Also reran `bun run typecheck` after the final test correction: both root and frontend passed, exit 0. Together with the separately executed 11 shell/ribbon/theme tests, this review has 57 passing tests across its bounded independent scopes; movement implementation tests are deliberately not counted as an independent review of this reviewer's own code.

Final disposition: **PASS for the bounded shell, table, mapping, folio-view, and hotel-search integration review**, with no outstanding blocking finding. Runtime evidence remains attributed separately below; full ecosystem coverage and database security/posting proofs are outside this approval.

### Browser evidence attribution

Root reports live-browser verification of native drawer `:modal`, initial close-button focus, Escape dismissal and focus restoration; mobile navigation main-content inert attribute, Tab containment, and Escape return to the trigger also passed. Initial timing-sensitive focus observations were resolved by waiting for the effect. These are root's browser observations, not personally executed browser evidence from this reviewer. This addendum does not claim that every pending runtime scenario above was independently executed.
