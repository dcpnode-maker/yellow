# Order 679 — Global Overture map in the existing live application

DELIVERED (bounded public layer) — 2026-09-24. See receipt679 and independent review. Founder asks to update the live app with Overture data, retain FULL GLOBAL scope, decide client region/country access later, store no bulk dataset on the laptop, and measure actual map result latency. Own-archive serving and the broader God Eye ecosystem are not declared complete.

## Authority and boundaries

Follows Order677 intake, not execution of the untrusted prototype. The existing August19 Drive archive is retained untouched. Do not download/restore bulk Parquet or PMTiles to any laptop drive. Public publisher-hosted, release-pinned PMTiles range reads may power a read-only global exploration view now; this is not a claim that Yellow's own database or Drive archive is serving queries. Tiles are an inspection projection, not every raw attribute or guaranteed complete records at every zoom. Label that distinction and publisher retention explicitly. No paid service, new permanent app/service, database migration, tenant data publication, pricing authority, or client geography policy. Public source URLs are not an entitlement boundary; future controlled serving requires server-side grants before claiming restricted client access.

## Scope — serving checkout D:/Yellow/git-live-order611-source-v2

- package.json, bun.lock: pinned permissive MapLibre/PMTiles dependencies only; preserve existing dependency changes.
- Amendment Q679: src/app.ts and src/http/overture-map.ts for a public-data-only fixed-source byte-range adapter; tests/overture-map-http.test.ts. Preserve the existing strict CSP. frontend/yellow/vite.config.ts and frontend/yellow/src/vite-env.d.ts for locally bundled map worker and lazy-only map vendor chunk. No backend changes beyond this exact tested route/import and new adapter.
- frontend/yellow/src/overture-map.ts: pinned source metadata, safe attribute normalization, bounded result list, pure helpers.
- frontend/yellow/src/workspaces/OvertureMapWorkspace.tsx and overture-map.css: lazy loaded real map, details/list, global navigation, clear loading/error states, provenance/attribution, measured tile/result timings, retry and cleanup.
- frontend/yellow/src/App.tsx, ui/OperatorHeader.tsx, ui/WorkspaceIcons.tsx (if it exists), workspaces/OperationalHub.tsx, workspaces/EcosystemWorkspace.tsx (if it exists): minimal navigation to map; no unrelated workflow edits.
- tests/overture-map.test.ts and tests/yellow-overture-map.browser.test.ts; scoped map fixtures if required in tests/fixtures/order679/.
- public/yellow-next/: generated production frontend only, retaining existing source baseline.
- scripts/order679-map-network-proof.ts: bounded read-only range/latency probe if needed, no raw dataset persistence.
- docs/market/OVERTURE-GLOBAL-LIVE-MAP.md, docs/PROJECT-STATUS.md, handoff/receipts/679-global-overture-live-map.md, handoff/reviews/679-global-overture-map-independent.md, handoff/LEDGER.md, this order; matching order/receipt/ledger in C coordination checkout.
- Temporary Dockerfile.order679: exact current676 image base plus generated frontend and Q679's exact reviewed src/app.ts + src/http/overture-map.ts ONLY; remove after build. Existing single app service recreation with rollback tag only. The pre-edit src/app.ts hash matches running676.

## Ownership and proof

Founder clarification 2026-09-24: Overture is a switchable map layer, not hotel operational truth. Expose independent Places and administrative-boundary layer controls inside the scoped map component; do not combine it with synthetic rates or claim unavailable layers are implemented. Follow-on reservation menu/calendar research does not widen this map implementation order.

Root owns source admission, pinned dependencies, integration, network measurements, deployment and live browser proof. Sol may implement only new frontend map helper/component/CSS and corresponding unit/mounted tests after receiving exact source metadata. Independent non-implementer must inspect source, execute bounded tests/typecheck/real remote tile proof and report any misleading completeness/latency/security claim before deployment. No high-risk database changes authorized.

Required checks: source HEAD/range/CORS/PMTiles header+metadata; actual visible features across separated global areas; first load versus changed viewport versus repeat viewport measurements with method; malformed attributes/unsafe links/feature cap tests; frontend typecheck, boundary check, production build; live desktop+mobile, errors/offline and navigation cleanup; healthy one live app and rollback image. Do not quote 50ms target as a result. No fake pins, embedded external app in place of integration, full dataset browser load, or test writes to hotel records.

## Definition of delivered

Real global publisher map layer accessible in the current live Yellow app, measurable inspected features, no bulk laptop dataset, clear remaining work for controlled own-archive querying and future per-client geography access. Independent proof and exact image/URL recorded. Global raw archive continuation remains explicit rather than falsely called complete/latest.
