import { expect, test } from "bun:test";
const ribbon = await Bun.file(new URL("../frontend/yellow/src/ui/SegmentedRibbon.tsx", import.meta.url)).text();
const css = await Bun.file(new URL("../frontend/yellow/src/ui/movement-ribbon.css", import.meta.url)).text();
test("selection indicator uses layout coordinates not transient transformed bounds", () => {
  for (const field of ["offsetTop", "offsetLeft", "offsetWidth", "offsetHeight"]) expect(ribbon).toContain(`selected.${field}`);
  expect(ribbon).not.toContain("getBoundingClientRect");
  expect(ribbon).toContain("observer.observe(selected)");
  expect(ribbon).toContain('event.key === "ArrowRight"');
});
test("all three phone movement choices fit while preserving touch targets", () => {
  expect(css).toContain(".movement-view-ribbon .segmented-ribbon");
  expect(css).toContain("min-width: 0");
  expect(css).toContain("flex: 1 1 0");
  expect(css).toContain("min-height: 44px");
});
