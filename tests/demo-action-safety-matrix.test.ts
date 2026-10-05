import { describe, expect, test } from "bun:test";

import { app } from "../src/app";
import { buildDemoActionSafetyMatrix } from "../src/demo/action-safety-matrix";

describe("demo action safety matrix", () => {
  test("enumerates public demo action surfaces with governed housekeeping, check-in, cashier, settlement, checkout, room move, group status, pickup, wash and rooming-list mutations", () => {
    const matrix = buildDemoActionSafetyMatrix();

    expect(matrix.product).toBe("Yellow PMS");
    expect(matrix.readyToShare).toBe(false);
    expect(matrix.exactConfirmationPhrase).toBe("CONFIRM YELLOW OPERATION");
    expect(matrix.realPmsExecutionEnabled).toBe(true);
    expect(matrix.totals.enabledRealMutations).toBe(10);
    expect(matrix.totals.governedRealMutationFamilies).toBe(10);
    expect(matrix.totals.operatingJourneyActions).toBeGreaterThan(10);
    expect(matrix.totals.frontDeskBoardActions).toBeGreaterThan(1);
    expect(matrix.totals.actionsCoveredByConfirmation).toBe(
      matrix.totals.operatingJourneyActions + matrix.totals.frontDeskBoardActions,
    );
    expect(matrix.confirmationSample.withoutPhraseConfirmed).toBe(false);
    expect(matrix.confirmationSample.withPhraseConfirmed).toBe(true);
    expect(matrix.confirmationSample.withPhraseExecuted).toBe(false);
    expect(matrix.confirmationSample.withPhraseExecutionEnabled).toBe(false);
    expect(matrix.surfaces.map((surface) => surface.id)).toEqual([
      "operating-journey",
      "front-desk-board",
      "action-confirmation",
      "sandbox-execution",
      "workflow-rehearsal",
      "overwatch-message",
      "governed-housekeeping-command",
      "governed-checkin-command",
      "governed-cashier-posting-command",
      "governed-cashier-settlement-command",
      "governed-checkout-command",
      "governed-group-block-status-command",
      "governed-group-pickup-command",
      "governed-group-wash-command",
      "governed-group-rooming-list-command",
      "governed-room-move-command",
    ]);
    expect(matrix.surfaces.filter((surface) => surface.executionEnabledCount > 0).map((surface) => surface.id)).toEqual(["governed-housekeeping-command", "governed-checkin-command", "governed-cashier-posting-command", "governed-cashier-settlement-command", "governed-checkout-command", "governed-group-block-status-command", "governed-group-pickup-command", "governed-group-wash-command", "governed-group-rooming-list-command", "governed-room-move-command"]);
    expect(matrix.surfaces.filter((surface) => surface.realPmsExecutionAvailable).map((surface) => surface.id)).toEqual(["governed-housekeeping-command", "governed-checkin-command", "governed-cashier-posting-command", "governed-cashier-settlement-command", "governed-checkout-command", "governed-group-block-status-command", "governed-group-pickup-command", "governed-group-wash-command", "governed-group-rooming-list-command", "governed-room-move-command"]);
    expect(JSON.stringify(matrix)).toContain("Does not write occupancy, folio, journal, payment, fiscal document or statutory tables.");
    expect(JSON.stringify(matrix)).toContain("Calls record_occupancy()");
    expect(JSON.stringify(matrix)).toContain("one balanced journal, two posting lines");
    expect(JSON.stringify(matrix)).toContain("one payment row");
    expect(JSON.stringify(matrix)).toContain("Calls release_occupancy()");
    expect(JSON.stringify(matrix)).toContain("group.status_changed");
    expect(JSON.stringify(matrix)).toContain("group.pickup_created");
    expect(JSON.stringify(matrix)).toContain("group.wash_applied");
    expect(JSON.stringify(matrix)).toContain("group.rooming_list_imported");
    expect(JSON.stringify(matrix)).toContain("reservation.room_moved");
    expect(JSON.stringify(matrix)).toContain("Operational prompts stay deterministic-local and non-executing.");
  });

  test("serves the matrix route with security headers", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/action-safety-matrix"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(body.mode).toBe("public-demo-safety-matrix");
    expect(body.totals.enabledRealMutations).toBe(10);
    expect(body.realPmsExecutionEnabled).toBe(true);
  });
});
