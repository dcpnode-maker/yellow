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
  return new Function(`return (${functionSource(name)})`)() as T;
}

test("Order 209: Today operational actions are an exact lane and row-status truth table", () => {
  const action = executableFunction<(lane: string, row: string) => { workbench: string; label: string } | null>("todayOperationalAction");
  expect(action("due_in", "due_in")).toEqual({ workbench: "check-in", label: "Prepare check-in" });
  expect(action("due_out", "due_out")).toEqual({ workbench: "checkout", label: "Prepare checkout" });
  for (const lane of ["due_in", "due_out", "in_house", "unknown"]) {
    for (const row of ["due_in", "due_out", "in_house", "unknown"]) {
      if ((lane === "due_in" && row === "due_in") || (lane === "due_out" && row === "due_out")) continue;
      expect(action(lane, row)).toBeNull();
    }
  }
  const render = functionSource("renderTodayLane");
  expect(render).toContain("todayOperationalAction(status, row.status)");
  const card = functionSource("reservationCard");
  expect(card).toContain('"today-operational-action"');
  expect(card).toContain("operationalAction.label");
  expect(card).toContain("workbench: operationalAction.workbench");
  expect(card).toContain("reservationOpenButton(row)");
  expect(card).not.toMatch(/(?:arrivalTravel|departureTravel|pickup|room|folio).*todayOperationalAction/i);
});

test("Order 209: reservation workbench query parsing accepts only zero or one exact allowed value", () => {
  const parse = executableFunction<(search: string) => { valid: boolean; value: string | null }>("reservationWorkbenchIntent");
  expect(parse("")).toEqual({ valid: true, value: null });
  expect(parse("?workbench=check-in")).toEqual({ valid: true, value: "check-in" });
  expect(parse("?workbench=checkout")).toEqual({ valid: true, value: "checkout" });
  for (const invalid of [
    "?workbench=", "?workbench=checkin", "?workbench=CHECK-IN",
    "?workbench=check-in&workbench=checkout", "?workbench=check-in&extra=1", "?extra=1",
  ]) expect(parse(invalid)).toEqual({ valid: false, value: null });

  const route = functionSource("reservationRoute");
  expect(route).toContain("reservationWorkbenchIntent(location.search)");
  expect(route).toContain("history.replaceState(history.state");
  expect(route).toContain("workbench: parsed.value");
  expect(route).not.toContain("prepare");
});

test("Order 209: route intent is tracked separately and applied only after authoritative detail", () => {
  expect(script).toContain("let currentReservationWorkbench = null");
  const open = functionSource("openReservationDetail");
  expect(open).toContain('workbench === "check-in" || workbench === "checkout"');
  expect(open).toContain("RESERVATION_WORKBENCH_QUERY[currentReservationWorkbench]");
  expect(open).toContain("await loadReservationDetail(reservationId)");

  const sync = functionSource("syncReservationRoute");
  expect(sync).toContain("currentReservationWorkbench !== route.workbench");
  expect(sync).toContain("workbench: route.workbench");

  const render = functionSource("renderReservationDetail");
  expect(render).toContain("applyReservationWorkbenchIntent(reservation)");
  const apply = functionSource("applyReservationWorkbenchIntent");
  expect(apply).toContain('intent === "check-in" && reservation.status === "due_in"');
  expect(apply).toContain('intent === "checkout" && ["in_house", "due_out"].includes(reservation.status)');
  expect(apply).toContain("loadCheckInReadiness({ focus: checkInCompatible })");
  expect(apply).toContain("loadCheckoutReadiness({ focus: checkoutCompatible })");
  expect(apply).toContain("canonicalizeReservationWorkbenchIntent(reservation.reservationId)");
  expect(apply).toContain("reservationDetailDrawer.focus({ preventScroll: true })");
  expect(apply).not.toMatch(/method:\s*"POST"|submitCheckIn|submitCheckout|crypto\.randomUUID/);
});

test("Order 209: focused readiness settles only against the guarded current detail", () => {
  const checkIn = functionSource("loadCheckInReadiness");
  expect(checkIn).toContain("generation !== checkInReadinessGeneration");
  expect(checkIn).toContain("detailGeneration !== reservationDetailGeneration");
  expect(checkIn).toContain("reservationRouteReservationId !== reservationId");
  expect(checkIn).toContain("if (focus) checkInHeading.focus({ preventScroll: true })");
  expect(checkIn).toContain("if (focus) checkInRefresh.focus({ preventScroll: true })");

  const checkout = functionSource("loadCheckoutReadiness");
  expect(checkout).toContain("checkoutReadinessIsCurrent");
  expect(checkout).toContain("if (focus) departureHeading.focus({ preventScroll: true })");
  expect(checkout).toContain("if (focus) departureRetry.focus({ preventScroll: true })");
  expect(script).toContain('checkInForm.addEventListener("submit"');
  expect(script).toContain('departureCheckoutForm.addEventListener("submit"');
});
