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

type PickupState = Readonly<{ state: string; label: string }> | null;
const presenterSource = functionSource("reservationPickupAutomationState");
const presenter = Function(`"use strict"; ${presenterSource}; return reservationPickupAutomationState;`)() as
  (travel: Record<string, unknown> | null) => PickupState;

test("Order 214 maps only authoritative arrival pickup truth to exact honest labels", () => {
  const scheduledAt = "2026-09-14T06:30:00.123456Z";
  const pickupTaskId = "00000000-0000-4000-8000-000000021401";
  expect(presenter(null)).toBeNull();
  expect(presenter({ direction: "departure", pickupRequested: true, scheduledAt, pickupTaskId }))
    .toBeNull();
  expect(presenter({ direction: "arrival", pickupRequested: false, scheduledAt, pickupTaskId: null }))
    .toEqual({ state: "not-requested", label: "Pickup not requested" });
  expect(presenter({ direction: "arrival", pickupRequested: true, scheduledAt: null, pickupTaskId: null }))
    .toEqual({ state: "schedule-required", label: "Pickup requested · schedule required" });
  expect(presenter({ direction: "arrival", pickupRequested: true, scheduledAt, pickupTaskId: null }))
    .toEqual({ state: "task-pending", label: "Pickup requested · task pending" });
  expect(presenter({ direction: "arrival", pickupRequested: true, scheduledAt, pickupTaskId }))
    .toEqual({ state: "task-linked", label: "Pickup task linked" });
});

test("Order 214 keeps the state text-backed inside existing Travel detail", () => {
  const render = functionSource("reservationTravelDetailCollection");
  for (const field of ["direction", "mode", "carrier", "serviceNo", "scheduledAt"]) {
    expect(render).toContain(`item.${field}`);
  }
  expect(render).toContain('node("span", "reservation-pickup-state", pickup.label)');
  expect(render).toContain("state.dataset.pickupState = pickup.state");
  expect(render).toContain("const pickup = reservationPickupAutomationState(item)");
  expect(render).not.toMatch(/request\(|addEventListener|button|href|task\.status|assignee|queue|dispatch|driver|vehicle|contact/i);
  expect(functionSource("renderReservationDetail"))
    .toContain("reservationTravelDetailCollection(reservation.travel)");
});

test("Order 214 presentation is pure and adds no endpoint, polling, action, or lifecycle claim", () => {
  expect(presenterSource).not.toMatch(/request\(|fetch\(|setInterval|setTimeout|addEventListener|button|href/i);
  expect(presenterSource).not.toMatch(/taskStatus|taskState|assignee|queue|dispatch|completion|driver|vehicle|contact|outcome/i);
  expect(presenterSource).not.toContain("pickupTaskId:");
});
