import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Map, Marker, setWorkerCount, setWorkerUrl } from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import "./street-map.css";
import {
  parseStreetMapCoordinates,
  releaseStreetMap,
  STREET_MAP_ATTRIBUTION,
  STREET_MAP_CITIES,
  STREET_MAP_STYLE_URL,
  type StreetMapEventHandler,
} from "../street-map";
import {
  attachMarketListingLayers, createImportedMarketFileSession, filterMarketListings, paginateMarketListings,
  type ImportedMarketData, type MarketListingData, type MarketListingRow, type MarketMapPoint,
} from "../market-listing-import";
import { filterOsmMarketRows, osmCoordinateLabel, OSM_CATEGORY_LABELS, type OsmMarketData, type OsmMarketRow } from "../osm-market-import";

type MapState = "loading" | "ready" | "error";
const EMPTY_MARKET_POINTS: readonly MarketMapPoint[] = [];

export function MarketListingResults({ data, rows, page, selected, onSelect, onPage }: Readonly<{
  data: MarketListingData; rows: readonly MarketListingRow[]; page: number; selected: MarketListingRow | null;
  onSelect: (row: MarketListingRow) => void; onPage: (page: number) => void;
}>) {
  const paged = paginateMarketListings(rows, page);
  return <section className="street-map-results" aria-label="Imported listing results">
    <div className="street-map-results-heading"><h2>Listings</h2><span>Source prices are next-year averages, not October quotes or confirmed availability.</span></div>
    {paged.rows.length === 0 ? <p>No listings match these filters. Change the search or bedroom selection.</p> : <ol start={(paged.page - 1) * 20 + 1} className="street-map-result-list">{paged.rows.map(row => <li key={row.listingId}><button type="button" aria-pressed={selected?.listingId === row.listingId} onClick={() => onSelect(row)}><span className="street-map-result-title">{row.title || "Untitled source listing"}</span><span>{row.bedrooms} · {row.priceNextYearAverage === null ? "Price unavailable" : `${data.source.currency} ${row.priceNextYearAverage} next-year average`} · {row.latitude === null ? "Unmapped" : "Approximate pin"}</span></button></li>)}</ol>}
    <nav className="street-map-pages" aria-label="Listing pages"><button type="button" onClick={() => onPage(Math.max(1, paged.page - 1))} disabled={paged.page <= 1}>Previous</button><span>Page {paged.page} of {paged.pageCount}</span><button type="button" onClick={() => onPage(Math.min(paged.pageCount, paged.page + 1))} disabled={paged.page >= paged.pageCount}>Next</button></nav>
    {selected ? <article className="street-map-selected" aria-label="Selected listing detail"><h3>{selected.title || "Untitled source listing"}</h3><p>Listing ID {selected.listingId} · {selected.bedrooms}</p><p>{selected.priceNextYearAverage === null ? "Source price unavailable" : `${data.source.currency} ${selected.priceNextYearAverage} next-year average`} · not a dated quote, booking offer, or transaction price.</p><p>{selected.latitude === null ? "No source coordinates" : `Approximate source coordinates ${selected.latitude}, ${selected.longitude}`}. Not a verified entrance or rooftop location.</p><p>Source rating {selected.starRating ?? "not supplied"} · reviews {selected.reviews ?? "not supplied"} · minimum stay {selected.minimumStay ?? "not supplied"}.</p><p>Source URL (text only): {selected.listingLink}</p></article> : null}
    <p className="street-map-market-caveat">Imported dashboard sample for {data.source.market} only. Provider records are not independently verified active units; October regional percentile observations are separate and are not assigned to these listings.</p>
  </section>;
}

