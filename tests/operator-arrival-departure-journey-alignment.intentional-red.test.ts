import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

const JOURNEYS = [
  "today", "reservations", "folios", "cashiers", "housekeeping", "vehicles", "operations",
] as const;

function journeyIndex(source = html): string {
  const start = source.indexOf('<section class="management-journey-index');
  if (start < 0) throw new Error("Missing management journey index");
  const end = source.indexOf("</section>", start);
  if (end < 0) throw new Error("Unclosed management journey index");
  return source.slice(start, end + "</section>".length);
}

function journeyCategory(name: string, source = html): string {
  const index = journeyIndex(source);
  const marker = `<strong>${name}</strong>`;
  const markerStart = index.indexOf(marker);
  if (markerStart < 0) throw new Error(`Missing journey category: ${name}`);
  const categoryStart = index.lastIndexOf('<div class="management-journey-category">', markerStart);
  if (categoryStart < 0) throw new Error(`Unclosed journey category: ${name}`);
  // Read the category's balanced div boundary, independently of its disclosure
  // wrapper or file line endings. Never consume a sibling category's controls.
  const tags = /<\/?div\b[^>]*>/g;
  tags.lastIndex = categoryStart;
  let depth = 0;
  for (let tag = tags.exec(index); tag !== null; tag = tags.exec(index)) {
    depth += tag[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return index.slice(categoryStart, tags.lastIndex);
  }
  throw new Error(`Unclosed journey category: ${name}`);
}

test("Q249 journey category boundaries preserve nested content and exclude siblings across disclosure and line endings", () => {
  const first = '<div class="management-journey-category"><strong>Reservations</strong><div><button data-journey-view="reservations">Reservations</button></div></div>';
  const last = '<div class="management-journey-category"><strong>Stay operations</strong><div><button data-journey-view="today">Arrivals &amp; departures</button></div></div>';
  for (const newline of ["\n", "\r\n"]) {
    const source = ['<section class="management-journey-index">', '<details><summary>Related workflows</summary>',
      '<div class="management-journey-categories">', first, last, '</div>', '</details>', '</section>'].join(newline);
    expect(journeyCategory("Reservations", source)).toBe(first);
    expect(journeyCategory("Stay operations", source)).toBe(last);
    expect(journeyCategory("Reservations", source)).not.toContain('data-journey-view="today"');
  }
});

test("Q249 journey category boundary rejects missing or unclosed categories", () => {
  const source = '<section class="management-journey-index"><details><div class="management-journey-category"><strong>Stay operations</strong><div>Unclosed</div></details></section>';
  expect(() => journeyCategory("Stay operations", source)).toThrow("Unclosed journey category");
  expect(() => journeyCategory("Reservations", source)).toThrow("Missing journey category");
});

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
