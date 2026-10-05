# Curated God's Eye native map stack

Source: https://github.com/bilawalsidhu/gods-eye-view at
759652207fd1279ece97f0f19af566feb9a82146, `src/mapStackController.js` and the
minimal Cesium viewer configuration in `src/main.js`. Code licence: MIT.
`map-stack.ts` is a narrowed TypeScript adaptation, not a wholesale native app.

Retained: actual Cesium globe/imagery stack, asynchronous generation ownership,
native 2D/3D navigation. Added explicit disposal, demand rendering and Yellow UI.
Only OSM interactive street tiles are enabled. No prefetched/offline tiles.
https://operations.osmfoundation.org/policies/tiles/ applies; no service SLA.
Tile requests reveal the viewed vicinity, including after user-invoked GPS.

Not bundled: native main/style manager/provider-proxy service, provider keys,
TeleGeography/other local data, 3D models, Google News, OSINT feeds or simulated
traffic. No Esri/ion/Google/terrain provider is activated by this integration.
Cesium 1.138.0 has its own Apache-2.0 licence and third-party notices distributed
with the static build. Public listing publication remains a separate capability.