export function OsmMarketResults({ data, rows, page, selected, onSelect, onPage }: Readonly<{
  data: OsmMarketData; rows: readonly OsmMarketRow[]; page: number; selected: OsmMarketRow | null;
  onSelect: (row: OsmMarketRow) => void; onPage: (page: number) => void;
}>) {
  const paged = paginateMarketListings(rows, page);
  return <section className="street-map-results" aria-label="OpenStreetMap accommodation results">
    <div className="street-map-results-heading"><h2>Accommodation places</h2><span>Open map records, not verified active OTA listings.</span></div>
    {paged.rows.length === 0 ? <p>No accommodation places match. Change the search or category.</p> : <ol start={(paged.page - 1) * 20 + 1} className="street-map-result-list">{paged.rows.map(row => <li key={row.listingId}><button type="button" aria-pressed={selected?.listingId === row.listingId} onClick={() => onSelect(row)}><span className="street-map-result-title">{row.title || "Unnamed accommodation"}</span><span>{OSM_CATEGORY_LABELS[row.tourismKind]} · {osmCoordinateLabel(row.coordinateKind)}</span></button></li>)}</ol>}
    <nav className="street-map-pages" aria-label="Accommodation pages"><button type="button" onClick={() => onPage(Math.max(1, paged.page - 1))} disabled={paged.page <= 1}>Previous</button><span>Page {paged.page} of {paged.pageCount}</span><button type="button" onClick={() => onPage(Math.min(paged.pageCount, paged.page + 1))} disabled={paged.page >= paged.pageCount}>Next</button></nav>
    {selected ? <article className="street-map-selected" aria-label="Selected accommodation detail"><h3>{selected.title || "Unnamed accommodation"}</h3><p>{OSM_CATEGORY_LABELS[selected.tourismKind]} · OSM {selected.sourceType} {selected.sourceId}</p><p>{osmCoordinateLabel(selected.coordinateKind)}: {selected.latitude}, {selected.longitude}. Not a verified entrance or rooftop location.</p><p>Active inventory and OTA identity are unknown. Rates, calendar availability, bedrooms and reviews are not supplied by this sample.</p><p>Mapped accommodation record, unverified · source snapshot {data.source.sourceTimestamp}.</p><p><a href={selected.listingLink} target="_blank" rel="noopener noreferrer">View OpenStreetMap source</a></p></article> : null}
    <p className="street-map-market-caveat">Dubai metro sample, not complete Dubai coverage. The rectangle may include neighbouring municipalities; different OSM records can represent the same property. © OpenStreetMap contributors · <a href={data.source.copyrightUrl} target="_blank" rel="noopener noreferrer">ODbL</a>.</p>
  </section>;
}

export function ImportedMarketSummary({ imported }: Readonly<{ imported: ImportedMarketData }>) {
  if (imported.kind === "osm") {
    const data = imported.data;
    return <div className="street-map-source-card"><strong>Dubai metro sample · {data.rows.length.toLocaleString()} accommodation places</strong><span>{data.mappedCount.toLocaleString()} mapped points · OpenStreetMap, not OTA inventory</span><span>OSM snapshot {data.source.sourceTimestamp} · acquired {data.source.observedAt}</span><span>{data.source.returnedCount.toLocaleString()} source records · {data.source.excludedCount.toLocaleString()} excluded · active status, exact entrances and prices unknown.</span><span>File provenance is not independently authenticated. Selected metropolitan rectangle, not an administrative boundary or complete market.</span><span>© OpenStreetMap contributors · <a href={data.source.copyrightUrl} target="_blank" rel="noopener noreferrer">ODbL-1.0</a></span></div>;
  }
  const data = imported.data;
  return <div className="street-map-source-card"><strong>{data.source.market} · {data.rows.length.toLocaleString()} source listing rows</strong><span>{data.mappedCount.toLocaleString()} approximate mapped points · {data.unmappedCount.toLocaleString()} unmapped</span><span>PriceLabs dashboard {data.source.dashboardId} · {data.source.currency} · source refresh label {data.source.sourceRefreshed} (timezone unknown) · acquired {data.source.observedAt}</span><span>Market and refresh context are unverified file-supplied claims; these fields are not encoded in the downloaded CSV.</span></div>;
}

