# Global Overture map — Order 679

## What this provides

A lazily loaded map workspace in the existing Yellow application, using the
publisher's pinned **2026-09-23.0** PMTiles inspection projection. It has global
geographic scope, independent Places/boundary layer controls, an All/Lodging view,
coordinate navigation and inspected place details. Places appear from zoom 14.
The visible result list is capped at 200, not a complete count for the area.

Overture is geographic reference data, not hotel operational truth. The published
catalog has Places, Addresses, Buildings, Transportation, Divisions and Base
themes. This increment uses **Places and Divisions only**, not all six themes.
Fields vary in completeness. GERS identity, names, taxonomy, address, coordinates,
existence confidence, website and provenance can support property matching and
discovery of potential competitors/demand generators. They do not establish
verified competitor membership, room prices, availability, occupancy, sales or
guest records. Those require distinct authorized sources.

## Source and resource boundary

- Publisher origin: `https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/2026-09-23.0/`.
- Places object: 18,392,360,113 bytes; ETag `f5662b4fba7d9e30b44e9a6721b52b2d-69`.
- Divisions object: 19,929,576,927 bytes; ETag `38f1239639fdb952d5eed3aea789e14b-75`.
- **Neither object is downloaded to a laptop drive.** The application retrieves
  only bounded ranges needed for visible map tiles. Browser-managed HTTP caching
  may occur; this is not a bulk dataset mirror.
- Existing app route accepts only the two fixed files/release, single closed byte
  ranges up to 8 MiB, exact 206 ranges/length/ETag. No arbitrary URL or credential
  forwarding. Four upstream reads, 32 body-free queued requests, 30-second request
  deadline and 16 MiB/5-minute in-memory LRU. No persistent tile cache or new server.
- Map worker is bundled locally; strict self-only CSP remains intact. Map code is
  lazy-loaded, so normal reservation screens do not eagerly load the map engine.
- Publisher inspection files have limited retention (observed expiry around
  2026-11-23). This is **not a durable production tile-service SLA**. A controlled,
  cloud-side serving pipeline and release-update process remain follow-on work.

## What is not activated

The retained August 19 global Places archive on Google Drive remains untouched.
This UI is **not querying that archive or Yellow's PostgreSQL database**. No
automatic global mirror, scheduler, raw archive query service, or geography-based
client entitlement enforcement is implied. Public publisher URLs cannot enforce
client geography restrictions; controlled serving and server-side grants are
required before selling such restrictions. No database migration or hotel-record
write is part of this order.

## Measurements

Displayed time is measured from map initialization or viewport movement to the
MapLibre idle event (tiles settled); it includes camera movement and rendering,
not just a database query. Failed tiles retain a visible error and do not produce
a success latency. Record individual observations, not a universal SLA.

Pre-promotion isolated browser observations on 2026-09-24: world 7,293 ms; first
Riyadh 3,093 ms; London 7,414 ms; return Riyadh 2,259 ms. Independent reviewer
observed Sydney 4,746 ms. These runs have different browser/server cache histories,
so they are not a controlled cold-versus-warm benchmark. A separate raw 936,512-byte
tile request took about 15,084 ms. **50 ms has not been achieved here.** Exact live
image and final live observations belong in the Order 679 receipt.

## Optional hotel-local acceleration — proposal only

One managed hotel server can cache property-scoped reads and bounded regional map
data for its LAN, with remote backups, signed updates, UPS and recovery procedures.
An adaptive cache is preferable to mandatory 50 GB/1 TB allocations per device.
Browser quotas/eviction cannot guarantee that capacity. PostgreSQL remains the
authority for sellability, money and accepted writes; an offline edge design needs
explicit ownership/conflict rules before accepting transactions. No hotel-server
deployment or offline transaction support is implemented by this map increment.

## Primary references

- [Overture catalog and access](https://docs.overturemaps.org/getting-data/cloud-sources/)
- [Places fields, taxonomy and limitations](https://docs.overturemaps.org/guides/places/)
- [Attribution and licensing](https://docs.overturemaps.org/attribution/)
- [PMTiles integration](https://docs.protomaps.com/pmtiles/maplibre)
- [Browser storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
