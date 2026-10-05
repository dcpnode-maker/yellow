import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WORKSPACE_DOCK_DRAG_THRESHOLD_PX,
  WORKSPACE_DOCK_PREFERENCE_KEY,
  activateWorkspaceDockAction,
  createWorkspaceDockHandlers,
  createWorkspaceDockInteractionState,
  defaultWorkspaceDockPlacement,
  isWorkspaceDockPlacement,
  persistWorkspaceDockPlacement,
  readWorkspaceDockPlacement,
  resolveWorkspaceDockPlacement,
  snapWorkspaceDockPlacement,
  type WorkspaceDockPlacement,
  type WorkspaceDockStorage,
} from "../frontend/yellow/src/ui/workspace-dock";

const componentPath: string = "../frontend/yellow/src/ui/WorkspaceDock";
const { WorkspaceDock } = await import(componentPath);

class MemoryDockStorage implements WorkspaceDockStorage {
  readonly values = new Map<string, string>();
  failRead = false;
  failWrite = false;

  getItem(key: string): string | null {
    if (this.failRead) throw new Error("storage blocked");
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrite) throw new Error("storage blocked");
    this.values.set(key, value);
  }
}

function pointerEvent(
  target: { setPointerCapture(id: number): void; releasePointerCapture(id: number): void; hasPointerCapture(id: number): boolean },
  pointerId: number,
  clientX: number,
  clientY: number,
) {
  return { button: 0, pointerId, clientX, clientY, currentTarget: target };
}

function setupInteractions(options: { locked?: boolean; placement?: WorkspaceDockPlacement; storage?: WorkspaceDockStorage } = {}) {
  let placement = options.placement ?? "left";
  const storage = options.storage ?? new MemoryDockStorage();
  const changes: WorkspaceDockPlacement[] = [];
  const dragStates: boolean[] = [];
  let viewport = { width: 1280, height: 800 };
  const state = createWorkspaceDockInteractionState(placement);
  const handlers = createWorkspaceDockHandlers({
    state,
    getPlacement: () => placement,
    onPlacementChange: (next) => { placement = next; changes.push(next); },
    getStorage: () => storage,
    getViewport: () => viewport,
    isLocked: () => options.locked ?? false,
    onDraggingChange: (dragging) => dragStates.push(dragging),
  });
  const captures: string[] = [];
  const target = {
    setPointerCapture(id: number) { captures.push(`capture:${id}`); },
    releasePointerCapture(id: number) { captures.push(`release:${id}`); },
    hasPointerCapture(id: number) { return captures.includes(`capture:${id}`) && !captures.includes(`release:${id}`); },
  };
  return { handlers, state, storage, changes, dragStates, captures, target, getPlacement: () => placement, setViewport: (next: typeof viewport) => { viewport = next; } };
}

