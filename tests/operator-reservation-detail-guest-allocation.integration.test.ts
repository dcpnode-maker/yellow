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

test("Order 211: one current-detail Guests & shares action hosts the existing governed editor", () => {
  expect((html.match(/id="reservation-guest-form"/g) || [])).toHaveLength(1);
  expect(script).toContain('guestAllocationAction.textContent = "Guests & shares"');
  expect(script).toContain('guestAllocationAction.className = "secondary reservation-guest-allocation-action"');
  expect(script).toContain('const guestAllocationPanel = node("section", "reservation-guest-allocation-panel")');
  expect(script).toContain("void openReservationGuestAllocation(result.reservation, { focus: true })");

  const open = functionSource("openReservationGuestAllocation");
  expect(open).toContain("panel.append(reservationGuestForm)");
  expect(open).toContain("reservation.reservationId !== reservationRouteReservationId");
  expect(open).toContain("reservationDetailData.reservation.confirmationNo !== reservation.confirmationNo");
  expect(open).toContain("reservationLookupForm.elements.confirmationNo.value = confirmationNo");
  expect(open).toContain("requestReservationGuests(origin.property, confirmationNo)");
  expect(open).toContain("renderReservationGuests(body.reservation, focus)");
  expect(open).not.toMatch(/method:\s*"(?:POST|PATCH|PUT|DELETE)"/);
});

test("Order 211: guest loading and focus fail closed across exact drawer identity and lifecycle boundaries", () => {
  expect(script).toContain("let reservationGuestRequestGeneration = 0");
  const guard = functionSource("reservationGuestDetailRequestIsCurrent");
  for (const proof of [
    "origin.requestGeneration === reservationGuestRequestGeneration",
    "origin.detailGeneration === reservationDetailGeneration",
    "origin.property === propertySelect.value",
    "origin.reservationId === reservationRouteReservationId",
    "reservationDetailData?.reservation?.reservationId === origin.reservationId",
    "reservationDetailData.reservation.confirmationNo === origin.confirmationNo",
    "reservationDetailDrawer.hidden === false",
    'classList.contains("reservation-guest-allocation-panel")',
  ]) expect(guard).toContain(proof);

  const restore = functionSource("restoreReservationGuestEditorHome");
  expect(restore).toContain("reservationGuestRequestGeneration += 1");
  expect(restore).toContain("reservationGuestData = null");
  expect(restore).toContain("reservationGuestForm.hidden = true");
  expect(restore).toContain("reservationGuestHome.append(reservationGuestForm)");
  expect(functionSource("clearReservationDrawerLifecycle")).toContain("restoreReservationGuestEditorHome()");
  for (const boundary of ["showLogin", "loadReservationDetail", "closeReservationDetail"]) {
    expect(functionSource(boundary)).toContain("clearReservationDrawerLifecycle()");
  }
  const propertyChangeStart = script.indexOf('propertySelect.addEventListener("change"');
  const propertyChange = script.slice(propertyChangeStart, script.indexOf("for (const tab of navigation)", propertyChangeStart));
  expect(propertyChange).toContain("clearReservationDrawerLifecycle()");
});

test("Order 211: Stay changes, guest allocation and lifecycle editors are mutually exclusive", () => {
  const render = functionSource("renderReservationDrawerLifecycle");
  const stayHandler = render.slice(render.indexOf('stayChangesAction.addEventListener("click"'), render.indexOf("menu.append(stayChangesAction)"));
  expect(stayHandler).toContain("guestAllocationPanel.hidden = true");
  expect(stayHandler).toContain("restoreReservationGuestEditorHome()");
  const guestHandler = render.slice(render.indexOf('guestAllocationAction.addEventListener("click"'), render.indexOf("menu.append(guestAllocationAction)"));
  expect(guestHandler).toContain("stayChangesPanel.hidden = true");
  expect(guestHandler).toContain("restoreReservationSegmentEditorHome()");
  const lifecycle = functionSource("drawerLifecycleButton");
  expect(lifecycle).toContain("restoreReservationGuestEditorHome()");
  expect(lifecycle).toContain("restoreReservationSegmentEditorHome()");
});

test("Order 211: governed PUT is unchanged and success refreshes detail then guest truth exactly once", () => {
  const requestGuests = functionSource("requestReservationGuests");
  expect(requestGuests).toContain("/reservation-guests?confirmationNo=${enc(confirmationNo)}");

  const submit = functionSource("submitReservationGuestCommand");
  expect(submit).toContain("reservationGuestCommandOrigin()");
  expect(submit).toContain("reservationGuestDetailRequestIsCurrent(origin)");
  expect(submit).toContain("/reservations/${enc(reservationGuestData.reservationId)}/guests");
  expect(submit).toContain('method: "PUT"');
  expect(submit).toContain('headers: { "idempotency-key": key }');
  expect(submit).toContain("body: JSON.stringify(body)");
  expect(submit).toContain("pendingKeys.delete(identity)");
  expect(submit).toContain("refreshReservationDetailAfterGuestCommand(origin, response.reservation)");
  expect(submit.slice(submit.indexOf("} catch (error)"))).not.toContain("pendingKeys.delete(identity)");

  const refresh = functionSource("refreshReservationDetailAfterGuestCommand");
  expect(refresh).toContain('origin.kind !== "drawer"');
  expect(refresh).toContain("await loadReservationDetail(origin.reservationId)");
  expect(refresh).toContain("reservationDetailError.hidden === false");
  expect(refresh).toContain("reservationDetailContent.hidden");
  expect(refresh).toContain("return openReservationGuestAllocation(current, { focus: true })");
  expect((refresh.match(/loadReservationDetail\(/g) || [])).toHaveLength(1);
  expect((refresh.match(/openReservationGuestAllocation\(/g) || [])).toHaveLength(1);

  const handlerStart = script.indexOf('reservationGuestForm.addEventListener("submit"');
  const handlerEnd = script.indexOf('addReservationGuest.addEventListener("click"', handlerStart);
  const handler = script.slice(handlerStart, handlerEnd);
  expect(handler).toContain('role === "sharer" ? row.querySelector(\'input[name="sharePct"]\').value : null');
  expect(handler).toContain('guests.some((guest) => guest.role === "sharer") ? reservationPrimaryShare.value : null');
  expect(handler).toContain("await submitReservationGuestCommand(body)");
});
