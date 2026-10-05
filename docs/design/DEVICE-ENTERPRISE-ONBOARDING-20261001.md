# Yellow device, enterprise and registration design

Founder requirements recorded 1 October 2026. These requirements extend the complete Yellow destination; implementation status is stated below. Laptop is the controller and final integration point. Cloud and phone execute disjoint, input-bound jobs. CompSet Studio remains separate research.

## One operating system across devices

Keep one server-authorized operational model and API, with layouts suited to phone, tablet and laptop. Hotel, STR and mixed operators use the same inventory, reservations, tasks, accounting and permission authorities. Adapt presentation and navigation to available window width/height and input, rather than device model or resolution alone. Resizing, split-screen, rotation, display scaling and the on-screen keyboard must preserve the current property, task, draft and recovery state.

Phone: touch targets, single-task detail sheets, reachable navigation, concise summaries and locally scrollable dense tables. Tablet: responsive list/detail panes when space permits, with touch and keyboard support. Laptop: higher information density, keyboard navigation and multiple panes. A small window on a laptop uses the compact layout. Full functionality means an accessible path to every authorized workflow, not fitting every table column on one phone screen.

Android and iOS app releases are separate deliverables, not completed by responsive CSS. They must provide platform-appropriate lifecycle/session handling, safe areas, back/deep-link navigation, permission prompts and notifications, using the same governed backend. Camera/document capture, biometric convenience and offline work are capability-gated; offline code never independently authorizes occupancy, money or a booking. Choose the native rendering and packaging stack in a bounded engineering order after mapping existing React reuse and required platform capabilities. Do not duplicate PMS business logic.

