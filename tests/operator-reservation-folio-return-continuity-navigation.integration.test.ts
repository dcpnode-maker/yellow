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

describe("Order 224 reservation-to-Folio return continuity", () => {
  test("creates one minimized frozen descriptor from only the existing button or validated primary receipt", () => {
    const open = functionSource("openReservationFolioWorkspace");
    const render = functionSource("renderReservationFolios");
    const primary = functionSource("openPrimaryFolio");
    for (const field of [
      "source", "property", "reservationId", "confirmationNo", "reservationStatus",
      "folioId", "workbench", "originPath", "detailGeneration",
    ]) expect(open).toContain(field);
    expect(open).toContain("Object.freeze");
    expect(open).toContain("reservationFolioReturnIsCurrent");
    expect(open).toContain("openFolioWorkspace");
    expect(render).toContain('source: "existing"');
    expect(render).toContain("openReservationFolioWorkspace");
    expect(primary).toContain("primaryFolioResult");
    expect(primary).toContain('source: "primary-receipt"');
    expect(primary).toContain("receipt: result");
    expect(primary).toContain("detailGeneration: generation");
    expect(primary).toContain("openReservationFolioWorkspace");
    expect(primary.indexOf("primaryFolioResult")).toBeLessThan(primary.indexOf("openReservationFolioWorkspace"));
    expect(open).not.toMatch(/guest|occupancy|balanceMinor|settle|payment|posting|journal/i);
  });

  test("rechecks the complete property, reservation, Folio, route, view, drawer, workbench, generation and source matrix", () => {
    const guard = functionSource("reservationFolioReturnIsCurrent");
    for (const proof of [
      "propertySelect.value", "reservationRouteReservationId", "reservationDetailData",
      "reservationDetailGeneration", "reservationDetailFolioList", "reservationDetailDrawer",
      "currentReservationWorkbench", "location.pathname", "location.search", "activeView",
      "folioId", "source",
    ]) expect(guard).toContain(proof);
    expect(guard).toMatch(/confirmationNo/);
    expect(guard).toMatch(/reservation\.status|reservationStatus/);
    expect(guard).toMatch(/isConnected/);
    expect(guard).toMatch(/\.contains\(/);
    expect(guard).toContain('origin.source === "existing"');
    expect(guard).toContain("reservation.folios.some((item) => item.folioId === origin.folioId)");
    expect(guard).toContain('["existing", "primary-receipt"].includes(origin?.source)');
    expect(guard).toContain("reservationPrimaryFolioReservationId === origin.reservationId");
    expect(guard).toContain("primaryFolioReceipt?.reservationId === origin.reservationId");
    expect(guard).toContain("primaryFolioReceipt?.folioId === origin.folioId");
  });

  test("persists only an exact frozen return descriptor in one canonical Folio history entry", () => {
    const openReservation = functionSource("openReservationFolioWorkspace");
    const openFolio = functionSource("openFolioWorkspace");
    const fromState = functionSource("reservationFolioReturnFromState");
    const historyState = functionSource("folioWorkspaceHistoryState");
    const combined = `${openReservation}\n${openFolio}`;
    expect(combined.match(/history\.pushState\(/g)).toHaveLength(1);
    expect(combined).toContain("canonicalFolioPath");
    expect(combined).toContain('yellowSurface: "folio-workspace"');
    expect(historyState).toContain("reservationFolioReturn");
    expect(fromState).toContain('state?.yellowSurface !== "folio-workspace"');
    expect(fromState).toContain("confirmationNo,detailGeneration,folioId,originPath,property,reservationId,reservationStatus,source,workbench");
    expect(fromState).toContain("Object.keys(value).sort()");
    expect(fromState).toContain('!["existing", "primary-receipt"].includes(value.source)');
    expect(fromState).toContain('![null, "check-in", "checkout"].includes(value.workbench)');
    expect(fromState).toContain("RESERVATION_WORKBENCH_QUERY[value.workbench]");
    expect(fromState).toContain("Object.freeze({ ...value })");
    expect(fromState).toContain("Number.isInteger(value.detailGeneration)");
    expect(combined).not.toMatch(/localStorage|sessionStorage|setInterval|setTimeout|EventSource|WebSocket/);
  });

  test("dirty contextual Back confirms before route, state, clearing or focus effects", () => {
    const back = functionSource("returnFromFolioWorkspaceToReservation");
    expect(back).toContain("confirmFolioExit()");
    const confirmation = back.indexOf("confirmFolioExit()");
    for (const effect of ["history.", "clearFolioState", "focus("]) {
      const position = back.indexOf(effect);
      if (position >= 0) expect(position).toBeGreaterThan(confirmation);
    }
    expect(back).toMatch(/history\.(?:back|go)\(/);
    expect(back).toContain("reservationFolioReturnIsCurrent");
    expect(back).not.toMatch(/method\s*:/);
  });

  test("departure context wins, reservation context is second, and direct lookup remains unchanged", () => {
    const control = functionSource("syncDepartureFolioReturnControl");
    const historyState = functionSource("folioWorkspaceHistoryState");
    const open = functionSource("openFolioWorkspace");
    expect(control).toContain('"Back to departure"');
    expect(control).toContain('"Back to reservation"');
    expect(control).toContain('"Back to folio lookup"');
    expect(control.indexOf("departureFolioReturnIsCurrent")).toBeLessThan(control.indexOf("reservationFolioReturnIsCurrent"));
    expect(historyState.indexOf("departureFolioReturn")).toBeLessThan(historyState.indexOf("reservationFolioReturn"));
    expect(open).toContain("folioReturnFocus = trigger");
    expect(open).toContain("reservationFolioReturn");
    expect(open).toContain("departureFolioReturn");
    const fallbackStart = script.indexOf('folioWorkspaceBack.addEventListener("click"');
    const fallback = script.slice(fallbackStart, fallbackStart + 700);
    expect(fallback).toContain("returnFromFolioWorkspaceToDeparture()");
    expect(fallback).toContain("returnFromFolioWorkspaceToReservation()");
    expect(fallback).toContain('/p/${propertySelect.value}/folios');
  });

  test("Escape, browser Back, Forward and refresh reuse canonical history without commands", () => {
    const escapeStart = script.indexOf('activeView === "folios" && event.key === "Escape"');
    expect(escapeStart).toBeGreaterThanOrEqual(0);
    expect(script.slice(escapeStart, escapeStart + 500)).toContain("folioWorkspaceBack.click()");
    expect(script).toContain('window.addEventListener("popstate"');
    const sync = functionSource("syncFolioRoute");
    expect(sync).toContain("history.state");
    expect(sync).toContain("reservationFolioReturn");
    expect(sync).toContain("loadFolioWorkspace");
    expect(sync).not.toMatch(/method\s*:\s*"(?:POST|PUT|PATCH|DELETE)"/);
  });

  test("return refetches canonical reservation detail and restores exact Folio or safe section focus", () => {
    const back = functionSource("returnFromFolioWorkspaceToReservation");
    const detail = functionSource("openReservationDetail");
    const restore = functionSource("restoreReservationFolioReturnFocus");
    expect(back).toMatch(/openReservationDetail|syncReservationRoute/);
    expect(detail).toContain("loadReservationDetail");
    expect(restore).toMatch(/folioId/);
    expect(restore).toContain("reservation-folio-open");
    expect(restore).toMatch(/reservationDetailFolios|reservation-detail-folios/);
    expect(restore).toContain("focus({ preventScroll: true })");
  });

  test("navigation adds no mutation, polling, storage or inferred financial, checkout or occupancy authority", () => {
    const navigation = [
      functionSource("reservationFolioReturnIsCurrent"),
      functionSource("openReservationFolioWorkspace"),
      functionSource("returnFromFolioWorkspaceToReservation"),
    ].join("\n");
    expect(navigation).not.toMatch(/method\s*:\s*"(?:POST|PUT|PATCH|DELETE)"|setInterval|setTimeout|EventSource|WebSocket|localStorage|sessionStorage/);
    expect(navigation).not.toMatch(/settle|charge|deposit|payment|posting|journal|occupancy|roomCondition|housekeeping|checkoutReadiness/i);
  });
});
