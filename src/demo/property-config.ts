export type DemoMarketSegmentGroupCode = "CORP" | "OTA" | "WEBSITE" | "TRAVEL_TRADE" | "GROUPS";

export interface DemoRoomClass {
  readonly code: "KING" | "TWIN" | "QUEEN" | "SUITE";
  readonly label: string;
  readonly bedSetup: string;
}

export interface DemoRoomType {
  readonly code: "STD" | "DLX" | "PREM" | "SUITE";
  readonly label: string;
  readonly classCodes: readonly DemoRoomClass["code"][];
  readonly count: number;
  readonly baseOccupancy: number;
  readonly maxOccupancy: number;
  readonly operationalPurpose: string;
}

export interface DemoMealPlan {
  readonly code: "EP" | "CP" | "MAP" | "AP";
  readonly label: string;
  readonly inclusions: readonly string[];
}

export interface DemoCancellationPolicy {
  readonly code: "FLEX_24H" | "NRF" | "GROUP_CUTOFF";
  readonly label: string;
  readonly rule: string;
}

export interface DemoRatePlan {
  readonly code: string;
  readonly label: string;
  readonly marketSegmentGroup: DemoMarketSegmentGroupCode;
  readonly marketSegment: string;
  readonly sourceCodes: readonly string[];
  readonly roomTypeCodes: readonly DemoRoomType["code"][];
  readonly mealPlanCode: DemoMealPlan["code"];
  readonly cancellationPolicyCode: DemoCancellationPolicy["code"];
  readonly packageInclusions: readonly string[];
  readonly operationalPurpose: string;
}

export interface DemoMarketSegment {
  readonly code: string;
  readonly label: string;
  readonly sourceCodes: readonly string[];
  readonly examples: readonly string[];
}

export interface DemoMarketSegmentGroup {
  readonly code: DemoMarketSegmentGroupCode;
  readonly label: string;
  readonly segments: readonly DemoMarketSegment[];
}

export interface DemoSourceChannel {
  readonly code: string;
  readonly label: string;
  readonly kind: "ota" | "direct" | "sales" | "agent" | "events";
  readonly operationalUse: string;
}

export interface DemoCashierPolicy {
  readonly cashierCanReadFolio: true;
  readonly cashierCanPreparePosting: true;
  readonly cashDrawerRequiredForRead: false;
  readonly cashDrawerRequiredForCashSettlement: false;
  readonly postingExecutionEnabled: true;
  readonly settlementExecutionEnabled: true;
  readonly rule: string;
}

export interface DemoSafetyConfiguration {
  readonly publicDemoMutationMode: "governed-proof-routes";
  readonly exactConfirmationPhrase: "CONFIRM YELLOW OPERATION";
  readonly storesPan: false;
  readonly createsFiscalDocuments: false;
  readonly writesJournal: true;
  readonly writesOccupancy: true;
  readonly writesPayment: true;
  readonly notes: readonly string[];
}

export interface DemoPropertyConfiguration {
  readonly property: {
    readonly code: "YELLOW-DEMO";
    readonly name: "Yellow Grand Demo Hotel";
    readonly businessDate: "2026-09-23";
    readonly timezone: "Asia/Kolkata";
    readonly currency: "INR";
    readonly positioning: string;
    readonly inventoryRooms: number;
  };
  readonly roomClasses: readonly DemoRoomClass[];
  readonly roomTypes: readonly DemoRoomType[];
  readonly mealPlans: readonly DemoMealPlan[];
  readonly cancellationPolicies: readonly DemoCancellationPolicy[];
  readonly sourceChannels: readonly DemoSourceChannel[];
  readonly marketSegmentGroups: readonly DemoMarketSegmentGroup[];
  readonly ratePlans: readonly DemoRatePlan[];
  readonly cashierPolicy: DemoCashierPolicy;
  readonly safety: DemoSafetyConfiguration;
  readonly operatorReadModelRules: readonly string[];
}

