import { describe, expect, test } from "bun:test";

import { buildDemoHotelPerformance } from "../src/demo/hotel-performance";

describe("demo hotel performance read model", () => {
  test("returns simple server-owned hotel KPI math", () => {
    const performance = buildDemoHotelPerformance();

    expect(performance.contract.authority).toBe("server-owned-read-model");
    expect(performance.contract.hierarchy).toBe("MSG_TO_MS_ONLY");
    expect(performance.hotel.roomsAvailable).toBe(120);
    expect(performance.hotel.roomNights).toBe(80);
    expect(performance.hotel.roomRevenueMinor).toBe(1_197_000);
    expect(performance.hotel.occupancyPct).toBe(66.67);
    expect(performance.hotel.adrMinor).toBe(14_963);
    expect(performance.hotel.revparMinor).toBe(9_975);
  });

  test("rolls MSG, MS/source and room type as independent intersections", () => {
    const performance = buildDemoHotelPerformance();

    expect(performance.marketSegmentGroups.map((rollup) => rollup.label).sort()).toEqual([
      "CORP",
      "GROUPS",
      "OTA",
      "TRAVEL_TRADE",
      "WEBSITE",
    ]);
    expect(performance.marketSegmentsAndSources.some((rollup) => rollup.label === "OTA/Booking.com/mobile")).toBe(true);
    expect(performance.roomTypes.some((rollup) => rollup.label === "STD" && rollup.roomNights === 42)).toBe(true);
  });

  test("does not average child ratios while aggregating", () => {
    const performance = buildDemoHotelPerformance();
    const averageLeafAdr = Math.round(
      performance.leaves
        .map((leaf) => leaf.roomRevenueMinor / leaf.roomNights)
        .reduce((sum, adr) => sum + adr, 0) / performance.leaves.length,
    );

    expect(averageLeafAdr).not.toBe(performance.hotel.adrMinor);
    expect(performance.hotel.adrMinor).toBe(Math.round(performance.hotel.roomRevenueMinor / performance.hotel.roomNights));
    expect(performance.hotel.revparMinor).toBe(Math.round(performance.hotel.roomRevenueMinor / 120));
  });

  test("marks non-hotel demand scopes as lacking inventory denominator", () => {
    const performance = buildDemoHotelPerformance();

    for (const rollup of [...performance.marketSegmentGroups, ...performance.marketSegmentsAndSources, ...performance.roomTypes]) {
      expect(rollup.roomsAvailable).toBeNull();
      expect(rollup.occupancyPct).toBeNull();
      expect(rollup.revparMinor).toBeNull();
      expect(rollup.nullReason).toBe("DEMAND_SCOPE_HAS_NO_INVENTORY_DENOMINATOR");
    }
  });
});
