import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../frontend/yellow/src/${path}`, import.meta.url), "utf8");
const app = source("App.tsx");
const reservations = source("workspaces/ReservationWorkspace.tsx");
const hotelSearch = source("ui/HotelSearch.tsx");
const guestsWorkspace = reservations.slice(
  reservations.indexOf("function GuestsWorkspace()"),
  reservations.indexOf("function InlineGuestProfile("),
);

test("guest search navigation is removed while the canonical profile deep link remains", () => {
  expect(app).not.toContain('workflow("guests")');
  expect(app).not.toContain('aria-label="Open Guests"');
  expect(reservations).toContain('/guests?guest=${encodeURIComponent(guest.partyId)}');
  expect(guestsWorkspace).toContain("profile.partyId === requestedGuestSearch");
  expect(guestsWorkspace).toContain("Stay history");
  expect(guestsWorkspace).toContain("No contact hint is recorded.");
  expect(guestsWorkspace).toContain("Retry profile lookup");
  expect(guestsWorkspace).toContain("Open universal search");
  expect(guestsWorkspace).not.toContain('className="guest-search"');
  expect(guestsWorkspace).not.toContain('className="guest-results"');
});

test("an unselected guest route points to the shared property search", () => {
  expect(guestsWorkspace).toContain("guest-search-entry");
  expect(guestsWorkspace).toContain("Use Yellow’s shared search to find guest and company profiles, reservations, and booked room references.");
  expect(guestsWorkspace).toContain("/p/${propertyId}/today?hotelSearch=1");
  expect(hotelSearch).toContain('get("hotelSearch") === "1"');
});

test("reservation creation keeps its inline person picker and group blocks use Yellow copy", () => {
  expect(reservations).toContain("Search canonical guest profiles");
  expect(reservations).toContain("Group blocks</h2>");
  expect(reservations).not.toContain("Opera-style");
});
