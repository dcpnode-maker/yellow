import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

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

function executableFunction<T extends (...args: never[]) => unknown>(name: string): T {
  return new Function(`"use strict"; return (${functionSource(name)})`)() as T;
}

test("Order 223: Today preparation is the complete exact lane and status matrix", () => {
  const action = executableFunction<
    (lane: string, status: string) => { workbench: string; label: string } | null
  >("todayOperationalAction");
  const statuses = [
    "quote", "reserved", "waitlist", "due_in", "in_house", "due_out",
    "checked_out", "cancelled", "no_show", "unknown", "",
  ];
  const lanes = ["due_in", "due_out", "in_house", "unknown", ""];
  const exact = new Map([
    ["due_in:due_in", { workbench: "check-in", label: "Prepare check-in" }],
    ["due_out:due_out", { workbench: "checkout", label: "Prepare checkout" }],
    ["in_house:in_house", { workbench: "checkout", label: "Prepare checkout" }],
  ]);

  for (const lane of lanes) {
    for (const status of statuses) {
      expect(action(lane, status)).toEqual(exact.get(`${lane}:${status}`) ?? null);
    }
  }

  const helper = functionSource("todayOperationalAction");
  expect(helper).not.toMatch(
    /travel|pickup|room|folio|balance|occupancy|housekeeping|readiness|request|fetch|submit|method|post/i,
  );
});

test("Order 223: in-house reuses the existing semantic action and canonical preparation route", () => {
  const render = functionSource("renderTodayLane");
  expect(render).toContain("operationalAction: todayOperationalAction(status, row.status)");
  expect(render.match(/todayOperationalAction\(/g)).toHaveLength(1);

  const card = functionSource("reservationCard");
  expect(card).toContain('node("button", "today-operational-action", operationalAction.label)');
  expect(card).toContain("trigger: action, workbench: operationalAction.workbench");
  expect(card.match(/today-operational-action/g)).toHaveLength(1);
  expect(card).not.toMatch(/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']|submitCheckIn|submitCheckout|crypto\.randomUUID/);

  const open = functionSource("openReservationDetail");
  expect(open).toContain('workbench === "check-in" || workbench === "checkout"');
  expect(open).toContain("RESERVATION_WORKBENCH_QUERY[currentReservationWorkbench]");
  expect(open).toContain('`/p/${propertySelect.value}/res/${reservationId}${query}`');
  expect(open.match(/history\.pushState\(/g)).toHaveLength(1);
  expect(open).toContain("await loadReservationDetail(reservationId)");
  expect(open).not.toMatch(/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']|submitCheckIn|submitCheckout|crypto\.randomUUID/);
});

test("Order 223: strict parsing, guarded authoritative readiness and explicit confirmation remain mandatory", () => {
  const parse = executableFunction<
    (search: string) => { valid: boolean; value: string | null }
  >("reservationWorkbenchIntent");
  expect(parse("?workbench=checkout")).toEqual({ valid: true, value: "checkout" });
  for (const invalid of [
    "?workbench=", "?workbench=CHECKOUT", "?workbench=checkout&workbench=checkout",
    "?workbench=checkout&extra=1", "?extra=checkout",
  ]) expect(parse(invalid)).toEqual({ valid: false, value: null });

  const route = functionSource("reservationRoute");
  expect(route).toContain("reservationWorkbenchIntent(location.search)");
  expect(route).toContain("history.replaceState(history.state");

  const apply = functionSource("applyReservationWorkbenchIntent");
  expect(apply).toContain('intent === "checkout" && ["in_house", "due_out"].includes(reservation.status)');
  expect(apply).toContain("loadCheckoutReadiness({ focus: checkoutCompatible })");
  expect(apply).toContain("canonicalizeReservationWorkbenchIntent(reservation.reservationId)");
  expect(apply).not.toMatch(/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']|submitCheckout|crypto\.randomUUID/);

  const readiness = functionSource("loadCheckoutReadiness");
  expect(readiness).toContain("checkoutReadinessIsCurrent");
  expect(readiness).toContain("/checkout-readiness");
  expect(readiness).toContain("departureCheckoutConfirm.checked = false");
  const submit = functionSource("submitCheckout");
  expect(submit).toContain("checkoutReadinessData?.ready !== true");
  expect(submit).toContain("!departureCheckoutConfirm.checked");
});

test("Order 223: Today return focus and stale-detail containment remain identity guarded", () => {
  const open = functionSource("openReservationDetail");
  expect(open).toContain('if (activeView === "today")');
  expect(open).toContain('reservationDrawerReturnView = "today"');
  expect(open).toContain("reservationDrawerReturnReservationId = reservationId");

  const detail = functionSource("loadReservationDetail");
  expect(detail).toContain("generation !== reservationDetailGeneration");
  expect(detail).toContain("property !== propertySelect.value");
  expect(detail).toContain("reservationRouteReservationId !== reservationId");

  const close = functionSource("closeReservationDetail");
  expect(close).toContain("todayReturnFocus = { reservationId: returnReservationId, cycle: 0 }");
  expect(close).toContain('setView("today", false)');
  const restore = functionSource("restoreTodayReturnFocus");
  expect(restore).toContain("button.dataset.reservationId === todayReturnFocus.reservationId");
  expect(restore).toContain('decision === "row"');
  expect(restore).toContain('decision === "heading"');
});
