export type Variance = Readonly<{
  direction: "up" | "down" | "flat";
  percent: number;
}>;

export type MovementSortKey = "eta" | "guest" | "confirmation" | "nights" | "room" | "source" | "rate" | "adults" | "children";
export type MovementSort = Readonly<{ key: MovementSortKey; direction: "asc" | "desc" }>;
export type RecordedPresence = "all" | "present" | "absent";
export type TravelEvidence = "all" | "recorded" | "not_recorded";
export type PickupEvidence = "all" | "requested" | "not_recorded";
export type MovementQuery = Readonly<{
  movementTime: "arrival" | "departure";
  search: string;
  source: string;
  assignment: "all" | "assigned" | "unassigned";
  state: string;
  roomType: string;
  ratePlan: string;
  dateFrom: string;
  dateTo: string;
  minAdults: number | null;
  children: RecordedPresence;
  travel: TravelEvidence;
  pickup: PickupEvidence;
  sorts: readonly MovementSort[];
}>;

export const RESERVATION_BOARD_CAPABILITIES = Object.freeze({
  filters: Object.freeze([
    "search", "state", "source", "assignment", "roomType", "ratePlan", "dateRange",
    "minAdults", "children", "travel", "pickup",
  ] as const),
  sorts: Object.freeze([
    "eta", "guest", "confirmation", "nights", "room", "source", "rate", "adults", "children",
  ] as const satisfies readonly MovementSortKey[]),
});

/** One query contract drives manual controls and deterministic Yellow reads. */
export function createMovementQuery(
  movementTime: MovementQuery["movementTime"],
  overrides: Partial<Omit<MovementQuery, "movementTime">> = {},
): MovementQuery {
  const sorts = overrides.sorts ?? [
    { key: "eta", direction: "asc" },
    { key: "guest", direction: "asc" },
  ];
  return Object.freeze({
    movementTime,
    search: overrides.search ?? "",
    source: overrides.source ?? "",
    assignment: overrides.assignment ?? "all",
    state: overrides.state ?? "",
    roomType: overrides.roomType ?? "",
    ratePlan: overrides.ratePlan ?? "",
    dateFrom: overrides.dateFrom ?? "",
    dateTo: overrides.dateTo ?? "",
    minAdults: overrides.minAdults ?? null,
    children: overrides.children ?? "all",
    travel: overrides.travel ?? "all",
    pickup: overrides.pickup ?? "all",
    sorts: Object.freeze(sorts.map((sort) => Object.freeze({ ...sort }))),
  });
}
export type MovementRowLike = Readonly<{
  reservationId: string;
  confirmationNo: string;
  primaryGuestDisplayName?: string;
  primaryPartyName?: string;
  stayFrom?: string;
  stayTo?: string;
  sellableUnitLabel?: string | null;
  unitTypeLabel?: string | null;
  ratePlanLabel?: string | null;
  channelCode?: string;
  status?: string;
  operationalState?: string;
  adults?: number;
  children?: number;
  arrivalTravel?: Readonly<{
    scheduledAt?: string | null;
    mode?: string | null;
    carrier?: string | null;
    serviceNo?: string | null;
    pickupRequested?: boolean;
  }> | null;
  departureTravel?: Readonly<{
    scheduledAt?: string | null;
    mode?: string | null;
    carrier?: string | null;
    serviceNo?: string | null;
    pickupRequested?: boolean;
  }> | null;
}>;

export function propertyLocalGreeting(now: Date, timezone: string): Readonly<{ greeting: string; time: string }> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return Object.freeze({
    greeting,
    time: new Intl.DateTimeFormat("en-IN", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
    }).format(now),
  });
}

export function metricVariance(actual: number, baseline: number): Variance | null {
  if (!Number.isFinite(actual) || !Number.isFinite(baseline) || baseline === 0) return null;
  const raw = (actual - baseline) / Math.abs(baseline) * 100;
  const percent = Math.round(Math.abs(raw) * 10) / 10;
  return Object.freeze({ direction: raw > 0 ? "up" : raw < 0 ? "down" : "flat", percent });
}

function nights(row: MovementRowLike): number {
  const from = row.stayFrom ? new Date(row.stayFrom).getTime() : Number.NaN;
  const to = row.stayTo ? new Date(row.stayTo).getTime() : Number.NaN;
  return Number.isFinite(from) && Number.isFinite(to) ? Math.max(0, Math.round((to - from) / 86_400_000)) : 0;
}

function value(row: MovementRowLike, key: MovementSortKey, movementTime: "arrival" | "departure"): string | number {
  if (key === "eta") return movementTime === "departure" ? row.stayTo ?? "" : row.arrivalTravel?.scheduledAt ?? row.stayFrom ?? "";
  if (key === "guest") return row.primaryGuestDisplayName ?? row.primaryPartyName ?? "";
  if (key === "confirmation") return row.confirmationNo;
  if (key === "nights") return nights(row);
  if (key === "room") return row.sellableUnitLabel ?? row.unitTypeLabel ?? "";
  if (key === "source") return row.channelCode ?? "";
  if (key === "adults") return row.adults ?? -1;
  if (key === "children") return row.children ?? -1;
  return row.ratePlanLabel ?? "";
}

