export type BusinessMixLevel = "hotel" | "msg" | "ms_source" | "room_type";

export interface HotelPerformanceLeaf {
  readonly marketSegmentGroup: "CORP" | "OTA" | "WEBSITE" | "TRAVEL_TRADE" | "GROUPS";
  readonly marketSegment: string;
  readonly source: string;
  readonly roomType: "STD" | "DLX" | "PREM" | "SUITE";
  readonly roomNights: number;
  readonly roomRevenueMinor: number;
}

export interface HotelPerformanceRollup {
  readonly level: BusinessMixLevel;
  readonly key: string;
  readonly label: string;
  readonly roomsAvailable: number | null;
  readonly roomNights: number;
  readonly roomRevenueMinor: number;
  readonly currency: "INR";
  readonly occupancyPct: number | null;
  readonly adrMinor: number | null;
  readonly revparMinor: number | null;
  readonly nullReason: string | null;
}

export interface DemoHotelPerformance {
  readonly property: {
    readonly code: "YELLOW-DEMO";
    readonly name: "Yellow Grand Demo Hotel";
    readonly businessDate: "2026-09-23";
    readonly timezone: "Asia/Kolkata";
    readonly currency: "INR";
  };
  readonly contract: {
    readonly authority: "server-owned-read-model";
    readonly hierarchy: "MSG_TO_MS_ONLY";
    readonly formulas: readonly string[];
    readonly uiRule: string;
  };
  readonly hotel: HotelPerformanceRollup;
  readonly marketSegmentGroups: readonly HotelPerformanceRollup[];
  readonly marketSegmentsAndSources: readonly HotelPerformanceRollup[];
  readonly roomTypes: readonly HotelPerformanceRollup[];
  readonly leaves: readonly HotelPerformanceLeaf[];
}

const ROOMS_AVAILABLE = 120;

const LEAVES: readonly HotelPerformanceLeaf[] = Object.freeze([
  Object.freeze({
    marketSegmentGroup: "OTA",
    marketSegment: "Booking.com",
    source: "mobile",
    roomType: "STD",
    roomNights: 18,
    roomRevenueMinor: 216_000,
  }),
  Object.freeze({
    marketSegmentGroup: "OTA",
    marketSegment: "Agoda",
    source: "mobile",
    roomType: "DLX",
    roomNights: 8,
    roomRevenueMinor: 120_000,
  }),
  Object.freeze({
    marketSegmentGroup: "CORP",
    marketSegment: "Corporate negotiated",
    source: "sales-office",
    roomType: "PREM",
    roomNights: 16,
    roomRevenueMinor: 320_000,
  }),
  Object.freeze({
    marketSegmentGroup: "WEBSITE",
    marketSegment: "Brand website",
    source: "direct-web",
    roomType: "DLX",
    roomNights: 11,
    roomRevenueMinor: 187_000,
  }),
  Object.freeze({
    marketSegmentGroup: "GROUPS",
    marketSegment: "MICE",
    source: "sales-office",
    roomType: "STD",
    roomNights: 24,
    roomRevenueMinor: 264_000,
  }),
  Object.freeze({
    marketSegmentGroup: "TRAVEL_TRADE",
    marketSegment: "Wholesale FIT",
    source: "travel-agent",
    roomType: "SUITE",
    roomNights: 3,
    roomRevenueMinor: 90_000,
  }),
]);

export function buildDemoHotelPerformance(): DemoHotelPerformance {
  const leaves = Object.freeze([...LEAVES]);
  const hotel = rollup("hotel", "hotel:YELLOW-DEMO", "Hotel total", leaves, ROOMS_AVAILABLE);
  const marketSegmentGroups = groupRollups(
    leaves,
    "msg",
    (leaf) => leaf.marketSegmentGroup,
    (key) => key,
  );
  const marketSegmentsAndSources = groupRollups(
    leaves,
    "ms_source",
    (leaf) => `${leaf.marketSegmentGroup}/${leaf.marketSegment}/${leaf.source}`,
    (key) => key,
  );
  const roomTypes = groupRollups(
    leaves,
    "room_type",
    (leaf) => leaf.roomType,
    (key) => key,
  );

  return Object.freeze({
    property: Object.freeze({
      code: "YELLOW-DEMO",
      name: "Yellow Grand Demo Hotel",
      businessDate: "2026-09-23",
      timezone: "Asia/Kolkata",
      currency: "INR",
    }),
    contract: Object.freeze({
      authority: "server-owned-read-model" as const,
      hierarchy: "MSG_TO_MS_ONLY" as const,
      formulas: Object.freeze([
        "occupancy_pct = room_nights / rooms_available * 100",
        "ADR = room_revenue / actual_room_nights",
        "RevPAR = room_revenue / rooms_available",
      ]),
      uiRule: "UI renders this read model and never recomputes hotel hierarchy or KPI ratios from partial frontend rows.",
    }),
    hotel,
    marketSegmentGroups: Object.freeze(marketSegmentGroups),
    marketSegmentsAndSources: Object.freeze(marketSegmentsAndSources),
    roomTypes: Object.freeze(roomTypes),
    leaves,
  });
}

function groupRollups(
  leaves: readonly HotelPerformanceLeaf[],
  level: Exclude<BusinessMixLevel, "hotel">,
  keyOf: (leaf: HotelPerformanceLeaf) => string,
  labelOf: (key: string) => string,
): readonly HotelPerformanceRollup[] {
  const grouped = new Map<string, HotelPerformanceLeaf[]>();
  for (const leaf of leaves) {
    const key = keyOf(leaf);
    grouped.set(key, [...(grouped.get(key) ?? []), leaf]);
  }
  return [...grouped.entries()]
    .map(([key, groupLeaves]) => rollup(level, `${level}:${key}`, labelOf(key), groupLeaves, null))
    .sort((left, right) => right.roomRevenueMinor - left.roomRevenueMinor || left.label.localeCompare(right.label));
}

function rollup(
  level: BusinessMixLevel,
  key: string,
  label: string,
  leaves: readonly HotelPerformanceLeaf[],
  roomsAvailable: number | null,
): HotelPerformanceRollup {
  const roomNights = leaves.reduce((sum, leaf) => sum + leaf.roomNights, 0);
  const roomRevenueMinor = leaves.reduce((sum, leaf) => sum + leaf.roomRevenueMinor, 0);
  const occupancyPct = roomsAvailable === null || roomsAvailable <= 0 ? null : round2((roomNights / roomsAvailable) * 100);
  const adrMinor = roomNights <= 0 ? null : Math.round(roomRevenueMinor / roomNights);
  const revparMinor = roomsAvailable === null || roomsAvailable <= 0 ? null : Math.round(roomRevenueMinor / roomsAvailable);
  const nullReason = roomsAvailable === null ? "DEMAND_SCOPE_HAS_NO_INVENTORY_DENOMINATOR" : roomNights <= 0 ? "ADR_NO_ACTUAL_NIGHTS" : null;

  return Object.freeze({
    level,
    key,
    label,
    roomsAvailable,
    roomNights,
    roomRevenueMinor,
    currency: "INR",
    occupancyPct,
    adrMinor,
    revparMinor,
    nullReason,
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
