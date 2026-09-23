import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();

test("guests opens as an intentional search workflow, not a failed default lookup", () => {
  expect(app).toContain(': "";\n' + "type Stay");
  expect(app).toContain("Enter at least two characters to search guest profiles.");
  expect(app).toContain("Find a guest, open their profile and review their stay history.");
  expect(app).not.toContain(': "Arrival";');
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
