# Native God's Eye + Yellow listings

Founder direction, 24 September: native God's Eye/Cesium should be Yellow's map,
not a renamed disconnected Overture/MapLibre page. It should show hotels, BnBs and
vendors as selectable listings, with user-invoked GPS and nearby discovery.

Verified boundary: original native application runs separately on laptop4173;
public Yellow now includes the curated native688 globe and679 Overture. Neither exposes a Yellow-published
listing catalog. Existing CRM vendor identity is not vendor registration/catalog
or a customer-facing listing. No guest positions or private hotel records may be
automatically published to fill that gap.

24 September later update: founder approved exact package/version licence
exceptions under688. Curated native globe/GPS integration is now deployed on the
existing app after independent review and public desktop/mobile checks. See
receipt688-native-map-live.md; historical685 staged receipt is superseded for
current deployment status. Default builds still exclude the engine unless explicitly
enabled. Listings remain unimplemented; Overture and Reservations are retained.

Implementation sequence under Order685 (file-level scope to be admitted first):
1. Lazy native Cesium explorer, minimal MIT-code reuse, explicit asset/provider
   allowlist and visible attribution. Exclude upstream noncommercial TeleGeography,
   Google News feeds and unlicensed third-party models. No wholesale asset clone.
2. Explicit published-listing read contract: only consented/public Yellow property
   coordinates and cards, separated from reference Overture points. Tenant-owned
   publishing controls and isolation proof precede any public data feed.
3. `Locate me` requests location permission only after a user action; center locally,
   no stored position/history. Denial/offline/manual search fallbacks; optional
   foreground follow mode with clear off switch. Narrow existing geolocation
   Permissions-Policy from none to self only for the authorized surface.
4. Nearby filters/details and an explicit directions handoff. Native turn-by-turn
   needs a separately verified routing service; no simulated live traffic claim.
5. Vendor registration/catalogs remain deferred by founder, not fabricated markers.

No paid keys, public provider subscriptions, routing bill or blanket commercial
asset reuse is authorized by this plan. Reservations remain usable independently
of map downloads. Full Google Maps feature parity and universal50ms map loading
are not promised.
