import { expect, test } from "bun:test";
import { gzipSync } from "node:zlib";

const GUEST_FILES = {
  html: new URL("../src/http/guest/index.html", import.meta.url),
  script: new URL("../src/http/guest/guest.js", import.meta.url),
  css: new URL("../src/http/guest/guest.css", import.meta.url),
};

const PROVIDER_FILES = {
  html: new URL("../src/http/provider/index.html", import.meta.url),
  script: new URL("../src/http/provider/provider.js", import.meta.url),
  css: new URL("../src/http/provider/provider.css", import.meta.url),
};

const PERSISTENCE_OR_CREDENTIAL_AUTHORITY =
  /localStorage|sessionStorage|indexedDB|document\.cookie|CacheStorage|caches\.(?:open|put|match)|sendBeacon|navigator\.credentials/i;
const DANGEROUS_DOM = /innerHTML|outerHTML|insertAdjacentHTML|document\.write/i;
const SENSITIVE_FIELD = /<(?:input|textarea|select)\b[^>]*(?:pan|card|cvv|cvc|vpa|upi|bank|account|routing|iban|password)/i;
const INLINE_EXECUTABLE = /<style\b|<script\b(?![^>]*\bsrc\s*=)/i;
const EXTERNAL_ASSET = /\b(?:src|href)\s*=\s*["'](?:https?:)?\/\//i;

async function readSurface(files: typeof GUEST_FILES) {
  return {
    html: await Bun.file(files.html).text(),
    script: await Bun.file(files.script).text(),
    css: await Bun.file(files.css).text(),
  };
}

test("Order193 P5: guest surface is token-only, server-truth-only and browser-storage free", async () => {
  const { html, script, css } = await readSurface(GUEST_FILES);

  expect(html).toContain('<html lang="en">');
  expect(html).toContain('name="viewport"');
  expect(html).toContain("data-hosted-deposit-status");
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('id="refresh" type="button"');
  expect(html).not.toMatch(/<iframe\b/i);
  expect(html).not.toMatch(SENSITIVE_FIELD);
  expect(html).not.toMatch(INLINE_EXECUTABLE);
  expect(html).not.toMatch(EXTERNAL_ASSET);

  for (const source of [html, script]) {
    expect(source).not.toMatch(PERSISTENCE_OR_CREDENTIAL_AUTHORITY);
    expect(source).not.toMatch(DANGEROUS_DOM);
  }
  expect(script).toContain('credentials: "omit"');
  expect(script).toContain('cache: "no-store"');
  expect(script).toContain('redirect: "error"');
  expect(script).toContain('parts[0] === "pay" || isReturn ? parts[1] : ""');
  expect(script).toContain("const current = ++generation.value");
  expect(script).toContain("current !== generation.value || token !== parts[1]");
  expect(script).toContain('value.state === "captured"');
  expect(script).not.toMatch(/location\.search|searchParams|URLSearchParams/);
  expect(script).not.toMatch(/setInterval|setTimeout|WebSocket|EventSource/);

  expect(css).toContain("width:min(100%");
  expect(css).toContain("min-height:3rem");
  expect(css).toContain("button:focus-visible");
  expect(css).toContain("prefers-reduced-motion:no-preference");
});

test("Order193 P5: synthetic provider exposes exactly four safe deterministic outcomes", async () => {
  const { html, script, css } = await readSurface(PROVIDER_FILES);

  expect(html).toContain('<html lang="en">');
  expect(html).toContain('name="viewport"');
  expect(html).toContain("Synthetic provider · no real money");
  expect(html).toContain('aria-live="polite"');
  expect(html.match(/data-outcome=/g)).toHaveLength(4);
  for (const outcome of ["approve", "decline", "cancel", "timeout"]) {
    expect(html).toContain(`data-outcome="${outcome}"`);
    expect(html).toContain(`value="${outcome}"`);
  }
  expect(html).toContain('<form id="actions" method="post" action="/api/provider/local-deposit/outcome"');
  expect(html).toContain('<input id="handoff" name="handoff" type="hidden">');
  expect(html).not.toMatch(/<iframe\b/i);
  expect(html).not.toMatch(/<(?:textarea|select)\b/i);
  expect(html).not.toMatch(SENSITIVE_FIELD);
  expect(html).not.toMatch(INLINE_EXECUTABLE);
  expect(html).not.toMatch(EXTERNAL_ASSET);

  for (const source of [html, script]) {
    expect(source).not.toMatch(PERSISTENCE_OR_CREDENTIAL_AUTHORITY);
    expect(source).not.toMatch(DANGEROUS_DOM);
  }
  expect(script).toContain('credentials:"omit"');
  expect(script).toContain('cache:"no-store"');
  expect(script).toContain('redirect:"error"');
  expect(script).toContain("handoffField.value=handoff");
  expect(script).not.toContain("/api/provider/local-deposit/outcome");
  expect(script).not.toMatch(/https?:\/\//i);

  expect(css).toContain("width:min(100%");
  expect(css).toContain("min-height:3rem");
  expect(css).toContain("button:focus-visible");
  expect(css).not.toMatch(/animation\s*:|transition\s*:/i);
});

test("Order193 P5: lazy operator assets have a separate small budget and provider has no PMS credential", async () => {
  const lazy=[await Bun.file(new URL("../src/http/operator/operator-deposits.js",import.meta.url)).text(),
    await Bun.file(new URL("../src/http/operator/operator-deposits.css",import.meta.url)).text()];
  expect(lazy.reduce((size,value)=>size+gzipSync(value).byteLength,0)).toBeLessThanOrEqual(8*1024);
  const compose=await Bun.file(new URL("../docker-compose.yml",import.meta.url)).text();
  const app=compose.slice(compose.indexOf("  app:"),compose.indexOf("  synthetic-provider:"));
  const provider=compose.slice(compose.indexOf("  synthetic-provider:"),compose.indexOf("  provision:"));
  expect(app).toContain("YELLOW_RUNTIME_DATABASE_URL");
  expect(provider).not.toMatch(/YELLOW_RUNTIME_DATABASE_URL|REGISTRAR|TOKEN_SECRET/);
  const server=await Bun.file(new URL("../src/server.ts",import.meta.url)).text();
  expect(server.indexOf('surface === "provider"')).toBeLessThan(server.indexOf('required("YELLOW_RUNTIME_DATABASE_URL")'));
});
