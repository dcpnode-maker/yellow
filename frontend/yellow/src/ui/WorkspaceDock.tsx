import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  activateWorkspaceDockAction,
  createWorkspaceDockHandlers,
  createWorkspaceDockInteractionState,
  type WorkspaceDockPlacement,
  type WorkspaceDockStorage,
} from "./workspace-dock";
import "./workspace-dock.css";

export interface WorkspaceDockAction {
  id: string;
  label: string;
  current: boolean;
  icon: ReactNode;
  onActivate: () => void;
  unavailable?: boolean;
}

export interface WorkspaceDockProps {
  actions: readonly WorkspaceDockAction[];
  placement: WorkspaceDockPlacement;
  locked: boolean;
  onPlacementChange: (placement: WorkspaceDockPlacement) => void;
}

function getStorage(): WorkspaceDockStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function GripIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <circle cx="8" cy="6" r="1.4" /><circle cx="16" cy="6" r="1.4" />
    <circle cx="8" cy="12" r="1.4" /><circle cx="16" cy="12" r="1.4" />
    <circle cx="8" cy="18" r="1.4" /><circle cx="16" cy="18" r="1.4" />
  </svg>;
}

export function WorkspaceDock({ actions, placement, locked, onPlacementChange }: Readonly<WorkspaceDockProps>) {
  const [dragging, setDragging] = useState(false);
  const [hoverHelp, setHoverHelp] = useState<{ text: string; left: number; top: number } | null>(null);
  const [focusHelp, setFocusHelp] = useState<typeof hoverHelp>(null);
  const clearHelp = () => { setHoverHelp(null); setFocusHelp(null); };
  const helpAt = (element: HTMLButtonElement, text: string) => {
    const rect = element.getBoundingClientRect();
    return { text,
      left: Math.max(12, Math.min(window.innerWidth - 236, placement === "left" ? rect.right + 10 : rect.left)),
      top: Math.max(12, Math.min(window.innerHeight - 80, placement === "left" ? rect.top : rect.top - 62)),
    };
  };
  useEffect(() => {
    clearHelp();
    window.addEventListener("resize", clearHelp);
    return () => window.removeEventListener("resize", clearHelp);
  }, [placement, locked]);
  const visibleHelp = dragging ? null : hoverHelp ?? focusHelp;
  const tooltipPrefix = useId();
  const placementRef = useRef(placement);
  placementRef.current = placement;
  const callbacksRef = useRef({ onPlacementChange, locked });
  callbacksRef.current = { onPlacementChange, locked };
  const interactionState = useRef(createWorkspaceDockInteractionState(placement));
  const handlers = useRef<ReturnType<typeof createWorkspaceDockHandlers> | null>(null);
  if (!handlers.current) {
    handlers.current = createWorkspaceDockHandlers({
      state: interactionState.current,
      getPlacement: () => placementRef.current,
      onPlacementChange: (next) => callbacksRef.current.onPlacementChange(next),
      getStorage,
      getViewport: () => ({
        width: typeof window === "undefined" ? 1280 : window.innerWidth,
        height: typeof window === "undefined" ? 800 : window.innerHeight,
      }),
      isLocked: () => callbacksRef.current.locked,
      onDraggingChange: setDragging,
    });
  }
  const interaction = handlers.current;
  const nextPlacement = placement === "left" ? "bottom" : "left";
  const gripLabel = `Workspace dock is on the ${placement}. Activate to move it to the ${nextPlacement}, or drag to reposition.`;

  return <div className="operator-workspace-dock" data-placement={placement} data-dragging={dragging || undefined}>
    <button
      className="operator-dock-grip"
      type="button"
      aria-label={gripLabel}
      aria-describedby={`${tooltipPrefix}-grip`}
      aria-pressed={placement === "bottom"}
      title={gripLabel}
      disabled={locked}
      onPointerDown={interaction.onPointerDown}
      onPointerMove={interaction.onPointerMove}
      onPointerUp={interaction.onPointerUp}
      onPointerCancel={interaction.onPointerCancel}
      onKeyDown={interaction.onKeyDown}
      onClick={interaction.onClick}
      onPointerEnter={(event) => { if (event.pointerType !== "touch") setHoverHelp(helpAt(event.currentTarget, "Drag to the other edge, or activate to switch sides")); }}
      onPointerLeave={() => setHoverHelp(null)}
      onFocus={(event) => setFocusHelp(helpAt(event.currentTarget, "Drag to the other edge, or activate to switch sides"))}
      onBlur={() => setFocusHelp(null)}
    >
      <GripIcon />
      <span id={`${tooltipPrefix}-grip`} role="tooltip" className="operator-dock-tooltip operator-dock-grip-tooltip">
        Drag to the other edge, or activate to switch sides
      </span>
    </button>
    <nav className="operator-quick-dock" aria-label="Quick workspaces" onScroll={clearHelp}>
      {actions.map((action) => {
        const tooltipId = `${tooltipPrefix}-${action.id}`;
        return <button
          key={action.id}
          type="button"
          title={action.label}
          aria-label={action.label}
          aria-describedby={tooltipId}
          aria-current={action.current ? "page" : undefined}
          disabled={locked || action.unavailable}
          onClick={() => { clearHelp(); activateWorkspaceDockAction(action.onActivate, locked || Boolean(action.unavailable)); }}
          onPointerEnter={(event) => { if (event.pointerType !== "touch") setHoverHelp(helpAt(event.currentTarget, action.label)); }}
          onPointerLeave={() => setHoverHelp(null)}
          onFocus={(event) => setFocusHelp(helpAt(event.currentTarget, action.label))}
          onBlur={() => setFocusHelp(null)}
        >
          {action.icon}
          <span id={tooltipId} className="operator-dock-tooltip" role="tooltip">{action.label}</span>
        </button>;
      })}
    </nav>
    {visibleHelp && typeof document !== "undefined" ? createPortal(
      <span className="operator-dock-visible-tooltip" aria-hidden="true" style={{ left: visibleHelp.left, top: visibleHelp.top }}>{visibleHelp.text}</span>,
      document.body,
    ) : null}
  </div>;
}