Support every OS version that can provide the required functionality and security, with a published, tested compatibility matrix. Minimum Android API and iOS deployment target follow actual framework, platform API and security requirements; no all-versions claim or arbitrary cutoff. Future versions require regression testing. Reference: [Android SDK compatibility](https://developer.android.com/guide/topics/manifest/uses-sdk-element), [Android adaptive layouts](https://developer.android.com/develop/ui/views/layout/responsive-adaptive-design-with-views), [Apple layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout).

Acceptance matrix starts at widths 320/360/390/430 for phones; 600/768/820/980/981/1024 for tablet and breakpoint boundaries; 1280/1440 for laptops, plus larger windows. Check short-height, landscape, split-screen, zoom, screen readers, reduced motion, safe-area/notch and keyboard-open states. Widths are test cases, not fixed supported-device limits. Prove Today, reservations, task distribution, front desk, housekeeping and finance on real Android and iOS as well as automated browser journeys. Document-level horizontal overflow is a defect; clearly signposted local table scrolling is intentional.

Current evidence: responsive React/Vite exists; an isolated Android remote WebView demo exists under `mobile/`. No iOS target was found. There is no accepted native Android/iOS release or complete compatibility matrix. The current CUA browser permission check blocks interactive local preview acceptance; unit tests and compilation cannot substitute for it.

## Enterprise organisation and access

Use the existing tenant-scoped `org_node` hierarchy and `user_role.scope_node` descendant grants as the foundation for one organisation. Example: group → brand → operating region → property → outlet. An appropriately granted regional director can operate multiple descendant properties; regional department teams can receive narrower permissions across the same scope. Additional memberships allow explicitly selected properties in separate branches. A job title, geographic tag, contract or billing plan never grants access by itself.

Keep four dimensions distinct:

| Dimension | Purpose | Permission effect |
|---|---|---|
| Organisational hierarchy | Group, brand, operating division/region, property, outlet | Explicit role + scoped membership + capability; descendants only within tenant |
| Geography | Country, state/province, city, market area, coordinates/address | Filter/report dimension; no automatic grant |
| Commercial relationships | Legal owner, franchisee, operator, brand affiliation, management contract | Explicit effective-dated relationship and governed access agreement; no implicit ancestor |
| Product/subscription | Hotel, STR, Both, capacity and purchased modules | Entitlements intersect actor permission; does not create a grant |

Owned, franchised and management-contract hotels can share brand reporting while retaining distinct legal entities, operators and access agreements. A single tree cannot accurately encode every overlapping relationship. Moving a hotel or changing its contract must not silently change authority or historical ownership/reporting. Geography and commercial relationship models need explicit contracts and independent database/security proof before implementation.

Each user sees only authorised scopes and properties. The portfolio selector must display the current scope and allow drill-down to region/property, with counts and pagination. Group views cover operational attention, CRM task ownership/distribution, arrivals/departures, occupancy and commercial performance. Every action names its target properties and rechecks current authorisation per property. Initially provide authorised read/compare views; bulk mutation is a separate reviewed command with explicit selection, idempotency and per-property outcomes.

Aggregation must intersect permitted properties before calculating totals. Never sum money across currencies without explicit conversion evidence. Align property-local business dates and expose data freshness, unavailable properties and incomplete totals. Large portfolios need bounded server queries, pagination and incremental read projections, not fetching every hotel's full operational dataset into the browser. Do not use a client filter as a tenant/security boundary.

Franchisees or external management clients may belong to separate tenants. Existing descendant grants do not span tenants. Cross-tenant enterprise views require explicit source/target delegation, purpose/field-level scopes, expiry/revocation and audit; never broaden `app.tenant_id`, bypass RLS, or return raw tenant data to emulate federation.

Current evidence: `OrgHierarchy` implements ancestor/descendant reads with an indexed `ltree` path. Operator permission resolution already maps ancestor-scoped role grants to authorised properties. There is no runtime hierarchy-management or enterprise portfolio API/UI. Existing reservation Groups are property-scoped booking groups/blocks. Current showcase selectors are filtered to two demo IDs; preserve this boundary until a separately governed production portfolio path exists. The audit found synthetic fixtures relying on one ID, but no documented decision establishing the filter as production policy.

## Registration and subscription templates

Registration should first capture organisation/operator identity and Hotel, STR or Both, then existing/new portfolio scope, location and inventory structure, required modules and an explicit plan/quote. Set up the organisation, users/grants, properties and inventory only through governed provisioning commands. A post-create setting is not registration. `Both` selects two workspace views over one authoritative inventory and permission model; it cannot duplicate units, reservations or accounts.

| Template | Intake needed | Commercial handling |
|---|---|---|
| Single apartment | Studio/1/2/3+ bedrooms, separate bed/guest capacity, location, ownership/management role | Monthly subscription quote from approved catalogue |
| STR starter | Actual managed units, bedrooms/beds, locations/regions, team/modules | Configured maximum X; X and price await commercial policy |
| STR portfolio | Multi-unit/building/region portfolio, owner relations, teams and services | Approved capacity/module tiers; no guessed threshold |
| Small / medium / large hotel | Sellable rooms, property/outlet structure, departments, modules | Versioned room bands and prices from approved catalogue |
| Large resort / mega hotel | Capacity including 2,000–10,000 rooms, outlets, shift teams, concurrency/integrations | Scale-qualified deployment and commercial quote |
| Enterprise chain | Brands/regions/properties, legal entities, owned/franchised/managed relationships, delegation and reporting needs | Contracted enterprise plan, onboarding and access review |
| Mixed Hotel + STR | Both inventory/workspace needs, shared services and exact unit identities | Combine approved entitlements without double-billing the same inventory |

Bedrooms (BHK), beds, guest capacity, physical spaces and sellable rooms/units are distinct counts. A studio has zero bedrooms but is still an apartment. Store evidenced counts with units; never infer hotel capacity, occupancy or billable quantity from a product label. Proposed capacity during registration is an estimate until reconciled with the actual canonical inventory.

For STR economics, accept optional current lease/rent, frequency and currency, with permitted viewers. Keep property rental income, owner/lease expenditure and Yellow's SaaS subscription as separate money concepts. Forecasts show source, observation time, stay period, assumptions, uncertainty and scenario; unknown external rates remain unknown. Rent or a forecast does not set a subscription price without an approved commercial rule. Research CompSet results do not silently become booking/rate authority.

Catalogue versions contain eligibility bands, currency, recurring billing cadence, optional add-ons, taxes/trial/contract policy and effective dates. Display an approved amount or a quote-required state; no invented prices or automatic paid commitment. The catalogue defines entitlements; role scopes remain a separate intersection. Do not impose a fixed room cap simply because the onboarding label says 'small' or 'large'.

Provision large room lists with restartable idempotent chunks, progress and reconciliation. The current hotel-only bulk command caps each explicit list at 200; 2,000–10,000 rooms therefore requires 10–50 bounded chunks at that limit. Prove partial failure, replay and exact final inventory before scale claims. Do not raise the cap or generate occupancy by bypassing reviewed commands.

Current evidence: there is no runtime property-creation/registration endpoint or authoritative property Hotel/STR/Both selection. Existing `org_node.config` supports a narrow typed, audited property-mode command without inherently requiring a new table, but needs a dedicated permission/scope and real tenant/transaction proof. Unit `vertical_profile` does not establish a property's operating mode. Package catalogue/prices, operator relationships and registration workflows remain unbuilt.

## Ordered delivery

1. Complete the receiving-source build/release reconciliation and first dynamic viewport/safe-area correction; preserve exact proof and generated-asset identity.
2. Implement a read-only authorised same-tenant portfolio service and navigation, independently proving region/team isolation against real PostgreSQL and large synthetic portfolios. Preserve demo mode.
3. Add the persisted Hotel/STR/Both property configuration with dedicated read/write authority and reload proof, then authenticated registration/provisioning with the same command. Do not label configuration alone as complete registration.
4. Implement independent location/commercial relationships, delegated management and versioned subscription catalogue after explicit contract definitions; prices and eligibility bands require commercial input.
5. Wire template-guided inventory/team/module setup and restartable large-property imports, then portfolio reporting and authorised CRM distribution.
6. Build and test Android/iOS apps and the full device matrix, using the same API and one release history. Platform releases require their own signed-build and real-device acceptance.

Every slice has an exact order, disjoint worker ownership, source identity, meaningful executable proof and independent review appropriate to risk. No planned item is presented as built, deployed or a phase exit.
