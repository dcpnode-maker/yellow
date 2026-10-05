# Inventory page admission successor: restriction selector readiness

Astra independently reproduced a real blocker in frozen inventory-page-admission-v1: clearInventoryEvidence disables restrictionUnitType, but successful populateRestrictionUnitTypes never restores it. FormData excludes the disabled control, broadening a selected restriction to All room types. Candidate V1 and independent RED receipts remain immutable; acceptance is withheld.

Laptop is exclusive source/common-fixture writer.10R has acknowledged a safe RMS checkpoint and no further writes until explicit resume. Astra remains read-only independent reviewer.

## Exact successor scope

- src/http/operator/operator.js: the inventory evidence reset, restriction selector population, and restriction submit's read-context guard only.
- tests/operator-inventory-relationships-ui.integration.test.ts: meaningful actual-page readiness/FormData/no-effect assertions for returned populated, valid empty and pending/denied restriction contexts; retain all existing scenarios and budgets.
- This successor order plus scoped review/freeze/proof/status documentation and external immutable artifacts.

Restore restriction selection only after the existing current property/token/generation inventory admission succeeds. A valid empty returned inventory may expose the explicit existing All room types option; unavailable/pending/denied scope cannot silently become that selection or generate a new command. Disable the restriction submit presentation during invalidated reads and guard its handler before creating FormData or an intent. Keep original request body semantics, replay keys/uncertain evidence and backend authorization unchanged. No native commands, money/schema/auth/grants/dependencies/other workspaces/runtime changes.

Paired proof must reproduce the V1 selector bug before repair, then verify exact selected unitTypeId survives FormData, explicit empty All value is present rather than omitted, and pending/denied handler activation generates no request/key. Audit all seven cleared selectors for their existing successful population semantics without rewriting unrelated renderers. Root/frontend strict types,211 boundaries and retained page/component/layout tests remain required; independent Astra personally executes successor proof. Native API authority provenance remains distinct from synthetic page proof. No self-acceptance, publication or full18-scope claim.
