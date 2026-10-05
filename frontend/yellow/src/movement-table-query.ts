import { createMovementQuery, filterAndSortMovementRows, movementGuestAttributes, movementNights, RESERVATION_BOARD_CAPABILITIES, type MovementQuery, type MovementRowLike, type MovementSortKey } from "./today-workspace";
import { operationalStateLabel } from "./reservation-board";
import { queryTableRows, type TableColumn, type TableFilter, type TableQuery } from "./table-query";

export type MovementLane = "due_in" | "due_out" | "in_house";
type BoardRow = MovementRowLike & Readonly<{ sourceCode?: string | null; marketCode?: string | null }>;
export type MovementColumn = TableColumn<BoardRow> & Readonly<{ width: number; initial: boolean }>;

const localTime = (value: string | null | undefined, formatter: Intl.DateTimeFormat): string => {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return formatter.format(new Date(value));
};

/** Display/filter values only. Sorting remains the canonical movement comparator. */
export function movementColumns(direction: MovementQuery["movementTime"], timezone: string, includeDate = false): readonly MovementColumn[] {
  const timeOptions = { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h12" } as const;
  const dateOptions = { day: "2-digit", month: "short", year: "numeric" } as const;
  const movementFormatter = new Intl.DateTimeFormat("en-IN", { ...timeOptions, ...(includeDate ? dateOptions : {}) });
  const dateFormatter = new Intl.DateTimeFormat("en-IN", { ...timeOptions, ...dateOptions });
  return [
    { key: "eta", label: direction === "departure" ? "Departure" : "Arrival", width: includeDate ? 170 : 108, initial: true, value: row => localTime(direction === "departure" ? row.stayTo : row.arrivalTravel?.scheduledAt ?? row.stayFrom, movementFormatter) },
    { key: "guest", label: "Guest", width: 180, initial: true, value: row => row.primaryGuestDisplayName ?? row.primaryPartyName },
    { key: "confirmation", label: "Reservation", width: 132, initial: true, value: row => row.confirmationNo },
    { key: "arrival", label: "Stay from", width: 174, initial: false, value: row => localTime(row.stayFrom, dateFormatter) },
    { key: "departure", label: "Stay to", width: 174, initial: true, value: row => localTime(row.stayTo, dateFormatter) },
    { key: "nights", label: "Nights", width: 84, initial: true, value: row => movementNights(row) },
    { key: "roomType", label: "Room type", width: 145, initial: true, value: row => row.unitTypeLabel },
    { key: "roomTypeCode", label: "Room type code", width: 140, initial: false, value: row => row.unitTypeCode },
    { key: "room", label: "Assigned room", width: 140, initial: true, value: row => row.sellableUnitLabel },
    { key: "rateCode", label: "Rate code", width: 115, initial: true, value: row => row.ratePlanCode },
    { key: "rate", label: "Rate plan", width: 140, initial: true, value: row => row.ratePlanLabel },
    // The established "source" sort/filter key means channelCode. Never relabel it Source.
    { key: "source", label: "Channel", width: 115, initial: true, value: row => row.channelCode },
    { key: "sourceCode", label: "Source", width: 115, initial: true, value: row => row.sourceCode },
    { key: "marketCode", label: "Market", width: 115, initial: false, value: row => row.marketCode },
    { key: "adults", label: "Adults", width: 90, initial: false, value: row => row.adults },
    { key: "children", label: "Children", width: 95, initial: false, value: row => row.children },
    { key: "status", label: "Status", width: 145, initial: true, value: row => operationalStateLabel(row.operationalState ?? row.status ?? "") },
  ];
}

export function movementTableQuery(query: MovementQuery, filters: readonly TableFilter[]): TableQuery {
  return { search: query.search, filters, sorts: query.sorts.map(sort => ({ column: sort.key, direction: sort.direction })) };
}

export function applyMovementTableQuery(query: MovementQuery, table: TableQuery): Readonly<{ query: MovementQuery; filters: readonly TableFilter[] }> {
  const keys: readonly string[] = RESERVATION_BOARD_CAPABILITIES.sorts;
  if (table.sorts.some(sort => !keys.includes(sort.column) || (sort.direction !== "asc" && sort.direction !== "desc")) || new Set(table.sorts.map(sort => sort.column)).size !== table.sorts.length) throw new TypeError("Unsupported movement sort");
  return { query: createMovementQuery(query.movementTime, { ...query, search: table.search, sorts: table.sorts.map(sort => ({ key: sort.column as MovementSortKey, direction: sort.direction })) }), filters: table.filters };
}

export function queryMovementTableRows<T extends BoardRow>(rows: readonly T[], query: MovementQuery, filters: readonly TableFilter[], timezone: string, includeDate = false): readonly T[] {
  const filtered = filterAndSortMovementRows(rows, query, query.sorts, query.movementTime, timezone);
  // Existing travel-aware search, date predicates and sort precedence run exactly once.
  return queryTableRows(filtered, movementColumns(query.movementTime, timezone, includeDate), { search: "", filters, sorts: [] });
}

export const movementLaneFromSearch = (search: string): MovementLane | null => {
  const lane = new URLSearchParams(search).get("lane");
  return lane === "due_in" || lane === "due_out" || lane === "in_house" ? lane : null;
};
export function movementLaneUrl(href: string, lane: MovementLane | null): string {
  const url = new URL(href);
  if (lane) url.searchParams.set("lane", lane); else url.searchParams.delete("lane");
  return `${url.pathname}${url.search}${url.hash}`;
}

export { movementGuestAttributes };
