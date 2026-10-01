import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

async function renderWorkspaceWithIsolatedWindow(): Promise<string> {
  const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: { location: { search: "" } },
  });
  try {
    const componentPath = "../frontend/yellow/src/workspaces/GroupReservationWorkspace";
    const { GroupReservationWorkspace } = await import(componentPath);
    return renderToString(createElement(GroupReservationWorkspace, {
      propertyId: "00000000-0000-0000-0000-000000068702",
    }));
  } finally {
    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, "window", originalWindowDescriptor);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  }
}

test("Order687 staff workspace renders real creation and honest linked-group semantics", async () => {
  const html = await renderWorkspaceWithIsolatedWindow();
  expect(html).toContain("Group name");
  expect(html).toContain("Create linked group");
  expect(html).toContain("No rooms are held by a linked group");
  expect(html).toContain("each reservation keeps its own inventory");
});

test("Order687 rendering preserves a configurable read-only window from another suite", async () => {
  const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const priorWindow = { location: { pathname: "/prior-suite", search: "?prior=1" } };
  const readOnlyDescriptor = { configurable: true, enumerable: false, writable: false, value: priorWindow };
  Object.defineProperty(globalThis, "window", readOnlyDescriptor);
  try {
    const html = await renderWorkspaceWithIsolatedWindow();
    expect(html).toContain("Create linked group");
    expect(Object.getOwnPropertyDescriptor(globalThis, "window")).toEqual(readOnlyDescriptor);
    expect(globalThis.window).toBe(priorWindow as unknown as Window & typeof globalThis);
  } finally {
    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, "window", originalWindowDescriptor);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  }
});
