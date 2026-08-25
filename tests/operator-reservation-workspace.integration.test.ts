import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

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

test("Order 168: deep-linked nonmodal drawer is read-only and follows Back, focus and stale-response guards", () => {
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
  expect(script).toContain("reservationDetailActions.hidden = true");
  expect(script).not.toContain("openAdvancedReservation");
  expect(script).not.toContain("manage.addEventListener");
  expect(html).toMatch(/id="reservation-tools" hidden inert aria-hidden="true"/);
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

test("Order 168: operator assets remain within the 90 KiB combined gzip budget", async () => {
  const sizes = [html, css, script].map((asset) => gzipSync(asset).byteLength);
  expect(sizes.reduce((total, size) => total + size, 0)).toBeLessThanOrEqual(90 * 1024);
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
