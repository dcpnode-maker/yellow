import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import { CheckoutReadinessNotFoundError, CheckoutReadinessValidationError } from "../src/contexts/stay-operations";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000203001";
const PROPERTY = "00000000-0000-0000-0000-000000203002";
const RESERVATION = "00000000-0000-0000-0000-000000203003";
const SEGMENT = "00000000-0000-0000-0000-000000203004";
const SELLABLE = "00000000-0000-0000-0000-000000203005";
const SPACE = "00000000-0000-0000-0000-000000203006";
const OCCUPANCY = "00000000-0000-0000-0000-000000203007";
const FOLIO = "00000000-0000-0000-0000-000000203008";
const ACTOR = "00000000-0000-0000-0000-000000203009";

const calls: unknown[] = [];
const checkoutReadiness = {
  async read(input: unknown) {
    calls.push(input);
    return {
      reservationId: RESERVATION,
      reservationStatus: "due_out",
      ready: true,
      blockers: [],
      segment: { segmentId: SEGMENT, sellableUnitId: SELLABLE, periodStart: "2026-08-27T09:00:00.000Z", periodEnd: "2026-08-28T09:00:00.000Z" },
      room: { spaceId: SPACE, spaceCode: "402" },
      occupancy: { occupancyId: OCCUPANCY, periodStart: "2026-08-27T09:00:00.000Z", periodEnd: "2026-08-28T09:00:00.000Z" },
      folios: [{ folioId: FOLIO, folioNo: "FOL-203", windowNo: 1, name: "Room", status: "settled", currency: "USD", balanceMinor: "0" }],
    } as const;
  },
};

const api = new OperatorHttpApi(
  {} as LocalLoginService, {} as AvailabilityService,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  checkoutReadiness,
);

function context(path: string, scopes: readonly string[], granted = true): TenantRequestContext {
  const tx = (() => Promise.resolve(granted ? [{ id: PROPERTY, name: "Hotel", timezone: "UTC", currency: "USD" }] : [])) as unknown as Tx;
  return {
    tenantId: TENANT,
    request: new Request(`http://yellow.test${path}`),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");

function functionSource(name: string): string {
  const start = script.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const opening = script.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = opening; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

describe("Order 203 operator governed departure readiness", () => {
  test("GET is no-store, exact-scope and property-granted", async () => {
    calls.length = 0;
    const response = await api.checkoutReadiness(
      context("/x", ["stay-operations.checkout:read"]), PROPERTY, RESERVATION,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ reservationId: RESERVATION, ready: true, folios: [{ balanceMinor: "0" }] });
    expect(calls).toEqual([{ tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION }]);

    expect((await api.checkoutReadiness(context("/x", [], true), PROPERTY, RESERVATION)).status).toBe(403);
    expect((await api.checkoutReadiness(context("/x", ["stay-operations.checkout:read"], false), PROPERTY, RESERVATION)).status).toBe(404);
    expect(calls).toHaveLength(1);
  });

  test("malformed identifiers and query strings fail before the service", async () => {
    calls.length = 0;
    const scope = ["stay-operations.checkout:read"];
    expect((await api.checkoutReadiness(context("/x", scope), "bad", RESERVATION)).status).toBe(400);
    expect((await api.checkoutReadiness(context("/x", scope), PROPERTY, "bad")).status).toBe(400);
    expect((await api.checkoutReadiness(context("/x?include=ledger", scope), PROPERTY, RESERVATION)).status).toBe(400);
    expect(calls).toEqual([]);
  });

  test("domain validation and concealed absence map to stable operator errors", async () => {
    const request = new Request("http://yellow.test/x");
    const invalid = api.failure(request, new CheckoutReadinessValidationError("private detail"));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ type: "request/invalid" });
    const absent = api.failure(request, new CheckoutReadinessNotFoundError("private identity"));
    expect(absent.status).toBe(404);
    expect(await absent.json()).toMatchObject({ type: "reservations/not_found" });
  });

  test("the app exposes the exact read-only route", () => {
    expect(app).toContain('.get("/api/v1/properties/:property/reservations/:reservation/checkout-readiness"');
    expect(app).not.toContain('.post("/api/v1/properties/:property/reservations/:reservation/checkout-readiness"');
  });

  test("reservation detail renders a manual, accessible and stale-safe workbench", () => {
    for (const id of [
      "reservation-departure-workbench", "departure-readiness-heading", "departure-readiness-badge",
      "departure-readiness-error", "departure-readiness-retry", "departure-readiness-content",
      "departure-readiness-evidence", "departure-blockers", "departure-folio-count",
      "departure-folio-list", "departure-readiness-refresh", "departure-readiness-message",
    ]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain("does not check out the guest");

    const load = functionSource("loadCheckoutReadiness");
    const current = functionSource("checkoutReadinessIsCurrent");
    const render = functionSource("renderCheckoutReadiness");
    const card = functionSource("departureFolioCard");
    expect(load).toContain("/checkout-readiness");
    expect(load).not.toMatch(/method\s*:\s*["']POST["']/);
    expect(load).toContain("departureHeading.focus");
    expect(load).toContain("departureRetry.focus");
    expect(current).toContain("checkoutReadinessGeneration");
    expect(current).toContain("reservationDetailGeneration");
    expect(current).toContain("propertySelect.value");
    expect(current).toContain("reservationRouteReservationId === reservationId");
    expect(current).toContain("location.pathname === `/p/${property}/res/${reservationId}`");
    expect(render).toContain("No checkout occurred here");
    expect(card).toContain("`${folio.currency} ${folio.balanceMinor} minor units`");
    expect(card).toContain("openDepartureFolioWorkspace(folio.folioId, card, open)");
    expect(functionSource("openDepartureFolioWorkspace")).toContain("departureFolioReturnIsCurrent(descriptor, card, action)");
    expect(`${load}\n${render}\n${card}`).not.toMatch(/localStorage|sessionStorage|setInterval|BigInt|Number\(folio\.balanceMinor/);
    expect(script).not.toContain('id="departure-checkout"');
  });

  test("fixed blockers and all six appearances remain explicit and responsive", () => {
    for (const blocker of [
      "reservation_not_departure_state", "current_segment_missing_or_ambiguous",
      "physical_room_missing_or_ambiguous", "occupancy_missing_or_ambiguous",
      "folio_window_missing", "folio_window_unsettled", "folio_window_nonzero",
    ]) expect(script).toContain(blocker);
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .departure-workbench`);
    }
    expect(css).toContain(".departure-folio-open");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("@media (max-width: 600px)");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
