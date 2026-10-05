import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const routes = await Bun.file("src/app.ts").text();
const { readWorkspaceRoute } = await import("../frontend/yellow/src/workspace-navigation");
const PROPERTY = "6081b544-22a1-534f-a86d-bb1ae0519e14";

test("the mobile commercial overview is read-only and routes governed edits to the existing workflow", () => {
  expect(app).toContain('queryKey: ["commercial-snapshot", propertyId]');
  expect(app).toContain('fetch(`/api/v1/properties/${propertyId}/rate-configuration`, { headers })');
  expect(app).toContain('fetch(`/api/v1/properties/${propertyId}/inventory`, { headers })');
  expect(app).toContain('`/p/${propertyId}/rates?legacy=1`');
  expect(app).toContain("this overview never changes rates or distribution");
  expect(app).toContain('workspacePart === "rates"');
});

test("the existing configuration view remains addressable while Yellow Next owns its overview", () => {
  expect(app).toContain('`/p/${propertyId}/today?workspace=rates`');
  expect(app).toContain("const route = readWorkspaceRoute(routeHref, internalMarketLabEnabled);");
  expect(readWorkspaceRoute(`/p/${PROPERTY}/today?workspace=rates`).workspace).toBe("rates");
  expect(readWorkspaceRoute(`/p/${PROPERTY}/today`).workspace).toBe("today");
  expect(routes).toContain('operatorAssets.html(options.operatorLocalReviewCredentials, request)');
});
