import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");

const JOURNEYS = [
  "today", "reservations", "folios", "cashiers", "housekeeping", "vehicles", "operations",
] as const;

const FOLIO_CONTROL_IDS = [
  "folio-find-via-reservation-copy",
  "folio-find-via-reservation",
  "folio-workspace-back",
  "folio-window-new",
  "folio-tab-postings",
  "folio-tab-charge",
  "folio-tab-deposit",
  "folio-tab-organize",
  "folio-tab-direct-billing",
  "folio-settlement-action",
  "folio-charge-submit",
  "folio-organize-preview-submit",
  "folio-organize-submit",
  "receivable-transfer-submit",
  "folio-correction-submit",
  "folio-correction-cancel",
] as const;

const EXPECTED_FOLIOS_INTRO = "An eligible loaded folio may expose server-authorized deposits, immutable corrections, charge organization, direct billing and zero-balance settlement. This workspace does not calculate tax, issue invoices or fiscal documents, or check out a stay.";
const EXPECTED_TODAY_FINANCIALS = "Open an eligible loaded Folio for available financial tools; Cashiers remains a separate workbench.";

function elementById(id: string): string {
  const match = html.match(new RegExp(`<[^>]+id="${id}"[^>]*>`));
  if (!match) throw new Error(`Missing element ${id}`);
  return match[0];
}

function sectionById(id: string): string {
  const marker = `id="${id}"`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing section ${id}`);
  const start = html.lastIndexOf("<section", markerIndex);
  const end = html.indexOf("</section>", markerIndex);
  if (start < 0 || end < 0) throw new Error(`Unbounded section ${id}`);
  return html.slice(start, end + "</section>".length);
}

function financialsCategory(): string {
  const start = html.indexOf('<div class="management-journey-category">\n<strong>Financials</strong>');
  if (start < 0) throw new Error("Missing Today Financials category");
  const end = html.indexOf("</div>\n</div>", start);
  if (end < 0) throw new Error("Unbounded Today Financials category");
  return html.slice(start, end + "</div>".length);
}

function paragraphText(source: string, className?: string): string {
  const pattern = className
    ? new RegExp(`<p class="${className}">([^<]+)</p>`)
    : /<p>([^<]+)<\/p>/;
  const match = source.match(pattern);
  if (!match?.[1]) throw new Error("Missing scoped paragraph");
  return match[1].trim();
}

test("Order 320 intentional red: Folios names only conditional server-authorized built capabilities and exact boundaries", () => {
  const folios = sectionById("folios-view");
  const intro = paragraphText(folios, "muted");

  expect(intro).toBe(EXPECTED_FOLIOS_INTRO);
  for (const truth of [
    "eligible loaded folio",
    "server-authorized deposits",
    "immutable corrections",
    "charge organization",
    "direct billing",
    "zero-balance settlement",
  ]) expect(intro.toLowerCase()).toContain(truth);
  expect(intro).toMatch(/does not calculate tax/i);
  expect(intro).toMatch(/does not .*issue invoices or fiscal documents/i);
  expect(intro).toMatch(/does not .*check out/i);
  expect(intro).not.toMatch(/\bpayments?\b|refund|automatic(?:ally)?|guaranteed?|successful(?:ly)?|always available/i);
});

test("Order 320 intentional red: Today directs management to an eligible loaded Folio and separate Cashiers", () => {
  const financials = financialsCategory();
  const copy = paragraphText(financials);

  expect(copy).toBe(EXPECTED_TODAY_FINANCIALS);
  expect(copy).toMatch(/eligible loaded Folio/);
  expect(copy).toMatch(/Cashiers remains a separate workbench/);
  expect(copy).not.toMatch(/\bpayments?\b|refund|automatic(?:ally)?|guaranteed?|successful(?:ly)?|always available/i);
});

test("Order 320 intentional red: seven destinations and every existing Folio bridge, tab and action identity remain exact", () => {
  for (const view of JOURNEYS) {
    expect(html.match(new RegExp(`data-journey-view="${view}"`, "g"))).toHaveLength(1);
  }
  expect(html.match(/data-journey-view=/g)).toHaveLength(JOURNEYS.length);

  for (const id of FOLIO_CONTROL_IDS) {
    expect(html.match(new RegExp(`id="${id}"`, "g"))).toHaveLength(1);
    expect(elementById(id)).toBeTruthy();
  }
  expect(elementById("folio-find-via-reservation")).toContain('aria-describedby="folio-find-via-reservation-copy"');
  expect(elementById("folio-tab-postings")).toContain('aria-controls="folio-postings-panel"');
  expect(elementById("folio-tab-charge")).toContain('aria-controls="folio-charge-panel"');
  expect(elementById("folio-tab-deposit")).toContain('aria-controls="folio-deposit-panel"');
  expect(elementById("folio-tab-organize")).toContain('aria-controls="folio-organize-panel"');
  expect(elementById("folio-tab-direct-billing")).toContain('aria-controls="folio-direct-billing-panel"');
});
