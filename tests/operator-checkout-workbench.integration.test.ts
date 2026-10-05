import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import {
  CheckoutConflictError,
  CheckoutNotFoundError,
  CheckoutValidationError,
} from "../src/contexts/stay-operations";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000204001";
const PROPERTY = "00000000-0000-0000-0000-000000204002";
const RESERVATION = "00000000-0000-0000-0000-000000204003";
const SEGMENT = "00000000-0000-0000-0000-000000204004";
const SPACE = "00000000-0000-0000-0000-000000204005";
const ACTOR = "00000000-0000-0000-0000-000000204006";
const KEY = "checkout-attempt-0001";

const calls: unknown[] = [];
const checkouts = {
  async checkout(input: unknown) {
    calls.push(input);
    return {
      reservationId: RESERVATION,
      previousReservationStatus: "due_out" as const,
      reservationStatus: "checked_out" as const,
      segmentId: SEGMENT,
      segmentStatus: "departed" as const,
      assignedSpaceId: SPACE,
      checkedOutAt: "2026-08-28T09:30:00.000Z",
      previousSegmentPeriod: { from: "2026-08-27T09:00:00.000Z", to: "2026-08-29T09:00:00.000Z" },
      segmentPeriod: { from: "2026-08-27T09:00:00.000Z", to: "2026-08-28T09:30:00.000Z" },
      releasedClaimCount: 1,
      folioWindowCount: 2,
      replayed: false,
    };
  },
};

const api = new OperatorHttpApi(
  {} as LocalLoginService, {} as AvailabilityService,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  checkouts,
);

function context(path: string, scopes: readonly string[], granted = true, includeKey = true): TenantRequestContext {
  const tx = (() => Promise.resolve(granted ? [{ id: PROPERTY, name: "Hotel", timezone: "UTC", currency: "USD" }] : [])) as unknown as Tx;
  return {
    tenantId: TENANT,
    request: new Request(`http://yellow.test${path}`, {
      method: "POST",
      headers: includeKey ? { "content-type": "application/json", "idempotency-key": KEY } : { "content-type": "application/json" },
      body: "{}",
    }),
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

describe("Order 204 operator governed checkout command", () => {
  test("POST is no-store, property-granted and binds only server identity", async () => {
    calls.length = 0;
    const response = await api.commitCheckout(
      context("/x", ["stay-operations.checkout:commit"]), PROPERTY, RESERVATION, {},
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("idempotency-replayed")).toBe("false");
    expect(await response.json()).toMatchObject({ reservationId: RESERVATION, reservationStatus: "checked_out", replayed: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: RESERVATION,
      idempotencyKey: KEY,
      envelope: { actorId: ACTOR, tenantId: TENANT, propertyNode: PROPERTY, operation: "reservation.checked_out" },
    });
  });

  test("scope, concealment and exact request shape fail closed before service", async () => {
    calls.length = 0;
    const scope = ["stay-operations.checkout:commit"];
    expect((await api.commitCheckout(context("/x", []), PROPERTY, RESERVATION, {})).status).toBe(403);
    expect((await api.commitCheckout(context("/x", scope, false), PROPERTY, RESERVATION, {})).status).toBe(404);
    expect((await api.commitCheckout(context("/x", scope, true, false), PROPERTY, RESERVATION, {})).status).toBe(400);
    expect((await api.commitCheckout(context("/x?force=1", scope), PROPERTY, RESERVATION, {})).status).toBe(400);
    expect((await api.commitCheckout(context("/x", scope), "bad", RESERVATION, {})).status).toBe(400);
    expect((await api.commitCheckout(context("/x", scope), PROPERTY, "bad", {})).status).toBe(400);
    for (const body of [{ ready: true }, { roomId: SPACE }, { blockers: [] }, null, []]) {
      expect((await api.commitCheckout(context("/x", scope), PROPERTY, RESERVATION, body)).status).toBe(400);
    }
    expect(calls).toEqual([]);
  });

  test("domain failures map without leaking private detail", async () => {
    const request = new Request("http://yellow.test/x");
    expect(await api.failure(request, new CheckoutValidationError("private")).json()).toMatchObject({ status: 400, type: "request/invalid" });
    expect(await api.failure(request, new CheckoutNotFoundError("private")).json()).toMatchObject({ status: 404, type: "reservations/not_found" });
    const conflict = new CheckoutConflictError("private", ["folio_window_nonzero"]);
    expect(await api.failure(request, conflict).json()).toMatchObject({
      status: 409,
      type: "reservations/conflict",
      blockers: ["folio_window_nonzero"],
    });
  });

  test("the app exposes only the exact checkout command route", () => {
    expect(app).toContain('.post("/api/v1/properties/:property/reservations/:reservation/checkout"');
    expect(app).not.toContain('.put("/api/v1/properties/:property/reservations/:reservation/checkout"');
    expect(app).not.toContain('.delete("/api/v1/properties/:property/reservations/:reservation/checkout"');
  });

  test("Departure uses explicit confirmation, retained retry identity and authoritative refresh", () => {
    for (const id of ["checkout-command-form", "checkout-command-consequence", "checkout-command-confirm", "checkout-command-submit"]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("Check out guest");
    expect(html).toContain("server locks and revalidates the stay");
    expect(html).toContain('aria-live="assertive"');

    const submit = functionSource("submitCheckout");
    const current = functionSource("checkoutReadinessIsCurrent");
    const refresh = functionSource("loadCheckoutReadiness");
    expect(submit).toContain("/checkout`");
    expect(submit).toContain('method: "POST"');
    expect(submit).toContain('body: "{}"');
    expect(submit).toContain('"idempotency-key": attemptKey');
    expect(submit).toContain("checkoutAttemptDraft !== draft");
    expect(submit).toContain("Retry keeps the same request key");
    expect(submit).toContain("loadReservationDetail(reservationId)");
    expect(submit).toContain("authoritativeDetailGeneration !== reservationDetailGeneration");
    expect(submit).toContain("void loadToday()");
    expect(submit).toContain("departureHeading.focus");
    expect(submit).toContain("error?.status === 409");
    expect(submit).toContain("checkoutReadinessData = null");
    expect(submit).toContain("departureRefresh.focus");
    expect(refresh).toContain("departureCheckoutConfirm.checked = false");
    expect(current).toContain("checkoutReadinessGeneration");
    expect(current).toContain("reservationDetailGeneration");
    expect(current).toContain("propertySelect.value");
    expect(current).toContain("reservationRouteReservationId === reservationId");
    expect(current).toContain("location.pathname === `/p/${property}/res/${reservationId}`");
    expect(submit).not.toMatch(/localStorage|sessionStorage|setInterval|ready\s*:|blockers\s*:|roomId|occupancyId|balanceMinor/);
  });

  test("command controls remain accessible across every appearance", () => {
    expect(css).toContain(".departure-checkout-confirm");
    expect(css).toContain("min-height: 44px");
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"]`);
      expect(css).toContain(".departure-checkout-confirm");
    }
    expect(css).toContain("min-height: 48px");
    expect(css).toContain("@media (max-width: 600px)");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
