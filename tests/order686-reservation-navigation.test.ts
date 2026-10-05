import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { reservationViewDestination, reservationViewForDestination, reservationViewFromSearch, reservationViewHref } from "../frontend/yellow/src/reservation-navigation";

describe("Order686 reservation-family navigation", () => {
  test("parses all sibling destinations and safely defaults unknown views to Individual", () => {
    expect(reservationViewDestination("list")).toBe("reservations:list");
    expect(reservationViewForDestination("reservations:groups")).toBe("groups");
    expect(reservationViewForDestination("reservations:calendar")).toBe("calendar");
    expect(reservationViewForDestination("reservations:unknown")).toBeNull();
    expect(reservationViewFromSearch("?view=groups")).toBe("groups");
    expect(reservationViewFromSearch("?view=calendar")).toBe("calendar");
    expect(reservationViewFromSearch("?view=unknown&source=desk")).toBe("list");
    expect(reservationViewFromSearch("")).toBe("list");
  });

  test("retains unrelated query and hash while changing only the reservation sibling", () => {
    expect(reservationViewHref("/p/hotel/reservations", "?source=desk&view=calendar", "#grid", "groups"))
      .toBe("/p/hotel/reservations?source=desk&view=groups#grid");
    expect(reservationViewHref("/p/hotel/reservations", "?source=desk&view=groups", "#top", "list"))
      .toBe("/p/hotel/reservations?source=desk#top");
  });

  test("changes siblings in-place only on the canonical reservations route and retains mutation guards", () => {
    const app = readFileSync("frontend/yellow/src/App.tsx", "utf8");
    const workflowStart = app.indexOf("const workflow = (part: string) =>");
    const workflow = app.slice(workflowStart, workflowStart + 2400);
    expect(workflow.indexOf("reservationLifecycleBusyRef.current || voiceTransferRecoveryLockedRef.current")).toBeLessThan(workflow.indexOf("reservationViewForDestination(part)"));
    expect(workflow).toContain('const path = `/p/${propertyId}/reservations`');
    expect(workflow).toContain("window.location.pathname === path");
    expect(workflow).toContain('window.history.pushState(null, "", href)');
    expect(workflow).toContain("window.dispatchEvent(new PopStateEvent(\"popstate\"))");
    expect(workflow).toContain("else window.location.assign(href)");
  });

  test("keeps the create draft and first-visited group workspace mounted across sibling views", () => {
    const source = readFileSync("frontend/yellow/src/workspaces/ReservationWorkspace.tsx", "utf8");
    expect(source).toContain("reservationViewHref(");
    expect(source).toContain('window.dispatchEvent(new PopStateEvent("popstate"))');
    expect(source).toContain("Your individual reservation draft is preserved.");
    expect(source).toContain('hidden={view !== "list"} inert={view !== "list" || undefined}');
    expect(source).toContain("const [groupsVisited, setGroupsVisited]");
    expect(source).toContain("<GroupReservationWorkspace key={propertyId} propertyId={propertyId} />");
    expect(source).toContain('aria-label="Individual reservation draft"');
    expect(source).toContain('["list", "Individual"], ["groups", "Groups"], ["calendar", "Calendar"]');
  });

  test("offers one compact editor with stay criteria, filters, ordered sorts, and column visibility", () => {
    const controls = readFileSync("frontend/yellow/src/ui/TableControls.tsx", "utf8");
    expect(controls).toContain('type Editor = "filter" | "sort" | "columns" | null');
    expect(controls).toContain('aria-label="Stay criteria"');
    expect(controls).toContain("Add filter");
    expect(controls).toContain("Add sort level");
    expect(controls).toContain("Clear table filters");
    expect(controls).toContain("Clear sort");
    expect(controls).toContain("Apply");
    expect(controls).toContain("Cancel");
  });

  test("keeps the reservation board padded with a quiet gray tab rail on mobile and desktop", () => {
    const styles = readFileSync("frontend/yellow/src/ui/table-controls.css", "utf8");
    expect(styles).toContain(".reservation-board-next.reservation-board-next");
    expect(styles).toContain("padding: 22px");
    expect(styles).toContain("padding: 12px");
    expect(styles).toContain("background: #eceef0");
    expect(styles).toContain(".reservation-board-next .reservation-workspace-tabs button.selected");
    expect(styles).toContain("background: #fff; color: #292e35");
    expect(styles).toContain("min-height: 44px; padding-inline: 8px");
    expect(styles).toContain("box-shadow: none !important");
  });
});
