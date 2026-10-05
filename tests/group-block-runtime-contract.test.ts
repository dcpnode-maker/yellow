import { describe, expect, it } from "bun:test";

import { app } from "../src/app";
import { buildGroupBlockManager, buildGroupBlockRuntime, buildGroupBlocksWorkbench, DEMO_GROUP_BLOCKS } from "../src/contexts/groups";

describe("group block runtime contract", () => {
  it("deducting definite blocks show pickup, wash and remaining pickup rooms", () => {
    const block = DEMO_GROUP_BLOCKS[0];
    if (block === undefined) throw new Error("missing demo group block");

    const runtime = buildGroupBlockRuntime(block, "2026-09-24");

    expect(runtime.status).toBe("definite");
    expect(runtime.deductsHouseInventory).toBe(true);
    expect(runtime.marketSegmentGroup).toBe("GROUPS");
    expect(runtime.marketSegment).toBe("MICE");
    expect(runtime.totals.blocked).toBe(40);
    expect(runtime.totals.pickedUp).toBe(28);
    expect(runtime.totals.remainingBeforeWash).toBe(12);
    expect(runtime.totals.washed).toBe(2);
    expect(runtime.totals.availableForPickup).toBe(10);
  });

  it("never washes more rooms than remain after pickup", () => {
    const block = DEMO_GROUP_BLOCKS[0];
    if (block === undefined) throw new Error("missing demo group block");

    const runtime = buildGroupBlockRuntime({
      ...block,
      allotment: [{ stayDate: "2026-09-27", unitTypeCode: "DLX", blocked: 2, pickedUp: 2, rateMinor: 850000, currency: "INR" }],
    }, "2026-09-23");

    expect(runtime.totals.remainingBeforeWash).toBe(0);
    expect(runtime.totals.washed).toBe(0);
    expect(runtime.totals.availableForPickup).toBe(0);
  });

  it("keeps non-deducting tentative blocks visible without reducing house inventory", () => {
    const block = DEMO_GROUP_BLOCKS[1];
    if (block === undefined) throw new Error("missing demo group block");

    const runtime = buildGroupBlockRuntime(block, "2026-09-23");

    expect(runtime.status).toBe("tentative");
    expect(runtime.deductsHouseInventory).toBe(false);
    expect(runtime.totals.blocked).toBe(16);
    expect(runtime.totals.availableForPickup).toBe(16);
    expect(runtime.operationalPurpose).toContain("without deducting house inventory");
  });

  it("returns a deterministic workbench for the public demo API", async () => {
    const expected = buildGroupBlocksWorkbench("2026-09-23");
    const response = await app.handle(new Request("http://localhost/api/v1/demo/group-blocks"));
    const actual = await response.json();

    expect(response.status).toBe(200);
    expect(actual).toEqual(expected);
    expect(actual.blocks).toHaveLength(2);
    expect(actual.invariants).toContain("Block status deduction is configuration, not hard-coded workflow magic.");
  });

  it("returns a group reservation manager with confirmation-gated disabled actions", async () => {
    const expected = buildGroupBlockManager("2026-09-23");
    const response = await app.handle(new Request("http://localhost/api/v1/demo/group-blocks/manager"));
    const actual = await response.json();

    expect(response.status).toBe(200);
    expect(actual).toEqual(expected);
    expect(actual.purpose).toContain("Manage group reservations");
    expect(actual.operatingRules).toContain("Pickup converts block demand into named or placeholder reservations against the block before house inventory.");

    const definite = actual.blocks.find((block: { code: string }) => block.code === "YCC-0926");
    expect(definite.releaseRisk).toBe("urgent");
    expect(definite.roomingListGap).toBe(6);
    expect(definite.nextOperationalStep).toContain("Review cutoff");
    expect(definite.actions.map((action: { id: string }) => action.id)).toEqual([
      "pickup-from-block",
      "import-rooming-list",
      "wash-or-release",
      "convert-status",
    ]);
    expect(definite.actions.every((action: { requiresConfirmation: boolean; executionEnabled: boolean }) => action.requiresConfirmation === true && action.executionEnabled === false)).toBe(true);
  });
});
