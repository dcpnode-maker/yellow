import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { createApp } from "../src/app";
import { OperatorHttpApi } from "../src/http/operator";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

const SECONDARY = [
  "operations", "housekeeping", "vehicles", "inventory", "restrictions", "rates", "status",
] as const;
const JOURNEYS = [
  "today", "reservations", "folios", "cashiers", "housekeeping", "vehicles", "operations",
] as const;

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

function elementOpeningTag(id: string): string {
  const match = html.match(new RegExp(`<[^>]+id="${id}"[^>]*>`));
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

test("Order 316 intentional red: authenticated root is synchronously Today", () => {
  expect(elementOpeningTag("nav-today")).toContain("is-active");
  expect(elementOpeningTag("nav-availability")).not.toContain("is-active");
  expect(elementOpeningTag("today-view")).not.toContain(" hidden");
  expect(elementOpeningTag("availability-view")).toContain(" hidden");
  expect(html).toContain('<h1 id="workbench-title">Today</h1>');
  expect(script).toContain('let activeView = "today";');
  expect(script).toMatch(/location\.pathname\.endsWith\("\/status"\) \? "status" : "today";/);
  const showWorkbench = functionSource("showWorkbench");
  expect(showWorkbench).toContain('location.pathname === "/" && propertySelect.value');
  expect(showWorkbench).toContain('history.replaceState({}, "", `/p/${enc(propertySelect.value)}/today`)');
  expect(showWorkbench.indexOf("history.replaceState")).toBeLessThan(showWorkbench.indexOf("setView(activeView, false)"));
});

test("Order 316 intentional red: Today names only the seven existing connected journey destinations", () => {
  const index = journeyIndex();
  expect(index).toContain('aria-labelledby="management-journey-title"');
  expect(index).toContain('id="management-journey-title"');
  for (const view of JOURNEYS) {
    expect(index.match(new RegExp(`data-journey-view="${view}"`, "g"))).toHaveLength(1);
    expect(html).toContain(`id="nav-${view}"`);
    expect(html).toContain(`id="${view}-view"`);
  }
  expect(index.match(/data-journey-view=/g)).toHaveLength(JOURNEYS.length);
  for (const truth of [
    "search/create", "reservation board", "eligible reservation detail",
    "Folios", "eligible reservation", "Cashier",
    "due-in", "due-out", "in-house", "Housekeeping", "Vehicle", "Room outages",
  ]) expect(index).toContain(truth);
});

test("Order 316 intentional red: journey copy does not advertise deferred authority", () => {
  const index = journeyIndex();
  expect(index).not.toMatch(/tape chart|waitlist action|token.payment|day.close|statutory|fiscal|mobile|offline|photo|queue|messag|kiosk|report|owner portal|group|OTA|channel/i);
  expect(index).not.toMatch(/complete app|all features|phase complete|automatic|guaranteed/i);
  expect(index).not.toMatch(/data-(?:property|reservation|folio|task|vehicle)-id=/i);
});

test("Order 316 intentional red: one shared navigation path owns journey controls and Simple overlay settlement", () => {
  expect(script).toContain('const managementJourneyControls = document.querySelectorAll("[data-journey-view]")');
  expect(script).toContain("for (const control of managementJourneyControls)");
  expect(script).toContain("setView(control.dataset.journeyView)");

  const finish = functionSource("finishWorkspaceNavigation");
  expect(finish).toContain('document.documentElement.dataset.experience === "simple"');
  expect(finish).toContain("SECONDARY_VIEWS.has(view)");
  expect(finish).toContain("closeSecondaryWorkspaces()");
  expect(finish).toContain('document.getElementById(`${view}-title`)');
  expect(finish).toContain("focus({ preventScroll: true })");
  expect(finish).not.toMatch(/request\(|fetch\(|method:|click\(\)|submit/i);

  for (const view of SECONDARY) {
    expect(script).toContain(`"${view}"`);
    expect(html).toContain(`id="${view}-title"`);
  }
  expect(script).toContain("finishWorkspaceNavigation(tab.dataset.view)");
  expect(script).toContain("finishWorkspaceNavigation(control.dataset.journeyView)");
});

test("Order 316 intentional red: Advanced and Expert remain direct while every explicit route survives", async () => {
  const applyExperience = functionSource("applyExperience");
  expect(applyExperience).toContain('const next = EXPERIENCES.has(experience) ? experience : "simple"');
  expect(applyExperience).toContain('secondaryWorkspacesToggle.hidden = next !== "simple"');
  expect(applyExperience).toContain('secondaryWorkspaces.hidden = next === "simple" && !keepSecondaryOpen');
  expect(script).toContain('const EXPERIENCES = new Set(["simple", "advanced", "expert"])');
  expect(html.match(/class="domain-tab(?: is-active)?"/g)).toHaveLength(13);

  const property = "00000000-0000-0000-0000-000000000316";
  const app = createApp({ operatorApi: new OperatorHttpApi({} as never) });
  for (const view of [
    "today", "availability", "reservations", "folios", "cashiers", "housekeeping", "vehicles",
    "operations", "inventory", "restrictions", "rates", "status",
  ]) {
    const response = await app.handle(new Request(`http://yellow.test/p/${property}/${view}`));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(html);
  }
  expect(script).toContain('location.pathname.endsWith("/availability") ? "availability"');
  expect(script).toContain('location.pathname.endsWith("/today") ? "today"');
  expect(script).toContain('location.pathname.endsWith("/cashiers") ? "cashiers"');
  expect(script).toContain('location.pathname.endsWith("/status") ? "status"');
});
