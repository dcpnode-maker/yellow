import { expect, test } from "bun:test";

import { operatorAssets } from "../src/http/operator";

const htmlFile = new URL("../src/http/operator/index.html", import.meta.url);
const scriptFile = new URL("../src/http/operator/operator-interfaces.js", import.meta.url);
const styleFile = new URL("../src/http/operator/operator-interfaces.css", import.meta.url);
const appFile = new URL("../src/app.ts", import.meta.url);
const operatorFile = new URL("../src/http/operator.ts", import.meta.url);
const interfaces = ["ledger", "aura", "relay", "journey", "orbit", "atlas", "focus", "index"] as const;

test("Order458 exposes one native interface gallery after the existing presentation controller", async () => {
  const html = await Bun.file(htmlFile).text();
  expect(html).toContain('<html lang="en" data-theme="apple" data-workspace-skin="ledger">');
  expect(html).toContain('<link rel="stylesheet" href="/assets/operator-interfaces.css">');
  expect(html.indexOf('<script src="/assets/operator.js" defer></script>'))
    .toBeLessThan(html.indexOf('<script src="/assets/operator-interfaces.js" defer></script>'));
  expect(html).toContain('<button class="quiet" id="interface-gallery-open" type="button" aria-haspopup="dialog">');
  expect(html).toContain('<dialog id="interface-gallery" aria-labelledby="interface-gallery-title" aria-describedby="interface-gallery-description">');
  expect(html).toContain('id="interface-gallery-close" type="button" aria-label="Close interface gallery"');
  expect(html).toContain('<div class="interface-gallery-grid" id="interface-gallery-grid"></div>');
  const motion = html.match(/<select id="interface-motion-select"[\s\S]*?<\/select>/)?.[0] ?? "";
  expect([...motion.matchAll(/<option value="([^"]+)">/g)].map(match => match[1])).toEqual(["spatial", "reduced"]);
  expect(html.match(/id="workspace-skin-select"/g)).toHaveLength(1);
  expect(html.match(/id="workbench-view"/g)).toHaveLength(1);
});

test("Order458 gallery delegates selection and motion without data, request or route authority", async () => {
  const script = await Bun.file(scriptFile).text();
  const ids = [...script.matchAll(/^\s*\["([a-z]+)", "\d{2}",/gm)].map(match => match[1]);
  expect(ids).toEqual([...interfaces]);
  expect(new Set(ids).size).toBe(8);
  expect(script).toContain("select.value = id;");
  expect(script).toContain('select.dispatchEvent(new Event("change", { bubbles: true }));');
  expect(script).toContain("dialog.showModal();");
  expect(script).toContain('dialog.addEventListener("close", () => {');
  expect(script).toContain("returnFocus.focus({ preventScroll: true })");
  expect(script).toContain('dialog.addEventListener("cancel", clearPointer)');
  expect(script).toContain('const reduced = preference.matches || motion.value === "reduced";');
  expect(script).toContain('root.dataset.interfaceMotion = reduced ? "reduced" : "spatial";');
  expect(script).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
  expect(script).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|history\.|location\.|requestSubmit|\.submit\s*\(/);
  expect(script).not.toMatch(/accessToken|authorization|api\/v1|#(?:invoice|reservation|folio|payment)[-\w]*/i);
});

test("Order458 stylesheet owns eight bounded light presentations and accessibility fallbacks", async () => {
  const css = await Bun.file(styleFile).text();
  for (const id of interfaces) expect(css).toContain(`[data-workspace-skin="${id}"]`);
  expect(css).toContain('[data-interface-motion="reduced"]');
  expect(css).toMatch(/\.interface-miniature\s*\{[\s\S]*?overflow:\s*(?:clip|visible);[\s\S]*?perspective:\s*780px;[\s\S]*?transform-style:\s*preserve-3d;/);
  for (const depth of [18, 24, 30, 42]) expect(css).toMatch(new RegExp(`translate3d\\([^)]*,\\s*${depth}px\\)`));
  expect(css).toContain("prefers-reduced-motion: reduce");
  expect(css).toContain("forced-colors: active");
  expect(css).toMatch(/@media\s*\(max-width:\s*1020px\)/);
  expect(css).toMatch(/@media\s*\(max-width:\s*(?:767|600)px\)/);
  expect(css).not.toMatch(/overflow-x:\s*hidden/);
  expect(css).not.toMatch(/animation-iteration-count:\s*infinite|animation:\s*[^;}]*\binfinite\b|will-change\s*:/i);
});

test("Order458 interface assets are exact same-origin static responses", async () => {
  const [app, operator, expectedCss, expectedJs] = await Promise.all([
    Bun.file(appFile).text(), Bun.file(operatorFile).text(), Bun.file(styleFile).text(), Bun.file(scriptFile).text(),
  ]);
  expect(app).toContain('.get("/assets/operator-interfaces.css", () => operatorAssets.interfacesCss())');
  expect(app).toContain('.get("/assets/operator-interfaces.js", () => operatorAssets.interfacesJs())');
  expect(operator).toContain('interfacesCss: new URL("./operator/operator-interfaces.css", import.meta.url)');
  expect(operator).toContain('interfacesJs: new URL("./operator/operator-interfaces.js", import.meta.url)');
  const css = operatorAssets.interfacesCss();
  const js = operatorAssets.interfacesJs();
  expect(css.headers.get("content-type")).toBe("text/css; charset=utf-8");
  expect(js.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
  expect(css.headers.get("cache-control")).toBe("no-cache");
  expect(js.headers.get("cache-control")).toBe("no-cache");
  expect(await css.text()).toBe(expectedCss);
  expect(await js.text()).toBe(expectedJs);
});
