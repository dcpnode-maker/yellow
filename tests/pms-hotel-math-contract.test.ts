import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const contract = readFileSync(join(root, "docs", "PMS-HOTEL-MATH.md"), "utf8");
const normalizedContract = contract.replace(/\s+/g, " ");
const prototypeReadme = readFileSync(
  join(root, "prototypes", "commercial-attribution", "README.md"),
  "utf8",
);

describe("PMS hotel math contract", () => {
  test("keeps hotel KPI truth server-owned and simple", () => {
    expect(contract).toContain("PostgreSQL is the system of record");
    expect(contract).toContain("Reporting screens consume server read models");
    expect(normalizedContract).toContain("they do not calculate operational truth from ad hoc frontend rows");
  });

  test("freezes MSG to MS as the only parent-child demand hierarchy", () => {
    expect(contract).toContain("MSG → MS is the only parent-child demand hierarchy");
    expect(normalizedContract).toContain("Many reservation nights roll up to one MS");
    expect(normalizedContract).toContain("many MS rows roll up to one MSG");
    expect(contract).toContain("Everything else is an independent intersection");
    expect(contract).toContain("source/channel");
    expect(contract).toContain("company, booker, agent or profile");
    expect(contract).toContain("room class");
    expect(contract).toContain("room type");
  });

  test("requires ratio KPIs to be recomputed after compatible aggregation", () => {
    expect(contract).toContain("occupancy_pct = room_nights / rooms_available * 100");
    expect(contract).toContain("ADR = room_revenue / actual_room_nights");
    expect(contract).toContain("RevPAR = room_revenue / rooms_available");
    expect(contract).toContain("add the nights, add the money, then divide once");
    expect(contract).toContain("Never average child ADRs, child occupancies or child RevPARs");
    expect(contract).toContain("Yellow does not guess");
  });

  test("prevents future UI business-mix inference", () => {
    expect(contract).toContain("The UI may format, sort and drill into server-owned read models");
    expect(contract).toContain("must not");
    expect(contract).toContain("hard-code MSG/MS/source hierarchy");
    expect(contract).toContain("compute occupancy, ADR or RevPAR from partial frontend collections");
    expect(contract).toContain("treat planned demand as occupied inventory");
  });

  test("stays aligned with the accepted commercial-attribution prototype", () => {
    expect(prototypeReadme).toContain("MSG→MS is the only parent-child demand hierarchy");
    expect(prototypeReadme).toContain("Channel/source, company/booker, group kind, class/type and organization are independent intersections");
    expect(prototypeReadme).toContain("Ratios are recomputed after summing compatible numerators and denominators");
  });
});
