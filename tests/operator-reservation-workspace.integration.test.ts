import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { createApp } from "../src/app";
import { OperatorHttpApi } from "../src/http/operator";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

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
  expect(script).toContain("incoming = Array.isArray(page.reservations) ? page.reservations.slice(0, 100)");
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

test("Order 168: deep-linked nonmodal drawer follows server flags, Back, focus and stale-response guards", () => {
  for (const id of [
    "reservation-detail-drawer", "reservation-detail-title", "reservation-detail-close",
    "reservation-detail-loading", "reservation-detail-error", "reservation-detail-retry",
    "reservation-detail-content", "reservation-detail-actions", "reservation-detail-status",
  ]) expect(html).toContain(`id="${id}"`);
  expect(html).not.toMatch(/id="reservation-detail-drawer"[^>]+aria-modal/);
  expect(script).toContain("function syncReservationRoute()");
  expect(script).toContain('window.addEventListener("popstate"');
  expect(script).toContain('yellowSurface: "reservation-detail"');
  expect(script).toContain('history.state?.yellowSurface === "reservation-detail"');
  expect(script).toContain("reservationDrawerReturnFocus?.isConnected");
  expect(script).toContain("generation !== reservationDetailGeneration");
  expect(script).toContain("property !== propertySelect.value");
  expect(script).toContain("result.actions?.canModify || result.actions?.canCancel || result.actions?.canReinstate");
  expect(script).not.toMatch(/reservation\.status\s*===.+(?:canModify|canCancel|canReinstate)/);
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
