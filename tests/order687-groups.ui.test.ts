import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

test("Order687 staff workspace renders real creation and honest linked-group semantics", async () => {
  Object.assign(globalThis, { window: { location: { search: "" } } });
  const componentPath = "../frontend/yellow/src/workspaces/GroupReservationWorkspace";
  const { GroupReservationWorkspace } = await import(componentPath);
  const html = renderToString(createElement(GroupReservationWorkspace, {
    propertyId: "00000000-0000-0000-0000-000000068702",
  }));
  expect(html).toContain("Group name");
  expect(html).toContain("Create linked group");
  expect(html).toContain("No rooms are held by a linked group");
  expect(html).toContain("each reservation keeps its own inventory");
});
