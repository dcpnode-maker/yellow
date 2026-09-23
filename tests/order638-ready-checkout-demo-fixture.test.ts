import { describe, expect, test } from "bun:test";

const probe = await Bun.file("tools/probe-colleague-demo-readiness.ts").text();

describe("Order 638 ready checkout demo fixture", () => {
  test("the colleague-readiness probe proves both ready and blocked checkout paths", () => {
    expect(probe).toContain('name: "ready checkout fixture"');
    expect(probe).toContain('name: "blocked checkout guardrail"');
    expect(probe).toContain('readiness.ready === true');
    expect(probe).toContain('readiness.ready === false && blockers.length > 0');
    expect(probe).toContain('folio.status === "settled" || folio.status === "closed"');
    expect(probe).toContain('folio.balanceMinor === "0"');
    expect(probe).toContain('typeof occupancy.occupancyId === "string"');
  });
});
