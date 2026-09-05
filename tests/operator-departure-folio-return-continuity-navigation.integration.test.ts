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

describe("Order 222 departure-to-Folio return continuity", () => {
  test("creates one minimized frozen descriptor only from exact current departure Folio truth", () => {
    const open = functionSource("openDepartureFolioWorkspace");
    for (const field of [
      "property", "reservationId", "confirmationNo", "reservationStatus", "folioId",
      "workbench", "originPath", "readinessGeneration", "detailGeneration",
    ]) expect(open).toContain(field);
    expect(open).toContain("Object.freeze");
    expect(open).toContain('workbench: "checkout"');
    expect(open).toContain("departureFolioReturnIsCurrent");
    expect(open).toContain("openFolioWorkspace");
    expect(open).not.toMatch(/guest|occupancy|balanceMinor|settle|payment|posting|journal/i);
  });

  test("rechecks every property, reservation, folio, route, drawer, workbench, generation and card boundary", () => {
    const guard = functionSource("departureFolioReturnIsCurrent");
    for (const proof of [
      "propertySelect.value", "reservationRouteReservationId", "reservationDetailData",
      "checkoutReadinessData", "checkoutReadinessGeneration", "reservationDetailGeneration",
      "departureFolioList", "location.pathname", "location.search", "activeView",
      "reservationDetailDrawer", "currentReservationWorkbench", "folioId",
    ]) expect(guard).toContain(proof);
    expect(guard).toMatch(/card\.isConnected|action\.isConnected/);
    expect(guard).toMatch(/\.contains\((?:card|action)\)/);
    expect(guard).toMatch(/confirmationNo/);
    expect(guard).toMatch(/reservation\.status|reservationStatus/);
    expect(guard).toMatch(/workbench.*checkout|checkout.*workbench/);
  });

  test("adds one contextual Folio history entry carrying only the validated descriptor", () => {
    const openDeparture = functionSource("openDepartureFolioWorkspace");
    const openFolio = functionSource("openFolioWorkspace");
    const fromState = functionSource("departureFolioReturnFromState");
    const combined = `${openDeparture}\n${openFolio}`;
    expect(combined).toContain('yellowSurface: "folio-workspace"');
    expect(combined).toMatch(/departureFolioReturn/);
    expect(combined.match(/history\.pushState\(/g)).toHaveLength(1);
    expect(combined).toContain("canonicalFolioPath");
    expect(combined).not.toMatch(/localStorage|sessionStorage|setInterval|setTimeout|EventSource|WebSocket/);
    expect(fromState).toContain("confirmationNo,detailGeneration,folioId,originPath,property,readinessGeneration,reservationId,reservationStatus,workbench");
    expect(fromState).toContain('state?.yellowSurface !== "folio-workspace"');
    expect(fromState).toContain('!["in_house", "due_out"].includes(value.reservationStatus)');
    expect(fromState).toContain("?workbench=checkout");
    expect(fromState).toContain("Number.isInteger(value.readinessGeneration)");
    expect(fromState).toContain("Number.isInteger(value.detailGeneration)");
    expect(fromState).toContain("Object.freeze({ ...value })");
  });

  test("contextual Back confirms dirty exit before changing route, state or focus", () => {
    const back = functionSource("returnFromFolioWorkspaceToDeparture");
    expect(back).toContain("confirmFolioExit()");
    const confirmation = back.indexOf("confirmFolioExit()");
    for (const effect of ["history.", "clearFolioState", "focus("]) {
      const position = back.indexOf(effect);
      if (position >= 0) expect(position).toBeGreaterThan(confirmation);
    }
    expect(back).toMatch(/history\.(?:back|go)\(/);
    expect(back).toContain("departureFolioReturnIsCurrent");
    expect(back).not.toMatch(/method\s*:/);
  });

  test("shows Back to departure only for current context while direct Folios keep Back to lookup", () => {
    expect(script).toContain('"Back to departure"');
    expect(script).toContain('"Back to folio lookup"');
    const direct = functionSource("openFolioWorkspace");
    const control = functionSource("syncDepartureFolioReturnControl");
    expect(direct).toContain("departureFolioReturn");
    expect(direct).toContain("folioReturnFocus = trigger");
    expect(direct).toMatch(/departureFolioReturn\s*\?\s*\{ yellowSurface: "folio-workspace", departureFolioReturn \}\s*:\s*\{ yellowSurface: "folio-workspace" \}/);
    expect(control).toContain("departureFolioReturnIsCurrent(departureFolioReturn)");
    expect(control).toContain('"Back to departure"');
    expect(control).toContain('"Back to folio lookup"');
    expect(control).toContain('classList.toggle("folio-departure-return", departureCurrent)');
    const backHandler = script.slice(script.indexOf('folioWorkspaceBack.addEventListener("click"'),
      script.indexOf("for (const [tab, element] of tabs)"));
    expect(backHandler).toContain("returnFromFolioWorkspaceToDeparture");
    expect(backHandler).toContain('/p/${propertySelect.value}/folios');
  });

  test("Escape, browser Back, Forward and refresh reuse canonical route state without commands", () => {
    const escapeStart = script.indexOf('activeView === "folios" && event.key === "Escape"');
    expect(escapeStart).toBeGreaterThanOrEqual(0);
    expect(script.slice(escapeStart, escapeStart + 450)).toContain("folioWorkspaceBack.click()");
    expect(script).toContain('window.addEventListener("popstate"');
    const syncFolio = functionSource("syncFolioRoute");
    expect(syncFolio).toMatch(/departureFolioReturn|history\.state/);
    expect(syncFolio).toContain("loadFolioWorkspace");
    expect(syncFolio).not.toMatch(/method\s*:\s*"(?:POST|PUT|PATCH|DELETE)"/);
  });

  test("return reparses checkout intent, refetches authoritative detail/readiness and restores safe focus", () => {
    const back = functionSource("returnFromFolioWorkspaceToDeparture");
    const openDetail = functionSource("openReservationDetail");
    const intent = functionSource("applyReservationWorkbenchIntent");
    const restore = functionSource("restoreDepartureFolioReturnFocus");
    expect(back).toContain("workbench=checkout");
    expect(back).toMatch(/syncReservationRoute|openReservationDetail|applyReservationWorkbenchIntent|history\.(?:back|go)/);
    expect(openDetail).toContain("loadReservationDetail");
    expect(intent).toContain("loadCheckoutReadiness");
    expect(restore).toContain("item.dataset.folioId === returning.folioId");
    expect(restore).toContain('querySelector(".departure-folio-open")');
    expect(restore).toContain("action?.isConnected ? action : departureHeading");
    expect(restore).toContain("focus({ preventScroll: true })");
  });

  test("navigation adds no mutation, polling, browser storage or financial inference", () => {
    const navigation = [
      functionSource("departureFolioReturnIsCurrent"),
      functionSource("openDepartureFolioWorkspace"),
      functionSource("returnFromFolioWorkspaceToDeparture"),
    ].join("\n");
    expect(navigation).not.toMatch(/method\s*:\s*"(?:POST|PUT|PATCH|DELETE)"|setInterval|setTimeout|EventSource|WebSocket|localStorage|sessionStorage/);
    expect(navigation).not.toMatch(/settle|charge|deposit|payment|posting|journal|occupancy|roomCondition|housekeeping/i);
  });
});
