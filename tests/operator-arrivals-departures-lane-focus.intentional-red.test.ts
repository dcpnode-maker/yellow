import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

const JOURNEYS = [
  "today", "reservations", "folios", "cashiers", "housekeeping", "vehicles", "operations",
] as const;

function journeyIndex(): string {
  const start = html.indexOf('<section class="management-journey-index');
  if (start < 0) throw new Error("Missing management journey index");
  const end = html.indexOf("</section>", start);
  if (end < 0) throw new Error("Unclosed management journey index");
  return html.slice(start, end + "</section>".length);
}

function managementJourneyHandler(): string {
  const start = script.indexOf("for (const control of managementJourneyControls) control.addEventListener");
  if (start < 0) throw new Error("Missing management journey handler");
  const end = script.indexOf("\n });", start);
  if (end < 0) throw new Error("Unclosed management journey handler");
  return script.slice(start, end + "\n });".length);
}

test("Order 332 intentional red: Arrivals & departures focuses loaded operational lanes without generic Today navigation", () => {
  expect(html).toMatch(/<div class="today-lanes"[^>]*id="today-operational-lanes"[^>]*tabindex="-1"[^>]*>/);

  const handler = managementJourneyHandler();
  const specialCase = handler.indexOf('control.dataset.journeyView === "today"');
  const genericNavigation = handler.indexOf("setView(control.dataset.journeyView)");
  expect(specialCase).toBeGreaterThan(0);
  expect(specialCase).toBeLessThan(genericNavigation);
  expect(handler).toContain('$("#today-operational-lanes")');
  expect(handler).toContain("focus({ preventScroll: true })");
  expect(handler).toContain('scrollIntoView({ block: "start" })');
  expect(handler.indexOf("return", specialCase)).toBeLessThan(genericNavigation);

  const todayBranch = handler.slice(specialCase, genericNavigation);
  expect(todayBranch).not.toMatch(/setView\(|finishWorkspaceNavigation\(|loadToday\(|request\(|fetch\(|history\.(?:pushState|replaceState|back|go)\(/);
});

test("Order 332 intentional red: seven exact journey identities and all other shared routing remain pinned", () => {
  const index = journeyIndex();
  for (const journey of JOURNEYS) {
    expect(index.match(new RegExp(`data-journey-view="${journey}"`, "g"))).toHaveLength(1);
  }
  expect(index.match(/data-journey-view=/g)).toHaveLength(JOURNEYS.length);
  expect(index).toContain('data-journey-view="today">Arrivals &amp; departures</button>');

  const handler = managementJourneyHandler();
  expect(handler.match(/setView\(control\.dataset\.journeyView\)/g)).toHaveLength(1);
  expect(handler.match(/finishWorkspaceNavigation\(control\.dataset\.journeyView\)/g)).toHaveLength(1);
  expect(handler).not.toMatch(/data\.journeyView\s*=|dataset\.journeyView\s*=|\.click\(\)|method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
  for (const journey of JOURNEYS.filter((journey) => journey !== "today")) {
    expect(html).toContain(`id="nav-${journey}"`);
    expect(html).toContain(`id="${journey}-view"`);
  }
});
