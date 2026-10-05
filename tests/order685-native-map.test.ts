import { expect, test } from "bun:test";
import { parseMapPosition, locationFailure } from "../frontend/yellow/src/god-eye-map";
import { cesiumAssetPath } from "../src/http/god-eye-assets";
import { isYellowOperatorDocument, SECURITY_HEADERS, YELLOW_MAP_CSP } from "../src/http/security-headers";

test("coordinates are explicit latitude/longitude, bounded and finite", () => {
  expect(parseMapPosition("30.3165, 78.0322")).toEqual({ latitude: 30.3165, longitude: 78.0322 });
  expect(parseMapPosition(" -90, +180 ")).toEqual({ latitude: -90, longitude: 180 });
  for (const value of ["", "Dubai", "91,0", "0,181", "1e5,0", "NaN,0", "0,Infinity", "0,0,0", "0;0", "<script>"]) expect(parseMapPosition(value)).toBeNull();
});
test("GPS failure recovery never implies permission or completion", () => {
  expect(locationFailure(1)).toContain("declined");
  expect(locationFailure(2)).toContain("could not");
  expect(locationFailure(3)).toContain("too long");
  for (const code of [1,2,3]) expect(locationFailure(code)).toContain("coordinates");
});
test("only curated local Cesium asset paths admitted", () => {
  for (const path of ["Assets/Textures/NaturalEarthII/0/0/0.jpg", "Workers/createTaskProcessorWorker.js", "ThirdParty/Workers/pako_inflate.js", "Widgets/widgets.css", "LICENSE.md", "ThirdParty.json"]) expect(cesiumAssetPath(path)).toBe(path);
  for (const path of ["../package.json", "Assets/../package.json", "Assets//x.png", "/Assets/x.png", "Assets\\x.png", "Assets/%2e%2e/x.png", "Assets/%2Fx.png", ".env", "src/server.ts", "Widgets/x.html", "Widgets/x.exe", "Workers/./x.js"]) expect(cesiumAssetPath(path)).toBeNull();
});
test("map provider and location privileges scoped to React documents", () => {
  const id = "6081b544-22a1-534f-a86d-bb1ae0519e14";
  expect(isYellowOperatorDocument(`/p/${id}/today`)).toBe(true);
  expect(isYellowOperatorDocument(`/p/${id}/reservations`)).toBe(true);
  for (const path of ["/api/v1/me/properties", "/assets/operator.js", `/p/${id}/invoices`, "/client/locanda-homes", "/p/x/today"]) expect(isYellowOperatorDocument(path)).toBe(false);
  expect(SECURITY_HEADERS["permissions-policy"]).toContain("geolocation=()");
  expect(YELLOW_MAP_CSP).toContain("connect-src 'self' https://tile.openstreetmap.org");
  expect(YELLOW_MAP_CSP).not.toContain("'unsafe-eval'");
  expect(YELLOW_MAP_CSP).toContain("'wasm-unsafe-eval'");
  expect(YELLOW_MAP_CSP).not.toContain("https:;");
});
