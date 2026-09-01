import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { createApp } from "../src/app";
import { OperatorHttpApi } from "../src/http/operator";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

const JOURNEYS = [
  "today", "reservations", "folios", "cashiers", "housekeeping", "vehicles", "operations",
] as const;

function element(id: string): string {
  const match = html.match(new RegExp(`<([a-z][a-z0-9-]*)[^>]+id="${id}"[^>]*>[\\s\\S]*?<\\/\\1>`));
  if (!match) throw new Error(`Missing element ${id}`);
  return match[0];
}

function journeyIndex(): string {
  const start = html.indexOf('<section class="management-journey-index');
  if (start < 0) throw new Error("Missing management journey index");
  const end = html.indexOf("</section>", start);
  if (end < 0) throw new Error("Unclosed management journey index");
  return html.slice(start, end + "</section>".length);
}

function journeyCategory(name: string): string {
  const index = journeyIndex();
  const marker = `<strong>${name}</strong>`;
  const markerStart = index.indexOf(marker);
  if (markerStart < 0) throw new Error(`Missing journey category: ${name}`);
  const categoryStart = index.lastIndexOf('<div class="management-journey-category">', markerStart);
  const nextCategory = index.indexOf('<div class="management-journey-category">', markerStart + marker.length);
  const categoryEnd = nextCategory >= 0 ? nextCategory : index.indexOf("</div>\n</div>\n</section>", markerStart);
  if (categoryStart < 0 || categoryEnd < 0) throw new Error(`Unclosed journey category: ${name}`);
  return index.slice(categoryStart, categoryEnd);
}

test("Order 324 intentional red: all scoped OOO/OOS destinations visibly say Room outages", () => {
  const preview = element("secondary-workspaces-preview");
  const navigation = element("nav-operations");
  const stayOperations = journeyCategory("Stay operations");

  expect(preview).toContain("Room outages · Housekeeping · Vehicle register");
  expect(navigation).toContain("<span>Room outages</span>");
  expect(stayOperations).toContain("an eligible Vehicle and room outages.</p>");
  expect(stayOperations).toContain('data-journey-view="operations">Room outages</button>');
});

test("Order 324 intentional red: Room outages preserves exact identities and canonical operations routing", async () => {
  const navigation = element("nav-operations");
  const index = journeyIndex();

  expect(navigation).toContain('id="nav-operations"');
  expect(navigation).toContain('data-view="operations"');
  expect(navigation).toContain('aria-controls="operations-view"');
  expect(html.match(/id="nav-operations"/g)).toHaveLength(1);
  expect(html.match(/id="operations-view"/g)).toHaveLength(1);
  expect(index.match(/data-journey-view="operations"/g)).toHaveLength(1);
  for (const journey of JOURNEYS) {
    expect(index.match(new RegExp(`data-journey-view="${journey}"`, "g"))).toHaveLength(1);
  }
  expect(index.match(/data-journey-view=/g)).toHaveLength(JOURNEYS.length);

  expect(script).toContain('location.pathname.endsWith("/operations") ? "operations"');
  expect(script).toContain('history.pushState(null, "", `/p/${propertySelect.value}/${activeView}`)');
  expect(script).toContain('const managementJourneyControls = document.querySelectorAll("[data-journey-view]")');
  expect(script).toContain("setView(control.dataset.journeyView)");
  expect(script).toContain("finishWorkspaceNavigation(control.dataset.journeyView)");

  const property = "00000000-0000-0000-0000-000000000324";
  const app = createApp({ operatorApi: new OperatorHttpApi({} as never) });
  const response = await app.handle(new Request(`http://yellow.test/p/${property}/operations`));
  expect(response.status).toBe(200);
  expect(await response.text()).toBe(html);
});
