import { expect, test } from "bun:test";
import { createApp } from "../src/app";
import type { OperatorHttpApi } from "../src/http/operator";
import { godEyeAsset } from "../src/http/god-eye-assets";
const app = createApp({ publicOperatorSurface: "yellow-next", operatorApi: {} as OperatorHttpApi });
test("actual document and API policies remain separated", async () => {
  const document = await app.handle(new Request("http://localhost/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today?workspace=market-map"));
  expect(document.status).toBe(200);
  expect(document.headers.get("permissions-policy")).toContain("geolocation=(self)");
  expect(document.headers.get("content-security-policy")).toContain("https://tiles.openfreemap.org");
  const health = await app.handle(new Request("http://localhost/health"));
  expect(health.headers.get("permissions-policy")).toContain("geolocation=()");
  expect(health.headers.get("content-security-policy")).not.toContain("openstreetmap");
});
test.skipIf(process.env.YELLOW_REQUIRE_NATIVE_MAP_BUILD !== "1")("native build serves engine assets with MIME", async () => {
  const css = await app.handle(new Request("http://localhost/yellow-next/cesium/Widgets/widgets.css"));
  expect(css.status).toBe(200);
  expect(css.headers.get("content-type")).toContain("text/css");
  const worker = await app.handle(new Request("http://localhost/yellow-next/cesium/Workers/createTaskProcessorWorker.js"));
  expect(worker.status).toBe(200);
  expect(worker.headers.get("content-type")).toContain("javascript");

  const notices = await Promise.all([
    app.handle(new Request("http://localhost/yellow-next/cesium/ThirdParty/pako-LICENSE.txt")),
    app.handle(new Request("http://localhost/yellow-next/cesium/ThirdParty/pako-zlib-LICENSE.txt")),
    app.handle(new Request("http://localhost/yellow-next/cesium/ThirdParty/tslib-LICENSE.txt")),
    app.handle(new Request("http://localhost/yellow-next/cesium/ThirdParty/gods-eye-LICENSE.txt")),
    app.handle(new Request("http://localhost/yellow-next/cesium/LICENSE.md")),
    app.handle(new Request("http://localhost/yellow-next/cesium/ThirdParty.json")),
  ]);
  for (const notice of notices.slice(0, 5)) {
    expect(notice.status).toBe(200);
    expect(notice.headers.get("content-type")).toContain("text/plain");
  }
  expect(notices[5]!.status).toBe(200);
  expect(notices[5]!.headers.get("content-type")).toContain("application/json");
  const noticeText = await Promise.all(notices.slice(0, 5).map((notice) => notice.text()));
  const pakoMit = noticeText[0]!; const pakoZlib = noticeText[1]!; const tslib = noticeText[2]!;
  const godsEye = noticeText[3]!; const cesium = noticeText[4]!;
  expect(pakoMit).toContain("Copyright (C) 2014-2017 by Vitaly Puzrin and Andrei Tuputcyn");
  expect(pakoMit).toContain("THE SOFTWARE IS PROVIDED \"AS IS\"");
  expect(pakoZlib).toContain("(C) 1995-2013 Jean-loup Gailly and Mark Adler");
  expect(pakoZlib).toContain("Permission is granted to anyone to use this software");
  expect(pakoZlib).toContain("This software is provided 'as-is'");
  expect(tslib).toContain("Copyright (c) Microsoft Corporation.");
  expect(godsEye).toContain("Copyright");
  expect(cesium.length).toBeGreaterThan(0);
  expect((await notices[5]!.text()).length).toBeGreaterThan(0);
});
test("missing or invalid engine paths remain closed", async () => {
  for (const path of ["Assets/missing.png", "../package.json", "Assets/%2e%2e/package.json", "Workers/../../.env", "Widgets/widgets.css/secret"]) expect((await godEyeAsset(path)).status).toBe(404);
});
test.skipIf(process.env.YELLOW_REQUIRE_NATIVE_MAP_BUILD === "1")("default release excludes native map engine and assets", async () => {
  const files = [...new Bun.Glob("public/yellow-next/**/*").scanSync({ onlyFiles: true })];
  expect(files.filter((path) => /cesium|god-eye-engine|GodEyeMapWorkspace/.test(path))).toEqual([]);
});
