import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("reservation workspace sibling routing", () => {
  test("uses the same work area, deep-link parameter and browser-history event", () => {
    const source = readFileSync("frontend/yellow/src/workspaces/ReservationWorkspace.tsx", "utf8");
    expect(source).toContain('useState<ReservationWorkspaceView>(() => reservationViewFromSearch(window.location.search))');
    expect(source).toContain('window.history.pushState(null, "", reservationViewHref(');
    expect(source).toContain('window.addEventListener("popstate", onPopState)');
    expect(source).toContain("<ReservationRoomCalendar");
    expect(source).toContain("<GroupReservationWorkspace key={propertyId} propertyId={propertyId} />");
    expect(source).toContain("<MovementGrid");
    expect(source).toContain("window.location.assign(`/p/${propertyId}/res/");
  });

  test("does not discard active individual or group workspace state when a sibling is selected", () => {
    const source = readFileSync("frontend/yellow/src/workspaces/ReservationWorkspace.tsx", "utf8");
    expect(source).toContain("Your individual reservation draft is preserved.");
    expect(source).toContain("Return to Individual draft");
    expect(source).toContain('hidden={view !== "list"} inert={view !== "list" || undefined}');
    expect(source).toContain('hidden={view !== "groups"} inert={view !== "groups" || undefined}');
    expect(source).toContain("const [groupsVisited, setGroupsVisited]");
  });
});
