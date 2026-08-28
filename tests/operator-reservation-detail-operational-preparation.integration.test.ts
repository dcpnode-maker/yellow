import { describe, expect, test } from "bun:test";
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

describe("Order 219 reservation-detail operational preparation", () => {
  test("uses the exact authoritative status truth table and emits at most one preparation", () => {
    const action = executableFunction<(status: string) => Readonly<{ workbench: string; label: string }> | null>(
      "reservationOperationalPreparation",
    );
    expect(action("due_in")).toEqual({ workbench: "check-in", label: "Prepare check-in" });
    expect(action("in_house")).toEqual({ workbench: "checkout", label: "Prepare checkout" });
    expect(action("due_out")).toEqual({ workbench: "checkout", label: "Prepare checkout" });
    for (const status of ["quote", "reserved", "waitlist", "checked_out", "cancelled", "no_show", "other", ""]) {
      expect(action(status)).toBeNull();
    }
    expect(Object.isFrozen(action("due_in"))).toBeTrue();

    const render = functionSource("renderReservationDrawerLifecycle");
    expect(render).toContain("reservationOperationalPreparation(result.reservation.status)");
    expect(render).toContain('node("button", "primary reservation-operational-preparation-action", preparation.label)');
    expect(render).toContain('if (preparation && currentReservationWorkbench === null && location.pathname === plainDetailPath && location.search === "")');
    expect((render.match(/menu\.append\(action\)/g) || []).length).toBe(1);
  });

  test("rechecks every identity, status and visible-surface boundary before navigation", () => {
    const current = functionSource("reservationOperationalPreparationActionIsCurrent");
    for (const proof of [
      'activeView === "reservations"',
      "origin.detailGeneration === reservationDetailGeneration",
      "origin.property === propertySelect.value",
      "origin.reservationId === reservationRouteReservationId",
      "reservation?.reservationId === origin.reservationId",
      "reservation.confirmationNo === origin.confirmationNo",
      "reservation.status === origin.status",
      "preparation?.workbench === origin.workbench",
      "location.pathname",
      'location.search === ""',
      "reservationDetailDrawer.isConnected",
      "reservationDetailDrawer.hidden === false",
      "reservationDetailContent.isConnected",
      "reservationDetailContent.hidden === false",
      "reservationDetailActions.isConnected",
      "reservationDetailActions.hidden === false",
      "action?.isConnected",
      "action.hidden === false",
      "action.disabled === false",
      "reservationDetailDrawer.contains(action)",
    ]) expect(current).toContain(proof);
    expect(functionSource("openReservationOperationalPreparation")).toContain(
      "if (!reservationOperationalPreparationActionIsCurrent(origin, action)) return",
    );
  });

  test("validates persisted return identity and rejects malformed or status-incompatible state", () => {
    const state = functionSource("reservationOperationalPreparationReturnFromState");
    expect(state).toContain('state?.yellowSurface !== "reservation-detail"');
    expect(state).toContain('Object.keys(value).sort().join(",") !== "confirmationNo,exitAction,property,reservationId,status,workbench"');
    expect(state).toContain("value.property !== property");
    expect(state).toContain("value.reservationId !== reservationId");
    expect(state).toContain("canonicalUuid(value.property)");
    expect(state).toContain("canonicalUuid(value.reservationId)");
    expect(state).toContain('typeof value.confirmationNo !== "string"');
    expect(state).toContain('!["back", "replace"].includes(value.exitAction)');
    expect(state).toContain("reservationOperationalPreparation(value.status)?.workbench !== value.workbench");
    expect(state).toContain("Object.freeze({ ...value })");
  });

  test("adds one same-reservation query entry through the existing exact parser", () => {
    const open = functionSource("openReservationOperationalPreparation");
    expect((open.match(/history\.pushState\(/g) || []).length).toBe(1);
    expect(open).toContain("/p/${origin.property}/res/${origin.reservationId}?${RESERVATION_WORKBENCH_QUERY[origin.workbench]}");
    expect(open).toContain('yellowSurface: "reservation-detail"');
    expect(open).toContain("reservationOperationalPreparationReturn: returnState");
    expect(open).toContain('exitAction: reservationExitHistoryAction(history.state, "reservation-detail")');
    expect(open).toContain("const route = reservationRoute()");
    expect(open).toContain('route.kind !== "detail"');
    expect(open).toContain("route.workbench !== origin.workbench");
    expect(open).toContain("currentReservationWorkbench = route.workbench");
    expect(open).toContain("applyReservationWorkbenchIntent(reservationDetailData.reservation)");

    const parse = executableFunction<(search: string) => { valid: boolean; value: string | null }>("reservationWorkbenchIntent");
    expect(parse("?workbench=check-in")).toEqual({ valid: true, value: "check-in" });
    expect(parse("?workbench=checkout")).toEqual({ valid: true, value: "checkout" });
    for (const invalid of [
      "?workbench=", "?workbench=checkin", "?workbench=CHECK-IN",
      "?workbench=check-in&workbench=checkout", "?workbench=checkout&extra=1", "?extra=1",
    ]) expect(parse(invalid)).toEqual({ valid: false, value: null });
  });

  test("uses existing readiness and explicit confirmation authority without a command on navigation", () => {
    const open = functionSource("openReservationOperationalPreparation");
    const apply = functionSource("applyReservationWorkbenchIntent");
    const checkInReadiness = functionSource("loadCheckInReadiness");
    const checkoutReadiness = functionSource("loadCheckoutReadiness");
    expect(apply).toContain('intent === "check-in" && reservation.status === "due_in"');
    expect(apply).toContain('intent === "checkout" && ["in_house", "due_out"].includes(reservation.status)');
    expect(apply).toContain("loadCheckInReadiness({ focus: checkInCompatible })");
    expect(apply).toContain("loadCheckoutReadiness({ focus: checkoutCompatible })");
    expect(checkInReadiness).toContain("/check-in/readiness");
    expect(checkoutReadiness).toContain("/checkout-readiness");
    expect(script).toContain('checkInForm.addEventListener("submit"');
    expect(script).toContain('departureCheckoutForm.addEventListener("submit"');
    expect(functionSource("submitCheckIn")).toContain("!checkInConfirm.checked");
    expect(functionSource("submitCheckout")).toContain("!departureCheckoutConfirm.checked");
    expect(open).not.toMatch(/method:\s*"(?:POST|PUT|PATCH|DELETE)"|submitCheckIn|submitCheckout|crypto\.randomUUID|request\(/);
  });

  test("Refresh and Forward reapply intent while Back restores plain-detail safe focus", () => {
    const openDetail = functionSource("openReservationDetail");
    const sync = functionSource("syncReservationRoute");
    const render = functionSource("renderReservationDetail");
    const restore = functionSource("restoreReservationOperationalPreparationFocus");
    expect(openDetail).toContain("reservationOperationalPreparationReturnFromState(history.state, propertySelect.value, reservationId)");
    expect(openDetail).toContain("reservationOperationalPreparationReturn = operationalReturn");
    expect(sync).toContain("currentReservationWorkbench !== route.workbench");
    expect(sync).toContain("openReservationDetail(route.reservationId, { push: false, workbench: route.workbench })");
    expect(render).toContain("applyReservationWorkbenchIntent(reservation)");
    expect(render).toContain("restoreReservationOperationalPreparationFocus(reservation)");
    expect(restore).toContain("currentReservationWorkbench !== null");
    expect(restore).toContain('location.search !== ""');
    expect(restore).toContain('querySelector(".reservation-operational-preparation-action")');
    expect(restore).toContain("returning.confirmationNo === reservation.confirmationNo");
    expect(restore).toContain("returning.status === reservation.status");
    expect(restore).toContain("preparation?.workbench === returning.workbench");
    expect(restore).toContain("(exact ? action : reservationDetailTitle).focus({ preventScroll: true })");
    expect(restore).toContain("reservationOperationalPreparationReturn = null");
  });

  test("preserves existing Close and Escape behavior and adds no polling, storage or inferred command", () => {
    const close = functionSource("closeReservationDetail");
    expect(close).toContain("reservationOperationalPreparationReturnFromState(");
    expect(close).toContain("reservationOperationalPreparationReturn = null");
    expect(close).toContain('operationalReturn?.exitAction === "back"');
    expect(close).toContain("history.go(-2)");
    expect(close).toContain('operationalReturn?.exitAction === "replace"');
    expect(close).toContain("/p/${propertySelect.value}/reservations");
    expect(close).toContain('reservationExitHistoryAction(history.state, "reservation-detail") === "back"');
    expect(close).toContain("history.back()");
    expect(script).toContain('if (!reservationDetailDrawer.hidden) { event.preventDefault(); closeReservationDetail(); return; }');

    const navigation = [
      functionSource("reservationOperationalPreparation"),
      functionSource("reservationOperationalPreparationReturnFromState"),
      functionSource("reservationOperationalPreparationActionIsCurrent"),
      functionSource("openReservationOperationalPreparation"),
      functionSource("restoreReservationOperationalPreparationFocus"),
    ].join("\n");
    expect(navigation).not.toMatch(/setInterval|setTimeout|localStorage|sessionStorage|method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
    expect(navigation).not.toMatch(/auto(?:matic)?(?:Check|[- ]?check)|occupancy|roomCondition|housekeeping|folioRepair/i);
  });
});