export function StreetMapWorkspace() {
  const canvas = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const layerRef = useRef<ReturnType<typeof attachMarketListingLayers> | null>(null);
  const fileSessionRef = useRef<ReturnType<typeof createImportedMarketFileSession> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapLoadedRef = useRef(false);
  const fittedDataRef = useRef<ImportedMarketData | null>(null);
  const dataRef = useRef<ImportedMarketData | null>(null);
  const filteredRef = useRef<readonly MarketMapPoint[]>([]);
  const onSelectRef = useRef<(id: string) => void>(() => {});
  const [mapState, setMapState] = useState<MapState>("loading");
  const [mapHasLoaded, setMapHasLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [coordinateError, setCoordinateError] = useState("");
  const [preview, setPreview] = useState<{ latitude: number; longitude: number } | null>(null);
  const [data, setData] = useState<ImportedMarketData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filterOptions = useMemo(() => {
    if (data?.kind === "osm") {
      const counts = new globalThis.Map<string, number>();
      for (const row of data.data.rows) counts.set(row.tourismKind, (counts.get(row.tourismKind) ?? 0) + 1);
      return Object.entries(OSM_CATEGORY_LABELS).map(([value, label]) => ({ value, label: `${label} (${(counts.get(value) ?? 0).toLocaleString()})` }));
    }
    return [...new Set((data?.data.rows ?? []).map(row => row.bedrooms))].sort((a, b) => a.localeCompare(b)).map(value => ({ value, label: value }));
  }, [data]);
  const view = useMemo(() => {
    if (!data) return null;
    if (data.kind === "osm") return { kind: "osm" as const, data: data.data, rows: filterOsmMarketRows(data.data.rows, search, category) };
    return { kind: "pricelabs" as const, data: data.data, rows: filterMarketListings(data.data.rows, search, category) };
  }, [data, search, category]);
  const filtered = view?.rows ?? EMPTY_MARKET_POINTS;
  dataRef.current = data;
  filteredRef.current = filtered;
  onSelectRef.current = setSelectedId;

  useEffect(() => {
    const session = createImportedMarketFileSession({
      onLoaded(value) { setData(value); setImportError(null); setReading(false); },
      onError(message) { setImportError(message); setReading(false); },
      onCleared() {
        layerRef.current?.dispose(); layerRef.current = null;
        dataRef.current = null; fittedDataRef.current = null; setData(null); setSelectedId(null);
        setSearch(""); setCategory("all"); setPage(1); setImportError(null);
      },
    });
    fileSessionRef.current = session;
    return () => { session.dispose(); if (fileSessionRef.current === session) fileSessionRef.current = null; dataRef.current = null; };
  }, []);

  useEffect(() => {
    if (!canvas.current) return;
    let alive = true;
    let styleLoaded = false;
    let hadError = false;
    let loadTimeout: ReturnType<typeof setTimeout> | null = null;
    let map: Map | null = null;
    let marker: Marker | null = null;
    const onLoad: StreetMapEventHandler = () => {
      styleLoaded = true;
      if (loadTimeout) clearTimeout(loadTimeout);
      if (alive) {
        mapLoadedRef.current = true;
        setMapHasLoaded(true);
        setMapState(hadError ? "error" : "ready");
        if (map && dataRef.current) {
          try {
            layerRef.current = attachMarketListingLayers(map, id => onSelectRef.current(id));
            layerRef.current.update(filteredRef.current, true);
            fittedDataRef.current = dataRef.current;
          } catch { setMapState("error"); }
        }
      }
    };
    const onError: StreetMapEventHandler = () => {
      hadError = true;
      if (loadTimeout) clearTimeout(loadTimeout);
      if (alive) setMapState("error");
    };

    setMapState("loading");
    setMapHasLoaded(false);
    mapLoadedRef.current = false;
    try {
      // Earlier releases served this unchanged worker with a restrictive cached CSP.
      // Version its request so returning browsers receive the corrected worker policy.
      setWorkerUrl(`${mapWorkerUrl}?policy=699`);
      setWorkerCount(2);
      map = new Map({
        container: canvas.current,
        style: STREET_MAP_STYLE_URL,
        center: [0, 20],
        zoom: 1.5,
        minZoom: 1,
        maxZoom: 19,
        renderWorldCopies: false,
        maxTileCacheSize: 48,
        maxTileCacheZoomLevels: 5,
        attributionControl: false,
        cooperativeGestures: true,
      });
      marker = new Marker({ color: "#355f56", scale: 0.9 });
      mapRef.current = map;
      markerRef.current = marker;
      map.on("load", onLoad);
      map.on("error", onError);
      loadTimeout = setTimeout(() => {
        if (alive && !styleLoaded) setMapState("error");
      }, 15_000);
    } catch {
      setMapState("error");
    }

    return () => {
      alive = false;
      if (loadTimeout) clearTimeout(loadTimeout);
      layerRef.current?.dispose(); layerRef.current = null;
      fittedDataRef.current = null; mapLoadedRef.current = false;
      if (map) releaseStreetMap(map, marker, onLoad, onError);
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [retryCount]);

  useEffect(() => {
    const map = mapRef.current;
    if (!data) { layerRef.current?.dispose(); layerRef.current = null; fittedDataRef.current = null; return; }
    if (!map || !mapLoadedRef.current) return;
    try {
      if (!layerRef.current) layerRef.current = attachMarketListingLayers(map, id => onSelectRef.current(id));
      layerRef.current.update(filtered, fittedDataRef.current !== data);
      fittedDataRef.current = data;
    } catch { setMapState("error"); }
  }, [data, filtered]);

  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setReading(true);
    void fileSessionRef.current?.load(file);
    event.currentTarget.value = "";
  };
  const clearImport = () => { fileSessionRef.current?.clear(); setReading(false); if (fileInputRef.current) fileInputRef.current.value = ""; };
  const chooseListing = (row: MarketMapPoint) => {
    setSelectedId(row.listingId);
    if (row.latitude !== null && row.longitude !== null && mapLoadedRef.current) {
      try { mapRef.current?.flyTo({ center: [Number(row.longitude), Number(row.latitude)], zoom: 13, essential: false, duration: 500 }); }
      catch { setMapState("error"); }
    }
  };

  const chooseCity = (city: (typeof STREET_MAP_CITIES)[number]) => {
    mapRef.current?.flyTo({ center: [city.longitude, city.latitude], zoom: 11, essential: false, duration: 700 });
    setPreview(null);
    markerRef.current?.remove();
    setSelectedId(null);
  };

  const previewCoordinates = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const coordinates = parseStreetMapCoordinates(latitude, longitude);
    if (!coordinates) {
      setCoordinateError("Enter a map latitude from −85.051 to 85.051 and a longitude from −180 to 180.");
      return;
    }
    setCoordinateError("");
    setPreview(coordinates);
    const map = mapRef.current;
    const marker = markerRef.current;
    if (map && marker) {
      marker.setLngLat([coordinates.longitude, coordinates.latitude]).addTo(map);
      map.flyTo({ center: [coordinates.longitude, coordinates.latitude], zoom: 13, essential: false, duration: 700 });
    }
  };

  const retry = () => {
    setPreview(null);
    setRetryCount((count) => count + 1);
  };

  return <section className="street-map-workspace" aria-labelledby="street-map-title">
    <header className="street-map-heading">
      <div><h1 id="street-map-title">Market map</h1><p>Explore streets, an authorized listing export or the collected Dubai open-data sample.</p></div>
      <p className="street-map-provider">OpenFreeMap Liberty</p>
    </header>

    <section className="street-map-tools" aria-label="Map controls">
      <div className="street-map-cities" aria-label="Choose a city">
        {STREET_MAP_CITIES.map((city) => <button type="button" key={city.label} onClick={() => chooseCity(city)}>{city.label}</button>)}
      </div>
      <form className="street-map-coordinate-form" onSubmit={previewCoordinates} noValidate>
        <label>Latitude<input inputMode="decimal" autoComplete="off" value={latitude} onChange={(event) => setLatitude(event.target.value)} aria-label="Latitude, from −85.051 to 85.051" aria-invalid={Boolean(coordinateError)} aria-describedby={coordinateError ? "street-map-coordinate-error" : undefined} /></label>
        <label>Longitude<input inputMode="decimal" autoComplete="off" value={longitude} onChange={(event) => setLongitude(event.target.value)} aria-invalid={Boolean(coordinateError)} aria-describedby={coordinateError ? "street-map-coordinate-error" : undefined} /></label>
        <button className="street-map-preview-button" type="submit">Preview pin</button>
      </form>
      {coordinateError ? <p id="street-map-coordinate-error" className="street-map-coordinate-error" role="alert">{coordinateError}</p> : null}
      <p className="street-map-privacy-note">Map tiles are requested for the area you view. OpenFreeMap receives those tile requests.</p>
    </section>

    <section className="street-map-market-panel" aria-label="Private market listing import">
      <div className="street-map-market-intro">
        <div><h2>Local market data</h2><p>Import the PriceLabs <code>listings.normalized.json</code> export or Dubai <code>osm_accommodations_normalized.json</code> sample. One source at a time; rows stay in this mounted browser workspace and are not uploaded or saved by Yellow.</p></div>
        <div className="street-map-market-actions"><label className="street-map-file-label">Import local JSON<input ref={fileInputRef} type="file" accept=".json,application/json" onChange={importFile} aria-label="Import normalized PriceLabs listing JSON or OpenStreetMap sample" /></label><button type="button" onClick={clearImport} disabled={!data && !reading}>Clear imported data</button></div>
      </div>
      <p className="street-map-privacy-note">The listing file and row fields are not uploaded. OpenFreeMap tile requests can reveal the area you view or zoom into.</p>
      {reading ? <p role="status">Reading and validating local file…</p> : null}
      {importError ? <p className="street-map-coordinate-error" role="alert">{importError}</p> : null}
      {data ? <>
        <ImportedMarketSummary imported={data} />
        <div className="street-map-filter-row"><label>{data.kind === "osm" ? "Search name or OSM ID" : "Search title or listing ID"}<input type="search" value={search} maxLength={100} onChange={event => { setSearch(event.target.value); setPage(1); setSelectedId(null); }} /></label><label>{data.kind === "osm" ? "Accommodation type" : "Bedrooms"}<select value={category} onChange={event => { setCategory(event.target.value); setPage(1); setSelectedId(null); }}><option value="all">{data.kind === "osm" ? "All types" : "All bedrooms"}</option>{filterOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
        <p className="street-map-result-count" role="status">{filtered.length.toLocaleString()} matching {data.kind === "osm" ? "accommodation places" : "listings"} · {filtered.filter(row => row.latitude !== null).length.toLocaleString()} mapped</p>
      </> : null}
    </section>

    {preview ? <p className="street-map-preview-status" role="status">Preview pin at {preview.latitude.toFixed(5)}, {preview.longitude.toFixed(5)} — not saved or verified.</p> : null}
    <div className="street-map-frame">
      <div ref={canvas} className="street-map-canvas" role="region" aria-label="Street map" />
      {mapState === "loading" ? <div className="street-map-state" role="status">Loading street map…</div> : null}
      {mapState === "error" ? <div className="street-map-state street-map-state-error" role="alert"><strong>{mapHasLoaded ? "Some map tiles could not load" : "Map unavailable"}</strong><span>Check your connection and retry. Coordinate entry and imported listing details work without map tiles.</span><button type="button" onClick={retry}>Retry map</button></div> : null}
    </div>
    {view?.kind === "osm" ? <OsmMarketResults data={view.data} rows={view.rows} page={page} selected={view.rows.find(row => row.listingId === selectedId) ?? null} onSelect={chooseListing} onPage={setPage} /> : view?.kind === "pricelabs" ? <MarketListingResults data={view.data} rows={view.rows} page={page} selected={view.rows.find(row => row.listingId === selectedId) ?? null} onSelect={chooseListing} onPage={setPage} /> : null}
    <footer className="street-map-attribution" aria-label="Map attribution">
      <span>{STREET_MAP_ATTRIBUTION}</span>
      <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a>
      <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a>
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap copyright</a>
    </footer>
  </section>;
}
