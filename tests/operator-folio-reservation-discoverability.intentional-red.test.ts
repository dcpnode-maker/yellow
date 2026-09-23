import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { createApp } from "../src/app";
import { OperatorHttpApi } from "../src/http/operator";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

const EXPLICIT_ROUTES = [
  "today", "availability", "reservations", "folios", "operations", "inventory",
  "restrictions", "rates", "housekeeping", "vehicles", "cashiers", "status",
] as const;
const MANAGEMENT_JOURNEYS = [
  "today", "reservations", "folios", "cashiers", "housekeeping", "vehicles", "operations",
] as const;

function balancedBlockAfter(marker: string): string {
  const start = script.indexOf(marker);
  if (start < 0) throw new Error(`Missing source marker: ${marker}`);
  const opening = script.indexOf("{", start);
  if (opening < 0) throw new Error(`Missing source block: ${marker}`);
  let depth = 0;
  for (let index = opening; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`Unclosed source block: ${marker}`);
}

function elementById(id: string): string {
  const match = html.match(new RegExp(`<[^>]+id="${id}"[^>]*>`));
  if (!match) throw new Error(`Missing element ${id}`);
  return match[0];
}

function folioLookup(): string {
  const start = html.indexOf('<form class="card folio-lookup" id="folio-statement-lookup-form">');
  if (start < 0) throw new Error("Missing Folios lookup");
  const end = html.indexOf("</form>", start);
  if (end < 0) throw new Error("Unclosed Folios lookup");
  return html.slice(start, end + "</form>".length);
}

test("Order 318 intentional red: the empty Folios lookup has one truthful reservation bridge", () => {
  const lookup = folioLookup();
  const control = elementById("folio-find-via-reservation");
  expect(lookup.match(/class="quiet"/g)).toHaveLength(1);
  expect(control).toContain('class="quiet"');
  expect(control).toContain('type="button"');
  expect(control).toContain('aria-describedby="folio-find-via-reservation-copy"');
  expect(lookup).toContain(">Find via reservation</button>");
  expect(lookup).toContain('id="folio-find-via-reservation-copy"');
  expect(lookup).toMatch(/Reservations/i);
  expect(lookup).toMatch(/eligible/i);
  expect(lookup).toMatch(/existing Folio action/i);
  expect(lookup).not.toMatch(/every reservation|automatically|auto-(?:create|open|select)|create(?:s|d)? (?:a |the )?folio|settlement eligible|invoice eligible/i);
  expect(lookup.match(/id="folio-find-via-reservation"/g)).toHaveLength(1);
});

test("Order 318 intentional red: one inert-on-cancel handler reuses canonical Reservations navigation", () => {
  expect(script).toContain('const folioFindViaReservation = $("#folio-find-via-reservation")');
  const handler = balancedBlockAfter('folioFindViaReservation.addEventListener("click", () =>');
  expect(script.match(/folioFindViaReservation\.addEventListener\("click"/g)).toHaveLength(1);
  expect(handler).toContain("confirmFolioExit()");
  expect(handler).toContain('setView("reservations")');
  expect(handler).toContain('finishWorkspaceNavigation("reservations")');
  const confirmation = handler.indexOf("confirmFolioExit()");
  const route = handler.indexOf('setView("reservations")');
  const settlement = handler.indexOf('finishWorkspaceNavigation("reservations")');
  expect(confirmation).toBeLessThan(route);
  expect(route).toBeLessThan(settlement);
  expect(handler.slice(confirmation, route)).toContain("return");
  expect(handler).not.toMatch(/request\(|fetch\(|\.click\(|method:|submit\(|openPrimaryFolio|loadFolio|folioStatementLookupForm\.requestSubmit/i);
});

test("Order 318 intentional red: existing management controls and explicit shell routes remain exact", async () => {
  for (const view of MANAGEMENT_JOURNEYS) {
    expect(html.match(new RegExp(`data-journey-view="${view}"`, "g"))).toHaveLength(1);
  }
  expect(html.match(/data-journey-view=/g)).toHaveLength(MANAGEMENT_JOURNEYS.length);

  const property = "00000000-0000-0000-0000-000000000318";
  const app = createApp({ operatorApi: new OperatorHttpApi({} as never) });
  for (const view of EXPLICIT_ROUTES) {
    const response = await app.handle(new Request(`http://yellow.test/p/${property}/${view}`));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(html);
  }
});
