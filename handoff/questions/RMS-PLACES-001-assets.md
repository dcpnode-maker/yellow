# RMS-PLACES-001 — local land backdrop

The admitted map needs one bounded local land geometry file to provide geographic
context without a runtime tile service. The original exact Scope named its notice
but omitted this data filename. Work on that file stopped before creation.

## RESOLVED

Coordinator admits `src/http/operator/vendor/ne_110m_land.geojson` and this record
under the existing founder-authorized map integration. This is a routine asset
choice within the stated zero-network goal, not new product intent or spending.
Use Natural Earth's 1:110m land layer with a pinned upstream revision and SHA256;
the independent reference review checked its primary public-domain terms at
https://www.naturalearthdata.com/about/terms-of-use/. Record provenance in the
already scoped MARKET-MAP-NOTICE. Do not add administrative boundaries or any
God's Eye bundled noncommercial data. MapLibre6.9.0 is the single renderer for
Mercator and globe; no second Cesium runtime is needed for this bounded feature.
