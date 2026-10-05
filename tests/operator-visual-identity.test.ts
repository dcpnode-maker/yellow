import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createApp } from "../src/app";
import type { OperatorHttpApi } from "../src/http/operator";

const repository = resolve(import.meta.dir, "..");
const operatorRoot = resolve(repository, "src/http/operator");
const fontPath = resolve(operatorRoot, "vendor/urbanist-v1.330/Urbanist[ital,wght].woff2");
const urbanistLicensePath = resolve(operatorRoot, "vendor/urbanist-v1.330/OFL.txt");
const spritePath = resolve(operatorRoot, "vendor/phosphor-core-2.1.1/phosphor-nav-regular.svg");
const phosphorLicensePath = resolve(operatorRoot, "vendor/phosphor-core-2.1.1/LICENSE");
const noticePath = resolve(operatorRoot, "vendor/ASTRA-VISUAL-ASSETS-NOTICE.md");

const FONT_SHA256 = "464493d71c6645dd5c6c4c2bb3b1620011283bf0ff06ae7dd61fa983d25bc628";
const URBANIST_LICENSE_SHA256 = "502f01e7ab22276fa50b68f6e4b9db36d2928e08de227484ec5f430cb0d9defa";
const SPRITE_SHA256 = "1fe873c70f4a2e3734ffa1118a078e0b1ac986d01499eb462b788acfb81358c0";
const PHOSPHOR_LICENSE_SHA256 = "b5b1f1da112d18ea2147decfd48ddc1bf2b5aeb6c265381579340e95b15a2bb2";
const navIcons = Object.freeze([
  ["nav-today", "calendar-check"],
  ["nav-availability", "chart-bar"],
  ["nav-reservations", "calendar-dots"],
  ["nav-folios", "notebook"],
  ["nav-invoices", "invoice"],
  ["nav-cashiers", "cash-register"],
  ["nav-day-close", "calendar-x"],
  ["nav-trust", "hand-coins"],
  ["nav-operations", "bed"],
  ["nav-housekeeping", "broom"],
  ["nav-vehicles", "car"],
  ["nav-inventory", "package"],
  ["nav-restrictions", "prohibit"],
  ["nav-rates", "tag"],
  ["nav-status", "chart-line-up"],
] as const);

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("Q211 self-hosted Astra visual identity", () => {
  test("vendors the exact pinned font, sprite and complete upstream licences", async () => {
    const [font, urbanistLicense, sprite, phosphorLicense, notice] = await Promise.all([
      readFile(fontPath),
      readFile(urbanistLicensePath),
      readFile(spritePath),
      readFile(phosphorLicensePath),
      readFile(noticePath, "utf8"),
    ]);

    expect(font.byteLength).toBe(58_004);
    expect(sha256(font)).toBe(FONT_SHA256);
    expect(sha256(urbanistLicense)).toBe(URBANIST_LICENSE_SHA256);
    expect(sha256(sprite)).toBe(SPRITE_SHA256);
    expect(sha256(phosphorLicense)).toBe(PHOSPHOR_LICENSE_SHA256);
    expect(urbanistLicense.toString("utf8")).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(urbanistLicense.toString("utf8")).toContain("Copyright 2024 The Urbanist Project Authors");
    expect(phosphorLicense.toString("utf8")).toContain("MIT License");
    expect(phosphorLicense.toString("utf8")).toContain("Copyright (c) 2023 Phosphor Icons");
    for (const value of [
      "549716453f76335ccc5a9e537cbe0da03d6fed34",
      "2b75f3ad12b420c9504ef05df8d2564a28f8500e",
      FONT_SHA256,
      SPRITE_SHA256,
      "Urbanist[ital,wght].woff2 is stored byte-for-byte without modification",
      "combined without path-data edits",
    ]) expect(notice).toContain(value);
    for (const [, icon] of navIcons) expect(notice).toContain(`/assets/regular/${icon}.svg`);
  });

  test("maps fifteen distinct labelled destinations to safe currentColor regular symbols", async () => {
    const [html, sprite] = await Promise.all([
      readFile(resolve(operatorRoot, "index.html"), "utf8"),
      readFile(spritePath, "utf8"),
    ]);

    const canonicalSymbols = [...sprite.matchAll(/<symbol\s+id="([^"]+)"[^>]*>[\s\S]*?<\/symbol>/g)];
    const inlineSymbols = [...html.matchAll(/<symbol\s+id="([^"]+)"[^>]*>[\s\S]*?<\/symbol>/g)];
    const symbols = canonicalSymbols.map(match => match[1]);
    expect(symbols).toEqual(navIcons.map(([, icon]) => `ph-${icon}`));
    expect(new Set(symbols).size).toBe(15);
    expect(inlineSymbols.map(match => match[1])).toEqual(symbols);
    expect(inlineSymbols.map(match => match[0])).toEqual(canonicalSymbols.map(match => match[0]));
    expect(html).toContain("<svg hidden aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\">");
    expect(sprite.match(/fill="currentColor"/g)?.length).toBe(15);
    expect(sprite).not.toMatch(/<script\b|\bon\w+\s*=|<foreignObject\b|\bfilter\s*=|(?:href|src)\s*=\s*["'](?:https?:|\/\/|data:)/i);

    for (const [id, icon] of navIcons) {
      expect(html).toMatch(new RegExp(`<button[^>]+id="${id}"[\\s\\S]*?<svg[^>]+aria-hidden="true"[^>]*>[\\s\\S]*?<use href="#ph-${icon}"\\s*\\/>[\\s\\S]*?<span>[^<]+<\\/span>`));
    }
    expect(html).not.toMatch(/href="#i-|<svg[^>]*>\s*<path/i);
    expect(html).not.toContain("ph-currency");
  });

  test("serves only the two explicit same-origin assets with security headers and exact MIME", async () => {
    const app = createApp({ operatorApi: {} as OperatorHttpApi });
    const font = await app.handle(new Request("http://yellow.test/static/fonts/urbanist-v1.330.woff2"));
    const sprite = await app.handle(new Request("http://yellow.test/static/icons/phosphor-nav-2.1.1.svg"));
    expect(font.status).toBe(200);
    expect(font.headers.get("content-type")).toBe("font/woff2");
    expect((await font.arrayBuffer()).byteLength).toBe(58_004);
    expect(sprite.status).toBe(200);
    expect(sprite.headers.get("content-type")).toBe("image/svg+xml");
    expect((await sprite.text()).match(/<symbol\b/g)?.length).toBe(15);
    for (const response of [font, sprite]) {
      expect(response.headers.get("cache-control")).toBe("no-cache");
      expect(response.headers.get("content-security-policy")).toContain("font-src 'self'");
      expect(response.headers.get("content-security-policy")).toContain("img-src 'self'");
    }
    expect((await app.handle(new Request("http://yellow.test/static/fonts/OFL.txt"))).status).toBe(404);
    expect((await app.handle(new Request("http://yellow.test/static/icons/LICENSE"))).status).toBe(404);
    expect((await app.handle(new Request("http://yellow.test/static/icons/phosphor-nav-2.1.2.svg"))).status).toBe(404);
  });

  test("applies swap-loaded Urbanist only to public workspaces with a visible system fallback", async () => {
    const [html, css, script] = await Promise.all([
      readFile(resolve(operatorRoot, "index.html"), "utf8"),
      readFile(resolve(operatorRoot, "operator.css"), "utf8"),
      readFile(resolve(operatorRoot, "operator.js"), "utf8"),
    ]);
    expect(css).toMatch(/@font-face\s*{[^}]*font-family:\s*"Urbanist";[^}]*url\("\/static\/fonts\/urbanist-v1\.330\.woff2"\)[^}]*font-weight:\s*100 900;[^}]*font-display:\s*swap;/s);
    expect(css).toMatch(/html:root\[data-workspace-skin\]\s*{[^}]*--font-ui:\s*"Urbanist",\s*ui-sans-serif,\s*system-ui,\s*-apple-system,\s*"Segoe UI",\s*sans-serif;/s);
    expect(`${html}\n${css}\n${script}`
      .replaceAll('xmlns="http://www.w3.org/2000/svg"', "")
      .replaceAll('url("/static/fonts/urbanist-v1.330.woff2")', ""))
      .not.toMatch(/https?:\/\/|@import|url\s*\(/i);
  });
});
