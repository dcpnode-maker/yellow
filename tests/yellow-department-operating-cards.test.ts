import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

test("Today exposes role cards without fabricating unavailable commercial facts", () => {
  expect(app).toContain("DepartmentPerformanceMatrix");
  expect(app).toContain("GENERAL MANAGER");
  expect(app).toContain("FRONT OFFICE");
  expect(app).toContain("HOUSEKEEPING");
  expect(app).toContain("REVENUE");
  expect(app).toContain("ROOMS DIVISION");
  expect(app).toContain("SALES &amp; HOD");
  expect(app).toContain("Actuals · pace · forecast unavailable");
  expect(app).toContain("Last-night actuals");
  expect(app).toContain("Room nights · revenue");
  expect(app).toContain("Group displacement");
  expect(app).toContain("department-fact-list");
  expect(app).toContain("approved reporting feed");
  expect(app).toContain("loadOperationalBlocks");
  expect(app).toContain("OOO · OOS rooms");
});

test("Housekeeping readiness and early-check-in prerequisites remain explicit", () => {
  expect(app).toContain('room.condition === "clean" || room.condition === "inspected"');
  expect(app).toContain('room.condition === "dirty" || room.condition === "pickup"');
  expect(app).toContain("A sell decision also needs live supply, policy, approved price and guest confirmation.");
  expect(app).toContain("arrivalPressure");
  expect(css).toContain(".department-card-grid");
  expect(css).toContain(".department-card button:focus-visible");
});
