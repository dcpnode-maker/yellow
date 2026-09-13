export const MARKET_MAP_LIMITS = Object.freeze({ points: 500, id: 80, name: 500, mercatorLatitude: 85.05112878 });
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u;
const ROLES = new Set(["candidate", "own", "comparator"]);
const exact = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value)
 && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const boundedText = (value, max) => typeof value === "string" && value.length <= max * 2
 && value.length > 0 && Array.from(value).length <= max && value.trim().length > 0 && value.isWellFormed()
 && !/[\u0000-\u001f\u007f]/u.test(value);

/** Copy the complete bounded message before accepting any revision or rendering. */
export function tryParseMarketMapData(value) {
 try {
  if (!exact(value, ["type", "version", "nonce", "revision", "points"]) || value.type !== "yellow-market-map-data"
   || value.version !== 1 || typeof value.nonce !== "string" || !UUID.test(value.nonce)
   || !Number.isSafeInteger(value.revision) || value.revision < 1 || !Array.isArray(value.points)
   || value.points.length > MARKET_MAP_LIMITS.points) return null;
  const ids = new Set(), points = [];
  for (const point of value.points) {
   if (!exact(point, ["id", "name", "latitude", "longitude", "role"])
    || !boundedText(point.id, MARKET_MAP_LIMITS.id) || !boundedText(point.name, MARKET_MAP_LIMITS.name)
    || typeof point.latitude !== "number" || !Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90
    || typeof point.longitude !== "number" || !Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180
    || !ROLES.has(point.role) || ids.has(point.id)) return null;
   ids.add(point.id);
   points.push(Object.freeze({ id: point.id, name: point.name, latitude: point.latitude, longitude: point.longitude, role: point.role }));
  }
  return Object.freeze({ type: "yellow-market-map-data", version: 1, nonce: value.nonce, revision: value.revision, points: Object.freeze(points) });
 } catch { return null; }
}

export function partitionMarketMapPoints(points) {
 const visible = points.filter(point => Math.abs(point.latitude) <= MARKET_MAP_LIMITS.mercatorLatitude);
 return Object.freeze({ visible: Object.freeze(visible), omitted: points.length - visible.length });
}

/** Pure protocol state. Rejected messages cannot consume a nonce or a revision. */
export function createMarketMapChannel(origin, parent) {
 let accepted = null, closed = false;
 return Object.freeze({
  accept(event) {
   if (closed || event.origin !== origin || event.source !== parent) return null;
   const next = tryParseMarketMapData(event.data);
   if (!next || (accepted && (next.nonce !== accepted.nonce || next.revision <= accepted.revision))) return null;
   accepted = next;
   return next;
  },
  inspect(id, expectedRevision) {
   if (closed || !accepted || accepted.revision !== expectedRevision
    || !accepted.points.some(point => point.id === id && Math.abs(point.latitude) <= MARKET_MAP_LIMITS.mercatorLatitude)) return null;
   return Object.freeze({ type: "yellow-market-map-inspect", version: 1, nonce: accepted.nonce, revision: accepted.revision, id });
  },
  close() { closed = true; accepted = null; },
 });
}

