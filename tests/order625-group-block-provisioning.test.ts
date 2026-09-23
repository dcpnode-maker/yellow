import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Order 625 reproducible public group block fixture", () => {
  test("provisioning script preserves the synthetic MICE and social group-block demo", () => {
    const script = read("tools/provision-public-group-blocks.ps1");
    expect(script).toContain("LOC-MICE-0926");
    expect(script).toContain("LOC-SOC-0928");
    expect(script).toContain("block_status_def");
    expect(script).toContain("block_allotment");
    expect(script).toContain("group_master");
    expect(script).toContain("Northstar Leadership Summit");
    expect(script).toContain("Horizon Family Wedding");
  });

  test("colleague readiness probe fails if group blocks disappear", () => {
    const probe = read("tools/probe-colleague-demo-readiness.ts");
    expect(probe).toContain("group block workbench");
    expect(probe).toContain("/group-blocks");
    expect(probe).toContain("groups.length >= 2");
    expect(probe).toContain("blockedRooms");
    expect(probe).toContain("pickedUpRooms");
  });
});
