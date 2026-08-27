import { describe, expect, test } from "bun:test";

import { createApp } from "../src/app";
import { operatorAssets } from "../src/http/operator";

describe("Order194 local sign-in prefill", () => {
  test("default operator document remains credential-free and non-persistent", async () => {
    const response = await operatorAssets.html();
    const html = await response.text();
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(html).not.toContain('name="tenant" autocomplete="organization" required maxlength="63" placeholder="yellow-demo" value=');
    expect(html).not.toContain('name="email" type="email" autocomplete="username" required maxlength="254" placeholder="operator@yellow.local" value=');
    expect(html).not.toContain('name="password" type="password" autocomplete="current-password" required maxlength="1024" value=');
  });

  test("explicit local document masks, escapes and refuses browser caching", async () => {
    const response = await operatorAssets.html({
      tenant: 'yellow-demo&"<',
      email: "operator+review@yellow.local",
      password: 'secret&"<value>',
    }, new Request("http://127.0.0.1:3000/"));
    const html = await response.text();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(html).toContain('name="tenant" autocomplete="organization" required maxlength="63" placeholder="yellow-demo" value="yellow-demo&amp;&quot;&lt;"');
    expect(html).toContain('name="email" type="email" autocomplete="username" required maxlength="254" placeholder="operator@yellow.local" value="operator+review@yellow.local"');
    expect(html).toContain('name="password" type="password" autocomplete="current-password" required maxlength="1024" value="secret&amp;&quot;&lt;value&gt;"');
    expect(html).not.toContain('type="text" autocomplete="current-password"');
  });

  test("all operator routes receive the same explicit local-only document", async () => {
    const app = createApp({
      operatorApi: {} as never,
      operatorLocalReviewCredentials: { tenant: "yellow-demo", email: "operator@yellow.local", password: "not-committed" },
    });
    for (const path of ["/", "/p/00000000-0000-0000-0000-000000000001/folios", "/p/00000000-0000-0000-0000-000000000001/status"]) {
      const response = await app.handle(new Request(`http://127.0.0.1:3000${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.text()).toContain('value="not-committed"');
    }
  });

  test("configured credentials are absent from a non-loopback request", async () => {
    const app = createApp({
      operatorApi: {} as never,
      operatorLocalReviewCredentials: { tenant: "yellow-demo", email: "operator@yellow.local", password: "not-committed" },
    });
    const response = await app.handle(new Request("http://yellow.test/"));
    const html = await response.text();
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(html).not.toContain("not-committed");
  });

  test("server source gates a complete process-only trio behind loopback and explicit enablement", async () => {
    const source = await Bun.file(new URL("../src/server.ts", import.meta.url)).text();
    expect(source).toContain('Bun.env.YELLOW_LOCAL_REVIEW_PREFILL !== "1"');
    expect(source).toContain("Object.values(credentials).some((value) => value.length === 0)");
    expect(source).not.toMatch(/console\.(?:log|error|warn)\([^\n]*(?:LOCAL_REVIEW|credentials)/);
    const operator = await Bun.file(new URL("../src/http/operator.ts", import.meta.url)).text();
    expect(operator).toContain('new Set(["127.0.0.1", "localhost", "[::1]", "::1"])');
  });
});
