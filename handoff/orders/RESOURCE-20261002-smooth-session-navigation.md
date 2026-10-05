# Smooth session and workspace navigation

Root admits this bounded Phase 7 receiving UX repair from the user's October 2 instruction: links must open quickly without showing sign-in again before their page. Base is clean e27da80e2e4a55dc653f455adc7b2d271253d20b on phase-7/resource-receiving-20261001. Preserve the original Yellow shell, theme, ribbon hierarchy, flows and every domain command.

## Source scope

- frontend/yellow/src/workspace-navigation.ts (new, same-property modern route admission and guarded history navigation)
- frontend/yellow/src/App.tsx (reactive route read, navigation calls, existing lifecycle/recovery guards)
- frontend/yellow/src/workspaces/ReservationWorkspace.tsx (navigation calls and reactive guest/CRS deep-link inputs)
- frontend/yellow/src/workspaces/FinanceWorkspace.tsx (reactive reservation deep-link input only)
- frontend/yellow/src/AuthenticationGate.tsx (neutral initial restoration state; preserve renewal and failure credential form)
- frontend/yellow/src/authentication.css (loading presentation only if necessary)
- tests/yellow-workspace-navigation.test.ts (new, real controller with controlled window/history plus auth continuity)
- tests/yellow-react-auth-gate.ui.test.ts (restoration presentation and retained expiry/recovery proof)
- tests/yellow-react-browser-session.test.tsx (only if existing restoration assertion requires correction)
- tests/staff-module-navigation.ui.test.tsx (inject the new navigation dependency into the actual compiled CRS callback; retain all existing lock assertions)
- tests/order626-group-block-rooming-list.test.ts, tests/public-demo-proxy.intentional-red.test.ts, tests/yellow-guest-search-workspace.test.ts, tests/yellow-next-commercial-workspace.test.ts, tests/yellow-next-finance-workspace.test.ts, tests/yellow-next-property-settings.test.ts, tests/yellow-reference-ui-restoration.test.tsx, tests/yellow-reservation-command-surface.test.ts, tests/yellow-reservation-finance-entry.test.ts, tests/yellow-responsive-operational-shell.test.ts, tests/yellow-voice-routing.test.ts (existing source/captured-handler proofs: update only the navigation dependency and reactive route assertions, preserving destination/lock/authority assertions)
- docs/PROJECT-STATUS.md (bounded evidence/status entry)
- this order

No backend/schema/API contract, auth-session lifetime/token persistence, dependencies/locks, canonical checkout, or domain ownership changes. Same-property supported React routes navigate inside the retained App, AuthenticationGate and QueryClient. External, legacy, new-tab/download/modifier links and cross-property routes keep native browser navigation and existing authoritative bootstrap/grant checks. URL path/query/hash, deep links and Back/Forward must remain functional. Existing unfinished-action/uncertain-write/auth-expiry locks must block client transitions and history departure, including existing beforeunload guards; no request may rebind to another property's global API context.

## Validation and release

Require meaningful controller/route/back-forward/lock/auth continuity tests, existing auth/session/navigation/domain UI regression checks, root/frontend strict types, boundaries and isolated Vite asset build. Independent non-implementer review and executable proof precede live admission. Browser visual acceptance remains separate; never bypass unavailable saved browser permissions.

Root may stage a version-exact artifact runtime outside Git under yellow-receiving-build-20261001-v1, copying existing protected DB/JWT/public-origin configuration unchanged. Independently reviewed exact-owner cutover may replace only old Bun 13452 and V7 watcher 15240 after new source/assets/manifest are verified, on existing port 3184. Keep DB 2124, named connector 7876, public hostname, Worker/account/VPC service and their secrets untouched. Preserve old runtime/manifests/receipts for rollback, retain stop/pause latches, update authoritative live record atomically after public proof. No database-start policy bypass or tunnel reprovisioning. Every actual runtime action gets a durable redacted receipt. Do not claim visual acceptance or complete ecosystem delivery from unit/API proof.
