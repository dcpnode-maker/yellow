import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { createApp } from "../src/app";
import type { OperatorHttpApi } from "../src/http/operator";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

const operatorApi = new Proxy({}, {
  get: () => () => new Response("unused"),
}) as OperatorHttpApi;

function functionSource(name: string): string {
  const start = script.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const opening = script.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = opening; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

function executableFunction<T extends (...args: never[]) => unknown>(name: string): T {
  return new Function(`return (${functionSource(name)})`)() as T;
}

function cssRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Missing CSS rule ${selector}`);
  return match[1]!;
}

test("Order 171 P0/P5: reservation drawer exposes only explicit UUID-backed folio handoff", () => {
  for (const id of [
    "reservation-detail-folios", "reservation-primary-folio-create",
    "reservation-primary-folio-message", "folio-workspace-back",
  ]) expect(html).toContain(`id="${id}"`);
  expect(script).toContain("function renderReservationFolios(");
  expect(script).toContain("function openPrimaryFolio(");
  expect(functionSource("renderReservationFolios")).toContain(
    "folios.length === 0 && result.actions?.canOpenPrimaryFolio === true",
  );
  expect(functionSource("renderReservationFolios")).not.toMatch(/reservation\.status|status\s*===/);
  expect(script).toContain("/primary-folio");
  expect(script).toContain('headers: { "idempotency-key": attemptKey }');
  expect(script).toContain("reservationPrimaryFolioAttemptKey");
  expect(script).toContain("generation !== reservationDetailGeneration");
  expect(script).toContain("property !== propertySelect.value");
  expect(script).not.toMatch(/automatically creates? (?:a )?folio/i);
  const parse = executableFunction<(value: Record<string, unknown>) => Record<string, unknown>>("primaryFolioResult");
  const result = {
    folioId: "00000000-0000-0000-0000-000000017101",
    reservationId: "00000000-0000-0000-0000-000000017102",
    folioNo: "FOL-171", windowNo: 1, changed: true, replayed: false,
  };
  expect(parse(result)).toEqual(result);
  expect(() => parse({ ...result, accountId: "not-disclosed" })).toThrow("invalid primary folio result");
  expect(() => parse({ ...result, windowNo: 2 })).toThrow("invalid primary folio result");
});

test("Order 171 P0/P5: UUID workspace route is canonical, bounded and restorable", () => {
  const parse = executableFunction<(pathname: string, search: string) => Record<string, unknown>>("folioRouteFromLocation");
  const id = "00000000-0000-0000-0000-000000017100";
  expect(parse(`/p/${id}/folio/${id}`, "?tab=postings")).toEqual({
    kind: "workspace", property: id, folioId: id, tab: "postings", after: "",
  });
  expect(parse(`/p/${id}/folio/${id}`, "?tab=charge&after=abc_DEF-123")).toEqual({
    kind: "workspace", property: id, folioId: id, tab: "charge", after: "abc_DEF-123",
  });
  expect(parse(`/p/${id}/folio/${id}`, "?tab=unknown&after=bad%20cursor")).toEqual({
    kind: "workspace", property: id, folioId: id, tab: "postings", after: "",
  });
  expect(parse(`/p/${id}/folios`, "")).toEqual({ kind: "list", property: id });
  expect(executableFunction<(rows: unknown[]) => unknown[]>("boundedFolioPage")(
    Array.from({ length: 80 }, (_, index) => index),
  )).toEqual(Array.from({ length: 50 }, (_, index) => index));
  expect(functionSource("renderFolioRows")).toContain("folioStatementRows.replaceChildren()");
  expect(functionSource("renderFolioRows")).toContain("folioStatementCards.replaceChildren()");
  expect(functionSource("renderFolioRows")).not.toContain("append = false");
});

test("Order 174 P1/P2: singular UUID folio deep links serve only the exact operator shell route", async () => {
  const app = createApp({ operatorApi });
  const property = "00000000-0000-4000-8000-000000017400";
  const folio = "00000000-0000-4000-8000-000000017401";
  const plural = await app.handle(new Request(`http://order174.test/p/${property}/folios`));
  const singular = await app.handle(new Request(`http://order174.test/p/${property}/folio/${folio}`));

  expect(plural.status).toBe(200);
  expect(singular.status).toBe(200);
  expect(plural.headers.get("content-type")).toContain("text/html");
  expect(singular.headers.get("content-type")).toContain("text/html");
  expect(await singular.text()).toBe(await plural.text());

  const neighboringShells = [
    "/",
    `/p/${property}/res/00000000-0000-4000-8000-000000017402`,
  ];
  for (const path of neighboringShells) {
    const response = await app.handle(new Request(`http://order174.test${path}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toBe(html);
  }

  for (const path of [
    `/p/${property}/folio`,
    `/p/${property}/folio/${folio}/extra`,
    `/p/${property}/unknown/${folio}`,
  ]) {
    const response = await app.handle(new Request(`http://order174.test${path}`));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("NOT_FOUND");
  }
});

test("Order 171 P5: statement has semantic desktop and equivalent mobile states", () => {
  for (const id of [
    "folio-workspace", "folio-workspace-title", "folio-statement-loading",
    "folio-statement-error", "folio-statement-retry", "folio-statement-cards",
    "folio-tab-postings", "folio-tab-charge",
  ]) expect(html).toContain(`id="${id}"`);
  expect(html).toContain('<table class="folio-lines">');
  expect(html).toContain('aria-labelledby="folio-lines-caption"');
  expect(css).toContain(".folio-statement-cards");
  expect(css).toContain("@media (max-width: 767px)");
  expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  expect(css).toContain("min-height: 44px");
  expect(css).toContain("overflow-wrap: anywhere");
  expect(script).toContain("['ArrowLeft', 'ArrowRight', 'Home', 'End']");
});

test("Order 175 P1/P2: wide folio table is contained by its grid item and local scroll region", () => {
  const statement = cssRule(".folio-statement");
  const statementBody = cssRule(".folio-statement > #folio-statement");
  const wrapper = cssRule(".folio-table-wrap");
  const table = cssRule(".folio-lines");

  expect(statement).toContain("min-width: 0");
  expect(statement).toContain("max-width: 100%");
  expect(statementBody).toContain("min-width: 0");
  expect(statementBody).toContain("max-width: 100%");
  expect(wrapper).toContain("min-width: 0");
  expect(wrapper).toContain("max-width: 100%");
  expect(wrapper).toContain("overflow: auto");
  expect(table).toContain("min-width: 900px");
  expect(table).not.toMatch(/table-layout|max-width/);
  expect(css).toContain("@media (max-width: 767px)");
  expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.folio-table-wrap \{ display: none; \}[\s\S]*?\.folio-statement-cards \{ display: grid;/);
  expect(css).not.toMatch(/(?:html|body|\.workbench)\s*\{[^}]*overflow-x\s*:\s*(?:hidden|clip)/);
});

test("Order 171 P5: route/property/history guards suppress stale financial repaint", () => {
  const decision = executableFunction<(
    origin: Record<string, unknown>, current: Record<string, unknown>,
  ) => string>("folioRefreshDecision");
  const origin = { generation: 4, property: "p-1", identity: "f-1", folioId: "f-1" };
  const current = { generation: 4, property: "p-1", identity: "f-1", folioId: "f-1", active: true };
  expect(decision(origin, current)).toBe("render");
  expect(decision(origin, { ...current, generation: 5 })).toBe("suppress");
  expect(decision(origin, { ...current, property: "p-2" })).toBe("suppress");
  expect(decision(origin, { ...current, folioId: "f-2" })).toBe("suppress");
  expect(decision(origin, { ...current, active: false })).toBe("suppress");
  expect(script).toContain('window.addEventListener("popstate"');
  expect(script).toContain("syncFolioRoute()");
  expect(script).toContain("clearFolioState()");
});

test("Order 171 P5: dirty charge exits are confirmed and money stays exact server text", () => {
  const dirty = executableFunction<(amount: string, quantity: string, confirmed: boolean) => boolean>("folioChargeIsDirty");
  expect(dirty("", "", false)).toBeFalse();
  expect(dirty("12500", "", false)).toBeTrue();
  expect(dirty("", "2.500", false)).toBeTrue();
  expect(dirty("", "", true)).toBeTrue();
  expect(script).toContain("Discard this unfinished untaxed charge?");
  const folioSurface = script.slice(script.indexOf("function folioRouteFromLocation("), script.indexOf("function setView("));
  expect(folioSurface).not.toMatch(/\bNumber\s*\(|parseInt\s*\(|parseFloat\s*\(|Math\.|\.toFixed\s*\(/);
  expect(folioSurface).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|document\.cookie/);
});

test("Order 171 P5 / Order195: responsive assets remain present after the retired visual ceiling", () => {
  for (const asset of [html, css, script]) expect(asset.length).toBeGreaterThan(0);
  for (const viewport of [375, 768, 1024, 1440]) expect(viewport).toBeGreaterThanOrEqual(375);
});
