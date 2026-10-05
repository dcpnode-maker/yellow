import { useEffect, useRef, useState } from "react";
import { Map, Marker, addProtocol, removeProtocol, setWorkerCount, setWorkerUrl } from "maplibre-gl";
import { Protocol } from "pmtiles";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import "./overture-map.css";
import { boundedVisiblePlaces, matchesOvertureView, OVERTURE_AREAS, OVERTURE_RELEASE, overtureArchiveUrl, parseCoordinate, PLACES_MIN_ZOOM, VISIBLE_PLACE_LIMIT, type OverturePlace, type OvertureView } from "../overture-map";

type ViewState = "loading" | "overview" | "places" | "error";

export default function OvertureMapWorkspace() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const measurementStart = useRef(0);
  const measurementPending = useRef(false);
  const failed = useRef(false);
  const viewRef = useRef<OvertureView>("all");
  const placesOnRef = useRef(true);
  const boundariesOnRef = useRef(true);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<OvertureView>("all");
  const [placesOn, setPlacesOn] = useState(true);
  const [boundariesOn, setBoundariesOn] = useState(true);
  const [state, setState] = useState<ViewState>("loading");
  const [error, setError] = useState("");
  const [places, setPlaces] = useState<readonly OverturePlace[]>([]);
  const [selected, setSelected] = useState<OverturePlace | null>(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [inputError, setInputError] = useState("");
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    if (!container.current) return;
    let alive = true;
    let map: Map | null = null;
    const protocol = new Protocol({ metadata: false });
    measurementStart.current = performance.now();
    measurementPending.current = true;
    failed.current = false;
    setState("loading");
    setError("");
    setPlaces([]);
    setSelected(null);
    try {
      setWorkerUrl(mapWorkerUrl);
      setWorkerCount(2);
      addProtocol("pmtiles", protocol.tile);
      const placesUrl = overtureArchiveUrl(window.location.origin, "places");
      const divisionsUrl = overtureArchiveUrl(window.location.origin, "divisions");
      map = new Map({
        container: container.current,
        center: [0, 18], zoom: 2, minZoom: 1, maxZoom: 19,
        renderWorldCopies: false,
        maxTileCacheSize: 32,
        attributionControl: {},
        style: {
          version: 8,
          projection: { type: "mercator" },
          sources: {
            divisions: { type: "vector", url: `pmtiles://${divisionsUrl}`, minzoom: 0, maxzoom: 12, attribution: '<a href="https://docs.overturemaps.org/attribution/">© Overture Maps contributors</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>' },
            places: { type: "vector", url: `pmtiles://${placesUrl}`, minzoom: 14, maxzoom: 14, attribution: '<a href="https://docs.overturemaps.org/attribution/">© Overture Maps contributors</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>' },
          },
          layers: [
            { id: "ocean", type: "background", paint: { "background-color": "#dce9ef" } },
            { id: "land", type: "fill", source: "divisions", "source-layer": "division_area", filter: ["==", ["get", "is_land"], true], paint: { "fill-color": "#e9eee9", "fill-opacity": 0.95 } },
            { id: "boundaries", type: "line", source: "divisions", "source-layer": "division_boundary", paint: { "line-color": "#94a7ad", "line-width": 0.8 } },
            { id: "places", type: "circle", source: "places", "source-layer": "place", minzoom: PLACES_MIN_ZOOM, paint: { "circle-color": "#26645e", "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 3, 18, 7], "circle-stroke-color": "#fff", "circle-stroke-width": 1.2, "circle-opacity": 0.84 } },
          ],
        },
      });
      mapRef.current = map;
      const current = map;
      const refreshPlaces = () => {
        if (!alive || failed.current || current.getZoom() < PLACES_MIN_ZOOM) return;
        if (!placesOnRef.current) { setPlaces([]); setState("overview"); return; }
        const features = current.queryRenderedFeatures({ layers: ["places"] });
        const visible = boundedVisiblePlaces(features).filter(place => matchesOvertureView(place, viewRef.current));
        setPlaces(visible);
        setState("places");
      };
      const inspect = () => {
        if (!alive || failed.current || !measurementPending.current) return;
        measurementPending.current = false;
        setElapsed(Math.round(performance.now() - measurementStart.current));
        if (current.getZoom() < PLACES_MIN_ZOOM) {
          setPlaces([]);
          setState("overview");
          return;
        }
        refreshPlaces();
      };
      current.on("load", () => {
        if (!alive) return;
        if (viewRef.current === "lodging") current.setFilter("places", ["in", '"hierarchy":["lodging"', ["coalesce", ["get", "taxonomy"], ""]]);
        if (!placesOnRef.current) current.setLayoutProperty("places", "visibility", "none");
        if (!boundariesOnRef.current) {
          current.setLayoutProperty("land", "visibility", "none");
          current.setLayoutProperty("boundaries", "visibility", "none");
        }
      });
      current.on("movestart", () => {
        if (failed.current || !alive) return;
        measurementStart.current = performance.now();
        measurementPending.current = true;
        setElapsed(null);
        setSelected(null);
        setPlaces([]);
        setState("loading");
      });
      current.on("idle", inspect);
      current.on("click", "places", event => {
        const item = boundedVisiblePlaces(event.features ?? [])[0];
        if (item && alive) setSelected(item);
      });
      current.on("error", event => {
        if (!alive) return;
        failed.current = true;
        measurementPending.current = false;
        const message = event.error instanceof Error ? event.error.message : "Map tiles could not be loaded.";
        setError(message);
        setState("error");
        setPlaces([]);
        setSelected(null);
        setElapsed(null);
      });
    } catch (cause) {
      if (alive) {
        failed.current = true;
        measurementPending.current = false;
        setError(cause instanceof Error ? cause.message : "The map could not start.");
        setState("error");
      }
    }
    return () => {
      alive = false;
      mapRef.current = null;
      map?.remove();
      removeProtocol("pmtiles");
    };
  }, [attempt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!selected || !map || failed.current) return;
    const label = document.createElement("span");
    label.className = "overture-selected-label";
    label.textContent = selected.name;
    const marker = new Marker({ element: label, anchor: "bottom", offset: [0, -10] }).setLngLat([selected.longitude, selected.latitude]).addTo(map);
    return () => { marker.remove(); };
  }, [selected]);

  const changeView = (next: OvertureView) => {
    if (viewRef.current === next) return;
    viewRef.current = next;
    setView(next);
    setSelected(null);
    setPlaces([]);
    const map = mapRef.current;
    if (!map || failed.current || !map.getLayer("places")) return;
    map.setFilter("places", next === "lodging" ? ["in", '"hierarchy":["lodging"', ["coalesce", ["get", "taxonomy"], ""]] : null);
    if (placesOnRef.current && map.getZoom() >= PLACES_MIN_ZOOM) {
      setState("loading");
      map.once("idle", () => {
        if (!failed.current && mapRef.current === map) {
          setPlaces(boundedVisiblePlaces(map.queryRenderedFeatures({ layers: ["places"] })).filter(place => matchesOvertureView(place, viewRef.current)));
          setState("places");
        }
      });
    }
  };

  const togglePlaces = () => {
    const next = !placesOnRef.current;
    placesOnRef.current = next;
    setPlacesOn(next);
    setSelected(null);
    setPlaces([]);
    const map = mapRef.current;
    if (!map || failed.current || !map.getLayer("places")) return;
    map.setLayoutProperty("places", "visibility", next ? "visible" : "none");
    if (next && map.getZoom() >= PLACES_MIN_ZOOM) {
      setState("loading");
      map.once("idle", () => {
        if (!failed.current && mapRef.current === map && placesOnRef.current) {
          setPlaces(boundedVisiblePlaces(map.queryRenderedFeatures({ layers: ["places"] })).filter(place => matchesOvertureView(place, viewRef.current)));
          setState("places");
        }
      });
    } else if (!next) setState("overview");
  };

  const toggleBoundaries = () => {
    const next = !boundariesOnRef.current;
    boundariesOnRef.current = next;
    setBoundariesOn(next);
    const map = mapRef.current;
    if (!map || failed.current || !map.getLayer("land")) return;
    map.setLayoutProperty("land", "visibility", next ? "visible" : "none");
    map.setLayoutProperty("boundaries", "visibility", next ? "visible" : "none");
  };

  const goTo = (lon: number, lat: number) => {
    if (failed.current || !mapRef.current) return;
    setInputError("");
    const center = mapRef.current.getCenter();
    if (Math.abs(center.lng - lon) < 1e-7 && Math.abs(center.lat - lat) < 1e-7 && Math.abs(mapRef.current.getZoom() - 14.5) < 1e-7) return;
    setSelected(null);
    setPlaces([]);
    setElapsed(null);
    setState("loading");
    mapRef.current.jumpTo({ center: [lon, lat], zoom: 14.5 });
  };
  const submitCoordinates = (event: React.FormEvent) => {
    event.preventDefault();
    const point = parseCoordinate(longitude, latitude);
    if (!point) { setInputError("Enter a longitude from −180 to 180 and latitude from −85.05 to 85.05."); return; }
    goTo(point[0], point[1]);
  };

  return <section className="overture-workspace" aria-labelledby="overture-heading">
    <header className="overture-head"><div><span className="eyebrow">Global map · public publisher snapshot</span><h1 id="overture-heading">Overture Places</h1><p>Explore the public release {OVERTURE_RELEASE}. The map streams bounded vector tiles; it is not Yellow’s complete raw archive or a live rates feed.</p></div><span className="overture-release">Release {OVERTURE_RELEASE}</span></header>
    <div className="overture-explore"><div className="overture-view-choice" role="group" aria-label="Place category view"><button type="button" aria-pressed={view === "all"} onClick={() => changeView("all")}>All places</button><button type="button" aria-pressed={view === "lodging"} onClick={() => changeView("lodging")}>Lodging</button><small>Lodging follows the published taxonomy hierarchy, including hotels; neither view is a complete area count.</small></div><div className="overture-layer-choice" role="group" aria-label="Map layers"><span>Layers</span><button type="button" aria-pressed={placesOn} onClick={togglePlaces}>Places {placesOn ? "on" : "off"}</button><button type="button" aria-pressed={boundariesOn} onClick={toggleBoundaries}>Boundaries {boundariesOn ? "on" : "off"}</button></div><div className="overture-area-buttons" aria-label="Explore an area">{OVERTURE_AREAS.map(area => <button key={area.label} type="button" onClick={() => goTo(area.longitude, area.latitude)}>{area.label}</button>)}</div><form onSubmit={submitCoordinates}><label>Latitude <input inputMode="decimal" value={latitude} onChange={event => setLatitude(event.target.value)} placeholder="-85.05 to 85.05" /></label><label>Longitude <input inputMode="decimal" value={longitude} onChange={event => setLongitude(event.target.value)} placeholder="-180 to 180" /></label><button type="submit">Go to coordinates</button></form>{inputError ? <p role="alert">{inputError}</p> : null}</div>
    <div className="overture-layout"><div className="overture-map-frame"><div ref={container} className="overture-map-canvas" aria-label="Interactive global Overture map" /><div className="overture-zoom" role="group" aria-label="Map zoom"><button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomTo(Math.min(19, mapRef.current.getZoom() + 1), { duration: 0 })}>+</button><button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomTo(Math.max(1, mapRef.current.getZoom() - 1), { duration: 0 })}>−</button></div>{state === "loading" ? <div className="overture-map-status" role="status">Loading publisher map tiles…</div> : null}{state === "error" ? <div className="overture-map-status is-error" role="alert"><strong>Map unavailable</strong><span>{error}</span><button type="button" onClick={() => setAttempt(value => value + 1)}>Retry map</button></div> : null}</div><aside className="overture-inspector" aria-label="Visible places and details"><h2>{selected ? selected.name : "Visible places"}</h2>{selected ? <><dl><dt>GERS ID</dt><dd>{selected.id}</dd><dt>Category</dt><dd>{selected.category ?? "Not recorded"}</dd><dt>Status</dt><dd>{selected.status ?? "Unknown"}</dd><dt>Address</dt><dd>{selected.address ?? "Not recorded"}</dd><dt>Confidence</dt><dd>{selected.confidence === null ? "Not recorded" : `${Math.round(selected.confidence * 100)}%`}</dd><dt>Coordinates</dt><dd>{selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}</dd></dl>{selected.websites.length ? <div><h3>Website</h3>{selected.websites.map(url => <a key={url} href={url} rel="noopener noreferrer" target="_blank">{url}</a>)}</div> : null}{selected.sources.length ? <div><h3>Source records</h3>{selected.sources.map((source, index) => <p key={`${index}-${source}`}>{source}</p>)}</div> : null}<button type="button" onClick={() => setSelected(null)}>Back to visible places</button></> : <>{!placesOn ? <p>Places layer is off. Turn it on to inspect loaded place features; no absence is inferred.</p> : state === "overview" ? <p>World and division overview. Zoom to level 14 or choose an area to load Places; no place count is inferred at this zoom.</p> : state === "places" ? <><p>Loaded visible {view === "lodging" ? "lodging" : "places"} only: {places.length}{places.length === VISIBLE_PLACE_LIMIT ? ` (display capped at ${VISIBLE_PLACE_LIMIT})` : ""}. This is not a total for the area.</p><div className="overture-place-list">{places.map(place => <button type="button" key={place.id} onClick={() => setSelected(place)}><strong>{place.name}</strong><span>{place.category ?? "Category unknown"}</span></button>)}</div>{!places.length ? <p>No {view === "lodging" ? "lodging" : "place"} features returned in this loaded viewport. This does not establish absence from the source archive.</p> : null}</> : <p>Place results are unavailable while tiles load.</p>}</>}</aside></div>
    {elapsed !== null && state !== "error" ? <p className="overture-timing">Viewport ready (tiles settled): {elapsed.toLocaleString()} ms in this browser session, including camera movement. Cold and repeat timings vary with network/cache.</p> : null}
    <footer className="overture-footnote">Data <a href="https://docs.overturemaps.org/attribution/" target="_blank" rel="noopener noreferrer">© Overture Maps contributors</a> and <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>. This publisher-hosted September 23 snapshot may expire around November 23; Yellow’s retained August 19 Drive archive is not queried here. Overture identities are not verified hotel competitors, live rates, availability, or room sales. Client-country access rules are not implemented.</footer>
  </section>;
}
