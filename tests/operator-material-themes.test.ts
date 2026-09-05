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

test("Order195: all six advertised appearances are allowlisted and keep one semantic app", async () => {
  const html = await Bun.file(htmlFile).text();
  const script = await Bun.file(scriptFile).text();
  const appearanceSelect = html.match(/<select id="theme-select"[\s\S]*?<\/select>/)?.[0] ?? "";
  const advertised = [...appearanceSelect.matchAll(/<option value="([^"]+)">/g)].map((match) => match[1]);
  expect(advertised).toEqual([...themes]);
  expect(new Set(advertised).size).toBe(6);
  for (const theme of advertised) {
    expect(html).toContain(`<option value="${theme}">`);
    expect(script).toContain(`"${theme}"`);
  }
  expect(html.match(/id="workbench-view"/g)).toHaveLength(1);
  expect(script).toContain("document.documentElement.dataset.theme = next");
  expect(script).toContain('const THEMES = new Set(["apple", "android", "win95", "glass", "neo", "erp"])');
  expect(script).toContain('THEMES.has(theme) ? theme : "apple"');
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
  const text = `${await Bun.file(htmlFile).text()}\n${await Bun.file(cssFile).text()}\n${await Bun.file(scriptFile).text()}`;
  expect(text).not.toMatch(/https?:\/\/|@import|url\s*\(/i);
  expect(text).not.toMatch(/logo|trademark/i);
});
