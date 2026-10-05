import { expect, test } from "bun:test";

const htmlFile = new URL("../src/http/operator/index.html", import.meta.url);
const cssFile = new URL("../src/http/operator/operator.css", import.meta.url);
const scriptFile = new URL("../src/http/operator/operator.js", import.meta.url);

const themes = [
  "apple", "android", "win95", "glass", "neo", "erp",
] as const;

function themeBlock(css: string, theme: string) {
  const marker = `:root[data-theme="${theme}"] {`;
  const order184 = css.indexOf("/* Order 184:");
  const start = css.indexOf(marker, order184);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n", start);
  expect(end).toBeGreaterThan(start);
  return css.slice(start, end);
}

function token(block: string, name: string) {
  const value = block.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
  expect(value).toBeDefined();
  return value!;
}

function contrast(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  };
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

test("Order195 / Order458: six historical CSS families remain internal behind one eight-interface app", async () => {
  const html = await Bun.file(htmlFile).text();
  const script = await Bun.file(scriptFile).text();
  const workspaceSelect = html.match(/<select id="workspace-skin-select"[\s\S]*?<\/select>/)?.[0] ?? "";
  const advertised = [...workspaceSelect.matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)]
    .map((match) => [match[1], match[2]]);
  expect(advertised).toEqual([
    ["ledger", "Ledger · Precision desk"], ["aura", "Aura · Spatial glass"],
    ["relay", "Relay · Operations board"], ["journey", "Journey · Guided workspace"],
    ["orbit", "Orbit · Command centre"], ["atlas", "Atlas · Portfolio studio"],
    ["focus", "Focus · Task companion"], ["index", "Index · Planning desk"],
  ]);
  expect(new Set(advertised.map(([value]) => value)).size).toBe(8);
  expect(html.match(/id="workbench-view"/g)).toHaveLength(1);
  expect(html).not.toMatch(/id="(?:theme|experience)-select"|>Appearance<|>Workspace detail</);
  expect(script).toContain('const WORKSPACE_SKINS = new Set(["ledger", "aura", "relay", "journey", "orbit", "atlas", "focus", "index"])');
  expect(script).toContain('WORKSPACE_SKINS.has(skin) ? skin : "ledger"');
  expect(script).toContain("document.documentElement.dataset.workspaceSkin = next");
  expect(script).not.toMatch(/document\.documentElement\.dataset\.(?:theme|experience)\s*=|\b(?:THEMES|EXPERIENCES)\b|applyTheme|applyExperience/);
  expect(script).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
});

test("Order185: every skin declares a complete non-colour material vector", async () => {
  const css = await Bun.file(cssFile).text();
  const required = [
    "--font-ui:", "--control-radius:", "--card-radius:", "--material-card:",
    "--material-card-border:", "--material-card-shadow:", "--material-control:",
    "--material-control-border:", "--material-control-shadow:", "--material-primary:",
    "--material-primary-shadow:", "--material-nav:",
  ];
  for (const theme of themes) {
    const block = themeBlock(css, theme);
    for (const property of required) expect(block).toContain(property);
    expect(block).not.toMatch(/(?:^|[;{]\s*)(?:display|visibility|position|order)\s*:/m);
  }
});

test("Order185: signature materials are structural and accessibility fallbacks are permanent", async () => {
  const css = await Bun.file(cssFile).text();
  expect(themeBlock(css, "win95")).toContain("outset");
  expect(css).toContain(':root[data-theme="win95"] input');
  expect(themeBlock(css, "glass")).toContain("--material-card-filter: blur(24px) saturate(165%)");
  expect(themeBlock(css, "glass")).toContain("--paper: #071126");
  expect(themeBlock(css, "android")).toContain("--material-press: scale(.97)");
  expect(themeBlock(css, "neo")).toContain("inset -4px -4px 8px #ffffff");
  expect(css).toContain("@supports not ((-webkit-backdrop-filter: blur(2px)) or (backdrop-filter: blur(2px)))");
  expect(css).toContain("@media (forced-colors: active)");
  expect(css).toContain(':root[data-theme="android"] :is(button, input, select, textarea, .domain-tab) { min-height: 48px; }');
  expect(css).toContain(':root[data-theme="win95"] .win-taskbar');
  expect(css).toContain(':root[data-theme="glass"] .depth-plane-front');
  expect(css).toContain("min-height: 44px");
});

test("Order188: narrow Android domain tabs retain exact 48px targets in local scroll", async () => {
  const css = await Bun.file(cssFile).text();
  const narrowStart = css.lastIndexOf("@media (max-width: 767px)");
  const narrowEnd = css.indexOf("@supports not", narrowStart);
  expect(narrowStart).toBeGreaterThanOrEqual(0);
  expect(narrowEnd).toBeGreaterThan(narrowStart);
  const narrowAndroid = css.slice(narrowStart, narrowEnd);
  const tabRule = narrowAndroid.match(/:root\[data-theme="android"\] \.domain-tab \{([^}]*)\}/)?.[1] ?? "";
  expect(tabRule).toMatch(/(?:^|;)\s*flex:\s*0 0 auto\s*;/);
  expect(tabRule).toMatch(/(?:^|;)\s*min-inline-size:\s*48px\s*;/);
  expect(tabRule).toMatch(/(?:^|;)\s*min-block-size:\s*48px\s*;/);
  expect(css).toMatch(/:root\[data-theme="android"\] \.domain-nav \{[^}]*overflow-x:\s*auto\s*;/);
});

test("Order185: welcome text and classic focus remain visibly accessible", async () => {
  const css = await Bun.file(cssFile).text();
  for (const theme of themes) {
    const block = themeBlock(css, theme);
    const paper = token(block, "--paper");
    expect(contrast(token(block, "--ink"), paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(block, "--muted"), paper)).toBeGreaterThanOrEqual(4.5);
  }
  const win95 = themeBlock(css, "win95");
  expect(contrast(token(win95, "--focus"), token(win95, "--nav"))).toBeGreaterThanOrEqual(3);
  expect(css).toContain(':root[data-theme="win95"] .app-bar :is(button, select, a):focus-visible');
  expect(css).toContain("box-shadow: 0 0 0 2px #000000");
  expect(contrast("#000000", "#c0c0c0")).toBeGreaterThanOrEqual(3);
});

test("Order185: the material system remains dependency-free and same-origin", async () => {
  const [html, css, script] = await Promise.all([
    Bun.file(htmlFile).text(), Bun.file(cssFile).text(), Bun.file(scriptFile).text(),
  ]);
  const text = `${html}\n${css}\n${script}`;
  expect(html.match(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g)).toHaveLength(1);
  expect(css.match(/url\("\/static\/fonts\/urbanist-v1\.330\.woff2"\)/g)).toHaveLength(1);
  expect(script).not.toMatch(/https?:\/\/|@import|url\s*\(/i);
  expect(text.replace('xmlns="http://www.w3.org/2000/svg"', "")
    .replace('url("/static/fonts/urbanist-v1.330.woff2")', ""))
    .not.toMatch(/https?:\/\/|@import|url\s*\(/i);
  expect(text).not.toMatch(/logo|trademark/i);
});
