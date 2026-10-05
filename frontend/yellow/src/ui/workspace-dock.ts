export type WorkspaceDockPlacement = "left" | "bottom";

export const WORKSPACE_DOCK_PREFERENCE_KEY = "«REDACTED-SECRET»";
export const WORKSPACE_DOCK_DRAG_THRESHOLD_PX = 8;

export interface WorkspaceDockStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isWorkspaceDockPlacement(value: unknown): value is WorkspaceDockPlacement {
  return value === "left" || value === "bottom";
}

export function defaultWorkspaceDockPlacement(viewportWidth: number): WorkspaceDockPlacement {
  return viewportWidth <= 980 ? "bottom" : "left";
}

export function readWorkspaceDockPlacement(storage: WorkspaceDockStorage | undefined): WorkspaceDockPlacement | undefined {
  if (!storage) return undefined;
  try {
    const value = storage.getItem(WORKSPACE_DOCK_PREFERENCE_KEY);
    return isWorkspaceDockPlacement(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function persistWorkspaceDockPlacement(
  placement: WorkspaceDockPlacement,
  storage: WorkspaceDockStorage | undefined,
): boolean {
  if (!storage || !isWorkspaceDockPlacement(placement)) return false;
  try {
    storage.setItem(WORKSPACE_DOCK_PREFERENCE_KEY, placement);
    return true;
  } catch {
    return false;
  }
}

export function resolveWorkspaceDockPlacement(
  savedValue: unknown,
  viewportWidth: number,
): WorkspaceDockPlacement {
  return isWorkspaceDockPlacement(savedValue) ? savedValue : defaultWorkspaceDockPlacement(viewportWidth);
}

export function snapWorkspaceDockPlacement(
  clientX: number,
  clientY: number,
  viewportWidth: number,
  viewportHeight: number,
): WorkspaceDockPlacement {
  const x = Math.max(0, Math.min(viewportWidth, clientX));
  const y = Math.max(0, Math.min(viewportHeight, clientY));
  const distanceToLeft = x;
  const distanceToBottom = viewportHeight - y;
  return distanceToLeft <= distanceToBottom ? "left" : "bottom";
}

export interface WorkspaceDockCaptureTarget {
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
  hasPointerCapture?: (pointerId: number) => boolean;
}

export interface WorkspaceDockPointerEvent {
  button: number;
  pointerId: number;
  clientX: number;
  clientY: number;
  currentTarget: WorkspaceDockCaptureTarget;
}

export interface WorkspaceDockInteractionState {
  pointerId: number | undefined;
  startX: number;
  startY: number;
  origin: WorkspaceDockPlacement;
  dragged: boolean;
  suppressNextPointerClick: boolean;
  target: WorkspaceDockCaptureTarget | undefined;
}

export function createWorkspaceDockInteractionState(placement: WorkspaceDockPlacement): WorkspaceDockInteractionState {
  return {
    pointerId: undefined,
    startX: 0,
    startY: 0,
    origin: placement,
    dragged: false,
    suppressNextPointerClick: false,
    target: undefined,
  };
}

export interface WorkspaceDockHandlerOptions {
  state: WorkspaceDockInteractionState;
  getPlacement: () => WorkspaceDockPlacement;
  onPlacementChange: (placement: WorkspaceDockPlacement) => void;
  getStorage: () => WorkspaceDockStorage | undefined;
  getViewport: () => Readonly<{ width: number; height: number }>;
  isLocked: () => boolean;
  onDraggingChange: (dragging: boolean) => void;
}

export function createWorkspaceDockHandlers(options: WorkspaceDockHandlerOptions) {
  const { state } = options;
  const commit = (placement: WorkspaceDockPlacement) => {
    options.onPlacementChange(placement);
    persistWorkspaceDockPlacement(placement, options.getStorage());
  };
  const releaseCapture = () => {
    if (state.pointerId === undefined || !state.target) return;
    try {
      if (!state.target.hasPointerCapture || state.target.hasPointerCapture(state.pointerId)) {
        state.target.releasePointerCapture?.(state.pointerId);
      }
    } catch {
      // Pointer capture may already have been released by the browser.
    }
  };
  const clearDrag = (suppressClick: boolean) => {
    const wasDragging = state.dragged;
    releaseCapture();
    state.suppressNextPointerClick = suppressClick;
    state.pointerId = undefined;
    state.target = undefined;
    state.dragged = false;
    if (wasDragging) options.onDraggingChange(false);
  };
  const cancelDrag = () => {
    if (state.pointerId === undefined) return false;
    state.origin = options.getPlacement();
    clearDrag(true);
    return true;
  };

  return {
    onPointerDown(event: WorkspaceDockPointerEvent) {
      if (options.isLocked() || event.button !== 0) return;
      state.suppressNextPointerClick = false;
      state.pointerId = event.pointerId;
      state.startX = event.clientX;
      state.startY = event.clientY;
      state.origin = options.getPlacement();
      state.dragged = false;
      state.target = event.currentTarget;
      try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { state.target = undefined; state.pointerId = undefined; }
    },
    onPointerMove(event: WorkspaceDockPointerEvent) {
      if (state.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < WORKSPACE_DOCK_DRAG_THRESHOLD_PX) return;
      if (!state.dragged) {
        state.dragged = true;
        options.onDraggingChange(true);
      }
    },
    onPointerUp(event: WorkspaceDockPointerEvent) {
      if (state.pointerId !== event.pointerId) return;
      const dragged = state.dragged;
      const viewport = options.getViewport();
      if (dragged && !options.isLocked()) {
        commit(snapWorkspaceDockPlacement(event.clientX, event.clientY, viewport.width, viewport.height));
      }
      clearDrag(dragged);
    },
    onPointerCancel(event: WorkspaceDockPointerEvent) {
      if (state.pointerId === event.pointerId) cancelDrag();
    },
    onKeyDown(event: Readonly<{ key: string; preventDefault(): void }>) {
      if (event.key === "Escape" && cancelDrag()) event.preventDefault();
    },
    onClick(event: Readonly<{ detail: number; preventDefault(): void }>) {
      if (state.suppressNextPointerClick && event.detail > 0) {
        state.suppressNextPointerClick = false;
        event.preventDefault();
        return;
      }
      state.suppressNextPointerClick = false;
      if (options.isLocked()) return;
      commit(options.getPlacement() === "left" ? "bottom" : "left");
    },
    cancelDrag,
  };
}

export function activateWorkspaceDockAction(onActivate: () => void, locked: boolean): void {
  if (!locked) onActivate();
}
