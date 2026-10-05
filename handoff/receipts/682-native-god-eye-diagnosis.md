# Order 682 — native God's Eye actually verified

2026-09-24. Coordinator personally ran the original native app, not the Yellow
Overture workspace. Vendor registration remains deferred. No Yellow code changed
by this diagnostic order and no second public Yellow app was created.

## What failed / what was missing

The archived God's Eye source and datasets were not an installed/served original
app in the current Yellow deployment. D1484 explicitly records archive inventory
and source audit without runtime installation. The current live map (Order679) is
Overture Places/Divisions: it does not include the upstream Cesium globe, imagery
or live feed proxy. This explains that mismatch; it does not establish the cause
of any unidentified historical crash/session that was not reproduced.

## Native execution evidence

- Source: `https://github.com/bilawalsidhu/gods-eye-view` exact archived commit
  `759652207fd1279ece97f0f19af566feb9a82146` (detached).
- Directory: `D:/Yellow/temp/order682-gods-eye-native`.
- Node v24.19.0, npm 11.17.0; `npm ci --ignore-scripts --no-audit --no-fund
  --cache D:/Yellow/temp/order682-npm-cache`: 198 packages, exit0.
- `npm run doctor`: supported runtime, dependencies installed, keyless Esri map
  and terrain ready. All nine optional provider credentials reported unconfigured.
- Provider credentials cleared in the child process environment; no secret copied,
  account created, API billing enabled or browser provider-settings save performed.
- `npm run dev -- --host 127.0.0.1 --port 4173 --strictPort`: Vite6.4.3 ready.
- Native URL: `http://127.0.0.1:4173/`. Laptop loopback only; not reachable on the
  user's phone through the Yellow tunnel. No new firewall rule or public tunnel.
- Actual browser rendered original God's Eye title and satellite imagery; chose
  Environmental preset and enabled Live Flights + Satellites via the native UI.
- At13:17UTC: **11.8K aircraft**, **831 satellites**, **33 USGS earthquakes**
  displayed with feed timestamps and rendered globe markers (initial quakes32).
- Native location controls flew to Dubai and rendered its Esri city imagery at
  25.2020,55.2763. No error-level browser log entries at the observed checkpoints.
- Two nonfatal Cesium warnings about geometry outlines/height-reference on terrain.

## Honest limits

The free satellite basemap is imagery, not a live camera feed of every location.
Satellite positions are propagated from orbital data; aircraft visuals may be
interpolated. Native keyless traffic is simulation, not a live traffic measurement.
Photorealistic Google 3D needs an eligible Cesium ion or Google Maps configuration;
Google Maps direct billing is not activated. AIS vessels, NASA FIRMS live fires,
TomTom live traffic and OpenAI voice have separate provider requirements; these
were not enabled. CCTV availability depends on actual public camera coverage.

Upstream MIT applies to code, not every bundled dataset/model. TeleGeography
bundled cables are noncommercial; OSM-derived data is ODbL. This was a local
upstream diagnostic, not approval to distribute all assets commercially in Yellow.

No app source patch was needed to reach a working native render and live feeds.
No upstream full unit suite/build or Yellow integration is claimed. Native server
is a manually started background process, not a reboot-persistent installed service.
