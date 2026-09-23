import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const operator = readFileSync(new URL("../src/http/operator.ts", import.meta.url), "utf8");
const board = readFileSync(new URL("../src/contexts/reservations/board.ts", import.meta.url), "utf8");

test("Order 418: a guest name opens a Party-backed, property-scoped factual stay-history drawer", () => {
  for (const id of [
    "guest-profile-drawer", "guest-profile-title", "guest-profile-close", "guest-profile-loading",
    "guest-profile-error", "guest-profile-retry", "guest-profile-content", "guest-profile-status",
  ]) expect(html).toContain(`id=\"${id}\"`);
  expect(script).toContain('button.addEventListener("click", () => void openGuestProfile(row, { trigger: button }))');
  expect(script).toContain("async function openGuestProfile");
  expect(script).toContain("Party profile and property-scoped stay history loaded from server truth.");
  expect(script).toContain("/parties:search");
  expect(script).toContain("let partyId = row.primaryPartyId");
  expect(script).toContain("/reservations/${enc(row.reservationId)}");
  expect(script).toContain("closeGuestProfile");
  expect(css).toContain(".guest-profile-drawer");
  expect(board).toContain("readonly partyId?: string;");
  expect(board).toContain("reservation_guest AS guest");
  expect(operator).toContain("primaryPartyId: reservation.primaryPartyId");
  expect(operator).toContain('const allowed = ["partyId", "status", "from", "to", "after", "limit"]');
});
