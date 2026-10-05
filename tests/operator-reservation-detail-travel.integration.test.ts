import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
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

test("Order 212: one current-detail Travel details action hosts one reusable editor", () => {
  expect((html.match(/id="reservation-travel-form"/g) || [])).toHaveLength(1);
  expect(script).toContain('travelAction.textContent = "Travel details"');
  expect(script).toContain('travelAction.className = "secondary reservation-travel-action"');
  expect(script).toContain('const travelPanel = node("section", "reservation-travel-panel")');
  expect(script).toContain("if (lifecycle.actions.canModify) menu.append(travelAction)");
  expect(script).toContain("void openReservationTravelEditor(result.reservation, { focus: true })");

  const open = functionSource("openReservationTravelEditor");
  expect(open).toContain("panel.append(reservationTravelForm)");
  expect(open).toContain("reservation.reservationId !== reservationRouteReservationId");
  expect(open).toContain("reservationDetailData.reservation.confirmationNo !== reservation.confirmationNo");
  expect(open).toContain("Array.isArray(reservation.travel)");
  expect(open).toContain('direction === "arrival"');
  expect(open).toContain('direction === "departure"');
  expect(open).not.toMatch(/request\(|method:\s*"(?:POST|PATCH|PUT|DELETE)"/);
});

test("Order 212: exact detail identity, route, generation and mounted panel guard all paint and focus", () => {
  expect(script).toContain("let reservationTravelRequestGeneration = 0");
  const guard = functionSource("reservationTravelDetailRequestIsCurrent");
  for (const proof of [
    "origin.requestGeneration === reservationTravelRequestGeneration",
    "origin.detailGeneration === reservationDetailGeneration",
    "origin.property === propertySelect.value",
    "origin.reservationId === reservationRouteReservationId",
    "location.pathname === `/p/${origin.property}/res/${origin.reservationId}`",
    "reservationDetailData?.reservation?.reservationId === origin.reservationId",
    "reservationDetailData.reservation.confirmationNo === origin.confirmationNo",
    "reservationDetailDrawer.hidden === false",
    'classList.contains("reservation-travel-panel")',
  ]) expect(guard).toContain(proof);

  const restore = functionSource("restoreReservationTravelEditorHome");
  expect(restore).toContain("reservationTravelRequestGeneration += 1");
  expect(restore).toContain("reservationTravelData = null");
  expect(restore).toContain("reservationTravelForm.hidden = true");
  expect(restore).toContain("reservationTravelHome.append(reservationTravelForm)");
  expect(functionSource("clearReservationDrawerLifecycle")).toContain("restoreReservationTravelEditorHome()");
});

test("Order 212: exact loaded tuple is the CAS expected value and desired truth stays minimized", () => {
  const tuple = functionSource("reservationTravelTuple");
  for (const field of ["mode", "carrier", "serviceNo", "scheduledAt", "pickupRequested"]) {
    expect(tuple).toContain(field);
  }
  expect(tuple).not.toMatch(/travelId|pickupTaskId|notes/);
  const desired = functionSource("desiredReservationTravel");
  expect(desired).toContain('direction === "arrival" && fields.pickupRequested.checked');
  expect(desired).toContain("scheduledValue === utcInstantInputValue(loaded.scheduledAt)");
  expect(desired).toContain("scheduledAt = loaded.scheduledAt");
  expect(desired).toContain("new Date(`${scheduledValue}Z`)");
  expect(desired).toContain("instant.toISOString()");
  expect(desired).toContain("empty travel and deletion are not available");

  const submit = functionSource("submitReservationTravelCommand");
  expect(submit).toContain("const expected = reservationTravelTuple(reservationTravelDirectionItem(direction), direction)");
  expect(submit).toContain("const body = { expected, travel }");
  expect(submit).toContain("/travel/${enc(direction)}");
  expect(submit).toContain('method: "PUT"');
  expect(submit).toContain('headers: { "idempotency-key": key }');
  expect(submit).toContain("body: JSON.stringify(body)");
  expect(submit).not.toMatch(/travelId|pickupTaskId|notes/);
});

test("Order 212: panels are mutually exclusive and success refreshes detail exactly once", () => {
  const lifecycle = functionSource("drawerLifecycleButton");
  expect(lifecycle).toContain("restoreReservationTravelEditorHome()");
  const render = functionSource("renderReservationDrawerLifecycle");
  const travelHandler = render.slice(render.indexOf('travelAction.addEventListener("click"'), render.indexOf("if (lifecycle.actions.canModify)"));
  expect(travelHandler).toContain("stayChangesPanel.hidden = true");
  expect(travelHandler).toContain("guestAllocationPanel.hidden = true");
  expect(travelHandler).toContain("restoreReservationSegmentEditorHome()");
  expect(travelHandler).toContain("restoreReservationGuestEditorHome()");

  const refresh = functionSource("refreshReservationDetailAfterTravelCommand");
  expect((refresh.match(/loadReservationDetail\(/g) || [])).toHaveLength(1);
  expect((refresh.match(/openReservationTravelEditor\(/g) || [])).toHaveLength(1);
  expect(refresh).toContain("reservationDetailError.hidden === false");
  expect(refresh).toContain("reservationDetailContent.hidden");
});
