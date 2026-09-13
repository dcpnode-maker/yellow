/* RMS-PLACES-001: public catalog discovery only. It intentionally cannot mutate property, rate, inventory, or provider mappings. */
(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const root = $("#market-map-view");
  if (!root) return;

  const ui = {
    canvas: $("#market-map-canvas"), form: $("#market-map-search-form"), query: $("#market-map-query"),
    visible: $("#market-map-visible-search"), radius: $("#market-map-radius"), radiusSearch: $("#market-map-radius-search"), globe: $("#market-map-toggle-globe"),
    status: $("#market-map-status"), release: $("#market-map-release"), count: $("#market-map-count"),
    list: $("#market-map-place-list"), subject: $("#market-map-subject"), compset: $("#market-map-compset"),
    selectionStatus: $("#market-map-selection-status"), export: $("#market-map-export"), property: $("#property-select"),
  };
  let map = null;
  let maplibre = null;
  let mapLoading = null;
  let observed = false;
  let requestGeneration = 0;
  let contextGeneration = 0;
  let queryTimer = 0;
  let placeById = new Map();
  const selectionById = new Map();
  let subjectId = "";
  const competitorIds = new Set();
  let release = "";
  let schemaVersion = "";
  let lastSearchMode = "";
  let lastBounds = null;
  let markers = [];

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function currentProperty() { return ui.property?.value || ""; }
  function active() { return !root.hidden && Boolean(currentProperty()); }
  function status(message, error = false) {
    ui.status.textContent = message;
    ui.status.classList.toggle("error", error);
  }
  function request(path, options) {
    return new Promise((resolve, reject) => {
      const event = new CustomEvent("yellow:operator-request", { detail: { path, options, resolve, reject } });
      if (!window.dispatchEvent(event)) reject(new Error("The signed-in operator request channel is unavailable."));
    });
  }
  function clearMarkers() { for (const marker of markers) marker.remove(); markers = []; }
  function clearSelection(message = "Selection is ready for mapping review.") {
    subjectId = "";
    competitorIds.clear();
    selectionById.clear();
    renderSelection();
    ui.selectionStatus.textContent = message;
  }
  function clearForContext(message) {
    requestGeneration += 1;
    placeById = new Map(); release = ""; schemaVersion = ""; lastSearchMode = ""; lastBounds = null;
    clearMarkers(); clearSelection(message);
    renderPlaces();
    ui.release.textContent = "No catalog release loaded.";
    ui.export.disabled = true;
  }
  function selectedPlace(id) { return selectionById.get(id) || placeById.get(id) || null; }
  function retainSelection(place) { if (place?.id) selectionById.set(place.id, place); }
  function haversineKm(latitudeA, longitudeA, latitudeB, longitudeB) {
    const radians = Math.PI / 180;
    const lat = (latitudeB - latitudeA) * radians;
    const lng = (longitudeB - longitudeA) * radians;
    const value = Math.sin(lat / 2) ** 2 + Math.cos(latitudeA * radians) * Math.cos(latitudeB * radians) * Math.sin(lng / 2) ** 2;
    return 6371.0088 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }
  function statusLabel(place) {
    const value = place.status === "temporarily_closed" ? "temporarily closed" : place.status === "permanently_closed" ? "permanently closed" : place.status || "unknown";
    return `${place.category || "place"} · ${value}`;
  }
  function placeDescription(place) {
    const address = place.address && typeof place.address === "object"
      ? [place.address.freeform, place.address.locality, place.address.region, place.address.postcode, place.address.country].filter(Boolean).join(", ") : "";
    const brand = place.brand && typeof place.brand === "object" ? place.brand.name : place.brand;
    return [brand, address, place.country].filter(Boolean).join(" · ");
  }
  function safeWebsite(place) { return Array.isArray(place.websites) ? place.websites.find((value) => /^https?:\/\//i.test(value)) : ""; }
  function renderPlaces() {
    ui.list.replaceChildren();
    ui.count.textContent = String(placeById.size);
    if (!placeById.size) { ui.list.append(element("p", "market-map-empty", "No places loaded. Search by name, website, domain, or GERS id.")); return; }
    for (const place of placeById.values()) {
      const card = element("article", `market-map-place${place.id === subjectId ? " is-subject" : ""}${competitorIds.has(place.id) ? " is-competitor" : ""}`);
      const top = element("div", "market-map-place__top");
      top.append(element("strong", "", place.name || "Unnamed place"), element("span", "badge", place.confidence == null ? "unscored" : `${Math.round(place.confidence * 100)}%`));
      card.append(top, element("small", "", statusLabel(place)));
      const description = placeDescription(place);
      if (description) card.append(element("small", "", description));
      const sourceSummary = Array.isArray(place.sources) ? place.sources.map((source) => typeof source === "string" ? source : source?.dataset || source?.name || source?.provider).filter(Boolean).join(", ") : "";
      const attributes = element("details", "market-map-place__attributes");
      const summary = element("summary", "", "Inspect public attributes");
      const facts = [
        `ID: ${place.id}`,
        `Coordinates: ${Number(place.latitude).toFixed(5)}, ${Number(place.longitude).toFixed(5)}`,
        sourceSummary ? `Sources: ${sourceSummary}` : "Sources: not supplied",
      ];
      attributes.append(summary, element("small", "", facts.join(" · ")));
      card.append(attributes);
      const actions = element("div", "market-map-place__actions");
      const own = element("button", "quiet", place.id === subjectId ? "Own property" : "Mark own"); own.type = "button";
      own.setAttribute("aria-pressed", String(place.id === subjectId));
      own.addEventListener("click", () => { if (subjectId === place.id) subjectId = ""; else { retainSelection(place); subjectId = place.id; } competitorIds.delete(place.id); renderAll(); });
      const comp = element("button", "quiet", competitorIds.has(place.id) ? "Remove comp" : "Add comp"); comp.type = "button";
      comp.disabled = place.id === subjectId;
      comp.addEventListener("click", () => {
        if (competitorIds.has(place.id)) competitorIds.delete(place.id);
        else if (competitorIds.size < 50 && place.id !== subjectId) { retainSelection(place); competitorIds.add(place.id); }
        else { ui.selectionStatus.textContent = "A research compset is limited to 50 unique candidates."; return; }
        renderAll();
      });
      actions.append(own, comp);
      const website = safeWebsite(place);
      if (website) { const link = element("a", "quiet", "Website"); link.href = website; link.target = "_blank"; link.rel = "noopener noreferrer"; actions.append(link); }
      card.append(actions);
      card.addEventListener("dblclick", () => focusPlace(place));
      ui.list.append(card);
    }
  }
  function renderSelection() {
    const subject = selectedPlace(subjectId);
    ui.subject.textContent = subject ? `${subject.name} is marked as your property.` : "No subject selected.";
    ui.compset.replaceChildren();
    for (const id of competitorIds) {
      const place = selectedPlace(id); if (!place) continue;
      const chip = element("div", "market-map-chip"); chip.append(element("span", "", place.name));
      const remove = element("button", "quiet", "Remove"); remove.type = "button"; remove.addEventListener("click", () => { competitorIds.delete(id); renderAll(); }); chip.append(remove); ui.compset.append(chip);
    }
    if (!competitorIds.size) ui.compset.append(element("p", "market-map-empty", "No comparable candidates selected."));
    ui.export.disabled = !subject || !competitorIds.size;
  }
  function markerRole(place) { return place.id === subjectId ? "subject" : competitorIds.has(place.id) ? "competitor" : "place"; }
  function renderMarkers() {
    if (!map || !maplibre) return;
    clearMarkers();
    for (const place of placeById.values()) {
      if (!Number.isFinite(place.longitude) || !Number.isFinite(place.latitude)) continue;
      const point = element("button", "market-map-marker"); point.type = "button"; point.dataset.role = markerRole(place); point.setAttribute("aria-label", place.name); point.addEventListener("click", () => focusPlace(place));
      markers.push(new maplibre.Marker({ element: point, anchor: "center" }).setLngLat([place.longitude, place.latitude]).addTo(map));
    }
  }
  function renderAll() { renderPlaces(); renderSelection(); renderMarkers(); }
  function focusPlace(place) { if (map && Number.isFinite(place.longitude) && Number.isFinite(place.latitude)) map.flyTo({ center: [place.longitude, place.latitude], zoom: Math.max(map.getZoom(), 13), essential: true }); }
  function boundedBounds(bounds) {
    const west = Math.max(-180, bounds.getWest()), east = Math.min(180, bounds.getEast());
    const south = Math.max(-85, bounds.getSouth()), north = Math.min(85, bounds.getNorth());
    if (east - west > 5 || north - south > 5) return null;
    return { west, south, east, north };
  }
  function centreBounds() {
    if (!map) return null;
    const center = map.getCenter(); const km = Number(ui.radius.value) || 5;
    const latitudeDegrees = km / 110.574; const longitudeDegrees = km / Math.max(1, 111.320 * Math.cos(center.lat * Math.PI / 180));
    return { west: center.lng - longitudeDegrees, east: center.lng + longitudeDegrees, south: center.lat - latitudeDegrees, north: center.lat + latitudeDegrees };
  }
  function radiusFeature() {
    if (!map) return null;
    const center = map.getCenter(); const distance = (Number(ui.radius.value) || 5) / 6371.0088;
    const latitude = center.lat * Math.PI / 180; const longitude = center.lng * Math.PI / 180; const ring = [];
    for (let step = 0; step <= 64; step += 1) {
      const bearing = step * 2 * Math.PI / 64;
      const lat = Math.asin(Math.sin(latitude) * Math.cos(distance) + Math.cos(latitude) * Math.sin(distance) * Math.cos(bearing));
      const lng = longitude + Math.atan2(Math.sin(bearing) * Math.sin(distance) * Math.cos(latitude), Math.cos(distance) - Math.sin(latitude) * Math.sin(lat));
      ring.push([((lng * 180 / Math.PI + 540) % 360) - 180, lat * 180 / Math.PI]);
    }
    return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
  }
  function renderRadius() {
    if (!map || !map.isStyleLoaded()) return;
    const feature = radiusFeature(); if (!feature) return;
    const source = map.getSource("market-map-radius");
    if (source) { source.setData(feature); return; }
    map.addSource("market-map-radius", { type: "geojson", data: feature });
    map.addLayer({ id: "market-map-radius-fill", type: "fill", source: "market-map-radius", paint: { "fill-color": "#27765f", "fill-opacity": 0.10 } });
    map.addLayer({ id: "market-map-radius-line", type: "line", source: "market-map-radius", paint: { "line-color": "#27765f", "line-width": 2 } });
  }
  function queryMode(query) {
    const value = query.trim();
    if (/^https?:\/\//i.test(value)) return ["url", "url"];
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(value)) return ["domain", "domain"];
    const gers = value.match(/^gers\s*[:_-]\s*(.+)$/i);
    if (gers?.[1]) return ["id", "id", gers[1].trim()];
    if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) return ["id", "id", value];
    return ["keyword", "q", value];
  }
  function fitToPlaces(places) {
    if (!map || !places.length) return;
    const points = places.filter((place) => Number.isFinite(place.longitude) && Number.isFinite(place.latitude));
    if (!points.length) return;
    if (points.length === 1) { map.flyTo({ center: [points[0].longitude, points[0].latitude], zoom: 14, essential: true }); return; }
    const bounds = points.reduce((result, place) => result.extend([place.longitude, place.latitude]), new maplibre.LngLatBounds([points[0].longitude, points[0].latitude], [points[0].longitude, points[0].latitude]));
    map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0, essential: true });
  }
  async function search(params, label, radiusFilter = null) {
    const property = currentProperty(); if (!property || !active()) return;
    const generation = ++requestGeneration; const context = contextGeneration;
    const mode = params.mode; const search = new URLSearchParams(params); search.set("limit", "200");
    status(label);
    try {
      const body = await request(`/api/v1/properties/${encodeURIComponent(property)}/market-map/places?${search}`, { method: "GET" });
      if (generation !== requestGeneration || context !== contextGeneration || property !== currentProperty() || !active()) return;
      const received = Array.isArray(body?.places) ? body.places : [];
      const places = radiusFilter
        ? received.filter((place) => Number.isFinite(place?.latitude) && Number.isFinite(place?.longitude) && haversineKm(radiusFilter.latitude, radiusFilter.longitude, place.latitude, place.longitude) <= radiusFilter.km)
        : received;
      placeById = new Map(places.filter((place) => place && typeof place.id === "string").map((place) => [place.id, place]));
      for (const place of places) if (selectionById.has(place.id)) selectionById.set(place.id, place);
      release = typeof body?.release === "string" ? body.release : ""; schemaVersion = typeof body?.schemaVersion === "string" ? body.schemaVersion : ""; lastSearchMode = mode;
      ui.release.textContent = release ? `Catalog release ${release}${schemaVersion ? ` · ${schemaVersion}` : ""}${body.truncated ? " · results truncated; refine the search" : ""}` : "Catalog response did not identify a release.";
      const bounded = radiusFilter ? ` ${places.length} of ${received.length} returned records are within the ${radiusFilter.km} km geodesic radius.` : "";
      status(places.length ? `${places.length} public place record${places.length === 1 ? "" : "s"} loaded.${bounded} Select a subject and comparable candidates.${body.truncated ? " Catalog results were truncated; refine the search." : ""}` : radiusFilter ? `No returned catalog records are within the ${radiusFilter.km} km geodesic radius.${body.truncated ? " The catalog result set was truncated; refine the search." : ""}` : "No public place records match this bounded search.");
      renderAll();
      if (mode !== "bbox") fitToPlaces(places);
    } catch (error) {
      if (generation !== requestGeneration || context !== contextGeneration || property !== currentProperty() || !active()) return;
      status(error instanceof Error ? error.message : "Market catalog could not be searched.", true);
    }
  }
  function loadRuntimeCss() {
    if (document.querySelector('link[href="/assets/vendor/maplibre-gl-6.9.0/maplibre-gl.css"]')) return;
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "/assets/vendor/maplibre-gl-6.9.0/maplibre-gl.css"; document.head.append(link);
  }
  async function loadMap() {
    if (map || mapLoading || !active()) return mapLoading;
    mapLoading = (async () => {
      try {
        loadRuntimeCss();
        maplibre = await import("/assets/vendor/maplibre-gl-6.9.0/maplibre-gl.mjs");
        if (typeof maplibre.setWorkerUrl === "function") maplibre.setWorkerUrl("/assets/vendor/maplibre-gl-6.9.0/maplibre-gl-worker.mjs");
        const land = await fetch("/assets/vendor/ne_110m_land.geojson", { credentials: "same-origin" }).then((response) => response.ok ? response.json() : null).catch(() => null);
        if (!active()) return;
        const sources = land ? { land: { type: "geojson", data: land } } : {};
        const layers = [{ id: "background", type: "background", paint: { "background-color": "#e9eef0" } }];
        if (land) layers.push({ id: "land", type: "fill", source: "land", paint: { "fill-color": "#d5dfcf", "fill-opacity": 0.9 } });
        map = new maplibre.Map({ container: ui.canvas, style: { version: 8, sources, layers }, center: [0, 20], zoom: 1.4, attributionControl: false, maxBounds: [[-180, -85], [180, 85]] });
        map.addControl(new maplibre.NavigationControl({ showCompass: true }), "top-right");
        map.on("load", () => { ui.visible.disabled = false; ui.radiusSearch.disabled = false; if (typeof map.setProjection === "function") { ui.globe.hidden = false; } renderMarkers(); renderRadius(); if (lastSearchMode !== "bbox") fitToPlaces([...placeById.values()]); });
        map.on("moveend", () => { lastBounds = boundedBounds(map.getBounds()); renderRadius(); });
      } catch (error) {
        ui.canvas.replaceChildren(element("p", "", "Map rendering is unavailable in this browser. Use the accessible result list to search and select places."));
        status("Map runtime unavailable; the catalog list and research selection remain available.");
      } finally { mapLoading = null; }
    })();
    return mapLoading;
  }
  async function exportSelection() {
    const property = currentProperty(); const context = contextGeneration; const selectedSubjectId = subjectId; const selectedCompetitorIds = [...competitorIds];
    const subject = selectedPlace(selectedSubjectId); const competitors = selectedCompetitorIds.map(selectedPlace).filter(Boolean);
    if (!property || !subject || !competitors.length) return;
    try {
      const body = await request(`/api/v1/properties/${encodeURIComponent(property)}/market-map/selection`, { method: "POST", body: JSON.stringify({ subjectId: selectedSubjectId, competitorIds: selectedCompetitorIds }) });
      if (context !== contextGeneration || property !== currentProperty() || selectedSubjectId !== subjectId || selectedCompetitorIds.join("|") !== [...competitorIds].join("|") || !active()) return;
      const payload = { ...body, downloadedAt: new Date().toISOString(), notice: "Research selection only. This export does not create a provider mapping or operational write." };
      const href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      const link = element("a"); link.href = href; link.download = `yellow-market-map-research-${property}.json`; link.click(); URL.revokeObjectURL(href);
      ui.selectionStatus.textContent = "Research selection downloaded. It still requires provider mapping review before any operational use.";
    } catch (error) {
      if (context !== contextGeneration || property !== currentProperty() || !active()) return;
      ui.selectionStatus.textContent = error instanceof Error ? error.message : "Selection could not be prepared for download.";
    }
  }
  function scheduleSearch() {
    window.clearTimeout(queryTimer); const value = ui.query.value.trim();
    if (value.length < 2) return;
    queryTimer = window.setTimeout(() => { const [mode, key, normalized] = queryMode(value); void search({ mode, [key]: normalized }, "Searching public place catalog…"); }, 420);
  }
  ui.form.addEventListener("submit", (event) => { event.preventDefault(); window.clearTimeout(queryTimer); const value = ui.query.value.trim(); if (value.length < 2) { status("Enter at least two characters to search the public catalog.", true); return; } const [mode, key, normalized] = queryMode(value); void search({ mode, [key]: normalized }, "Searching public place catalog…"); });
  ui.query.addEventListener("input", scheduleSearch);
  ui.visible.addEventListener("click", () => { const bounds = boundedBounds(map?.getBounds()); if (!bounds) { status("Zoom closer: visible-area searches are limited to a 5° span.", true); return; } lastBounds = bounds; void search({ mode: "bbox", ...Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, String(value)])) }, "Searching the visible area…"); });
  ui.radius.addEventListener("change", renderRadius);
  ui.radiusSearch.addEventListener("click", () => { const bounds = centreBounds(); const center = map?.getCenter(); const km = Number(ui.radius.value) || 5; if (!bounds || !center) return; void search({ mode: "bbox", ...Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, String(value)])) }, "Searching the selected radius…", { latitude: center.lat, longitude: center.lng, km }); });
  ui.globe.addEventListener("click", () => { if (!map || typeof map.setProjection !== "function") return; const globe = ui.globe.getAttribute("aria-pressed") !== "true"; map.setProjection({ type: globe ? "globe" : "mercator" }); ui.globe.setAttribute("aria-pressed", String(globe)); ui.globe.textContent = globe ? "Flat map" : "Globe view"; });
  ui.export.addEventListener("click", () => void exportSelection());
  ui.property?.addEventListener("change", () => { contextGeneration += 1; clearForContext("Property changed. Market-map selections were cleared before any new catalog request."); });
  window.addEventListener("yellow:operator-signed-out", () => { contextGeneration += 1; clearForContext("Signed out. Market-map selections were cleared."); });
  const observer = new MutationObserver(() => { if (active() && !observed) { observed = true; void loadMap(); } if (!active()) observed = false; });
  observer.observe(root, { attributes: true, attributeFilter: ["hidden"] });
  queueMicrotask(() => { if (active()) { observed = true; void loadMap(); } });
})();