describe("Order 703 dock placement and storage", () => {
  test("invalid preferences fall back by viewport size and valid choices are bounded", () => {
    expect(isWorkspaceDockPlacement("left")).toBe(true);
    expect(isWorkspaceDockPlacement("bottom")).toBe(true);
    expect(isWorkspaceDockPlacement("right")).toBe(false);
    expect(defaultWorkspaceDockPlacement(1280)).toBe("left");
    expect(defaultWorkspaceDockPlacement(980)).toBe("bottom");
    expect(resolveWorkspaceDockPlacement("right", 1280)).toBe("left");
    expect(resolveWorkspaceDockPlacement("left", 390)).toBe("left");
    expect(snapWorkspaceDockPlacement(-40, 300, 390, 844)).toBe("left");
    expect(snapWorkspaceDockPlacement(300, 900, 390, 844)).toBe("bottom");
  });

  test("corrupt, unavailable, and throwing localStorage never blocks navigation", () => {
    const storage = new MemoryDockStorage();
    storage.values.set(WORKSPACE_DOCK_PREFERENCE_KEY, "nearby");
    expect(readWorkspaceDockPlacement(storage)).toBeUndefined();
    expect(readWorkspaceDockPlacement(undefined)).toBeUndefined();
    storage.failRead = true;
    expect(readWorkspaceDockPlacement(storage)).toBeUndefined();
    storage.failRead = false;
    storage.failWrite = true;
    expect(persistWorkspaceDockPlacement("bottom", storage)).toBe(false);
    expect(resolveWorkspaceDockPlacement(undefined, 390)).toBe("bottom");
  });

  test("pointer capture requires the movement threshold and persists only a completed drag", () => {
    const dock = setupInteractions();
    const threshold = WORKSPACE_DOCK_DRAG_THRESHOLD_PX;
    dock.handlers.onPointerDown(pointerEvent(dock.target, 7, 18, 100));
    expect(dock.captures).toEqual(["capture:7"]);
    dock.handlers.onPointerMove(pointerEvent(dock.target, 7, 18 + threshold - 1, 100));
    expect(dock.state.dragged).toBe(false);
    expect(dock.changes).toEqual([]);
    expect(readWorkspaceDockPlacement(dock.storage)).toBeUndefined();
    dock.handlers.onPointerUp(pointerEvent(dock.target, 7, 18 + threshold - 1, 100));
    expect(dock.getPlacement()).toBe("left");
    expect(readWorkspaceDockPlacement(dock.storage)).toBeUndefined();

    dock.handlers.onPointerDown(pointerEvent(dock.target, 8, 18, 100));
    dock.handlers.onPointerMove(pointerEvent(dock.target, 8, 18 + threshold + 1, 100));
    expect(dock.state.dragged).toBe(true);
    expect(readWorkspaceDockPlacement(dock.storage)).toBeUndefined();
    dock.handlers.onPointerUp(pointerEvent(dock.target, 8, 300, 790));
    expect(dock.getPlacement()).toBe("bottom");
    expect(readWorkspaceDockPlacement(dock.storage)).toBe("bottom");
    expect(dock.captures.slice(-1)).toEqual(["release:8"]);
    expect(dock.dragStates).toEqual([true, false]);

    let prevented = false;
    dock.handlers.onClick({ detail: 1, preventDefault: () => { prevented = true; } });
    expect(prevented).toBe(true);
    expect(dock.getPlacement()).toBe("bottom");
    expect(dock.changes).toEqual(["bottom"]);
  });

  test("Escape and pointercancel cancel captured drags without saving or repositioning", () => {
    const dock = setupInteractions();
    dock.handlers.onPointerDown(pointerEvent(dock.target, 11, 20, 40));
    dock.handlers.onPointerMove(pointerEvent(dock.target, 11, 40, 60));
    let prevented = false;
    dock.handlers.onKeyDown({ key: "Escape", preventDefault: () => { prevented = true; } });
    expect(prevented).toBe(true);
    expect(dock.state.pointerId).toBeUndefined();
    expect(dock.changes).toEqual([]);
    expect(readWorkspaceDockPlacement(dock.storage)).toBeUndefined();
    expect(dock.captures).toContain("release:11");
    let escapeClickPrevented = false;
    dock.handlers.onClick({ detail: 1, preventDefault: () => { escapeClickPrevented = true; } });
    expect(escapeClickPrevented).toBe(true);

    dock.handlers.onPointerDown(pointerEvent(dock.target, 12, 22, 44));
    dock.handlers.onPointerMove(pointerEvent(dock.target, 12, 42, 64));
    dock.handlers.onPointerCancel(pointerEvent(dock.target, 12, 42, 64));
    expect(dock.state.pointerId).toBeUndefined();
    expect(dock.changes).toEqual([]);
    expect(readWorkspaceDockPlacement(dock.storage)).toBeUndefined();
    let cancelClickPrevented = false;
    dock.handlers.onClick({ detail: 1, preventDefault: () => { cancelClickPrevented = true; } });
    expect(cancelClickPrevented).toBe(true);
    dock.handlers.onClick({ detail: 0, preventDefault() {} });
    expect(dock.getPlacement()).toBe("bottom");
    expect(readWorkspaceDockPlacement(dock.storage)).toBe("bottom");
  });

  test("keyboard/tap activation is a non-drag alternative and remains usable if storage is blocked", () => {
    const storage = new MemoryDockStorage();
    storage.failWrite = true;
    const dock = setupInteractions({ storage });
    dock.handlers.onClick({ detail: 0, preventDefault() {} });
    expect(dock.getPlacement()).toBe("bottom");
    expect(dock.changes).toEqual(["bottom"]);
    expect(readWorkspaceDockPlacement(storage)).toBeUndefined();
    dock.setViewport({ width: 390, height: 844 });
    expect(defaultWorkspaceDockPlacement(390)).toBe("bottom");
  });

  test("locked placement and action handlers cannot invoke callbacks", () => {
    const dock = setupInteractions({ locked: true });
    dock.handlers.onPointerDown(pointerEvent(dock.target, 4, 0, 0));
    dock.handlers.onClick({ detail: 0, preventDefault() {} });
    expect(dock.captures).toEqual([]);
    expect(dock.changes).toEqual([]);
    let actionCount = 0;
    activateWorkspaceDockAction(() => { actionCount += 1; }, true);
    expect(actionCount).toBe(0);
    activateWorkspaceDockAction(() => { actionCount += 1; }, false);
    expect(actionCount).toBe(1);
  });
});