/** No network or document access occurs when this module is imported for pure tests. */
export function mountMarketMapFrame(view, doc, leaflet) {
 const status = doc.getElementById("map-status"), omitted = doc.getElementById("map-omitted");
 const canvas = doc.getElementById("source-map"), fit = doc.getElementById("fit-records");
 if (!status || !omitted || !canvas || !fit) return null;
 if (view.parent === view || !leaflet || leaflet.version !== "1.9.4") {
  status.textContent = "Street map is unavailable. Use the complete evidence table in Yellow.";
  return null;
 }
 const channel = createMarketMapChannel(view.location.origin, view.parent);
 let disposed = false, map = null, layer = null, tiles = null, visible = [], firstFit = false, tileFailed = false;
 const send = message => { if (!disposed && !doc.hidden) view.parent.postMessage(message, view.location.origin); };
 const inspect = (id, revision) => { const message = channel.inspect(id, revision); if (message) send(message); };
 const boundsForRecords = () => {
  const latitudes = visible.map(point => point.latitude), longitudes = visible.map(point => point.longitude);
  const south = Math.min(...latitudes), north = Math.max(...latitudes), west = Math.min(...longitudes), east = Math.max(...longitudes);
  const latitudePad = Math.max((north - south) * .2, .002), longitudePad = Math.max((east - west) * .2, .002);
  return leaflet.latLngBounds([
   [Math.max(-MARKET_MAP_LIMITS.mercatorLatitude, south - latitudePad), Math.max(-180, west - longitudePad)],
   [Math.min(MARKET_MAP_LIMITS.mercatorLatitude, north + latitudePad), Math.min(180, east + longitudePad)],
  ]);
 };
 const fitRecords = () => {
  if (disposed || doc.hidden || !map || visible.length === 0) return;
  const bounds = boundsForRecords();
  map.setMinZoom(2);
  map.setMaxBounds(bounds);
  map.fitBounds(bounds, { animate: false, padding: [12, 12], maxZoom: 18 });
  map.setMinZoom(Math.max(2, Math.min(18, map.getBoundsZoom(bounds) - 2)));
  if (tiles) { tiles.options.bounds = bounds; tiles.redraw(); }
 };
 const report = () => {
  if (disposed) return;
  status.textContent = visible.length === 0 ? "No source points can be displayed. Use the complete evidence table."
   : tileFailed ? "Some street tiles are unavailable or offline. Source points remain inspectable; the complete evidence table is unchanged."
   : "Source points are inspectable. Street tiles are best-effort; their presence does not verify source records.";
 };
 const stop = () => {
  if (disposed) return;
  disposed = true; channel.close();
  view.removeEventListener("message", receive);
  view.removeEventListener("pagehide", stop);
  doc.removeEventListener("visibilitychange", visibility);
  fit.removeEventListener("click", fitRecords);
  canvas.removeEventListener("keydown", navigate);
  canvas.removeAttribute("tabindex");
  fit.disabled = true;
  if (map) map.remove();
  map = layer = tiles = null; visible = [];
  canvas.replaceChildren();
  status.textContent = "Map stopped. Disable and enable it again to view streets; the evidence table remains available.";
 };
 const visibility = () => { if (doc.hidden) stop(); };
 const navigate = event => {
  if (disposed || doc.hidden || !map || visible.length === 0 || event.target !== canvas
   || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  let offset = null, zoomDelta = 0;
  switch (event.key) {
   case "ArrowLeft": offset = [-80, 0]; break;
   case "ArrowRight": offset = [80, 0]; break;
   case "ArrowUp": offset = [0, -80]; break;
   case "ArrowDown": offset = [0, 80]; break;
   case "+": case "=": zoomDelta = 1; break;
   case "-": case "_": zoomDelta = -1; break;
   default: return;
  }
  event.preventDefault(); event.stopPropagation();
  const multiplier = event.shiftKey ? 3 : 1, zoom = map.getZoom();
  if (offset) {
   const target = map.unproject(map.project(map.getCenter(), zoom).add([offset[0] * multiplier, offset[1] * multiplier]), zoom);
   // Public panTo clamps via setView before movement. panBy-then-clamp can start a bounds-bounce animation.
   map.panTo(target, { animate: false });
  } else map.setView(map.getCenter(), zoom + zoomDelta * multiplier, { animate: false });
 };
 const receive = event => {
  if (disposed || doc.hidden) return;
  const data = channel.accept(event);
  if (!data) return;
  const partition = partitionMarketMapPoints(data.points);
  visible = partition.visible;
  omitted.textContent = `${visible.length} of ${data.points.length} source points displayed. ${partition.omitted} omitted outside the street map projection (latitude ±85.05112878°); all records remain in the complete evidence table.`;
  fit.disabled = visible.length === 0;
  try {
   if (layer) layer.clearLayers();
   if (visible.length === 0) {
    if (tiles && map.hasLayer(tiles)) map.removeLayer(tiles);
    report(); return;
   }
   if (!map) {
    // Leaflet 1.9.4's default keyboard pan is animated independently of zoomAnimation.
    // Own only this canvas's arrow/zoom handler; do not patch the library or use private map state.
    map = leaflet.map(canvas, { keyboard: false, zoomControl: true, attributionControl: false, minZoom: 2, maxZoom: 19,
     zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, inertia: false, maxBoundsViscosity: 1 });
    canvas.setAttribute("tabindex", "0");
    leaflet.control.attribution({ prefix: false }).addTo(map);
    layer = leaflet.layerGroup().addTo(map);
   }
   // Leaflet must have a view before paths exist, so accessible marker elements are available below.
   if (!firstFit) { fitRecords(); firstFit = true; }
   for (const point of visible) {
    const color = point.role === "own" ? "#a94717" : point.role === "comparator" ? "#416d28" : "#286d9e";
    const marker = leaflet.circleMarker([point.latitude, point.longitude], { radius: point.role === "own" ? 9 : 7,
     color: "#ffffff", weight: 2, fillColor: color, fillOpacity: .95, className: `market-point market-point--${point.role}` }).addTo(layer);
    marker.on("click", () => inspect(point.id, data.revision));
    const node = marker.getElement();
    if (node) {
     node.setAttribute("tabindex", "0"); node.setAttribute("role", "button");
     node.setAttribute("aria-label", `Inspect ${point.name}. ${point.role}. This does not select a property or comparator.`);
     node.dataset.pointId = point.id;
     node.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); inspect(point.id, data.revision); }
     });
    }
   }
   if (!tiles) {
    // OSM public raster policy: current human viewport only, browser cache, no proxy/geocoder/prefetch.
    tiles = leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, noWrap: true,
     bounds: boundsForRecords(), detectRetina: false, updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 0,
     referrerPolicy: "strict-origin-when-cross-origin",
     attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>' });
    tiles.on("tileerror", () => { if (!disposed) { tileFailed = true; report(); } });
   }
   if (!map.hasLayer(tiles)) tiles.addTo(map);
   report();
  } catch {
   stop();
   status.textContent = "Street map is unavailable. Use the complete evidence table; no selection was changed.";
  }
 };
 view.addEventListener("message", receive);
 view.addEventListener("pagehide", stop);
 doc.addEventListener("visibilitychange", visibility);
 fit.addEventListener("click", fitRecords);
 canvas.addEventListener("keydown", navigate);
 if (doc.hidden) stop();
 else send(Object.freeze({ type: "yellow-market-map-ready", version: 1 }));
 return Object.freeze({ dispose: stop });
}

if (typeof window !== "undefined" && typeof document !== "undefined") mountMarketMapFrame(window, document, window.L);
