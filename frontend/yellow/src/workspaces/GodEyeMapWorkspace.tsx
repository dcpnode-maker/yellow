import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { CesiumWidget, PointPrimitiveCollection } from "@cesium/engine";
import { locationFailure, parseMapPosition, type MapPosition } from "../god-eye-map";
import { OVERTURE_AREAS } from "../overture-map";
import "./god-eye-map.css";

const OvertureMapWorkspace = lazy(() => import("./OvertureMapWorkspace"));
type Engine = typeof import("../vendor/gods-eye/engine");

function MapIcon({ kind }: { kind: "locate" | "world" | "search" }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    {kind === "locate" ? <><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /></> :
      kind === "world" ? <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></> :
        <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>}
  </svg>;
}

function NativeExplorer() {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<CesiumWidget | null>(null);
  const engine = useRef<Engine | null>(null);
  const locationEntity = useRef<PointPrimitiveCollection | null>(null);
  const mounted = useRef(false);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("Choose a city or explore the globe.");
  const [locating, setLocating] = useState(false);
  const [mode, setMode] = useState<"3D" | "2D">("3D");

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    let instance: CesiumWidget | null = null;
    let disposeStack: (() => void) | null = null;
    let removeRenderError: (() => void) | null = null;
    setReady(false);
    setError("");
    setLocating(false);
    setMode("3D");
    void Promise.all([import("../vendor/gods-eye/engine"), import("../vendor/gods-eye/map-stack")]).then(async ([Cesium, native]) => {
      if (cancelled || !host.current) return;
      engine.current = Cesium;
      // Native God's Eye viewer configuration, narrowed to hospitality map use.
      // No Ion default assets, geocoder, provider credentials or third-party feeds.
      instance = new Cesium.CesiumWidget(host.current, {
        baseLayer: false, skyBox: false, skyAtmosphere: false,
        requestRenderMode: true, maximumRenderTimeChange: Infinity,
        contextOptions: { webgl: { preserveDrawingBuffer: true } },
      });
      instance.targetFrameRate = 30;
      instance.resolutionScale = Math.min(1, 1.5 / (window.devicePixelRatio || 1));
      instance.scene.globe.preloadAncestors = false;
      instance.scene.globe.preloadSiblings = false;
      instance.scene.globe.tileCacheSize = 64;
      instance.scene.backgroundColor = Cesium.Color.fromCssColorString("#e9edf0");
      instance.scene.screenSpaceCameraController.minimumZoomDistance = 150;
      instance.scene.screenSpaceCameraController.maximumZoomDistance = 24_000_000;
      instance.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(50, 24, 19_000_000) });
      removeRenderError = instance.scene.renderError.addEventListener(() => {
        if (!cancelled) setError("The 3D view stopped. Try reopening the map, or use the Overture reference view.");
      });
      const stack = new native.MapStackController(instance, () => {
        if (!cancelled) setError("Some street-map tiles could not load. Check your connection and retry the map.");
      });
      disposeStack = () => stack.dispose();
      await stack.setStack("osm");
      if (cancelled) return;
      viewer.current = instance;
      setReady(true);
    }).catch(() => {
      if (!cancelled) setError("The native map could not start. Your browser needs WebGL. Retry, or use the Overture reference view.");
    });
    return () => {
      cancelled = true;
      mounted.current = false;
      disposeStack?.();
      removeRenderError?.();
      if (instance && !instance.isDestroyed()) instance.destroy();
      viewer.current = null;
      engine.current = null;
      locationEntity.current = null;
    };
  }, [retry]);

  const focus = (position: MapPosition, height = 6500) => {
    const map = viewer.current;
    const Cesium = engine.current;
    if (!map || map.isDestroyed() || !Cesium) return;
    map.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, height),
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.65,
    });
  };

  const search = () => {
    const city = OVERTURE_AREAS.find((item) => item.label.toLowerCase() === query.trim().toLowerCase());
    const position = city ?? parseMapPosition(query);
    if (!position) {
      setMessage("Choose a listed city or enter latitude, longitude (for example 30.3165, 78.0322).");
      return;
    }
    focus(position);
    setMessage(city ? `Exploring ${city.label}.` : "Showing the coordinates you entered.");
  };

  const locate = () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      setMessage("Location needs HTTPS and a browser with location support. You can still choose a city or enter coordinates.");
      return;
    }
    setLocating(true);
    setMessage("Waiting for your location permission and device position…");
    const activeViewer = viewer.current;
    navigator.geolocation.getCurrentPosition((position) => {
      if (!mounted.current || viewer.current !== activeViewer) return;
      setLocating(false);
      const map = viewer.current;
      const Cesium = engine.current;
      if (!map || map.isDestroyed() || !Cesium) return;
      const { latitude, longitude, accuracy } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        setMessage(locationFailure(2));
        return;
      }
      if (locationEntity.current) map.scene.primitives.remove(locationEntity.current);
      const points = new Cesium.PointPrimitiveCollection();
      map.scene.primitives.add(points);
      locationEntity.current = points;
      points.add({ position: Cesium.Cartesian3.fromDegrees(longitude, latitude),
        pixelSize: 12, color: Cesium.Color.fromCssColorString("#1976e8"), outlineColor: Cesium.Color.WHITE, outlineWidth: 3, disableDepthTestDistance: Infinity });
      focus({ latitude, longitude }, Math.max(2000, Math.min(50_000, accuracy * 6)));
      setMessage(`Your location is shown${Number.isFinite(accuracy) ? ` (approximately ${Math.round(accuracy)} m accuracy)` : ""}. It is not saved by Yellow.`);
    }, (failure) => {
      if (!mounted.current || viewer.current !== activeViewer) return;
      setLocating(false);
      setMessage(locationFailure(failure.code));
    }, { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 });
  };

  return <>
    <div className="god-eye-tools">
      <form className="god-eye-search" onSubmit={(event) => { event.preventDefault(); search(); }}>
        <MapIcon kind="search" />
        <input aria-label="City or latitude, longitude" list="god-eye-cities" placeholder="City or latitude, longitude" value={query} onChange={(event) => setQuery(event.target.value)} />
        <datalist id="god-eye-cities">{OVERTURE_AREAS.map((city) => <option key={city.label} value={city.label} />)}</datalist>
        <button type="submit" disabled={!ready}>Go</button>
      </form>
      <div className="god-eye-tool-group" aria-label="Map controls">
        <button type="button" disabled={!ready || locating} onClick={locate}><MapIcon kind="locate" />{locating ? "Locating…" : "Locate me"}</button>
        <button type="button" disabled={!ready} onClick={() => { focus({ latitude: 24, longitude: 50 }, 19_000_000); setMessage("World view."); }}><MapIcon kind="world" />World</button>
        {(["3D", "2D"] as const).map((value) => <button key={value} type="button" aria-pressed={mode === value} disabled={!ready} onClick={() => {
          const map = viewer.current;
          if (!map || map.isDestroyed()) return;
          if (value === "2D") map.scene.morphTo2D(0); else map.scene.morphTo3D(0);
          setMode(value);
        }}>{value}</button>)}
      </div>
    </div>
    <div className="god-eye-status" role="status">{message}</div>
    <div className="god-eye-canvas-wrap">
      <div ref={host} className="god-eye-canvas" aria-label="God's Eye native Cesium map" />
      {!ready && !error ? <div className="god-eye-loading" role="status">Opening native globe…</div> : null}
      {error ? <div className="god-eye-error" role="alert"><span>{error}</span><button onClick={() => setRetry((value) => value + 1)}>Retry map</button></div> : null}
      <div className="god-eye-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></div>
    </div>
    <div className="god-eye-footnotes">
      <p>God’s Eye native globe · Street imagery, not live video. Exact GPS stays in this view; map tiles for the viewed area are requested from OpenStreetMap.</p>
      <details><summary>Yellow listings &amp; map sources</summary>
        <p>Yellow hotel, BnB and vendor listings have not been published to this map yet. No private property or guest records are exposed here. Use Overture reference to explore existing place data.</p>
        <p>Native map-stack code adapted from <a href="https://github.com/bilawalsidhu/gods-eye-view" target="_blank" rel="noreferrer">God’s Eye View</a> (MIT). CesiumJS is Apache-2.0. Satellite imagery, live feeds and routing are not enabled in this curated integration.</p>
      </details>
    </div>
  </>;
}

export default function GodEyeMapWorkspace() {
  const [view, setView] = useState<"native" | "overture">("native");
  return <section className="god-eye-workspace" aria-label="God's Eye map workspace">
    <header className="god-eye-heading"><div><h1>God’s Eye</h1><p>Explore places. Keep the world in view.</p></div>
      <div className="god-eye-view-ribbon" aria-label="Map view">
        <button aria-pressed={view === "native"} onClick={() => setView("native")}>Native globe</button>
        <button aria-pressed={view === "overture"} onClick={() => setView("overture")}>Overture reference</button>
      </div>
    </header>
    {view === "native" ? <NativeExplorer /> : <Suspense fallback={<p role="status">Opening Overture reference…</p>}><OvertureMapWorkspace /></Suspense>}
  </section>;
}