export function buildDemoPropertyConfiguration(): DemoPropertyConfiguration {
  const roomClasses = Object.freeze([
    roomClass("KING", "King", "one king bed"),
    roomClass("TWIN", "Twin", "two twin beds"),
    roomClass("QUEEN", "Queen", "one queen bed"),
    roomClass("SUITE", "Suite", "suite bedding"),
  ]);
  const roomTypes = Object.freeze([
    roomType("STD", "Standard Room", ["KING", "TWIN"], 44, 2, 3, "Entry product for OTA, direct and group allocations."),
    roomType("DLX", "Deluxe Room", ["KING", "TWIN", "QUEEN"], 46, 2, 3, "Core transient product used by website, OTA and corporate demand."),
    roomType("PREM", "Premium Room", ["KING", "QUEEN"], 22, 2, 3, "Higher ADR product used by corporate negotiated and upsell flows."),
    roomType("SUITE", "Suite", ["SUITE"], 8, 2, 4, "High-value product used for travel trade, VIP and wedding demand."),
  ]);

  return Object.freeze({
    property: Object.freeze({
      code: "YELLOW-DEMO",
      name: "Yellow Grand Demo Hotel",
      businessDate: "2026-09-23",
      timezone: "Asia/Kolkata",
      currency: "INR",
      positioning: "Fictional 120-room full-service city hotel configured for colleague demo operations.",
      inventoryRooms: roomTypes.reduce((sum, room) => sum + room.count, 0),
    }),
    roomClasses,
    roomTypes,
    mealPlans: Object.freeze([
      mealPlan("EP", "Room only", ["stay"]),
      mealPlan("CP", "Breakfast included", ["stay", "breakfast"]),
      mealPlan("MAP", "Breakfast and dinner", ["stay", "breakfast", "dinner"]),
      mealPlan("AP", "All meals", ["stay", "breakfast", "lunch", "dinner"]),
    ]),
    cancellationPolicies: Object.freeze([
      cancellationPolicy("FLEX_24H", "Flexible 24h", "Free cancellation until 24 hours before local-property arrival date."),
      cancellationPolicy("NRF", "Non-refundable", "Charge retained after booking; refund requires approved exception workflow."),
      cancellationPolicy("GROUP_CUTOFF", "Group cutoff", "Unpicked group rooms are reviewed at cutoff and can be washed back to house inventory."),
    ]),
    sourceChannels: Object.freeze([
      source("booking-mobile", "Booking.com mobile", "ota", "OTA production and mobile-origin analysis."),
      source("agoda-mobile", "Agoda mobile", "ota", "Asia OTA production and parity monitoring."),
      source("brand-web", "Brand website", "direct", "Direct web demand and lower distribution cost."),
      source("sales-office", "Sales office", "sales", "Corporate negotiated and group/MICE handling."),
      source("travel-agent", "Travel agent", "agent", "Wholesale FIT and travel-trade handling."),
      source("events-team", "Events team", "events", "Wedding/social/incentive block handling."),
    ]),
    marketSegmentGroups: Object.freeze([
      msg("OTA", "Online travel agencies", [
        segment("BOOKING", "Booking.com", ["booking-mobile"], ["public OTA transient", "mobile OTA"]),
        segment("AGODA", "Agoda", ["agoda-mobile"], ["Asia OTA transient"]),
      ]),
      msg("WEBSITE", "Brand/direct website", [
        segment("BRAND_WEB", "Brand website", ["brand-web"], ["direct retail", "member rate"]),
      ]),
      msg("CORP", "Corporate", [
        segment("CORP_NEG", "Corporate negotiated", ["sales-office"], ["company contracted", "business travel"]),
      ]),
      msg("GROUPS", "Groups", [
        segment("MICE", "MICE", ["sales-office"], ["conference", "corporate group"]),
        segment("SOCIAL", "Social group", ["events-team"], ["wedding", "birthday", "engagement"]),
      ]),
      msg("TRAVEL_TRADE", "Travel trade", [
        segment("WHOLESALE_FIT", "Wholesale FIT", ["travel-agent"], ["agent FIT", "offline package"]),
      ]),
    ]),
    ratePlans: Object.freeze([
      ratePlan("OTA-FLEX-CP", "OTA flexible breakfast", "OTA", "Booking.com", ["booking-mobile", "agoda-mobile"], ["STD", "DLX"], "CP", "FLEX_24H", [
        "breakfast",
        "wifi",
      ], "Default OTA rate used for mobile transient arrivals."),
      ratePlan("WEB-DIRECT-MAP", "Website direct dinner package", "WEBSITE", "Brand website", ["brand-web"], ["DLX", "PREM"], "MAP", "FLEX_24H", [
        "breakfast",
        "dinner credit",
        "late checkout subject to availability",
      ], "Direct package for higher conversion and lower acquisition cost."),
      ratePlan("CORP-BBAR-EP", "Corporate negotiated BAR", "CORP", "Corporate negotiated", ["sales-office"], ["DLX", "PREM"], "EP", "FLEX_24H", [
        "wifi",
        "company billing eligible after approval",
      ], "Business travel rate for approved companies."),
      ratePlan("GRP-MICE-CP", "MICE group breakfast", "GROUPS", "MICE", ["sales-office"], ["STD", "DLX", "PREM"], "CP", "GROUP_CUTOFF", [
        "breakfast",
        "meeting desk handoff",
        "rooming-list import",
      ], "Group block rate connected to pickup, wash and rooming-list workflows."),
      ratePlan("TRADE-SUITE-NRF", "Travel trade suite NRF", "TRAVEL_TRADE", "Wholesale FIT", ["travel-agent"], ["SUITE"], "AP", "NRF", [
        "all meals",
        "agent voucher validation",
      ], "Offline travel-trade package for suite and high-value FIT demand."),
    ]),
    cashierPolicy: Object.freeze({
      cashierCanReadFolio: true,
      cashierCanPreparePosting: true,
      cashDrawerRequiredForRead: false,
      cashDrawerRequiredForCashSettlement: false,
      postingExecutionEnabled: true,
      settlementExecutionEnabled: true,
      rule: "Cashier can read and prepare folio work without a cash drawer; posting and demo cash-marker settlement execute only through reviewed governed routes with exact confirmation.",
    }),
    safety: Object.freeze({
      publicDemoMutationMode: "governed-proof-routes",
      exactConfirmationPhrase: "CONFIRM YELLOW OPERATION",
      storesPan: false,
      createsFiscalDocuments: false,
      writesJournal: true,
      writesOccupancy: true,
      writesPayment: true,
      notes: Object.freeze([
        "Most public demo surfaces are read-only or synthetic overlays.",
        "Reviewed governed proof routes can mutate PostgreSQL PMS truth after exact confirmation.",
        "Real check-in, posting, settlement, checkout, room move, group block status conversion, group pickup, group wash/release and group rooming-list import are exposed only through governed proof routes.",
      ]),
    }),
    operatorReadModelRules: Object.freeze([
      "MSG rolls up to MS; source/channel, company, room type, meal plan and policy are intersections.",
      "Room nights and room revenue are added first; occupancy, ADR and RevPAR are divided once at the requested roll-up.",
      "UI renders this server configuration and must not invent hierarchy or KPI math.",
    ]),
  });
}

