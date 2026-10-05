import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CAPABILITY_REGISTRY, capabilityByKey, isOperationalCapability } from "../frontend/yellow/src/ecosystem/capability-registry";
import EcosystemHub from "../frontend/yellow/src/workspaces/EcosystemHub";

test("Order71 adds only the two bounded actionable ecosystem entries", () => {
  const crs = capabilityByKey("reservations.staff-crs");
  const rms = capabilityByKey("revenue.rms-evidence");
  expect(crs).toMatchObject({ key: "reservations.staff-crs", module: "reservations", label: "Staff CRS search", status: "beta", existing: true,
    audience: ["hotel-operator", "hotel-manager"], route: "/p/:propertyId/reservations?view=crs",
    summary: "Search availability across granted properties and continue with a reservation draft.",
    operationalPurpose: "Find an offer, then continue through guest selection and fresh reservation confirmation.",
    prerequisite: "Authenticated staff access to the selected properties and current availability.",
    statusReason: "Existing staff search and draft handoff; an offer does not reserve inventory or confirm a price." });
  expect(rms).toMatchObject({ key: "revenue.rms-evidence", module: "revenue", label: "RMS evidence", status: "beta", existing: true,
    audience: ["revenue-team", "hotel-manager"], route: "/p/:propertyId/today?workspace=rates",
    summary: "Review recorded rate models and economics in Rates.",
    operationalPurpose: "Inspect available revenue evidence for the current property.",
    prerequisite: "Authenticated property access and configured rate data.",
    statusReason: "Existing evidence view; quotes may be unavailable, and this entry does not publish rates or generate forecasts." });
  expect(crs?.devices).toEqual(["desktop", "tablet"]); expect(rms?.devices).toEqual(["desktop", "tablet"]);
  expect(isOperationalCapability(crs!)).toBe(true); expect(isOperationalCapability(rms!)).toBe(true);
  expect(CAPABILITY_REGISTRY.filter(record => record.key === "reservations.staff-crs" || record.key === "revenue.rms-evidence")).toHaveLength(2);
});

test("existing broad CRS, booking, RMS recommendations, CRM and setup boundaries remain unchanged", () => {
  expect(capabilityByKey("reservations.crs")).toMatchObject({ status: "preview", existing: false, route: "/ecosystem/preview/reservations-crs" });
  expect(capabilityByKey("reservations.booking-engine")).toMatchObject({ status: "blocked", existing: false });
  expect(capabilityByKey("revenue.rms-recommendations")).toMatchObject({ status: "planned", existing: false });
  expect(capabilityByKey("crm.guests")).toMatchObject({ status: "live", existing: true });
  expect(capabilityByKey("property-setup.settings")).toMatchObject({ status: "live", existing: true });
});

test("All ecosystem renders both entries as actionable beta cards with truthful copy", () => {
  const html = renderToStaticMarkup(createElement(EcosystemHub, { propertyId: "synthetic-property" }));
  for (const [key, label, button] of [["reservations.staff-crs", "Staff CRS search", "Open bounded view"], ["revenue.rms-evidence", "RMS evidence", "Open bounded view"]]) {
    const card = html.slice(html.indexOf(`data-capability-key=\"${key}\"`));
    expect(card).toContain(`<h3>${label}</h3>`); expect(card.slice(0, card.indexOf("</article>")).match(/<button/g)?.length).toBeGreaterThan(0);
    expect(card.slice(0, card.indexOf("</article>"))).toContain("Beta"); expect(card.slice(0, card.indexOf("</article>"))).toContain(button);
  }
});
