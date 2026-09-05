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

test("Order 322 intentional red: Today is presented once as Arrivals & departures under Stay operations", () => {
  const index = journeyIndex();
  const reservations = journeyCategory("Reservations");
  const stayOperations = journeyCategory("Stay operations");

  expect(index.match(/data-journey-view="today"/g)).toHaveLength(1);
  expect(stayOperations).toContain('data-journey-view="today"');
  expect(stayOperations).toContain('data-journey-view="today">Arrivals &amp; departures</button>');
  expect(reservations).not.toContain('data-journey-view="today"');
  expect(reservations.match(/data-journey-view=/g)).toHaveLength(1);
  expect(reservations).toContain('data-journey-view="reservations">Reservations</button>');
});

test("Order 322 intentional red: the alignment preserves seven identities and the shared Today router", () => {
  const index = journeyIndex();
  for (const journey of JOURNEYS) {
    expect(index.match(new RegExp(`data-journey-view="${journey}"`, "g"))).toHaveLength(1);
  }
  expect(index.match(/data-journey-view=/g)).toHaveLength(JOURNEYS.length);
  expect(script).toContain('const managementJourneyControls = document.querySelectorAll("[data-journey-view]")');
  expect(script).toContain("for (const control of managementJourneyControls)");
  expect(script).toContain("setView(control.dataset.journeyView)");
  expect(script).toContain("finishWorkspaceNavigation(control.dataset.journeyView)");
  expect(script.match(/managementJourneyControls = document\.querySelectorAll/g)).toHaveLength(1);
});
