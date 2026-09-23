import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Order 623 Opera-style group block workbench", () => {
  test("backend exposes the existing reservation group/block allotment primitives as a read-only workbench", () => {
    const service = read("src/contexts/reservations/group-blocks.ts");
    const http = read("src/http/operator.ts");
    const app = read("src/app.ts");

    expect(service).toContain("reservation_group AS group_row");
    expect(service).toContain("group_row.kind = 'block'");
    expect(service).toContain("block_allotment");
    expect(service).toContain("picked_up_rooms");
    expect(service).toContain("cutoff_state");
    expect(service).toContain("master_folio_id");
    expect(http).toContain("async groupBlocks");
    expect(http).toContain("Group block access is not granted");
    expect(app).toContain("/api/v1/properties/:property/group-blocks");
    expect(http).toContain("#groupBlocks: GroupBlockOperations = new GroupBlockService()");
  });

  test("React demo surface shows the PMS group block module instead of hiding the gap", () => {
    const api = read("frontend/yellow/src/yellow-api.tsx");
    const workspace = read("frontend/yellow/src/workspaces/ReservationWorkspace.tsx");
    const styles = read("frontend/yellow/src/styles.css");

    expect(api).toContain("async function loadGroupBlocks");
    expect(api).toContain("/api/v1/properties/${propertyId}/group-blocks");
    expect(workspace).toContain("Opera-style group blocks");
    expect(workspace).toContain("GROUP RESERVATIONS · BLOCK MANAGEMENT");
    expect(workspace).toContain("blocked</small>");
    expect(workspace).toContain("picked up</small>");
    expect(workspace).toContain("cutoffState");
    expect(styles).toContain(".group-block-workbench");
    expect(styles).toContain(".group-block-allotment");
  });
});
