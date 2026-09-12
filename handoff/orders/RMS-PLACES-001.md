# Order RMS-PLACES-001 — Overture discovery and market/compset map

Author: Codex, under Ankit's explicit instruction to build this integration in
parallel with the active desktop builder. Baseline PR92 commit
`46004d6f9b61a02f14259fd3f911e85a72ae0c60`; branch
`phase-9/overture-compset-map`. Phase 9 acquisition for Phase 14 RMS.
Admitted before implementation. The desktop owner retains fiscal/release work.

## Goal and authority

Make the preserved Overture Places snapshot useful in Yellow: stream publisher
Parquet or permitted local exports into an immutable, rebuildable public property
index; authenticated property-scoped search; a responsive interactive market map;
explicit selection of a subject property and comparable candidates; a portable
selection export for the existing market pipeline. Add an optional locally hosted
3D map using suitable God's Eye/Cesium concepts and compatible components.

This snapshot is property identity/attributes, not live rates, occupancy, sold
rooms, an automatic exact OTA match or unconstrained demand. Human confirmation
is explicit; selections are research proposals, not operational channel maps.
No tenant/client/guest/private export enters the global index. No rate or inventory
write, new PMS schema, new operational state/event, or deployment is authorized
by this order. PostgreSQL remains the only business authority. A global SQLite
spatial index is an immutable public-data cache, with bounded queries and no
tenant records, not a second operational database.

## Scope (exclusive lane ownership assigned by coordinator)

- `src/contexts/distribution/place-catalog.ts`, its public `index.ts` export,
  `tests/place-catalog.test.ts`: strict catalog schema/provenance, readonly SQLite
  adapter, bounded spatial/name/URL/id search, exact candidate selection validation.
- `scripts/research/build-place-catalog.py`,
  `tests/place-catalog-import.test.py`, `scripts/research/place-catalog-example.json`:
  streaming Parquet/NDJSON import, hospitality taxonomy, safe URLs, deduplication,
  reproducible release/source receipts, atomic output, real bounded UAE/KSA proof.
- `src/http/market-map.ts`, `tests/market-map.test.ts`,
  `tests/market-map.integration.test.ts`: authenticated read/selection APIs using
  existing tenant transaction and exact rates.configuration:read property grants;
  no storage of operational property/channel mappings. Proof includes two-tenant
  and disjoint-property denials before reading the catalog.
- `src/app.ts`, `src/server.ts`, `src/http/operator.ts`: minimal query/dependency
  and same-origin asset wiring, default unconfigured catalog shows explicit setup.
- `src/http/operator/operator-market-map.js`,
  `src/http/operator/operator-market-map.css`, `src/http/operator/index.html`,
  `src/http/operator/operator.js`, `src/http/operator/operator-interfaces.js`,
  `src/http/operator/operator-layouts.js`: existing workbench Market entry,
  bounded pan/zoom map, search, selection, matching confidence/provenance,
  export, optional lazy 3D, keyboard/list fallback and context reset.
- `src/http/operator/vendor/MARKET-MAP-NOTICE.md`, `src/http/market-map-assets.ts`,
  `src/http/security-headers.ts`, `package.json`, `bun.lock`: only exact reviewed
  commercially usable map runtime if required, same-origin assets, narrowly
  scoped CSP with no third-party network by default. No unrelated dependencies.
- `tests/operator-market-map.test.ts`, `tests/operator-market-map.browser.test.ts`,
  `scripts/research/verify-market-map-browser.ts`: executable UI/route/state/asset
  proof and screenshots using synthetic fixtures and separately labeled public data.
- This order, `handoff/reviews/RMS-PLACES-001.md`,
  `docs/research/OVERTURE-MARKET-MAP.md`, `docs/CONTRACTS.md`,
  append-only `DECISIONS.log` and `handoff/LEDGER.md`: source licences, exact proof,
  measured versus proposed limits, setup, and receiving-owner handoff.

## Verification and delivery

Write meaningful tests alongside implementation. Independently execute the
tenant/property isolation and input/asset traversal proof. Test streaming import
duplicates, malformed records, out-of-range coordinates, XSS/unsafe URLs, schema
or release mismatch, null operating status, bounded spatial limits and interruption
without replacement of a good catalog. Browser proof covers desktop/phone, map/list
selection, no stale cross-property selections, optional 3D failure and request budgets.
Run strict types, boundaries and licence checks. Run ./setup.sh --db-only; if
Docker is unavailable retain the actual failure and obtain canonical 11/11 on a
separately isolated disposable native PostgreSQL target where available. Do not
claim Compose or a live hotel-data import on that basis. A PR remains draft until
its required receiving gates are accepted. No self-merge.

Pin provenance to Overture 2026-08-19.0/schema v1.18.0 and God's Eye source
759652207fd1279ece97f0f19af566feb9a82146. Retain applicable contributor and component
notices. Do not copy noncommercial bundled layers or expose private Drive/account
information in public code. Keep the full snapshot off the browser/laptop; runtime
setup is a server-selected path. Existing 3/4-month rate shopping, refresh bands,
source budgets and 30% gross-margin pricing remain unchanged.

## Receiving-source discrepancy

The committed PROJECT-STATUS predates PR92's latest posted local-runtime evidence.
This isolated lane does not rewrite the desktop's current lifecycle or claim its
runtime state. Actual observations and this lane's acceptance are recorded here
and in its review/handoff; integration belongs to the active receiving owner.
