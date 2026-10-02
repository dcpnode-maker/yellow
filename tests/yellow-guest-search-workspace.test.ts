import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const workspace = await Bun.file("frontend/yellow/src/workspaces/ReservationWorkspace.tsx").text();
const { readWorkspaceRoute } = await import("../frontend/yellow/src/workspace-navigation");
const PROPERTY = "6081b544-22a1-534f-a86d-bb1ae0519e14";

test("guests opens as an intentional search workflow, not a failed default lookup", () => {
  expect(readWorkspaceRoute(`/p/${PROPERTY}/guests`).guest).toBe("");
  expect(readWorkspaceRoute(`/p/${PROPERTY}/guests?guest=party-123`).guest).toBe("party-123");
  expect(app).toContain("const route = readWorkspaceRoute(routeHref, internalMarketLabEnabled);");
  expect(workspace).toContain("Enter at least two characters to search guest profiles.");
  expect(workspace).toContain("Find a guest, open their profile and review their stay history.");
  expect(workspace).toContain("requestedGuestSearch.length >= 2 ? requestedGuestSearch : \"\"");
});

test("public-facing hotel language does not expose fixture terminology", () => {
  expect(app).toContain('property?.name === "Yellow Demo Property" ? "Yellow Hotel"');
  expect(app).not.toContain("synthetic-demo window");
  expect(app).not.toContain("current synthetic-demo records");
});

test("reservation guests open profiles by canonical Party ID rather than name", () => {
  expect(app).toContain('guest=${encodeURIComponent(guest.partyId)}');
  expect(app).toContain('profile.partyId === requestedGuestSearch');
  expect(app).not.toContain('guest=${encodeURIComponent(guest.displayName)}');
});