function roomClass(code: DemoRoomClass["code"], label: string, bedSetup: string): DemoRoomClass {
  return Object.freeze({ code, label, bedSetup });
}

function roomType(
  code: DemoRoomType["code"],
  label: string,
  classCodes: readonly DemoRoomClass["code"][],
  count: number,
  baseOccupancy: number,
  maxOccupancy: number,
  operationalPurpose: string,
): DemoRoomType {
  return Object.freeze({
    code,
    label,
    classCodes: Object.freeze([...classCodes]),
    count,
    baseOccupancy,
    maxOccupancy,
    operationalPurpose,
  });
}

function mealPlan(code: DemoMealPlan["code"], label: string, inclusions: readonly string[]): DemoMealPlan {
  return Object.freeze({ code, label, inclusions: Object.freeze([...inclusions]) });
}

function cancellationPolicy(code: DemoCancellationPolicy["code"], label: string, rule: string): DemoCancellationPolicy {
  return Object.freeze({ code, label, rule });
}

function source(
  code: string,
  label: string,
  kind: DemoSourceChannel["kind"],
  operationalUse: string,
): DemoSourceChannel {
  return Object.freeze({ code, label, kind, operationalUse });
}

function msg(
  code: DemoMarketSegmentGroupCode,
  label: string,
  segments: readonly DemoMarketSegment[],
): DemoMarketSegmentGroup {
  return Object.freeze({ code, label, segments: Object.freeze([...segments]) });
}

function segment(
  code: string,
  label: string,
  sourceCodes: readonly string[],
  examples: readonly string[],
): DemoMarketSegment {
  return Object.freeze({
    code,
    label,
    sourceCodes: Object.freeze([...sourceCodes]),
    examples: Object.freeze([...examples]),
  });
}

function ratePlan(
  code: string,
  label: string,
  marketSegmentGroup: DemoMarketSegmentGroupCode,
  marketSegment: string,
  sourceCodes: readonly string[],
  roomTypeCodes: readonly DemoRoomType["code"][],
  mealPlanCode: DemoMealPlan["code"],
  cancellationPolicyCode: DemoCancellationPolicy["code"],
  packageInclusions: readonly string[],
  operationalPurpose: string,
): DemoRatePlan {
  return Object.freeze({
    code,
    label,
    marketSegmentGroup,
    marketSegment,
    sourceCodes: Object.freeze([...sourceCodes]),
    roomTypeCodes: Object.freeze([...roomTypeCodes]),
    mealPlanCode,
    cancellationPolicyCode,
    packageInclusions: Object.freeze([...packageInclusions]),
    operationalPurpose,
  });
}
