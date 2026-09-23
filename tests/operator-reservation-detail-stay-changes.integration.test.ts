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

test("Order 210: one current-detail Stay changes action hosts the existing governed editor", () => {
  expect((html.match(/id="reservation-segment-editor"/g) || [])).toHaveLength(1);
  expect(script).toContain('stayChangesAction.textContent = "Stay changes"');
  expect(script).toContain('stayChangesAction.className = "secondary reservation-stay-changes-action"');
  expect(script).toContain('const stayChangesPanel = node("section", "reservation-stay-changes-panel")');
  expect(functionSource("openReservationStayChanges")).toContain("panel.append(reservationSegmentEditor)");
  expect(script).toContain("void openReservationStayChanges(result.reservation, { focus: true })");

  const open = functionSource("openReservationStayChanges");
  expect(open).toContain("reservation.reservationId !== reservationRouteReservationId");
  expect(open).toContain("reservationDetailData.reservation.confirmationNo !== reservation.confirmationNo");
  expect(open).toContain("reservationSegmentLookupForm.elements.confirmationNo.value = confirmationNo");
  expect(open).toContain("requestReservationSegments(origin.property, confirmationNo)");
  expect(open).toContain("renderReservationSegments(body.reservation, focus)");
  expect(open).not.toMatch(/method:\s*"(?:POST|PATCH|PUT|DELETE)"/);
});

test("Order 210: segment loading and focus fail closed across every drawer identity boundary", () => {
  expect(script).toContain("let reservationSegmentRequestGeneration = 0");
  const guard = functionSource("reservationSegmentDetailRequestIsCurrent");
  for (const proof of [
    "origin.requestGeneration === reservationSegmentRequestGeneration",
    "origin.detailGeneration === reservationDetailGeneration",
    "origin.property === propertySelect.value",
    "origin.reservationId === reservationRouteReservationId",
    "reservationDetailData?.reservation?.reservationId === origin.reservationId",
    "reservationDetailData.reservation.confirmationNo === origin.confirmationNo",
    "reservationDetailDrawer.hidden === false",
    'classList.contains("reservation-stay-changes-panel")',
  ]) expect(guard).toContain(proof);

  const restore = functionSource("restoreReservationSegmentEditorHome");
  expect(restore).toContain("reservationSegmentRequestGeneration += 1");
  expect(restore).toContain("reservationSegmentData = null");
  expect(restore).toContain("reservationSegmentEditor.hidden = true");
  expect(restore).toContain("reservationSegmentHome.append(reservationSegmentEditor)");
  expect(functionSource("clearReservationDrawerLifecycle")).toContain("restoreReservationSegmentEditorHome()");
  for (const boundary of ["showLogin", "loadReservationDetail", "closeReservationDetail"]) {
    expect(functionSource(boundary)).toContain("clearReservationDrawerLifecycle()");
  }
  const propertyChangeStart = script.indexOf('propertySelect.addEventListener("change"');
  const propertyChange = script.slice(propertyChangeStart, script.indexOf("for (const tab of navigation)", propertyChangeStart));
  expect(propertyChange).toContain("clearReservationDrawerLifecycle()");
});

test("Order 210: successful commands keep governed writes byte-stable then refresh detail and segment truth once", () => {
  const requestSegments = functionSource("requestReservationSegments");
  expect(requestSegments).toContain("/reservation-segments?confirmationNo=${enc(confirmationNo)}");

  const submit = functionSource("submitSegmentCommand");
  expect(submit).toContain("reservationSegmentCommandOrigin()");
  expect(submit).toContain("reservationSegmentDetailRequestIsCurrent(origin)");
  expect(submit).toContain("/reservations/${enc(reservationSegmentData.reservationId)}/segments/${enc(latest.segmentId)}${path}");
  expect(submit).toContain("method,");
  expect(submit).toContain('headers: { "idempotency-key": key }');
  expect(submit).toContain("body: JSON.stringify(body)");
  expect(submit).toContain("pendingKeys.delete(identity)");
  expect(submit).toContain("refreshReservationDetailAfterSegmentCommand(origin)");
  const catchSource = submit.slice(submit.indexOf("} catch (error)"));
  expect(catchSource).not.toContain("pendingKeys.delete(identity)");

  const refresh = functionSource("refreshReservationDetailAfterSegmentCommand");
  expect(refresh).toContain('origin.kind !== "drawer"');
  expect(refresh).toContain("await loadReservationSegments(true)");
  expect(refresh).toContain("await loadReservationDetail(origin.reservationId)");
  expect(refresh).toContain("return openReservationStayChanges(current, { focus: true })");
  expect((refresh.match(/loadReservationDetail\(/g) || [])).toHaveLength(1);
  expect((refresh.match(/openReservationStayChanges\(/g) || [])).toHaveLength(1);

  const render = functionSource("renderReservationSegments");
  expect(render).toContain("reservationDepartureForm.hidden = !latest?.actions.canChangeDeparture");
  expect(render).toContain("reservationRoomMoveForm.hidden = !latest?.actions.canMoveRoom");
});
