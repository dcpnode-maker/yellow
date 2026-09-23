export type ReservationBoardPage<T> = Readonly<{
  reservations?: readonly T[];
  nextCursor?: string | null;
}>;

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
