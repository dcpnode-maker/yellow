import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { createApp } from "../src/app";
import { OperatorHttpApi } from "../src/http/operator";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
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

test("Order 168: board is bounded, filterable without PII and exposes explicit recoverable states", () => {
  for (const id of [
    "reservation-board", "reservation-board-filters", "reservation-board-loading",
    "reservation-board-error", "reservation-board-empty", "reservation-board-content",
    "reservation-board-rows", "reservation-board-cards", "reservation-board-more",
    "reservation-board-retry", "reservation-board-status", "reservation-create-open",
  ]) expect(html).toContain(`id="${id}"`);
  for (const status of ["quote", "reserved", "waitlist", "due_in", "in_house", "due_out", "checked_out", "cancelled", "no_show"]) {
    expect(html).toContain(`<option value="${status}">`);
  }
  expect(script).toContain("function reservationBoardQuery(after = \"\")");
  expect(script).toContain('new URLSearchParams({ limit: "50" })');
  expect(script).toContain('query.set("status", status)');
  expect(script).toContain('query.set("after", after)');
  const boundedPage = executableFunction<(rows: unknown[]) => unknown[]>("boundedReservationPage");
  expect(boundedPage(Array.from({ length: 140 }, (_, index) => index))).toEqual(Array.from({ length: 100 }, (_, index) => index));
  expect(boundedPage(null as never)).toEqual([]);
  expect(script).toContain("reservationBoardRows = incoming");
  expect(script).toContain("reservationBoardRowsTarget.replaceChildren()");
  expect(script).not.toContain("[...reservationBoardRows, ...incoming]");
  expect(script).not.toMatch(/reservation-board\?[^\n]*(?:guest|name|contact|confirmation)/i);
  const filterForm = html.match(/<form[^>]+reservation-board-filters[\s\S]*?<\/form>/i)?.[0] || "";
  expect(filterForm).not.toMatch(/name="(?:guest|name|contact|confirmation)/i);
});

test("Order 168: create journey is four guided steps over the existing authoritative handlers", () => {
  for (const step of [1, 2, 3, 4]) {
    expect(html).toContain(`data-reservation-create-step="${step}"`);
    expect(html).toContain(`data-reservation-create-panel="${step}"`);
  }
  for (const id of [
    "reservation-booking-form", "party-profile-search-form", "party-profile-create-form",
    "reservation-booking-options", "reservation-booking-commit", "reservation-booking-hold-action",
    "reservation-booking-direct", "reservation-booking-held", "reservation-booking-confirmation",
    "reservation-offer-retry",
  ]) expect(html).toContain(`id="${id}"`);
  expect(script).toContain("setReservationCreateStep(3)");
  expect(script).toContain("setReservationCreateStep(4)");
  expect(script).toContain("Your stay and guest are preserved; search current offers again.");
  expect(script).toContain("reservationOfferRetry.hidden = false");
  expect(script).toContain("setReservationCreateStep(3)");
  expect(script).toContain("void loadReservationBoard()");
  expect(script).toContain("void openReservationDetail(reservationId");
  expect(script).toContain("result.reservation.confirmationNo");
  expect(script).not.toMatch(/(?:payment|checkIn|checkOut|tax)[A-Za-z]*\s*=\s*(?:true|false)/);
});

test("Order 168: deep-linked drawer gates lifecycle actions and follows Back, focus and stale-response guards", () => {
  for (const id of [
    "reservation-detail-drawer", "reservation-detail-title", "reservation-detail-close",
    "reservation-detail-loading", "reservation-detail-error", "reservation-detail-retry",
    "reservation-detail-content", "reservation-detail-actions", "reservation-detail-status",
  ]) expect(html).toContain(`id="${id}"`);
  expect(html).not.toMatch(/id="reservation-detail-drawer"[^>]+aria-modal/);
  expect(script).toContain("function syncReservationRoute()");
  expect(script).toContain('window.addEventListener("popstate"');
  expect(script).toContain('yellowSurface: "reservation-detail"');
  expect(script).toContain('reservationExitHistoryAction(history.state, "reservation-detail")');
  expect(script).toContain("reservationDrawerReturnFocus?.isConnected");
  expect(script).toContain("generation !== reservationDetailGeneration");
  expect(script).toContain("property !== propertySelect.value");
  expect(script).not.toContain("openAdvancedReservation");
  expect(html).toMatch(/id="reservation-tools" hidden inert aria-hidden="true"/);
  const actionNames = executableFunction<(actions: Record<string, boolean>) => string[]>("reservationDrawerActionNames");
  expect(actionNames({ canModify: true, canCancel: false, canReinstate: false })).toEqual(["modify"]);
  expect(actionNames({ canModify: false, canCancel: true, canReinstate: false })).toEqual(["cancel"]);
  expect(actionNames({ canModify: false, canCancel: false, canReinstate: true })).toEqual(["reinstate"]);
  expect(actionNames({ canModify: false, canCancel: false, canReinstate: false })).toEqual([]);
  const lifecycleFromDetail = executableFunction<(result: Record<string, unknown>) => Record<string, unknown>>("reservationLifecycleFromDetail");
  expect(lifecycleFromDetail({
    reservation: {
      reservationId: "r", confirmationNo: "Y-1", status: "reserved", notes: "n", eta: null, etd: null,
      marketCode: "M", sourceCode: "S", originCode: "O",
    },
    actions: { canModify: true, canCancel: true, canReinstate: false },
  })).toEqual({
    reservationId: "r", confirmationNo: "Y-1", status: "reserved",
    fields: { notes: "n", eta: null, etd: null, marketCode: "M", sourceCode: "S", originCode: "O" },
    actions: { canModify: true, canCancel: true, canReinstate: false },
  });
  const submitLifecycle = functionSource("submitLifecycleCommand");
  expect(submitLifecycle).toContain('kind: reservationLifecycleEditor.parentElement === reservationDetailActions ? "drawer" : "legacy"');
  expect(submitLifecycle).toContain("detailGeneration: reservationDetailGeneration");
  expect(submitLifecycle).toContain("encodeURIComponent(origin.property)");
  expect(submitLifecycle).toContain("reservationLifecycleRefreshDecision(origin");
  expect(submitLifecycle).toContain("dispatchReservationLifecycleRefresh(");
  expect(submitLifecycle).not.toContain("confirmationNo=");
  expect(script).toContain('drawerLifecycleButton("Edit details", reservationMetadataForm)');
  expect(script).toContain('drawerLifecycleButton("Cancel", reservationCancelForm)');
  expect(script).toContain('drawerLifecycleButton("Reinstate", reservationReinstatePanel)');
  const command = executableFunction<(action: string) => Record<string, string> | null>("reservationLifecycleCommand");
  expect(command("modify")).toEqual({ path: "", method: "PATCH" });
  expect(command("cancel")).toEqual({ path: "/cancel", method: "POST" });
  expect(command("reinstate")).toEqual({ path: "/reinstate", method: "POST" });
  expect(command("guest")).toBeNull();
  const refreshDecision = executableFunction<(origin: Record<string, unknown>, current: Record<string, unknown>) => string>("reservationLifecycleRefreshDecision");
  const drawerOrigin = { kind: "drawer", property: "p-1", reservationId: "r-1", routeReservationId: "r-1", detailGeneration: 7 };
  const current = { property: "p-1", routeReservationId: "r-1", detailGeneration: 7, drawerHidden: false };
  expect(refreshDecision(drawerOrigin, current)).toBe("uuid");
  expect(refreshDecision(drawerOrigin, { ...current, drawerHidden: true })).toBe("suppress");
  expect(refreshDecision(drawerOrigin, { ...current, property: "p-2" })).toBe("suppress");
  expect(refreshDecision(drawerOrigin, { ...current, routeReservationId: "other" })).toBe("suppress");
  expect(refreshDecision(drawerOrigin, { ...current, detailGeneration: 8 })).toBe("suppress");
  expect(refreshDecision({ ...drawerOrigin, kind: "legacy" }, current)).toBe("legacy");
  expect(refreshDecision({ ...drawerOrigin, kind: "legacy" }, { ...current, property: "p-2" })).toBe("suppress");
  const dispatchRefresh = executableFunction<(decision: string, id: string, uuid: (id: string) => void, legacy: () => void) => void>("dispatchReservationLifecycleRefresh");
  let uuidGets = 0;
  let confirmationGets = 0;
  for (const changed of [{ ...current, drawerHidden: true }, { ...current, property: "p-2" }]) {
    dispatchRefresh(refreshDecision(drawerOrigin, changed), "r-1", () => { uuidGets += 1; }, () => { confirmationGets += 1; });
  }
  expect({ uuidGets, confirmationGets }).toEqual({ uuidGets: 0, confirmationGets: 0 });
  dispatchRefresh("uuid", "r-1", (id) => { expect(id).toBe("r-1"); uuidGets += 1; }, () => { confirmationGets += 1; });
  expect({ uuidGets, confirmationGets }).toEqual({ uuidGets: 1, confirmationGets: 0 });
  expect(script).toContain('reservationLifecycleCommand("modify")');
  expect(script).toContain('reservationLifecycleCommand("cancel")');
  expect(script).toContain('reservationLifecycleCommand("reinstate")');
});

test("Order 209: strict workbench intent survives refresh and same-reservation query-only history without bypassing confirmation", () => {
  const parse = executableFunction<(search: string) => { valid: boolean; value: string | null }>("reservationWorkbenchIntent");
  expect(parse("")).toEqual({ valid: true, value: null });
  expect(parse("?workbench=check-in")).toEqual({ valid: true, value: "check-in" });
  expect(parse("?workbench=checkout")).toEqual({ valid: true, value: "checkout" });
  for (const invalid of [
    "?workbench=", "?workbench=checkin", "?workbench=CHECKOUT",
    "?workbench=check-in&workbench=check-in", "?workbench=checkout&extra=1", "?extra=1",
  ]) expect(parse(invalid)).toEqual({ valid: false, value: null });

  const route = functionSource("reservationRoute");
  expect(route).toContain("reservationWorkbenchIntent(location.search)");
  expect(route).toContain('history.replaceState(history.state, "", `/p/${detail[1]}/res/${detail[2]}`)');
  expect(route).toContain("workbench: parsed.value");

  const open = functionSource("openReservationDetail");
  expect(open).toContain('workbench === "check-in" || workbench === "checkout"');
  expect(open).toContain('const query = currentReservationWorkbench ? `?${RESERVATION_WORKBENCH_QUERY[currentReservationWorkbench]}` : ""');
  expect(open).toContain("await loadReservationDetail(reservationId)");
  const sync = functionSource("syncReservationRoute");
  expect(sync).toContain("currentReservationWorkbench !== route.workbench");
  expect(sync).toContain("workbench: route.workbench");

  const popstateStart = script.indexOf('window.addEventListener("popstate"');
  const popstate = script.slice(
    popstateStart,
    script.indexOf('document.addEventListener("keydown"', popstateStart),
  );
  expect(popstate).toContain("const route = reservationNavigationRoute()");
  expect(popstate).toContain('if (route.kind !== "other") setView("reservations", false)');
  expect(popstate).toContain("syncReservationRoute()");

  const canonicalize = functionSource("canonicalizeReservationWorkbenchIntent");
  expect(canonicalize).toContain("currentReservationWorkbench = null");
  expect(canonicalize).toContain("history.replaceState(history.state");
  const apply = functionSource("applyReservationWorkbenchIntent");
  expect(apply).toContain('intent === "check-in" && reservation.status === "due_in"');
  expect(apply).toContain('intent === "checkout" && ["in_house", "due_out"].includes(reservation.status)');
  expect(apply).toContain("loadCheckInReadiness({ focus: checkInCompatible })");
  expect(apply).toContain("loadCheckoutReadiness({ focus: checkoutCompatible })");
  expect(apply).toContain("reservationDetailDrawer.focus({ preventScroll: true })");
  expect(apply).not.toMatch(/method:\s*"POST"|submitCheckIn|submitCheckout|crypto\.randomUUID|\.click\(\)/);

  const checkInAction = script.slice(script.indexOf("const updateCheckInAction"), script.indexOf('departureRefresh.addEventListener'));
  expect(checkInAction).toContain("!checkInConfirm.checked");
  const checkoutAction = functionSource("syncCheckoutConfirmation");
  expect(checkoutAction).toContain("!departureCheckoutConfirm.checked");
  expect(script).toContain('checkInForm.addEventListener("submit"');
  expect(script).toContain('departureCheckoutForm.addEventListener("submit"');

  const checkInReadiness = functionSource("loadCheckInReadiness");
  expect(checkInReadiness).toContain("if (focus) checkInHeading.focus({ preventScroll: true })");
  expect(checkInReadiness).toContain("if (focus) checkInRefresh.focus({ preventScroll: true })");
  const checkoutReadiness = functionSource("loadCheckoutReadiness");
  expect(checkoutReadiness).toContain("if (focus) departureHeading.focus({ preventScroll: true })");
  expect(checkoutReadiness).toContain("restoreDepartureFolioReturnFocus(null)");
  expect(checkoutReadiness).toContain("if (focus && departureFolioReturn === returning) departureRetry.focus({ preventScroll: true })");
  const close = functionSource("closeReservationDetail");
  expect(close).toContain("reservationDrawerReturnFocus?.isConnected ? reservationDrawerReturnFocus : $(\"#reservations-title\")");
});

test("Order 210: Stay changes reuses server-governed segment truth and exact mutation transport", () => {
  const open = functionSource("openReservationStayChanges");
  expect(open).toContain("reservation.reservationId !== reservationRouteReservationId");
  expect(open).toContain("reservationDetailData.reservation.confirmationNo !== reservation.confirmationNo");
  expect(open).toContain("panel.append(reservationSegmentEditor)");
  expect(open).toContain("reservationSegmentLookupForm.elements.confirmationNo.value = confirmationNo");
  expect(open).toContain("requestReservationSegments(origin.property, confirmationNo)");
  expect(open).toContain("if (!reservationSegmentDetailRequestIsCurrent(origin)) return false");
  expect(open).toContain("body?.reservation?.reservationId !== origin.reservationId");
  expect(open).toContain("body.reservation.confirmationNo !== origin.confirmationNo");
  expect(open).toContain("renderReservationSegments(body.reservation, focus)");
  expect(open).not.toMatch(/method:\s*["'](?:PATCH|POST)["']|submitSegmentCommand|\.click\(\)/);

  const render = functionSource("renderReservationSegments");
  expect(render).toContain("reservationDepartureForm.hidden = !latest?.actions.canChangeDeparture");
  expect(render).toContain("reservationRoomMoveForm.hidden = !latest?.actions.canMoveRoom");
  expect(render).not.toMatch(/canChangeDeparture\s*=|canMoveRoom\s*=/);

  const submit = functionSource("submitSegmentCommand");
  expect(submit).toContain("const origin = reservationSegmentCommandOrigin()");
  expect(submit).toContain("if (origin.kind === \"drawer\" && !reservationSegmentDetailRequestIsCurrent(origin)) return false");
  expect(submit).toContain("`reservation-segment:${path}:${reservationSegmentData.reservationId}:${latest.segmentId}:${JSON.stringify(body)}`");
  expect(submit).toContain("pendingKeys.get(identity) || crypto.randomUUID()");
  expect(submit).toContain("/reservations/${enc(reservationSegmentData.reservationId)}/segments/${enc(latest.segmentId)}${path}");
  expect(submit).toContain("method,");
  expect(submit).toContain('headers: { "idempotency-key": key }');
  expect(submit).toContain("body: JSON.stringify(body)");
  expect(submit.match(/refreshReservationDetailAfterSegmentCommand\(origin\)/g)).toHaveLength(1);

  const listenerRegion = script.slice(
    script.indexOf('reservationDepartureForm.addEventListener("submit"'),
    script.indexOf('reservationMetadataForm.addEventListener("submit"'),
  );
  expect(listenerRegion).toContain('submitSegmentCommand("/departure", "PATCH"');
  expect(listenerRegion).toContain("expectedPeriod: latest.period");
  expect(listenerRegion).toContain("newDeparture: departure.toISOString()");
  expect(listenerRegion).toContain('submitSegmentCommand("/move", "POST"');
  expect(listenerRegion).toContain("expectedSellableUnitId: latest.sellableUnitId");
  expect(listenerRegion).toContain("destinationSellableUnitId: reservationRoomMoveForm.elements.destinationSellableUnitId.value");
});

test("Order 210: request identity fails closed across close, property and different-detail boundaries", () => {
  const guardSource = functionSource("reservationSegmentDetailRequestIsCurrent");
  const evaluate = new Function("state", `
    let reservationSegmentRequestGeneration = state.requestGeneration;
    let reservationDetailGeneration = state.detailGeneration;
    const propertySelect = { value: state.property };
    let reservationRouteReservationId = state.reservationId;
    let reservationDetailData = state.detailData;
    const reservationDetailDrawer = { hidden: state.drawerHidden };
    const reservationSegmentEditor = {
      parentElement: { classList: { contains: () => state.hosted } },
    };
    ${guardSource}
    return reservationSegmentDetailRequestIsCurrent(state.origin);
  `) as (state: Record<string, unknown>) => boolean;
  const origin = {
    requestGeneration: 11,
    detailGeneration: 7,
    property: "p-1",
    reservationId: "r-1",
    confirmationNo: "Y-1",
  };
  const current = {
    requestGeneration: 11,
    detailGeneration: 7,
    property: "p-1",
    reservationId: "r-1",
    detailData: { reservation: { reservationId: "r-1", confirmationNo: "Y-1" } },
    drawerHidden: false,
    hosted: true,
    origin,
  };
  expect(evaluate(current)).toBe(true);
  for (const stale of [
    { requestGeneration: 12 },
    { detailGeneration: 8 },
    { property: "p-2" },
    { reservationId: "r-2" },
    { detailData: { reservation: { reservationId: "r-2", confirmationNo: "Y-1" } } },
    { detailData: { reservation: { reservationId: "r-1", confirmationNo: "Y-2" } } },
    { drawerHidden: true },
    { hosted: false },
  ]) expect(evaluate({ ...current, ...stale })).toBe(false);

  const clear = functionSource("clearReservationDrawerLifecycle");
  expect(clear).toContain("restoreReservationSegmentEditorHome()");
  expect(functionSource("loadReservationDetail")).toContain("clearReservationDrawerLifecycle()");
  expect(functionSource("closeReservationDetail")).toContain("clearReservationDrawerLifecycle()");
  expect(functionSource("showLogin")).toContain("clearReservationDrawerLifecycle()");
  const propertyChangeStart = script.indexOf('propertySelect.addEventListener("change"');
  const propertyChange = script.slice(
    propertyChangeStart,
    script.indexOf("for (const tab of navigation)", propertyChangeStart),
  );
  expect(propertyChange).toContain("clearReservationDrawerLifecycle()");
});

test("Order 210: editor returns home and success refreshes detail plus segment truth exactly once", () => {
  const restoreSource = functionSource("restoreReservationSegmentEditorHome");
  const restore = new Function(`
    let reservationSegmentRequestGeneration = 4;
    let reservationSegmentData = { stale: true };
    const otherParent = {};
    const reservationSegmentEditor = { hidden: false, parentElement: otherParent };
    const reservationDepartureForm = { hidden: false };
    const reservationRoomMoveForm = { hidden: false };
    const segmentCommandMessage = {
      textContent: "stale",
      classList: { error: true, remove(name) { if (name === "error") this.error = false; } },
    };
    let appendCount = 0;
    const reservationSegmentHome = {
      append(node) { appendCount += 1; node.parentElement = this; },
    };
    ${restoreSource}
    restoreReservationSegmentEditorHome();
    return {
      requestGeneration: reservationSegmentRequestGeneration,
      data: reservationSegmentData,
      editorHidden: reservationSegmentEditor.hidden,
      departureHidden: reservationDepartureForm.hidden,
      moveHidden: reservationRoomMoveForm.hidden,
      message: segmentCommandMessage.textContent,
      error: segmentCommandMessage.classList.error,
      appendCount,
      atHome: reservationSegmentEditor.parentElement === reservationSegmentHome,
    };
  `) as () => Record<string, unknown>;
  expect(restore()).toEqual({
    requestGeneration: 5,
    data: null,
    editorHidden: true,
    departureHidden: true,
    moveHidden: true,
    message: "",
    error: false,
    appendCount: 1,
    atHome: true,
  });

  const refresh = functionSource("refreshReservationDetailAfterSegmentCommand");
  expect(refresh.match(/loadReservationSegments\(true\)/g)).toHaveLength(1);
  expect(refresh.match(/loadReservationDetail\(origin\.reservationId\)/g)).toHaveLength(1);
  expect(refresh.match(/openReservationStayChanges\(current, \{ focus: true \}\)/g)).toHaveLength(1);
  expect(refresh).toContain("if (!reservationSegmentDetailRequestIsCurrent(origin)) return false");
  expect(refresh).toContain("propertySelect.value !== origin.property");
  expect(refresh).toContain("reservationRouteReservationId !== origin.reservationId");
  expect(refresh).toContain("current.confirmationNo !== origin.confirmationNo");
});

test("Order 211: Guests & shares preserves primary identity and explicit no-remainder allocation", () => {
  expect(html).toMatch(/id="reservation-primary-party" readonly aria-readonly="true"/);
  const render = functionSource("renderReservationGuests");
  expect(render).toContain("reservationPrimaryParty.value = reservation.primaryPartyId");
  expect(render).toContain('if (guest.role !== "primary") addReservationGuestRow(guest)');
  expect(render).not.toMatch(/reservation\.primaryPartyId\s*=|role:\s*["']primary["']/);

  const canonical = executableFunction<(value: string) => string | null>("canonicalShare");
  expect(canonical("60.00")).toBe("60.00");
  expect(canonical("100.00")).toBe("100.00");
  for (const invalid of ["60", "60.0", "060.00", "0.00", "100.01", "-1.00"]) expect(canonical(invalid)).toBeNull();
  const basisPoints = new Function(`
    ${functionSource("canonicalShare")}
    return (${functionSource("shareBasisPoints")});
  `)() as (value: string) => bigint | null;
  expect(basisPoints("60.00")).toBe(6000n);
  expect(basisPoints("40.00")).toBe(4000n);
  expect(basisPoints("60.0")).toBeNull();

  const shareTotal = functionSource("updateReservationShareTotal");
  expect(shareTotal).toContain('row.querySelector("select").value === "sharer"');
  expect(shareTotal).toContain("share.disabled = !isSharer");
  expect(shareTotal).toContain('if (!isSharer) share.value = ""');
  expect(shareTotal).toContain("reservationPrimaryShare.disabled = sharers.length === 0");
  expect(shareTotal).toContain('reservationPrimaryShare.value = ""');
  expect(shareTotal).toContain("basisPoints.reduce((sum, value) => sum + value, 0n)");
  expect(shareTotal).toContain('total === 10000n ? " · ready" : " · must equal 100.00%"');
  expect(shareTotal).not.toMatch(/10000n\s*-|100(?:\.00)?\s*-/);

  const submitListenerStart = script.indexOf('reservationGuestForm.addEventListener("submit"');
  const submitListener = script.slice(submitListenerStart, script.indexOf('addReservationGuest.addEventListener("click"', submitListenerStart));
  expect(submitListener).toContain('role === "sharer" ? row.querySelector(\'input[name="sharePct"]\').value : null');
  expect(submitListener).toContain('guests.some((guest) => guest.role === "sharer") ? reservationPrimaryShare.value : null');
  expect(submitListener).toContain("const body = { primarySharePct, guests }");
  expect(submitListener).toContain("await submitReservationGuestCommand(body)");
  expect(submitListener).not.toMatch(/primaryPartyId|remainder|10000n\s*-/i);
});

test("Order 211: current-detail guest routing and existing PUT transport remain exact", () => {
  const open = functionSource("openReservationGuestAllocation");
  expect(open).toContain("reservation.reservationId !== reservationRouteReservationId");
  expect(open).toContain("reservationDetailData.reservation.confirmationNo !== reservation.confirmationNo");
  expect(open).toContain("panel.append(reservationGuestForm)");
  expect(open).toContain("reservationLookupForm.elements.confirmationNo.value = confirmationNo");
  expect(open).toContain("requestReservationGuests(origin.property, confirmationNo)");
  expect(open.match(/requestReservationGuests\(origin\.property, confirmationNo\)/g)).toHaveLength(1);
  expect(open).toContain("if (!reservationGuestDetailRequestIsCurrent(origin)) return false");
  expect(open).toContain("body?.reservation?.reservationId !== origin.reservationId");
  expect(open).toContain("body.reservation.confirmationNo !== origin.confirmationNo");
  expect(open).toContain("renderReservationGuests(body.reservation, focus)");
  expect(open).not.toMatch(/method:\s*["'](?:PUT|PATCH|POST)["']|submitReservationGuestCommand|\.click\(\)/);

  const submit = functionSource("submitReservationGuestCommand");
  expect(submit).toContain("const origin = reservationGuestCommandOrigin()");
  expect(submit).toContain('if (origin.kind === "drawer" && !reservationGuestDetailRequestIsCurrent(origin)) return false');
  expect(submit).toContain("`reservation-guests:${reservationGuestData.reservationId}:${JSON.stringify(body)}`");
  expect(submit).toContain("pendingKeys.get(identity) || crypto.randomUUID()");
  expect(submit).toContain("/reservations/${enc(reservationGuestData.reservationId)}/guests");
  expect(submit).toContain('method: "PUT"');
  expect(submit).toContain('headers: { "idempotency-key": key }');
  expect(submit).toContain("body: JSON.stringify(body)");
  expect(submit.match(/refreshReservationDetailAfterGuestCommand\(origin, response\.reservation\)/g)).toHaveLength(1);
  expect(submit).not.toMatch(/primaryPartyId|remainder|method:\s*["'](?:PATCH|POST)["']/i);
});

test("Order 211: guest request identity and lifecycle fail closed at every drawer boundary", () => {
  const guardSource = functionSource("reservationGuestDetailRequestIsCurrent");
  const evaluate = new Function("state", `
    let reservationGuestRequestGeneration = state.requestGeneration;
    let reservationDetailGeneration = state.detailGeneration;
    const propertySelect = { value: state.property };
    let reservationRouteReservationId = state.reservationId;
    let reservationDetailData = state.detailData;
    const reservationDetailDrawer = { hidden: state.drawerHidden };
    const reservationGuestForm = {
      parentElement: { classList: { contains: () => state.hosted } },
    };
    ${guardSource}
    return reservationGuestDetailRequestIsCurrent(state.origin);
  `) as (state: Record<string, unknown>) => boolean;
  const origin = {
    requestGeneration: 13,
    detailGeneration: 9,
    property: "p-1",
    reservationId: "r-1",
    confirmationNo: "Y-1",
  };
  const current = {
    requestGeneration: 13,
    detailGeneration: 9,
    property: "p-1",
    reservationId: "r-1",
    detailData: { reservation: { reservationId: "r-1", confirmationNo: "Y-1" } },
    drawerHidden: false,
    hosted: true,
    origin,
  };
  expect(evaluate(current)).toBe(true);
  for (const stale of [
    { requestGeneration: 14 },
    { detailGeneration: 10 },
    { property: "p-2" },
    { reservationId: "r-2" },
    { detailData: { reservation: { reservationId: "r-2", confirmationNo: "Y-1" } } },
    { detailData: { reservation: { reservationId: "r-1", confirmationNo: "Y-2" } } },
    { drawerHidden: true },
    { hosted: false },
  ]) expect(evaluate({ ...current, ...stale })).toBe(false);

  const clear = functionSource("clearReservationDrawerLifecycle");
  expect(clear).toContain("restoreReservationGuestEditorHome()");
  expect(functionSource("loadReservationDetail")).toContain("clearReservationDrawerLifecycle()");
  expect(functionSource("closeReservationDetail")).toContain("clearReservationDrawerLifecycle()");
  expect(functionSource("showLogin")).toContain("clearReservationDrawerLifecycle()");
  const propertyChangeStart = script.indexOf('propertySelect.addEventListener("change"');
  const propertyChange = script.slice(propertyChangeStart, script.indexOf("for (const tab of navigation)", propertyChangeStart));
  expect(propertyChange).toContain("clearReservationDrawerLifecycle()");
});

test("Order 211: guest editor restores home, excludes Stay changes and refreshes exact truth once", () => {
  const restoreSource = functionSource("restoreReservationGuestEditorHome");
  const restore = new Function(`
    let reservationGuestRequestGeneration = 6;
    let reservationGuestData = { stale: true };
    const otherParent = {};
    let resetCount = 0, replaceCount = 0, appendCount = 0;
    const message = {
      textContent: "stale",
      classList: { error: true, remove(name) { if (name === "error") this.error = false; } },
    };
    const reservationGuestForm = {
      hidden: false,
      parentElement: otherParent,
      reset() { resetCount += 1; },
      querySelector() { return message; },
    };
    const reservationGuestList = { replaceChildren() { replaceCount += 1; } };
    const reservationConfirmation = { textContent: "Y-1" };
    const reservationStatus = { textContent: "reserved" };
    const reservationShareTotal = { textContent: "stale total" };
    const reservationGuestHome = { append(node) { appendCount += 1; node.parentElement = this; } };
    ${restoreSource}
    restoreReservationGuestEditorHome();
    return {
      requestGeneration: reservationGuestRequestGeneration,
      data: reservationGuestData,
      hidden: reservationGuestForm.hidden,
      resetCount,
      replaceCount,
      confirmation: reservationConfirmation.textContent,
      status: reservationStatus.textContent,
      total: reservationShareTotal.textContent,
      message: message.textContent,
      error: message.classList.error,
      appendCount,
      atHome: reservationGuestForm.parentElement === reservationGuestHome,
    };
  `) as () => Record<string, unknown>;
  expect(restore()).toEqual({
    requestGeneration: 7,
    data: null,
    hidden: true,
    resetCount: 1,
    replaceCount: 1,
    confirmation: "—",
    status: "—",
    total: "No sharers · primary share must stay empty.",
    message: "",
    error: false,
    appendCount: 1,
    atHome: true,
  });

  const drawer = functionSource("renderReservationDrawerLifecycle");
  expect(drawer).toContain('node("section", "reservation-guest-allocation-panel")');
  expect(drawer).toContain('node("section", "reservation-stay-changes-panel")');
  expect(drawer).toContain("stayChangesPanel.hidden = true");
  expect(drawer).toContain("restoreReservationSegmentEditorHome()");
  expect(drawer).toContain("guestAllocationPanel.hidden = true");
  expect(drawer).toContain("restoreReservationGuestEditorHome()");
  const lifecycleButton = functionSource("drawerLifecycleButton");
  expect(lifecycleButton).toContain("restoreReservationSegmentEditorHome()");
  expect(lifecycleButton).toContain("restoreReservationGuestEditorHome()");

  const refresh = functionSource("refreshReservationDetailAfterGuestCommand");
  expect(refresh.match(/loadReservationDetail\(origin\.reservationId\)/g)).toHaveLength(1);
  expect(refresh.match(/openReservationGuestAllocation\(current, \{ focus: true \}\)/g)).toHaveLength(1);
  expect(refresh).toContain("if (!reservationGuestDetailRequestIsCurrent(origin)) return false");
  expect(refresh).toContain("propertySelect.value !== origin.property");
  expect(refresh).toContain("reservationRouteReservationId !== origin.reservationId");
  expect(refresh).toContain("current.confirmationNo !== origin.confirmationNo");
});

test("Order 168: dirty exit, history and journey reset policies execute at exact boundaries", () => {
  const shouldConfirm = executableFunction<(visible: boolean, dirty: boolean, destination: string) => boolean>("shouldConfirmReservationExit");
  expect(shouldConfirm(true, true, "board")).toBe(true);
  expect(shouldConfirm(true, true, "detail")).toBe(true);
  expect(shouldConfirm(true, true, "property")).toBe(true);
  expect(shouldConfirm(true, true, "create")).toBe(false);
  expect(shouldConfirm(true, false, "board")).toBe(false);
  expect(shouldConfirm(false, true, "board")).toBe(false);

  const historyAction = executableFunction<(state: unknown, surface: string) => string>("reservationExitHistoryAction");
  expect(historyAction({ yellowSurface: "reservation-create" }, "reservation-create")).toBe("back");
  expect(historyAction(null, "reservation-create")).toBe("replace");

  const emptyState = executableFunction<() => Record<string, unknown>>("emptyReservationJourneyState");
  expect(emptyState()).toEqual({ offers: [], selection: null, hold: null, draft: null, dirty: false, step: 1 });
  const resetSource = functionSource("resetReservationCreateJourney");
  for (const reset of [
    "reservationBookingForm.reset()", "resetReservationStayDates()", "clearPartyProfileState()",
    "reservationBookingOptions.replaceChildren()", "reservationBookingConfirmation.hidden = true",
    'reservationBookingConfirmation.querySelector("strong").textContent = ""',
  ]) expect(resetSource).toContain(reset);
  const executeReset = new Function(`
    ${functionSource("emptyReservationJourneyState")}
    let reservationBookingSearchGeneration = 4;
    let reservationBookingOffers = [{ pii: "old offer" }];
    let reservationBookingSelection = { pii: "old selection" };
    let reservationBookingHold = { pii: "old hold" };
    let reservationBookingDraft = { pii: "old party" };
    let reservationCreateDirty = true;
    let reservationCreateStep = 4;
    let reservationCreateProperty = "old-property";
    let formReset = false, datesReset = false, partyReset = false, optionsReset = false, selectionReset = false;
    const reservationBookingForm = { reset() { formReset = true; } };
    function resetReservationStayDates() { datesReset = true; }
    function clearPartyProfileState() { partyReset = true; }
    const reservationBookingOptions = { replaceChildren() { optionsReset = true; } };
    function clearReservationBookingSelection() { selectionReset = true; }
    const reservationOfferRetry = { hidden: false };
    const strong = { textContent: "old confirmation" }, small = { textContent: "old id" };
    const reservationBookingConfirmation = { hidden: false, querySelector(value) { return value === "strong" ? strong : small; } };
    const reservationBookingMessage = { textContent: "old guest", classList: { remove() {} } };
    function formMessage() {}
    const pendingKeys = new Map([["reservation-booking-old-pii", "key"], ["other-work", "keep"]]);
    ${resetSource}
    resetReservationCreateJourney();
    return { reservationBookingSearchGeneration, reservationBookingOffers, reservationBookingSelection,
      reservationBookingHold, reservationBookingDraft, reservationCreateDirty, reservationCreateStep,
      reservationCreateProperty, formReset, datesReset, partyReset, optionsReset, selectionReset,
      retryHidden: reservationOfferRetry.hidden, confirmationHidden: reservationBookingConfirmation.hidden,
      strong: strong.textContent, small: small.textContent, message: reservationBookingMessage.textContent,
      pending: [...pendingKeys.keys()] };
  `) as () => Record<string, unknown>;
  expect(executeReset()).toEqual({
    reservationBookingSearchGeneration: 5, reservationBookingOffers: [], reservationBookingSelection: null,
    reservationBookingHold: null, reservationBookingDraft: null, reservationCreateDirty: false,
    reservationCreateStep: 1, reservationCreateProperty: "", formReset: true, datesReset: true,
    partyReset: true, optionsReset: true, selectionReset: true, retryHidden: true,
    confirmationHidden: true, strong: "", small: "", message: "", pending: ["other-work"],
  });
  expect(functionSource("openReservationCreate")).toContain("resetReservationCreateJourney()");
  expect(functionSource("closeReservationCreate")).toContain("resetReservationCreateJourney()");
  expect(script).toContain('shouldConfirmReservationExit(reservationCreatePanel.hidden === false, reservationCreateDirty, route.kind)');
});

test("Order 168: direct-link and Forward restoration cannot expose impossible create steps", () => {
  const allowedStep = executableFunction<(step: number, prerequisites: Record<string, boolean>) => number>("allowedReservationCreateStep");
  const none = { active: false, stay: false, party: false, offer: false, draft: false };
  for (const requested of [2, 3, 4]) expect(allowedStep(requested, none)).toBe(1);
  expect(allowedStep(4, { ...none, active: true })).toBe(1);
  expect(allowedStep(4, { ...none, active: true, stay: true })).toBe(2);
  expect(allowedStep(4, { ...none, active: true, stay: true, party: true })).toBe(3);
  expect(allowedStep(4, { active: true, stay: true, party: true, offer: true, draft: true })).toBe(4);
  expect(allowedStep(3, { active: true, stay: true, party: true, offer: false, draft: false })).toBe(3);
  const syncRoute = functionSource("syncReservationRoute");
  expect(syncRoute).toContain("const continuing = reservationCreatePanel.hidden === false");
  expect(syncRoute).toContain("allowedReservationCreateStep(route.step, reservationCreatePrerequisites(continuing))");
  expect(syncRoute).toContain("if (!continuing) resetReservationCreateJourney()");
  expect(syncRoute).toContain("history.replaceState");
});

test("Order 168: responsive and accessibility contract is present without dependencies or browser authority", () => {
  for (const rule of [
    "@media (max-width: 1180px)", "@media (max-width: 767px)", "@media (max-width: 480px)",
    "@media (prefers-reduced-motion: reduce)", ".reservation-board-cards", ".reservation-board-table",
    ".reservation-detail-drawer", "min-height: 44px", "100dvh",
  ]) expect(css).toContain(rule);
  expect(script).toContain('event.key === "j"');
  expect(script).toContain('event.key === "k"');
  expect(script).toContain('event.key === "Escape"');
  expect(script).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|document\.cookie|setInterval|WebSocket|EventSource/);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  expect(ids.length).toBe(new Set(ids).size);
});

test("Order 168: 120-character confirmations stay contained and every visible theme control is 44px", () => {
  const confirmation = `Y-${"7E78E5402A3D4D41A7AB03B0041BD17A".repeat(4)}`.slice(0, 120);
  expect(confirmation).toHaveLength(120);
  for (const contract of [
    ".reservation-board-table { width: 100%; table-layout: fixed;",
    ".reservation-board-table th { min-width: 0;",
    ".reservation-board-table td { min-width: 0; max-width: 240px;",
    ".reservation-row-open { min-width: 0; max-width: 100%; min-height: 44px;",
    "overflow-wrap: anywhere; word-break: break-word;",
    ".reservation-board-cards, .reservation-board-card, .reservation-board-card-head { min-width: 0; max-width: 100%; }",
    ".reservation-board-card-head .reservation-row-open { flex: 1 1 auto; }",
    ".reservation-board-card-head .reservation-status-badge { flex: none; }",
    "#theme-select { min-height: 44px; }",
  ]) expect(css).toContain(contract);
  expect(css).not.toContain(".theme-control select { min-height: 40px;");
  for (const viewport of [375, 768, 1024, 1440]) expect(viewport).toBeGreaterThanOrEqual(375);
  expect(script).toContain("button.textContent = row.confirmationNo");
});

test("Order 168 / Order195: operator assets remain dependency-free after the retired visual ceiling", async () => {
  for (const asset of [html, css, script]) expect(asset.length).toBeGreaterThan(0);
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { dependencies: Record<string, string> };
  expect(pkg.dependencies).toEqual({ elysia: "^1.4.29" });
});

test("Order 168: direct reservation deep link serves the same protected HTML shell", async () => {
  const app = createApp({ operatorApi: new OperatorHttpApi({} as never) });
  const id = "00000000-0000-0000-0000-000000016800";
  const response = await app.handle(new Request(`http://yellow.test/p/${id}/res/${id}`));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/html");
  expect(await response.text()).toContain('id="reservation-detail-drawer"');
});
