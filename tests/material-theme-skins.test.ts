import { expect, test } from "bun:test";
import { gzipSync } from "node:zlib";

const cssFile = new URL("../src/http/operator/operator.css", import.meta.url);
const htmlFile = new URL("../src/http/operator/index.html", import.meta.url);
const scriptFile = new URL("../src/http/operator/operator.js", import.meta.url);

const themes = [
  "yellow", "apple", "macos", "win95", "winxp", "windows", "pixel", "linux",
  "glass", "neo", "skeuo", "clay", "aurora", "stripe", "airbnb", "duolingo",
] as const;

function themeBlock(css: string, theme: string): string {
  const marker = theme === "yellow" ? ":root {" : `:root[data-theme="${theme}"] {`;
  const start = css.indexOf(marker, css.indexOf("/* Order 184:"));
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n}", start);
  expect(end).toBeGreaterThan(start);
  const material = css.slice(start, end + 2);
  if (theme !== "yellow") return material;
  const baseStart = css.indexOf(":root {");
  const baseEnd = css.indexOf("\n}", baseStart);
  return `${css.slice(baseStart, baseEnd + 2)}\n${material}`;
}

test("Order184: all sixteen skins carry structural material vectors", async () => {
  const css = await Bun.file(cssFile).text();
  const categories = [
    /--(?:control|card)-radius:/, // geometry
    /--font-(?:ui|display):/, // typography
    /--material-nav(?:-border|-shadow)?:/, // navigation
    /--material-card(?:-border|-shadow)?:/, // cards
    /--material-control(?:-border|-shadow)?:/, // controls
    /--material-(?:card|control|primary|nav)-shadow:/, // elevation
  ];
  for (const theme of themes) {
    const block = themeBlock(css, theme);
    expect(block).toContain(`--font-ui:`);
    for (const category of categories) expect(block).toMatch(category);
    expect(css).toContain(theme === "yellow" ? ":root {" : `:root[data-theme="${theme}"] {`);
  }
  expect(css).toMatch(/\.app-bar[^{]*\{[^}]*display:\s*flex/);
  expect(css).toMatch(/\.card[^{]*\{[^}]*box-shadow:\s*var\(--card-shadow\)/);
  expect(css).toMatch(/\.domain-nav[^{]*\{[^}]*display:\s*grid/);
  expect(css).toMatch(/\.primary[^{]*\{[^}]*box-shadow:\s*var\(--material-primary-shadow\)/);
});

test("Order184: material signatures, fallbacks and accessibility contracts are explicit", async () => {
  const css = await Bun.file(cssFile).text();
  expect(css).toMatch(/backdrop-filter:\s*blur\(/);
  expect(css).toMatch(/@supports not[\s\S]*backdrop-filter[\s\S]*--material-card-filter:\s*none/);
  expect(css).toMatch(/data-theme="win95"[\s\S]*outset/);
  expect(css).toMatch(/data-theme="win95"[\s\S]*inset/);
  expect(css).toMatch(/data-theme="neo"[\s\S]*-8px[\s\S]*inset -4px/);
  expect(css).toMatch(/data-theme="skeuo"[\s\S]*repeating-linear-gradient/);
  expect(css).toMatch(/data-theme="clay"[\s\S]*3px solid/);
  expect(css).toMatch(/data-theme="aurora"[\s\S]*animation:/);
  expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  expect(css).toMatch(/@media \(forced-colors: active\)/);
  expect(css).toMatch(/min-height:\s*44px/);
});

test("Order184: skins use distinct layout grammars rather than palette aliases", async () => {
  const [css, html] = await Promise.all([Bun.file(cssFile).text(), Bun.file(htmlFile).text()]);
  const rules = (theme: string) => [...css.matchAll(new RegExp(`[^{}]*data-theme="${theme}"[^{}]*\\{[^{}]*\\}`, "g"))]
    .map((match) => match[0]).join("\n");
  const signatures: Record<(typeof themes)[number], RegExp[]> = {
    yellow: [/272px/, /status-summary-grid/, /status-phase-list/],
    apple: [/display:\s*block/, /flex-direction:\s*row/],
    macos: [/218px/, /28px 70px/], win95: [/274px/, /border:\s*2px inset/],
    winxp: [/258px/, /#214d99/], windows: [/280px/, /-webkit-backdrop-filter:\s*blur\(22px\)/],
    pixel: [/display:\s*block/, /flex-direction:\s*row/],
    linux: [/208px/, /background:\s*#252525/], glass: [/278px/, /repeat\(12/],
    neo: [/252px/, /minmax\(340px,1fr\)/], skeuo: [/286px/, /10px solid/],
    clay: [/270px/, /rotate\(/], aurora: [/232px/, /repeat\(12/],
    stripe: [/210px/, /minmax\(320px,1fr\)/],
    airbnb: [/228px/, /max-width:\s*1060px/],
    duolingo: [/258px/, /minmax\(360px,1fr\)/],
  };
  for (const [theme, patterns] of Object.entries(signatures)) {
    const scoped = rules(theme);
    expect(scoped).toContain(`data-theme="${theme}"`);
    for (const pattern of patterns) expect(scoped).toMatch(pattern);
  }
  expect(css).not.toMatch(/data-theme="[^"]+"[^{}]*\.domain-nav-group[^{}]*clip-path/);
  expect(css).not.toMatch(/data-theme="[^"]+"[^{}]*\{[^}]*(?:^|[;{]\s*)order:/m);
  expect(css).not.toMatch(/data-theme="macos"[^{}]*\.workbench[^{}]*\{[^}]*overflow:\s*clip/);
  expect(css).toMatch(/@media \(max-width:\s*600px\)[\s\S]*\.app-bar\s*\{[^}]*position:\s*relative[\s\S]*\.domain-bar\s*\{[^}]*top:\s*0/);
  expect(html.indexOf('class="property-context"')).toBeLessThan(html.indexOf('class="domain-nav"'));
});

test("Order184: skins remain responsive, dependency-free and inside the asset ceiling", async () => {
  const [html, css, script] = await Promise.all([
    Bun.file(htmlFile).text(), Bun.file(cssFile).text(), Bun.file(scriptFile).text(),
  ]);
  expect(css).toMatch(/@media \(max-width:\s*900px\)/);
  expect(css).toMatch(/@media \(max-width:\s*560px\)/);
  const all = `${html}\n${css}\n${script}`;
  expect(all).not.toMatch(/https?:\/\/|@import|url\s*\(/i);
  expect([html, css, script].reduce((sum, asset) => sum + gzipSync(asset).byteLength, 0))
    .toBeLessThanOrEqual(96 * 1024);
});
