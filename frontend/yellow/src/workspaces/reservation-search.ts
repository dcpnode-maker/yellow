import type { GroupHeader } from "../group-reservations-api";

/** Filter only the returned page. Group membership is never inferred from stays. */
export function filterGroupSearchRows(rows: readonly GroupHeader[], status: string, kind: string): readonly GroupHeader[] {
  return rows.filter((row) => (!status || row.status === status) && (!kind || row.kind === kind));
}
