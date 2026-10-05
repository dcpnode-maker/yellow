import { expect, test } from "bun:test";

import { createApp } from "../src/app";
import type { OperatorHttpApi } from "../src/http/operator";

test("Order444 Owner trust deep GET reloads the authenticated shell without invoking trust commands", async () => {
  const calls: string[] = [];
  const operatorApi = new Proxy({}, {
    get(_target, property) {
      return () => {
        calls.push(String(property));
        if (property === "unauthorized") {
          return Response.json({ type: "auth/unauthorized" }, { status: 401 });
        }
        return new Response("unexpected operator call", { status: 500 });
      };
    },
  }) as OperatorHttpApi;
  const app = createApp({ operatorApi });
  const property = "00000000-0000-4000-8000-000000044400";
  const root = await app.handle(new Request("http://order444.test/"));
  const rootHtml = await root.text();

  for (let reload = 0; reload < 2; reload += 1) {
    const shell = await app.handle(new Request(`http://order444.test/p/${property}/trust`));
    expect(shell.status).toBe(200);
    expect(shell.headers.get("content-type")).toContain("text/html");
    expect(shell.headers.get("cache-control")).toBe("no-cache");
    expect(await shell.text()).toBe(rootHtml);
    expect(calls).toEqual([]);
  }

  const protectedApi = await app.handle(new Request(
    `http://order444.test/api/v1/properties/${property}/trust/accounts`,
  ));
  expect(protectedApi.status).toBe(401);
  expect(await protectedApi.json()).toEqual({ type: "auth/unauthorized" });
  expect(calls).toEqual(["unauthorized"]);
  expect(calls).not.toContain("ownerTrustAccounts");
});
