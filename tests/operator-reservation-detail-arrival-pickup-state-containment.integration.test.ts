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

interface PickupTravel {
  readonly direction: "arrival" | "departure";
  readonly pickupRequested: boolean;
  readonly scheduledAt: string | null;
  readonly pickupTaskId: string | null;
}

interface PickupState {
  readonly state: "not-requested" | "schedule-required" | "task-pending" | "task-linked";
  readonly label: string;
}

test("Order 214: pure arrival truth emits only the four exact text-backed presentation states", () => {
  const state = executableFunction<(travel: PickupTravel | null | undefined) => PickupState | null>(
    "reservationPickupAutomationState",
  );
  const arrival = {
    direction: "arrival",
    pickupRequested: false,
    scheduledAt: "2027-05-06T07:30:00.000Z",
    pickupTaskId: null,
  } satisfies PickupTravel;

  expect(state(null)).toBeNull();
  expect(state(undefined)).toBeNull();
  expect(state({ ...arrival, direction: "departure", pickupRequested: true })).toBeNull();
  expect(state(arrival)).toEqual({ state: "not-requested", label: "Pickup not requested" });
  expect(state({ ...arrival, pickupRequested: true, scheduledAt: null })).toEqual({
    state: "schedule-required", label: "Pickup requested · schedule required",
  });
  expect(state({ ...arrival, pickupRequested: true })).toEqual({
    state: "task-pending", label: "Pickup requested · task pending",
  });
  expect(state({ ...arrival, pickupRequested: true, pickupTaskId: "canonical-task" })).toEqual({
    state: "task-linked", label: "Pickup task linked",
  });
  expect(Object.isFrozen(state(arrival)!)).toBeTrue();
  expect(Object.keys(state({ ...arrival, pickupRequested: true, pickupTaskId: "canonical-task" })!))
    .toEqual(["state", "label"]);
});

test("Order 214: canonical Travel rendering preserves travel truth without inventing task output or actions", () => {
  const presenter = functionSource("reservationPickupAutomationState");
  const travel = functionSource("reservationTravelDetailCollection");

  expect(travel).toContain("reservationPickupAutomationState(item)");
  expect(travel).toContain('"reservation-travel-detail-copy"');
  expect(travel).toContain('"reservation-pickup-state"');
  expect(travel).toContain("pickup.label");
  expect(travel).toContain("pickupState = pickup.state");
  for (const literal of ["direction", "mode", "carrier", "serviceNo", "scheduledAt"]) {
    expect(travel).toContain(literal);
  }

  // The presenter may inspect pickupTaskId only as coherent link-presence input. Neither
  // it nor the exact render helper may expose identity or grow an interactive task surface.
  expect(presenter).not.toMatch(/(?:request|fetch)\s*\(|href|addEventListener|onclick/i);
  expect(travel).not.toMatch(/pickupTaskId|taskStatus|taskState|assignee|assignment|queue|dispatch|completion|driver|vehicle|contact/i);
  expect(travel).not.toMatch(/(?:request|fetch)\s*\(|href|addEventListener|onclick/i);
  expect(travel).not.toMatch(/(?:el|node)\(\s*["'](?:a|button)["']/i);
  expect(travel).not.toMatch(/\/tasks?(?:\/|\?|`|["'])/i);
  expect(travel).not.toMatch(/method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i);

  const render = functionSource("renderReservationDetail");
  expect(render).toContain("reservationTravelDetailCollection(reservation.travel)");
  expect(render).not.toMatch(/pickupTaskId|taskStatus|taskState|assignee|queue|dispatch|completion|driver|vehicle|contact/i);
});

test("Order 214 detail containment survives the nested Order 215 Back, Escape and focus path", () => {
  const intent = executableFunction<(search: string) => { valid: boolean; value: string | null }>(
    "reservationWorkbenchIntent",
  );
  expect(intent("")).toEqual({ valid: true, value: null });
  expect(intent("?workbench=check-in")).toEqual({ valid: true, value: "check-in" });
  expect(intent("?workbench=checkout")).toEqual({ valid: true, value: "checkout" });
  for (const invalid of [
    "?workbench=pickup", "?pickup=1", "?task=canonical-task",
    "?workbench=check-in&pickup=1", "?workbench=checkout&workbench=checkout",
  ]) expect(intent(invalid)).toEqual({ valid: false, value: null });

  const route = functionSource("reservationRoute");
  expect(route).toContain("/^\\/p\\/([0-9a-f-]+)\\/res\\/([0-9a-f-]+)$/");
  expect(route).toContain("reservationWorkbenchIntent(location.search)");
  expect(route).toContain('history.replaceState(history.state, "", `/p/${detail[1]}/res/${detail[2]}`)');
  expect(route).not.toMatch(/pickup|task/i);

  const open = functionSource("openReservationDetail");
  expect(open).toContain('workbench === "check-in" || workbench === "checkout"');
  expect(open).toContain("reservationDetailDrawer.focus()");
  expect(open).toContain("await loadReservationDetail(reservationId)");
  expect(open).not.toMatch(/pickup|task/i);

  const load = functionSource("loadReservationDetail");
  expect(load).toContain("const generation = ++reservationDetailGeneration");
  expect(load).toContain("generation !== reservationDetailGeneration");
  expect(load).toContain("property !== propertySelect.value");
  expect(load).toContain("reservationRouteReservationId !== reservationId");
  expect(load).toContain("reservationDetailDrawer.setAttribute(\"aria-busy\", \"true\")");

  const close = functionSource("closeReservationDetail");
  expect(close).toContain("reservationDetailGeneration += 1");
  expect(close).toContain('reservationExitHistoryAction(history.state, "reservation-detail") === "back"');
  expect(close).toContain("reservationDrawerReturnFocus?.isConnected");
  expect(close).toContain("target?.focus()");

  const keydownStart = script.indexOf('document.addEventListener("keydown"');
  const keydownEnd = script.indexOf('folioStatementLookupForm.addEventListener', keydownStart);
  const keydown = script.slice(keydownStart, keydownEnd);
  expect(keydown).toContain('event.key === "Escape"');
  expect(keydown).toContain("closeReservationPickupTaskDetail()");
  expect(keydown).toContain("closeReservationDetail()");
  expect(keydown.indexOf("closeReservationPickupTaskDetail()")).toBeLessThan(
    keydown.indexOf("closeReservationDetail()"),
  );
  expect(keydown).not.toMatch(/method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
});
