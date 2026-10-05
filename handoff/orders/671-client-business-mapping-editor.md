# Order 671 — Client-owned business mapping editor

Status: COMPLETE — scoped draft-editor slice, independently verified and deployed
Owner: Codex
Source: D:/Yellow/git-live-order611-source-v2
Depends on: 570 attribution foundation; 670 client mapping contract; 668 shared search.

## Deliverable
An actual property-scoped Settings > Business mappings workflow: read active and
latest draft configuration, edit MSG/MS and source/channel relationships in forms,
validate with the existing taxonomy parser, save a new audited draft version, reload
it from PostgreSQL, and explain validation/conflict/permission errors. Existing
company/product mappings must be preserved. No JSON textarea or localStorage as
configuration authority. Shared list search/filter/sort controls should be used in
the new editor and be reusable for subsequent table adoption.

## Safety and boundaries
Use the existing commercial_attribution extension and transaction-local tenant
context; no schema changes. Both identity scope and property role grant checks are
required. Save is compare-and-swap against the latest version under an advisory
lock. References must stay tenant/property scoped. Record append-only audit evidence.
Drafts do not drive operational consumers, so do not publish an activation event or
claim drafts are active. Current active reporting is unchanged; effective-dated
activation, rate/company purpose inference, sales portfolios, and many-to-many room
products remain explicitly separate follow-up work. Do not edit client business
values in the live demo to test persistence; use rollback/isolated database fixtures.

Resolved settings entry: `PropertySettingsWorkspace` lives in App.tsx; no separate
PropertySettingsWorkspace.tsx will be created. Authorization reuses the existing
property setup permissions `inventory.configuration:read` / `:write`, checking both
the authenticated token and database role grant for the selected property. A read-only
catalogue check confirmed identity.extension scopes have no registered property-role
permissions in this deployment; adding invisible permissions would leave every client
blocked. This does not change roles or grant new permissions to any user.

## Exact scope
- src/contexts/reporting/commercial-mappings.ts (new)
- src/contexts/reporting/index.ts
- src/http/operator.ts
- src/app.ts
- frontend/yellow/src/yellow-api.tsx
- frontend/yellow/src/PropertySettingsWorkspace.tsx (if the existing filename differs,
  record the resolved existing settings file in this order before editing)
- frontend/yellow/src/ui/BusinessMappings.tsx (new)
- frontend/yellow/src/ui/business-mappings.css (new)
- frontend/yellow/src/ui/TableControls.tsx (new)
- frontend/yellow/src/table-query.ts (new)
- frontend/yellow/src/commercial-mapping-types.ts (new)
- frontend/yellow/src/App.tsx (settings mount only if required)
- tests/order671-commercial-mappings.test.ts (new)
- tests/order671-commercial-mappings.integration.test.ts (new)
- tests/order671-table-query.test.ts (new)
- tests/order671-business-mappings-ui.test.ts (new)
- public/yellow-next/** (generated production build)
- handoff/orders/671-client-business-mapping-editor.md (coordination and source copy)
- handoff/reviews/671-client-business-mapping-editor.md (coordination)
- handoff/receipts/671-client-business-mapping-editor.md (coordination)
- handoff/LEDGER.md (coordination)

## Proof
Strict root/frontend typechecks, focused parser and UI contract/query tests, real
PostgreSQL tenant/property isolation, stale concurrent save, validation rollback,
audit receipt and reload proofs. A non-implementing reviewer personally executes
the database proof before deployment. Browser proof for desktop/mobile navigation,
forms and existing persisted reads. Rebuild/recreate only the existing app after
green review; never start a second live app or overwrite unrelated work.
