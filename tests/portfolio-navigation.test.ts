import { describe, expect, test } from "bun:test";
import { parsePortfolioPage, propertyWorkspaceUrl, shouldLoadInitialPortfolioPage, type PortfolioNode } from "../frontend/yellow/src/portfolio-navigation";

const rootId = "10000000-0000-4000-8000-000000000001";
const regionId = "20000000-0000-4000-8000-000000000002";
const propertyId = "30000000-0000-4000-8000-000000000003";

const region: PortfolioNode = {
  id: regionId, name: "West", kind: "region", parentId: null,
  authorizedPropertyCount: 2, timezone: null, currency: null,
};
const property: PortfolioNode = {
  id: propertyId, name: "Yellow Hotel", kind: "property", parentId: regionId,
  authorizedPropertyCount: 1, timezone: "Asia/Kolkata", currency: "INR",
};

describe("authorized portfolio navigation helpers", () => {
  test("accepts a valid root and scoped page with the server-provided authorized counts", () => {
    expect(parsePortfolioPage({ scope: null, nodes: [region], nextCursor: region.id }, null)?.nodes).toEqual([region]);
    expect(parsePortfolioPage({ scope: region, nodes: [property], nextCursor: null }, regionId)?.nodes).toEqual([property]);
  });

  test("rejects malformed, duplicate, out-of-scope, or non-advancing pages", () => {
    expect(parsePortfolioPage({ scope: null, nodes: [{ ...region, authorizedPropertyCount: -1 }], nextCursor: null }, null)).toBeNull();
    expect(parsePortfolioPage({ scope: null, nodes: [region, region], nextCursor: null }, null)).toBeNull();
    expect(parsePortfolioPage({ scope: null, nodes: [{ ...region, parentId: rootId }], nextCursor: null }, null)).toBeNull();
    expect(parsePortfolioPage({ scope: null, nodes: [region], nextCursor: propertyId }, null)).toBeNull();
    expect(parsePortfolioPage({ scope: { ...region, id: "bad" }, nodes: [], nextCursor: null }, null)).toBeNull();
    expect(parsePortfolioPage({ scope: region, nodes: [{ ...property, parentId: rootId }], nextCursor: null }, regionId)).toBeNull();
    expect(parsePortfolioPage({ scope: region, nodes: [], nextCursor: propertyId }, regionId)).toBeNull();
    expect(parsePortfolioPage({ scope: { ...region, id: rootId }, nodes: [], nextCursor: null }, regionId)).toBeNull();
    expect(parsePortfolioPage({ scope: null, nodes: [{ ...region, id: propertyId }, region], nextCursor: null }, null)).toBeNull();
  });

  test("switch target changes only the property path segment and retains workspace deep-link state", () => {
    expect(propertyWorkspaceUrl("https://yellow.example/p/old-id/today?workspace=finance&reservation=stay-7#deposits", propertyId))
      .toBe(`/p/${propertyId}/today?workspace=finance&reservation=stay-7#deposits`);
    expect(propertyWorkspaceUrl("https://yellow.example/p/old-id/res/123", propertyId)).toBe(`/p/${propertyId}/res/123`);
    expect(propertyWorkspaceUrl("https://yellow.example/", propertyId)).toBe("/p/" + propertyId + "/today");
    expect(propertyWorkspaceUrl("https://yellow.example/?workspace=finance#cashier", propertyId)).toBe("/p/" + propertyId + "/today?workspace=finance#cashier");
    expect(propertyWorkspaceUrl("https://yellow.example/yellow-next", propertyId)).toBe("/p/" + propertyId + "/today");
    expect(propertyWorkspaceUrl("https://yellow.example/yellow-next/?workspace=finance#cashier", propertyId)).toBe("/p/" + propertyId + "/today?workspace=finance#cashier");
    expect(() => propertyWorkspaceUrl("https://yellow.example/unrecognized", propertyId)).toThrow();
    expect(() => propertyWorkspaceUrl("https://yellow.example/login", propertyId)).toThrow();
    expect(() => propertyWorkspaceUrl("https://yellow.example/p/current/today", "not-a-uuid")).toThrow();
  });

  test("successful empty pages do not repeatedly request the root scope", () => {
    expect(shouldLoadInitialPortfolioPage(true, false, false, false)).toBe(true);
    expect(shouldLoadInitialPortfolioPage(true, true, false, false)).toBe(false);
    expect(shouldLoadInitialPortfolioPage(true, false, true, false)).toBe(false);
    expect(shouldLoadInitialPortfolioPage(true, false, false, true)).toBe(false);
    expect(shouldLoadInitialPortfolioPage(false, false, false, false)).toBe(false);
  });
});
