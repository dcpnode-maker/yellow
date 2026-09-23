import { describe, expect, test } from "bun:test";

const MODULE = new URL(
  "../src/contexts/tax-fiscal/india-gst-section14-working-day-calendar-evidence.ts",
  import.meta.url,
);

describe("Order 338 intentional red: governed section14 working-day evidence", () => {
  test("production boundary and public export do not exist before implementation", async () => {
    expect(await Bun.file(MODULE).exists()).toBeTrue();
    const index = await Bun.file(new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url)).text();
    expect(index).toContain('from "./india-gst-section14-working-day-calendar-evidence"');
  });
});
