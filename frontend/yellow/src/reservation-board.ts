export type ReservationBoardPage<T> = Readonly<{
  reservations?: readonly T[];
  nextCursor?: string | null;
  businessDate?: string | null;
}>;
export const RESERVATION_JOURNEY_STAGES = ["pre_arrival", "arrival", "in_house", "departure", "post_departure"] as const;
export type ReservationJourneyStage = (typeof RESERVATION_JOURNEY_STAGES)[number];

/** A phase is meaningful only against the same persisted property day on every page. */
export async function collectReservationJourneyPages<T>(
  fetchPage: (after: string | null) => Promise<ReservationBoardPage<T>>,
  maximumPages = 50,
): Promise<Readonly<{ reservations: readonly T[]; businessDate: string }>> {
  let businessDate: string | null = null;
  const result = await collectReservationBoardPages(async after => {
    const page = await fetchPage(after);
    if (!page || !Array.isArray(page.reservations) ||
        !(page.nextCursor === null || typeof page.nextCursor === "string")) {
      throw new Error("The reservation phase response is incomplete.");
    }
    const day = page.businessDate;
    if (typeof day !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(day) ||
        !Number.isFinite(Date.parse(day + "T00:00:00Z")) ||
        new Date(day + "T00:00:00Z").toISOString().slice(0, 10) !== day) {
      throw new Error("No open property business day is available for this phase view.");
    }
    if (businessDate !== null && businessDate !== day) throw new Error("The property business day changed while loading. Refresh this phase view.");
    businessDate = day;
    return page;
  }, maximumPages);
  return Object.freeze({ ...result, businessDate: businessDate! });
}

export function operationalStateLabel(state: string): string {
  if (state === "due_in") return "Expected arrival";
  if (state === "due_out") return "Departure today";
  if (state === "in_house") return "In house";
  if (state === "checked_in_today") return "Checked in today";
  if (state === "stayover") return "Stayover";
  if (state === "checked_out_today") return "Checked out today";
  if (state === "checked_out") return "Departed history";
  return state.replaceAll("_", " ");
}

export function operationalStateDescription(state: string): string {
  if (state === "due_in") return "Due in · expected arrival";
  if (state === "due_out") return "Due out · departure today";
  if (state === "in_house") return "In house · occupied";
  if (state === "checked_in_today") return "Actual check-in completed today";
  if (state === "stayover") return "Continuing in-house stay";
  if (state === "checked_out_today") return "Actual check-out completed today";
  if (state === "checked_out") return "Checked out · departed history";
  return operationalStateLabel(state);
}

/**
 * Exhausts the server's bounded keyset pages without using OFFSET. Repeated or
 * excessive cursors fail closed instead of looping or silently showing a partial
 * hotel list.
 */
export async function collectReservationBoardPages<T>(
  fetchPage: (after: string | null) => Promise<ReservationBoardPage<T>>,
  maximumPages = 50,
): Promise<Readonly<{ reservations: readonly T[] }>> {
  if (!Number.isInteger(maximumPages) || maximumPages < 1 || maximumPages > 100) {
    throw new TypeError("maximumPages must be an integer between 1 and 100");
  }
  const reservations: T[] = [];
  const seen = new Set<string>();
  let after: string | null = null;
  for (let pageNumber = 0; pageNumber < maximumPages; pageNumber += 1) {
    const page = await fetchPage(after);
    reservations.push(...(page.reservations ?? []));
    const next = page.nextCursor ?? null;
    if (next === null) return Object.freeze({ reservations: Object.freeze(reservations) });
    if (typeof next !== "string" || next.length < 1 || seen.has(next)) {
      throw new Error("Reservation pagination returned an invalid cursor");
    }
    seen.add(next);
    after = next;
  }
  throw new Error("Reservation list exceeds the safe page limit");
}
