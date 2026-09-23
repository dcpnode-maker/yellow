import { expect, test } from "bun:test";

const source = new URL(
  "../src/contexts/tax-fiscal/india-gst-accommodation-component-family.ts",
  import.meta.url,
);
const index = new URL("../src/contexts/tax-fiscal/index.ts", import.meta.url);

test("Order 308 intentional red: governed accommodation component-family evidence exists", async () => {
  expect(await Bun.file(source).exists()).toBeTrue();
  const valueModule = await Bun.file(source).text();
  const moduleSurface = await Bun.file(index).text();
  expect(valueModule).toContain("deriveIndiaGstAccommodationComponentFamily");
  expect(valueModule).toContain("cgst_utgst");
  expect(moduleSurface).toContain('from "./india-gst-accommodation-component-family"');
});
