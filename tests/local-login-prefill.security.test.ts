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
    expect(html).toContain('id="login-form" autocomplete="off"');
    expect(html).toContain('<script src="/assets/operator-local-prefill.js" defer></script>');
    expect(html).toContain('name="tenant" autocomplete="off" required maxlength="63" placeholder="yellow-demo" data-local-default="yellow-demo&amp;&quot;&lt;" value="yellow-demo&amp;&quot;&lt;"');
    expect(html).toContain('name="email" type="email" autocomplete="off" required maxlength="254" placeholder="operator@yellow.local" data-local-default="operator+review@yellow.local" value="operator+review@yellow.local"');
    expect(html).toContain('name="password" type="password" autocomplete="off" required maxlength="1024" data-local-default="secret&amp;&quot;&lt;value&gt;" value="secret&amp;&quot;&lt;value&gt;"');
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
    expect(html).not.toContain("operator-local-prefill.js");
  });

  test("same-origin restoration helper contains no credential and is never cached", async () => {
    const response = operatorAssets.localPrefillJs();
    const script = await response.text();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(script).toContain("e.dataset.localDefault");
    expect(script).toContain("delete e.dataset.localDefault");
    expect(script).toContain("addEventListener('pageshow',r,{once:true})");
    expect(script).toContain("e.value=s");
    expect(script).not.toMatch(/yellow-demo|operator@|password|local-deposit/i);
  });

  test("one cancelable internal event restores private defaults and controls password clearing", async () => {
    const response = operatorAssets.localPrefillJs();
    const script = await response.text();
    expect(script).toContain("f.addEventListener('yellow:restore-local-login-defaults',h)");
    expect(script).toContain("e.preventDefault()");
    expect(script).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);

    class TestInput {
      readonly dataset: Record<string, string>;
      value = "";
      constructor(localDefault: string) { this.dataset = { localDefault }; }
    }
    const inputs = ["first", "second", "third"].map((value) => new TestInput(value));
    const listeners = new Map<string, (event: Event) => void>();
    const form = {
      elements: inputs,
      addEventListener(type: string, listener: (event: Event) => void) { listeners.set(type, listener); },
      dispatchEvent(event: Event) {
        listeners.get(event.type)?.(event);
        return !event.defaultPrevented;
      },
    };
    new Function("document", "HTMLInputElement", "addEventListener", "setTimeout", "requestAnimationFrame", script)(
      { querySelector: () => form },
      TestInput,
      () => undefined,
      (callback: () => void) => { callback(); },
      (callback: (timestamp: number) => void) => { callback(0); },
    );
    expect(inputs.map((input) => input.dataset)).toEqual([{}, {}, {}]);
    inputs.forEach((input) => { input.value = ""; });
    const restore = new Event("yellow:restore-local-login-defaults", { cancelable: true });
    expect(form.dispatchEvent(restore)).toBeFalse();
    expect(restore.defaultPrevented).toBeTrue();
    expect(inputs.map((input) => input.value)).toEqual(["first", "second", "third"]);

    const operator = await Bun.file(new URL("../src/http/operator/operator.js", import.meta.url)).text();
    expect(operator).toContain('new Event("yellow:restore-local-login-defaults", { cancelable: true })');
    expect(operator).toContain('if (loginForm.dispatchEvent(event)) loginForm.elements.password.value = "";');

    const showLogin = operator.slice(operator.indexOf("function showLogin()"), operator.indexOf("async function loadProperties()"));
    expect(showLogin).toContain("restoreLocalLoginDefaults();");
    const submit = operator.slice(
      operator.indexOf('loginForm.addEventListener("submit"'),
      operator.indexOf('availabilityForm.addEventListener("submit"'),
    );
    expect(submit).toContain("operator = body.user;\n  restoreLocalLoginDefaults();");
    expect(submit).toContain('} catch (error) {\n  accessToken = "";\n  restoreLocalLoginDefaults();');
  });

  test("late browser clearing is repaired on later lifecycle signals without overriding founder input", async () => {
    const response = operatorAssets.localPrefillJs();
    const script = await response.text();
    expect(script).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
    expect(script).not.toMatch(/yellow-demo|operator@|password|local-deposit/i);

    class TestInput {
      readonly dataset: Record<string, string>;
      value = "";
      constructor(localDefault: string) { this.dataset = { localDefault }; }
    }
    const inputs = ["tenant-default", "email-default", "secret-default"].map((value) => new TestInput(value));
    const windowListeners = new Map<string, (event: Event) => void>();
    const documentListeners = new Map<string, (event: Event) => void>();
    const formListeners = new Map<string, (event: Event) => void>();
    const timers: Array<() => void> = [];
    const frames: Array<(timestamp: number) => void> = [];
    const form = {
      elements: inputs,
      addEventListener(type: string, listener: (event: Event) => void) { formListeners.set(type, listener); },
    };
    const documentHarness = {
      visibilityState: "visible",
      querySelector: () => form,
      addEventListener(type: string, listener: (event: Event) => void) { documentListeners.set(type, listener); },
    };
    new Function("document", "HTMLInputElement", "addEventListener", "setTimeout", "requestAnimationFrame", script)(
      documentHarness,
      TestInput,
      (type: string, listener: (event: Event) => void) => { windowListeners.set(type, listener); },
      (callback: () => void) => { timers.push(callback); },
      (callback: (timestamp: number) => void) => { frames.push(callback); },
    );

    for (const callback of timers.splice(0)) callback();
    while (frames.length > 0) frames.shift()?.(0);
    expect(inputs.map((input) => input.value)).toEqual(["tenant-default", "email-default", "secret-default"]);

    inputs.forEach((input) => { input.value = ""; });
    windowListeners.get("focus")?.(new Event("focus"));
    expect(inputs.map((input) => input.value)).toEqual(["tenant-default", "email-default", "secret-default"]);

    inputs.forEach((input) => { input.value = ""; });
    windowListeners.get("pageshow")?.(new Event("pageshow"));
    expect(inputs.map((input) => input.value)).toEqual(["tenant-default", "email-default", "secret-default"]);

    inputs.forEach((input) => { input.value = ""; });
    documentListeners.get("visibilitychange")?.(new Event("visibilitychange"));
    expect(inputs.map((input) => input.value)).toEqual(["tenant-default", "email-default", "secret-default"]);

    inputs[0]!.value = "founder-tenant";
    inputs[1]!.value = "founder@example.test";
    inputs[2]!.value = "founder-entered-secret";
    windowListeners.get("focus")?.(new Event("focus"));
    expect(inputs.map((input) => input.value)).toEqual([
      "founder-tenant",
      "founder@example.test",
      "founder-entered-secret",
    ]);
  });

  test("server source gates a complete process-only trio behind loopback and explicit enablement", async () => {
    const source = await Bun.file(new URL("../src/server.ts", import.meta.url)).text();
    expect(source).toContain('Bun.env.YELLOW_LOCAL_REVIEW_PREFILL !== "1"');
    expect(source).toContain("Object.values(credentials).some((value) => value.length === 0)");
    expect(source).not.toMatch(/console\.(?:log|error|warn)\([^\n]*(?:LOCAL_REVIEW|credentials)/);
    const operator = await Bun.file(new URL("../src/http/operator.ts", import.meta.url)).text();
    expect(operator).toContain('new Set(["127.0.0.1", "localhost", "[::1]", "::1"])');
    const compose = await Bun.file(new URL("../docker-compose.yml", import.meta.url)).text();
    for (const name of ["YELLOW_LOCAL_REVIEW_PREFILL", "YELLOW_LOCAL_REVIEW_TENANT", "YELLOW_LOCAL_REVIEW_EMAIL", "YELLOW_LOCAL_REVIEW_PASSWORD"]) {
      expect(compose).toContain(`${name}: "\${${name}`);
    }
  });
});
