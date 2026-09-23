import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  REVIEW_PERMISSIONS,
  REVIEW_PICKUP_TASK_DISPATCH_PERMISSION,
  REVIEW_PICKUP_TASK_WORK_PERMISSION,
} from "../scripts/seed-review";

const source = readFileSync(new URL("../scripts/seed-review.ts", import.meta.url), "utf8");

describe("Order228 local-review pickup task dispatch seed", () => {
  test("the operator receives only the two bounded pickup-task scopes", () => {
    expect(REVIEW_PICKUP_TASK_DISPATCH_PERMISSION).toEqual({
      code: "stay-operations.pickup-tasks:dispatch",
      description: "Assign the exact linked arrival pickup task to active property staff",
    });
    expect(REVIEW_PICKUP_TASK_WORK_PERMISSION).toEqual({
      code: "stay-operations.pickup-tasks:work",
      description: "Start and complete the exact linked arrival pickup task",
    });
    const pickupScopes = REVIEW_PERMISSIONS
      .map(({ code }) => code)
      .filter((code) => code.startsWith("stay-operations.pickup-tasks:"));
    expect(pickupScopes).toEqual([
      "stay-operations.pickup-tasks:dispatch",
      "stay-operations.pickup-tasks:work",
    ]);
  });

  test("a separate exact open linked arrival fixture preserves the two Order206 rows", () => {
    expect(source).toContain("provisionPickupTaskDispatchExample(");
    expect(source).toContain("checkInExamples.identityGatedReservationId");
    expect(source).toContain("housekeepingExamples.attendantPartyId");
    expect(source).toContain("'guest_request', 'open', 'reservation'");
    expect(source).toContain("NULL, 'transport'");
    expect(source).toContain('Object.freeze({ requestType: "arrival_pickup" })');
    expect(source).toContain("pickup_requested, pickup_task_id, notes");
    expect(source).toContain("true, ${taskId}::uuid, NULL");
    expect(source).toContain("arrivalTravelExamples = await provisionArrivalTravelExamples");
    expect(source).toContain("pickupTaskDispatchExample = await provisionPickupTaskDispatchExample");
  });

  test("the published receipt exposes all deterministic UAT identities and identity-only mode stays null", () => {
    expect(source).toContain("readonly pickupTaskDispatchExample: ReviewPickupTaskDispatchExample");
    expect(source).toContain("readonly pickupTaskDispatchExample: null");
    expect(source).toContain("return Object.freeze({ reservationId, travelId, taskId, staffPartyId })");
    expect(source).toContain("review pickup task dispatch fixture: reservation=");
  });
});
