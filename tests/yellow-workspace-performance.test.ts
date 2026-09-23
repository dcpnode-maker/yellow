import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const hub = await Bun.file("frontend/yellow/src/workspaces/OperationalHub.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();
const vite = await Bun.file("frontend/yellow/vite.config.ts").text();

test("operations reuse authoritative query results instead of issuing duplicate reads", () => {
  expect(app).toContain("data: dueInQuery.data?.reservations");
  expect(app).toContain("data: dueOutQuery.data?.reservations");
  expect(app).toContain("data: operationalRooms");
  expect(app).toContain("data: operationalBlocksQuery.data?.map");
  expect(hub).not.toMatch(/\bfetch\(/);
  expect(hub.match(/\buseQuery\(/g) ?? []).toHaveLength(1);
  expect(hub).toContain("queryFn: loadDepartureServiceQueue");
  expect(hub).toContain("queryFn: () => loadDepartureServices(request.reservationId)");
  expect(app).toContain('enabled: workspacePart === "operations" || assistant');
  expect(app).toContain('enabled: workspacePart === "today" || assistant');
});

test("the new route is code split and long collections skip offscreen layout", () => {
  expect(app).toContain('lazy(() => import("./workspaces/OperationalHub"))');
  expect(css).toContain("content-visibility: auto;");
  expect(css).toContain("contain-intrinsic-size: 210px;");
  expect(css).toContain("contain-intrinsic-size: 84px;");
  expect(vite).toContain("codeSplitting");
  expect(vite).toContain("groups:");
});

test("mobile rendering contains the ribbon and uses one responsive codebase", () => {
  expect(css).toContain("@media (max-width: 620px)");
  expect(css).toContain("overflow-x: auto;");
  expect(css).toContain("grid-template-columns: 1fr;");
  expect(css).toContain("width: 100%; height: min(82vh, 720px)");
  expect(app).toContain('<PmsIcon name="today" />Ops');
});
