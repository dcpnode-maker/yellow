import { expect, test } from "bun:test";

import { createApp } from "../src/app";
import { OperatorHttpApi } from "../src/http/operator";

test("the optional mobile-first public surface serves its hashed bundle without exposing a directory", async () => {
  const app = createApp({
    operatorApi: new OperatorHttpApi({} as never),
    publicOperatorSurface: "yellow-next",
  });
  const page = await app.handle(new Request("http://yellow.test/p/demo/today"));
  expect(page.status).toBe(200);
  const html = await page.text();
  const asset = html.match(/\/yellow-next\/assets\/([A-Za-z0-9._-]+\.js)/)?.[1];
  expect(asset).toBeDefined();
  const bundle = await app.handle(new Request(`http://yellow.test/yellow-next/assets/${asset!}`));
  expect(bundle.status).toBe(200);
  expect(bundle.headers.get("content-type")).toContain("text/javascript");
  expect((await app.handle(new Request("http://yellow.test/yellow-next/assets/..%2Fapp.ts"))).status).toBe(404);
  const legacy = createApp({
    operatorApi: new OperatorHttpApi({} as never),
    publicOperatorSurface: "legacy",
  });
  const legacyPage = await legacy.handle(new Request("http://yellow.test/p/demo/today"));
  expect((await legacyPage.text())).toContain('/assets/operator.js');
});