function directionalTravel(
  row: MovementRowLike,
  movementTime: "arrival" | "departure",
): MovementRowLike["arrivalTravel"] {
  return movementTime === "departure" ? row.departureTravel : row.arrivalTravel;
}

function hasTravelEvidence(travel: MovementRowLike["arrivalTravel"]): boolean {
  return Boolean(
    travel &&
    (travel.scheduledAt || travel.mode || travel.carrier || travel.serviceNo || travel.pickupRequested === true),
  );
}

function propertyDateKey(row: MovementRowLike, movementTime: "arrival" | "departure", timezone: string): string {
  const raw = movementTime === "departure" ? row.stayTo : row.arrivalTravel?.scheduledAt ?? row.stayFrom;
  if (!raw) return "";
  const instant = new Date(raw);
  if (!Number.isFinite(instant.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function filterAndSortMovementRows<T extends MovementRowLike>(
  rows: readonly T[],
  filters: Readonly<{
    search: string;
    source: string;
    assignment: "all" | "assigned" | "unassigned";
    state?: string;
    roomType?: string;
    ratePlan?: string;
    dateFrom?: string;
    dateTo?: string;
    minAdults?: number | null;
    children?: RecordedPresence;
    travel?: TravelEvidence;
    pickup?: PickupEvidence;
  }>,
  sorts: readonly MovementSort[],
  movementTime: "arrival" | "departure" = "arrival",
  timezone = "UTC",
): readonly T[] {
  const needle = filters.search.trim().toLocaleLowerCase();
  const filtered = rows.filter((row) => {
    const assigned = Boolean(row.sellableUnitLabel);
    if (filters.state && (row.operationalState ?? row.status) !== filters.state) return false;
    if (filters.assignment === "assigned" && !assigned) return false;
    if (filters.assignment === "unassigned" && assigned) return false;
    if (filters.source && row.channelCode !== filters.source) return false;
    if (filters.roomType && row.unitTypeLabel !== filters.roomType) return false;
    if (filters.ratePlan && row.ratePlanLabel !== filters.ratePlan) return false;
    if (filters.minAdults !== null && filters.minAdults !== undefined && (row.adults ?? -1) < filters.minAdults) return false;
    if (filters.children === "present" && (row.children ?? 0) < 1) return false;
    if (filters.children === "absent" && row.children !== 0) return false;
    const travel = directionalTravel(row, movementTime);
    const travelRecorded = hasTravelEvidence(travel);
    if (filters.travel === "recorded" && !travelRecorded) return false;
    if (filters.travel === "not_recorded" && travelRecorded) return false;
    if (filters.pickup === "requested" && travel?.pickupRequested !== true) return false;
    if (filters.pickup === "not_recorded" && travel?.pickupRequested === true) return false;
    if (filters.dateFrom || filters.dateTo) {
      const date = propertyDateKey(row, movementTime, timezone);
      if (!date) return false;
      if (filters.dateFrom && date < filters.dateFrom) return false;
      if (filters.dateTo && date > filters.dateTo) return false;
    }
    if (!needle) return true;
    return [row.primaryGuestDisplayName, row.primaryPartyName, row.confirmationNo, row.sellableUnitLabel,
      row.unitTypeLabel, row.ratePlanLabel, row.channelCode, row.operationalState,
      travel?.mode, travel?.carrier, travel?.serviceNo,
      [travel?.mode, travel?.carrier, travel?.serviceNo].filter(Boolean).join(" "),
      travel?.pickupRequested ? "pickup requested" : undefined]
      .some((candidate) => candidate?.toLocaleLowerCase().includes(needle));
  });
  const active = sorts.length ? sorts : [{ key: "eta", direction: "asc" } as const];
  return Object.freeze(filtered.map((row, index) => ({ row, index })).sort((left, right) => {
    for (const sort of active) {
      const a = value(left.row, sort.key, movementTime);
      const b = value(right.row, sort.key, movementTime);
      const compared = typeof a === "number" && typeof b === "number"
        ? a - b
        : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
      if (compared !== 0) return sort.direction === "asc" ? compared : -compared;
    }
    return left.index - right.index || left.row.reservationId.localeCompare(right.row.reservationId);
  }).map(({ row }) => row));
}

export function movementNights(row: MovementRowLike): number { return nights(row); }

export function movementGuestAttributes(
  row: MovementRowLike,
  movementTime: "arrival" | "departure",
): string {
  const details: string[] = [];
  if (Number.isSafeInteger(row.adults) && row.adults !== undefined && row.adults >= 0) {
    details.push(`${row.adults} adult${row.adults === 1 ? "" : "s"}`);
  }
  if (Number.isSafeInteger(row.children) && row.children !== undefined && row.children > 0) {
    details.push(`${row.children} child${row.children === 1 ? "" : "ren"}`);
  }
  const travel = movementTime === "departure" ? row.departureTravel : row.arrivalTravel;
  const journey = [travel?.mode, travel?.carrier, travel?.serviceNo].filter((item): item is string => Boolean(item));
  if (journey.length) details.push(journey.join(" "));
  if (travel?.scheduledAt && !journey.length) details.push("travel time recorded");
  if (travel?.pickupRequested) details.push("pickup requested");
  if (!details.length) return "Guest/travel details unavailable";
  if (!hasTravelEvidence(travel)) details.push("travel not recorded");
  return details.join(" · ");
}
