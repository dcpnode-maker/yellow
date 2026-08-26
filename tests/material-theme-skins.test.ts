import { expect, test } from "bun:test";
import { gzipSync } from "node:zlib";

const cssFile = new URL("../src/http/operator/operator.css", import.meta.url);
const htmlFile = new URL("../src/http/operator/index.html", import.meta.url);
const scriptFile = new URL("../src/http/operator/operator.js", import.meta.url);

const themes = [
  "apple", "android", "win95", "glass", "neo",
] as const;

function themeBlock(css: string, theme: string): string {
  const marker = `:root[data-theme="${theme}"] {`;
  const start = css.indexOf(marker, css.indexOf("/* Order 184:"));
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n", start);
  expect(end).toBeGreaterThan(start);
  const material = css.slice(start, end);
  return material;
}

test("Order188: the five founder-selected systems carry structural material vectors", async () => {
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
    expect(css).toContain(`:root[data-theme="${theme}"] {`);
  }
  expect(css).toMatch(/\.app-bar[^{]*\{[^}]*display:\s*flex/);
  expect(css).toMatch(/\.card[^{]*\{[^}]*box-shadow:\s*var\(--card-shadow\)/);
  expect(css).toMatch(/\.domain-nav[^{]*\{[^}]*display:\s*grid/);
  expect(css).toMatch(/\.primary[^{]*\{[^}]*box-shadow:\s*var\(--material-primary-shadow\)/);
});

test("Order185: material signatures, fallbacks and accessibility contracts are explicit", async () => {
  const css = await Bun.file(cssFile).text();
  expect(css).toMatch(/backdrop-filter:\s*blur\(/);
  expect(css).toMatch(/@supports not[\s\S]*backdrop-filter[\s\S]*--material-card-filter:\s*none/);
  expect(css).toMatch(/data-theme="win95"[\s\S]*outset/);
  expect(css).toMatch(/data-theme="win95"[\s\S]*inset/);
  expect(css).toMatch(/data-theme="android"[\s\S]*min-height:\s*48px/);
  expect(css).toMatch(/data-theme="neo"[\s\S]*inset/);
  expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  expect(css).toContain("@keyframes glass-stage-in");
  expect(css).toMatch(/prefers-reduced-motion:[\s\S]*glass-stage-in[\s\S]*animation:\s*none/);
  expect(css).toMatch(/@media \(forced-colors: active\)/);
  expect(css).toMatch(/min-height:\s*44px/);
});

test("Order185: skins use distinct layout grammars rather than palette aliases", async () => {
  const [css, html] = await Promise.all([Bun.file(cssFile).text(), Bun.file(htmlFile).text()]);
  const rules = (theme: string) => [...css.matchAll(new RegExp(`[^{}]*data-theme="${theme}"[^{}]*\\{[^{}]*\\}`, "g"))]
    .map((match) => match[0]).join("\n");
  const signatures: Record<(typeof themes)[number], RegExp[]> = {
    apple: [/display:\s*block/, /flex-direction:\s*row/],
    android: [/display:\s*block/, /flex-direction:\s*row/],
    win95: [/274px/, /border:\s*2px inset/],
    glass: [/278px/, /repeat\(12/],
    neo: [/border-radius:\s*24px/, /inset/],
  };
  for (const [theme, patterns] of Object.entries(signatures)) {
    const scoped = rules(theme);
    expect(scoped).toContain(`data-theme="${theme}"`);
    for (const pattern of patterns) expect(scoped).toMatch(pattern);
  }
  expect(css).not.toMatch(/data-theme="[^"]+"[^{}]*\.domain-nav-group[^{}]*clip-path/);
  expect(css).not.toMatch(/data-theme="[^"]+"[^{}]*\{[^}]*(?:^|[;{]\s*)order:/m);
  expect(css).not.toMatch(/data-theme="(?:yellow|macos|winxp|windows|pixel|linux|skeuo|clay|aurora|stripe|airbnb|duolingo)"/);
  expect(css).toMatch(/@media \(max-width:\s*600px\)[\s\S]*\.app-bar\s*\{[^}]*position:\s*relative[\s\S]*\.domain-bar\s*\{[^}]*top:\s*0/);
  expect(html.indexOf('class="property-context"')).toBeLessThan(html.indexOf('class="domain-nav"'));
});

test("Order185: skins remain responsive, dependency-free and inside the asset ceiling", async () => {
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
