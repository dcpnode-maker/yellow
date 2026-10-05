import { describe, expect, test } from "bun:test";

import { app } from "../src/app";
import { buildDemoPropertyConfiguration } from "../src/demo/property-config";

describe("demo property configuration", () => {
  test("models a realistic configured hotel with governed mutation boundaries", () => {
    const config = buildDemoPropertyConfiguration();

    expect(config.property.code).toBe("YELLOW-DEMO");
    expect(config.property.inventoryRooms).toBe(120);
    expect(config.roomClasses.map((roomClass) => roomClass.code)).toEqual(["KING", "TWIN", "QUEEN", "SUITE"]);
    expect(config.roomTypes.map((roomType) => roomType.code)).toEqual(["STD", "DLX", "PREM", "SUITE"]);
    expect(config.roomTypes.reduce((sum, roomType) => sum + roomType.count, 0)).toBe(config.property.inventoryRooms);
    expect(config.mealPlans.map((mealPlan) => mealPlan.code)).toEqual(["EP", "CP", "MAP", "AP"]);
    expect(config.cancellationPolicies.map((policy) => policy.code)).toEqual(["FLEX_24H", "NRF", "GROUP_CUTOFF"]);
    expect(config.marketSegmentGroups.map((group) => group.code)).toEqual(["OTA", "WEBSITE", "CORP", "GROUPS", "TRAVEL_TRADE"]);
    expect(config.ratePlans).toHaveLength(5);
    expect(config.ratePlans.find((ratePlan) => ratePlan.code === "GRP-MICE-CP")?.cancellationPolicyCode).toBe("GROUP_CUTOFF");
    expect(config.cashierPolicy.cashDrawerRequiredForRead).toBe(false);
    expect(config.cashierPolicy.cashDrawerRequiredForCashSettlement).toBe(false);
    expect(config.cashierPolicy.postingExecutionEnabled).toBe(true);
    expect(config.cashierPolicy.settlementExecutionEnabled).toBe(true);
    expect(config.safety.publicDemoMutationMode).toBe("governed-proof-routes");
    expect(config.safety.writesJournal).toBe(true);
    expect(config.safety.writesOccupancy).toBe(true);
    expect(config.safety.writesPayment).toBe(true);
    expect(config.safety.notes.join(" ")).toContain("exact confirmation");
  });

  test("serves the configuration over the demo API", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/property-config"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(body.property.inventoryRooms).toBe(120);
    expect(body.ratePlans.map((ratePlan: { code: string }) => ratePlan.code)).toContain("OTA-FLEX-CP");
    expect(body.operatorReadModelRules.join(" ")).toContain("MSG rolls up to MS");
  });
});
