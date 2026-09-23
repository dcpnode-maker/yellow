import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

import {
  DEPARTURE_SERVICE_PERMISSIONS,
  DEPARTURE_SERVICE_ROLE_FIXTURES,
  REVIEW_PERMISSIONS,
} from "../scripts/seed-review";

const departurePermissionCodes = DEPARTURE_SERVICE_PERMISSIONS.map(({ code }) => code);

describe("Order 593 departure role fixture contract", () => {
  test("admits exactly the five synthetic routing roles", () => {
    expect(DEPARTURE_SERVICE_ROLE_FIXTURES.map(({ name }) => name)).toEqual([
      "Front Desk Cashier",
      "Housekeeping Desk",
      "Housekeeping Team Lead",
      "Assistant Manager",
      "Duty Manager",
    ]);
    expect(new Set(DEPARTURE_SERVICE_ROLE_FIXTURES.map(({ slug }) => slug)).size).toBe(5);
  });

  test("defines the backend departure permission vocabulary exactly once", () => {
    expect(departurePermissionCodes).toEqual([
      "stay-operations.departure-services:read",
      "stay-operations.departure-services:request",
      "stay-operations.departure-services:confirm",
      "stay-operations.departure-services:dispatch",
      "stay-operations.departure-services:work",
      "stay-operations.departure-services:escalate",
    ]);
    expect(new Set(departurePermissionCodes).size).toBe(departurePermissionCodes.length);
    expect(REVIEW_PERMISSIONS
      .filter(({ code }) => departurePermissionCodes.includes(code as typeof departurePermissionCodes[number]))
      .map(({ code }) => code)).toEqual(departurePermissionCodes);
  });

  test("keeps each role least-privileged and gives every role a work-capable route", () => {
    const permissions = DEPARTURE_SERVICE_ROLE_FIXTURES.map(({ permissionCodes }) => [...permissionCodes]);
    expect(permissions).toEqual([
      [
        "stay-operations.departure-services:read",
        "stay-operations.departure-services:request",
        "stay-operations.departure-services:confirm",
      ],
      [
        "stay-operations.departure-services:read",
        "stay-operations.departure-services:dispatch",
        "stay-operations.departure-services:work",
      ],
      [
        "stay-operations.departure-services:read",
        "stay-operations.departure-services:dispatch",
        "stay-operations.departure-services:work",
        "stay-operations.departure-services:escalate",
      ],
      [
        "stay-operations.departure-services:read",
        "stay-operations.departure-services:request",
        "stay-operations.departure-services:confirm",
        "stay-operations.departure-services:dispatch",
        "stay-operations.departure-services:escalate",
      ],
      departurePermissionCodes,
    ]);
    expect(permissions.some((codes) => codes.includes("stay-operations.departure-services:work"))).toBe(true);
    for (const role of DEPARTURE_SERVICE_ROLE_FIXTURES) {
      expect(role.permissionCodes.every((code) => departurePermissionCodes.includes(code as typeof departurePermissionCodes[number]))).toBe(true);
      expect(role.email).toMatch(/^departure-[a-z-]+@yellow\.local$/);
      expect(role.displayName).toMatch(/^Synthetic Departure /);
      expect(role.partyDisplayName).toMatch(/^Synthetic /);
    }
  });

  test("fixture implementation remains synthetic/local-review and does not invent user-party linkage", () => {
    const source = readFileSync(new URL("../scripts/seed-review.ts", import.meta.url), "utf8");
    expect(source).toContain("source: \"local-review\"");
    expect(source).toContain("synthetic: true");
    expect(source).toContain("await provisionDepartureRoleFixtures(connection, password)");
    expect(source).not.toMatch(/app_user[\s\S]{0,300}party_id/);
    expect(source).not.toMatch(/party_id[\s\S]{0,300}app_user/);
  });
});
