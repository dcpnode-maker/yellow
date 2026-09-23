import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../frontend/yellow/src/App.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../frontend/yellow/src/yellow-api.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../frontend/yellow/src/workspaces/ReservationWorkspace.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../frontend/yellow/src/styles.css", import.meta.url), "utf8");

function functionSlice(name: string, next: string): string {
  const start = workspace.indexOf(`function ${name}(`);
  const end = workspace.indexOf(next, start);
  if (start < 0 || end < 0) throw new Error(`Missing ${name}`);
  return workspace.slice(start, end);
}

describe("Order 587 guided Yellow checkout", () => {
  test("named checkout loads a dedicated lazy journey instead of the generic record", () => {
    expect(app).toContain('module.OverwatchCheckoutJourney');
    expect(app).toContain('checkoutReservationId?: string');
    expect(app).toContain('? { checkoutReservationId: reservationAction.reservation.reservationId }');
    expect(app).toContain('<OverwatchCheckoutJourney');
    expect(app).toContain('dueOutQuery.refetch()');
    expect(app).toContain('inHouseQuery.refetch()');
  });

  test("folio settlement and checkout retain caller-owned idempotency across uncertainty", () => {
    expect(api).toContain('body: JSON.stringify({ action, idempotencyKey })');
    expect(api).toContain('async function commitCheckout(reservationId: string, idempotencyKey: string)');
    expect(api).toContain('"idempotency-key": idempotencyKey');
    expect(api).toContain('class GovernedCheckoutRequestError');
    expect(api).toContain('Yellow retained this exact operation for verification and safe retry');
    expect(api).toContain('Yellow retained this exact departure operation for verification and safe retry');
  });

  test("every write has a separate confirmation and a fresh authoritative preflight", () => {
    const journey = functionSlice("OverwatchCheckoutJourney", "/**\n * A compact");
    for (const state of ["openConfirmed", "settleConfirmed", "checkoutConfirmed"]) {
      expect(journey).toContain(state);
    }
    expect(journey).toContain('loadReservation(reservationId)');
    expect(journey).toContain('loadCheckoutReadiness(reservationId)');
    expect(journey).toContain('loadFolioStatement(folioId)');
    expect(journey.indexOf('const [freshDetail, freshReadiness, freshStatement]')).toBeLessThan(journey.indexOf('transitionFolioStatus(folioId, "settle", key)'));
    expect(journey.indexOf('const [freshDetail, freshReadiness]')).toBeLessThan(journey.indexOf('commitCheckout(reservationId, checkoutAttempt.current)'));
    expect(journey).toContain('verified.reservation.status !== "checked_out"');
    expect(journey).toContain('verified.reservation.segments.every((segment) => segment.status === "departed")');
  });

  test("itemized billing is complete and non-zero money routes to Finance", () => {
    const journey = functionSlice("OverwatchCheckoutJourney", "/**\n * A compact");
    expect(journey).toContain('folios.map((folio) => ({');
    expect(journey).toContain('statement.rows.map((row)');
    expect(journey).toContain('moneyExactMinor(row.amountMinor, statement.folio.currency)');
    expect(journey).toContain('statement.balanceMinor === "0"');
    expect(journey).toContain('statement.folio.status === "open"');
    expect(journey).toContain('?workspace=finance');
    expect(journey).not.toMatch(/force.?settle|synthetic.?balance|write.?off/i);
  });

  test("governed physical requests keep observations unknown until a human outcome", () => {
    const journey = functionSlice("OverwatchCheckoutJourney", "/**\n * A compact");
    for (const copy of [
      "Damage inspection", "Missing items", "Minibar today", "Not recorded",
      "Request a bounded room check", "Coordinate one departure service",
      "No physical fact", "Human outcome",
    ]) expect(journey).toContain(copy);
    expect(journey).not.toMatch(/damage.*complete|minibar.*checked|luggage.*scheduled/i);
  });

  test("approved ribbon and exactly two inert depth cards survive narrow reflow", () => {
    const journey = functionSlice("OverwatchCheckoutJourney", "/**\n * A compact");
    expect(journey.match(/checkout-depth-card checkout-depth-card-/g)).toHaveLength(2);
    expect(journey).toContain('role="tablist" aria-label="Checkout progress"');
    expect(journey).toContain('aria-selected={stage === item.id}');
    expect(journey).toContain('ribbon.scrollTo({');
    expect(journey).toContain('left: selected.offsetLeft - (ribbon.clientWidth - selected.offsetWidth) / 2');
    expect(css).toContain('.checkout-ribbon button.active');
    expect(css).toContain('box-shadow: 0 0 0 1px rgba(255,231,0,.54), 0 0 18px rgba(255,225,0,.38)');
    expect(css).toContain('pointer-events: none');
    expect(css).toContain('@media (max-width: 280px)');
    expect(css).toContain('.yellow-command-surface:has(.checkout-journey) { padding-top: 66px; }');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
