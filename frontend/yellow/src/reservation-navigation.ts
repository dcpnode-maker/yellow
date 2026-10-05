export type ReservationWorkspaceView = "list" | "groups" | "calendar";
export type ReservationStageView = "pre_arrival" | "arrival" | "in_house" | "departure" | "post_departure" | "all";
const stageViews = new Set<ReservationStageView>(["pre_arrival", "arrival", "in_house", "departure", "post_departure", "all"]);
export function reservationStageFromSearch(search: string): ReservationStageView {
  const params = new URLSearchParams(search);
  const values = params.getAll("stage");
  return values.length === 1 && stageViews.has(values[0] as ReservationStageView) ? values[0] as ReservationStageView : "arrival";
}
export function reservationStageHref(pathname: string, search: string, hash: string, stage: ReservationStageView): string {
  const url = new URL(`${pathname}${search}${hash}`, "https://yellow.invalid");
  url.searchParams.delete("view"); url.searchParams.delete("group");
  url.searchParams.set("stage", stage);
  return `${url.pathname}${url.search}${url.hash}`;
}

const isReservationWorkspaceView = (value: string | null): value is ReservationWorkspaceView =>
  value === "list" || value === "groups" || value === "calendar";

export function reservationViewFromSearch(search: string): ReservationWorkspaceView {
  const value = new URLSearchParams(search).get("view");
  return isReservationWorkspaceView(value) ? value : "list";
}

/** undefined means no group link; null means an invalid/ambiguous link. */
export function reservationGroupFromSearch(search: string): string | null | undefined {
  const params = new URLSearchParams(search);
  const groups = params.getAll("group");
  if (groups.length === 0) return undefined;
  if (params.get("view") !== "groups" || groups.length !== 1 ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(groups[0]!)) return null;
  return groups[0]!;
}

export function reservationViewForDestination(destination: string): ReservationWorkspaceView | null {
  if (!destination.startsWith("reservations:")) return null;
  const view = destination.slice("reservations:".length);
  return isReservationWorkspaceView(view) ? view : null;
}

export function reservationViewDestination(view: ReservationWorkspaceView): string {
  return `reservations:${view}`;
}

export function reservationViewHref(
  pathname: string,
  search: string,
  hash: string,
  view: ReservationWorkspaceView,
): string {
  const url = new URL(`${pathname}${search}${hash}`, "https://yellow.invalid");
  if (view === "list") url.searchParams.delete("view");
  else url.searchParams.set("view", view);
  if (view !== "groups") url.searchParams.delete("group");
  return `${url.pathname}${url.search}${url.hash}`;
}
