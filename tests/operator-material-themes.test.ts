import { expect, test } from "bun:test";

const htmlFile = new URL("../src/http/operator/index.html", import.meta.url);
const cssFile = new URL("../src/http/operator/operator.css", import.meta.url);
const scriptFile = new URL("../src/http/operator/operator.js", import.meta.url);

const themes = [
  "apple", "macos", "win95", "winxp", "windows", "pixel", "linux", "glass",
  "neo", "skeuo", "clay", "aurora", "stripe", "airbnb", "duolingo",
] as const;

function themeBlock(css: string, theme: string) {
  const marker = `:root[data-theme="${theme}"] {`;
  const order184 = css.indexOf("/* Order 184:");
  const start = css.indexOf(marker, order184);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n}", start);
  expect(end).toBeGreaterThan(start);
  return css.slice(start, end + 2);
}

test("Order184: all advertised appearances are allowlisted and keep one semantic app", async () => {
  const html = await Bun.file(htmlFile).text();
  const script = await Bun.file(scriptFile).text();
  const appearanceSelect = html.match(/<select id="theme-select"[\s\S]*?<\/select>/)?.[0] ?? "";
  const advertised = [...appearanceSelect.matchAll(/<option value="([^"]+)">/g)].map((match) => match[1]);
  expect(advertised).toEqual(["yellow", ...themes]);
  expect(new Set(advertised).size).toBe(16);
  for (const theme of advertised) {
    expect(html).toContain(`<option value="${theme}">`);
    expect(script).toContain(`"${theme}"`);
  }
  expect(html.match(/id="workbench-view"/g)).toHaveLength(1);
  expect(script).toContain("document.documentElement.dataset.theme = next");
  expect(script).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
});

test("Order184: every skin declares a complete non-colour material vector", async () => {
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

test("Order184: signature materials are structural and accessibility fallbacks are permanent", async () => {
  const css = await Bun.file(cssFile).text();
  expect(themeBlock(css, "win95")).toContain("outset");
  expect(css).toContain(':root[data-theme="win95"] input');
  expect(themeBlock(css, "winxp")).toContain("linear-gradient");
  expect(themeBlock(css, "windows")).toContain("--material-card-filter: blur(18px)");
  expect(themeBlock(css, "glass")).toContain("--material-card-filter: blur(22px) saturate(155%)");
  expect(themeBlock(css, "glass")).toContain("rgba(255,255,255,.42)");
  expect(themeBlock(css, "neo")).toContain("-8px -8px 18px");
  expect(themeBlock(css, "neo")).toContain("inset -4px -4px 9px");
  expect(themeBlock(css, "skeuo")).toContain("repeating-linear-gradient");
  expect(themeBlock(css, "clay")).toContain("3px solid");
  expect(css).toContain("@keyframes yellow-aurora");
  expect(css).toContain("@supports not ((-webkit-backdrop-filter: blur(2px)) or (backdrop-filter: blur(2px)))");
  expect(css).toContain("@media (forced-colors: active)");
  expect(css).toContain(':root[data-theme="aurora"] body { animation: none; }');
  expect(css).toContain("min-height: 44px");
});

test("Order184: the material system remains dependency-free and same-origin", async () => {
  const text = `${await Bun.file(htmlFile).text()}\n${await Bun.file(cssFile).text()}\n${await Bun.file(scriptFile).text()}`;
  expect(text).not.toMatch(/https?:\/\/|@import|url\s*\(/i);
  expect(text).not.toMatch(/logo|trademark/i);
});
