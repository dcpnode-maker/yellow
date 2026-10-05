import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createApp } from "../src/app";
import type { OperatorHttpApi } from "../src/http/operator";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const rows = script.slice(script.indexOf("function addReservationGuestRow("),
  script.indexOf("function renderReservationGuests("));

function expectIncludes(source: string, fragment: string): void {
  expect(source.includes(fragment)).toBe(true);
}

test("Order445 replaces internal-ID entry with an explicit canonical guest picker", () => {
  expect(rows).toContain('party.type = "hidden"');
  expect(rows).toContain("mountReservationGuestPicker(row, party, guest)");
  expect(rows).not.toContain('"Party ID"');
  expectIncludes(script, 'import("/assets/operator-party-profile-picker.js")');
  expectIncludes(script, "onClear:");
  expectIncludes(script, "onSelect:");
});

test("Order445 disposes per-row drafts and binds every result to the current subject/session", () => {
  expectIncludes(script, "function clearReservationGuestPickers()");
  expectIncludes(script, "reservationGuestPickers.delete(row)");
  for (const boundary of [
    "row.isConnected", "property === propertySelect.value",
    "sessionToken === accessToken", "reservation === reservationGuestData",
    "generation === reservationGuestRequestGeneration",
  ]) expectIncludes(script, boundary);
  const restore = script.slice(script.indexOf("function restoreReservationGuestEditorHome("),
    script.indexOf("function restoreReservationSegmentEditorHome("));
  expect(restore).toContain("clearReservationGuestPickers()");
});

test("Order445 serves the picker through the existing no-cache same-origin asset surface", async () => {
  const app = createApp({ operatorApi: {} as OperatorHttpApi });
  const response = await app.handle(new Request("http://localhost/assets/operator-party-profile-picker.js"));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/javascript");
  expect(response.headers.get("cache-control")).toBe("no-cache");
  expect((await response.text()).includes("export function createPartyProfilePicker")).toBe(true);
});