describe("Order 703 rendered workspace dock contract", () => {
  test("renders all existing destinations with visible selected state and accessible reposition alternative", () => {
    const onActivate: string[] = [];
    const actions = [
      ["today", "Today"], ["reservations", "Reservations"], ["operations", "Front desk"], ["housekeeping", "Housekeeping"],
      ["finance", "Cashier"], ["rates", "Rates & distribution"], ["market-map", "Map"], ["status", "Reports"],
      ["ecosystem", "All workspaces"], ["settings", "Property setup"],
    ].map(([id, label]) => ({
      id: id!, label: label!, current: id === "today", icon: createElement("svg", { "aria-hidden": true }), onActivate: () => onActivate.push(id!),
    }));
    const html = renderToStaticMarkup(createElement(WorkspaceDock, {
      actions, placement: "left", locked: false, onPlacementChange() {},
    }));
    expect(html).toContain('data-placement="left"');
    expect(html).toContain('aria-label="Quick workspaces"');
    expect(html).toContain('aria-label="Workspace dock is on the left. Activate to move it to the bottom, or drag to reposition."');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="Today" aria-describedby=');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('role="tooltip"');
    expect(html).toContain("Drag to the other edge, or activate to switch sides");
    expect(html).toContain('aria-label="All workspaces"');
    for (const label of ["Front desk", "Rates &amp; distribution", "Map", "Reports", "Property setup"]) expect(html).toContain(`aria-label="${label}"`);
    expect(html.match(/type="button"/g)).toHaveLength(11);
    expect(onActivate).toEqual([]);
  });

  test("dedicated CSS contains left and bottom snap rails, safe areas, focus, hover and reduced motion", async () => {
    const styles = await Bun.file("frontend/yellow/src/ui/workspace-dock.css").text();
    expect(styles).toContain('.operator-workspace-dock[data-placement="left"]');
    expect(styles).toContain('.operator-workspace-dock[data-placement="bottom"]');
    expect(styles).toContain("env(safe-area-inset-bottom, 0px)");
    expect(styles).toContain("env(safe-area-inset-left, 0px)");
    expect(styles).toContain("touch-action: none");
    expect(styles).toContain("prefers-reduced-motion: reduce");
    expect(styles).toContain(":focus-visible");
    expect(styles).toContain(":hover");
    expect(styles).toContain("max-width: calc(100vw - 24px");
  });
});
