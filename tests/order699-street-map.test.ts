import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  parseStreetMapCoordinates,
  releaseStreetMap,
  STREET_MAP_ATTRIBUTION,
  STREET_MAP_CITIES,
  STREET_MAP_MAX_LATITUDE,
  STREET_MAP_PROVIDER_ORIGIN,
  STREET_MAP_STYLE_URL,
} from "../frontend/yellow/src/street-map";

describe("Order699 free street map", () => {
  it("accepts finite decimal coordinates within the rendered Mercator bounds", () => {
    expect(parseStreetMapCoordinates("51.5072", "-0.1276")).toEqual({ latitude: 51.5072, longitude: -0.1276 });
    expect(parseStreetMapCoordinates(`${STREET_MAP_MAX_LATITUDE}`, "180")).toEqual({ latitude: STREET_MAP_MAX_LATITUDE, longitude: 180 });
    expect(parseStreetMapCoordinates(`${-STREET_MAP_MAX_LATITUDE}`, "-180")).toEqual({ latitude: -STREET_MAP_MAX_LATITUDE, longitude: -180 });
    expect(parseStreetMapCoordinates(" 28.6 ", " 77.2 ")).toEqual({ latitude: 28.6, longitude: 77.2 });
  });

  it("rejects blanks, non-finite values, out-of-range and injected values", () => {
    for (const value of ["", " ", "NaN", "Infinity", "-Infinity", "90", "-90", "85.1", "1e2", "1;alert(1)", "javascript:1", "<img src=x>"]) {
      expect(parseStreetMapCoordinates(value, "0")).toBeNull();
    }
    for (const value of ["", " ", "NaN", "Infinity", "-Infinity", "181", "-181", "1e2", "1;alert(1)", "javascript:1", "<img src=x>"]) {
      expect(parseStreetMapCoordinates("0", value)).toBeNull();
    }
    expect(parseStreetMapCoordinates("91", "181")).toBeNull();
  });

  it("uses only the documented OpenFreeMap Liberty provider and visible attribution", () => {
    expect(STREET_MAP_STYLE_URL).toBe(`${STREET_MAP_PROVIDER_ORIGIN}/styles/liberty`);
    expect(new URL(STREET_MAP_STYLE_URL).origin).toBe(STREET_MAP_PROVIDER_ORIGIN);
    expect(STREET_MAP_ATTRIBUTION).toContain("OpenFreeMap");
    expect(STREET_MAP_ATTRIBUTION).toContain("OpenMapTiles");
    expect(STREET_MAP_ATTRIBUTION).toContain("OpenStreetMap");
    expect(STREET_MAP_CITIES.some((city) => city.label === "Riyadh")).toBeTrue();
    expect(STREET_MAP_CITIES.some((city) => city.label === "Dehradun")).toBeTrue();
  });

  it("detaches listeners and releases the map and temporary marker", () => {
    const calls: string[] = [];
    const onLoad = () => {};
    const onError = () => {};
    releaseStreetMap({ off: (event) => { calls.push(`off:${event}`); }, remove: () => calls.push("map:remove") },
      { remove: () => calls.push("marker:remove") }, onLoad, onError);
    expect(calls).toEqual(["off:load", "off:error", "marker:remove", "map:remove"]);
    calls.length = 0;
    releaseStreetMap({ off: (event) => { calls.push(`off:${event}`); }, remove: () => calls.push("map:remove") },
      null, onLoad, onError);
    expect(calls).toEqual(["off:load", "off:error", "map:remove"]);
  });

  it("lazily routes only the market-map workspace to this canvas", () => {
    const app = readFileSync("frontend/yellow/src/App.tsx", "utf8");
    const workspace = readFileSync("frontend/yellow/src/workspaces/StreetMapWorkspace.tsx", "utf8");
    const helpers = readFileSync("frontend/yellow/src/street-map.ts", "utf8");
    const build = readFileSync("frontend/yellow/vite.config.ts", "utf8");
    const navigation = readFileSync("frontend/yellow/src/ui/OperatorHeader.tsx", "utf8");
    expect(app).toContain('lazy(() => import("./workspaces/StreetMapWorkspace")');
    expect(app).toContain('{workspacePart === "market-map" ? <StreetMapWorkspace />');
    expect(helpers).toContain("https://tiles.openfreemap.org/styles/liberty");
    expect(workspace).toContain("not saved or verified");
    expect(workspace).toContain('setWorkerUrl(`${mapWorkerUrl}?policy=699`)');
    expect(helpers).toContain("marker?.remove");
    expect(workspace).not.toMatch(/Overture|Cesium|God.?s Eye|Google Maps/i);
    expect(build).not.toMatch(/CESIUM_BASE_URL|yellow-cesium-static-assets|god-eye-engine|__YELLOW_NATIVE_MAP__/);
    expect(navigation).toContain('["market-map", "Map"]');
    expect(navigation).not.toContain("God’s Eye");
    const hub = readFileSync("frontend/yellow/src/workspaces/OperationalHub.tsx", "utf8");
    expect(hub).toContain("OpenFreeMap streets and coordinate previews");
    expect(hub).not.toContain("Overture");
    expect(build).toContain("publicDir: false");
  });
});
