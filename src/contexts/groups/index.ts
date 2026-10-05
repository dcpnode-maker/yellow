export type GroupKind = "linked" | "block" | "share";
export type BlockStatusCode = "prospect" | "tentative" | "definite" | "cancelled";

export interface BlockStatusDefinition {
  readonly code: BlockStatusCode;
  readonly label: string;
  readonly deductsInventory: boolean;
  readonly sort: number;
}

export interface WashRule {
  readonly daysBeforeArrival: number;
  readonly releasePct: number;
}

export interface BlockAllotmentNight {
  readonly stayDate: string;
  readonly unitTypeCode: string;
  readonly blocked: number;
  readonly pickedUp: number;
  readonly rateMinor: number;
  readonly currency: "INR";
}

export interface RoomingListSummary {
  readonly expectedRooms: number;
  readonly namedRooms: number;
  readonly unnamedRooms: number;
  readonly importStatus: "not_started" | "partial" | "complete";
}

export interface ReservationGroupBlock {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly kind: GroupKind;
  readonly status: BlockStatusCode;
  readonly arrivalDate: string;
  readonly cutoffDate: string;
  readonly accountName: string;
  readonly marketSegmentGroup: "GROUPS";
  readonly marketSegment: string;
  readonly source: string;
  readonly elastic: boolean;
  readonly washSchedule: readonly WashRule[];
  readonly allotment: readonly BlockAllotmentNight[];
  readonly roomingList: RoomingListSummary;
}

export interface BlockNightRuntime {
  readonly stayDate: string;
  readonly unitTypeCode: string;
  readonly blocked: number;
  readonly pickedUp: number;
  readonly remainingBeforeWash: number;
  readonly washed: number;
  readonly availableForPickup: number;
  readonly rateMinor: number;
  readonly currency: "INR";
}

export interface GroupBlockRuntime {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly kind: GroupKind;
  readonly status: BlockStatusCode;
  readonly statusLabel: string;
  readonly deductsHouseInventory: boolean;
  readonly accountName: string;
  readonly marketSegmentGroup: "GROUPS";
  readonly marketSegment: string;
  readonly source: string;
  readonly arrivalDate: string;
  readonly cutoffDate: string;
  readonly elastic: boolean;
  readonly roomingList: RoomingListSummary;
  readonly totals: {
    readonly blocked: number;
    readonly pickedUp: number;
    readonly remainingBeforeWash: number;
    readonly washed: number;
    readonly availableForPickup: number;
  };
  readonly nights: readonly BlockNightRuntime[];
  readonly operationalPurpose: string;
}

export interface GroupBlocksWorkbench {
  readonly property: {
    readonly code: string;
    readonly name: string;
    readonly businessDate: string;
  };
  readonly statusDefinitions: readonly BlockStatusDefinition[];
  readonly blocks: readonly GroupBlockRuntime[];
  readonly invariants: readonly string[];
}

export interface GroupBlockManagerAction {
  readonly id: string;
  readonly label: string;
  readonly operationalPurpose: string;
  readonly requiresConfirmation: true;
  readonly executionEnabled: false;
  readonly affects: readonly string[];
}

export interface GroupBlockManagerItem extends GroupBlockRuntime {
  readonly releaseRisk: "none" | "watch" | "urgent";
  readonly roomingListGap: number;
  readonly nextOperationalStep: string;
  readonly actions: readonly GroupBlockManagerAction[];
}

export interface GroupBlockManager {
  readonly property: GroupBlocksWorkbench["property"];
  readonly purpose: string;
  readonly statusDefinitions: readonly BlockStatusDefinition[];
  readonly blocks: readonly GroupBlockManagerItem[];
  readonly operatingRules: readonly string[];
}

export const DEMO_BLOCK_STATUS_DEFINITIONS: readonly BlockStatusDefinition[] = Object.freeze([
  Object.freeze({ code: "prospect", label: "Prospect", deductsInventory: false, sort: 10 }),
  Object.freeze({ code: "tentative", label: "Tentative", deductsInventory: false, sort: 20 }),
  Object.freeze({ code: "definite", label: "Definite", deductsInventory: true, sort: 30 }),
  Object.freeze({ code: "cancelled", label: "Cancelled", deductsInventory: false, sort: 90 }),
]);

export const DEMO_GROUP_BLOCKS: readonly ReservationGroupBlock[] = Object.freeze([
  Object.freeze({
    id: "grp-mice-2026-09-ycc",
    code: "YCC-0926",
    name: "Yellow Cloud Conference",
    kind: "block",
    status: "definite",
    arrivalDate: "2026-09-27",
    cutoffDate: "2026-09-24",
    accountName: "Yellow Cloud Events Pvt Ltd",
    marketSegmentGroup: "GROUPS",
    marketSegment: "MICE",
    source: "direct-sales",
    elastic: false,
    washSchedule: Object.freeze([Object.freeze({ daysBeforeArrival: 3, releasePct: 25 })]),
    roomingList: Object.freeze({
      expectedRooms: 20,
      namedRooms: 14,
      unnamedRooms: 6,
      importStatus: "partial",
    }),
    allotment: Object.freeze([
      Object.freeze({ stayDate: "2026-09-27", unitTypeCode: "DLX", blocked: 12, pickedUp: 8, rateMinor: 850000, currency: "INR" }),
      Object.freeze({ stayDate: "2026-09-27", unitTypeCode: "KING", blocked: 8, pickedUp: 6, rateMinor: 950000, currency: "INR" }),
      Object.freeze({ stayDate: "2026-09-28", unitTypeCode: "DLX", blocked: 12, pickedUp: 8, rateMinor: 850000, currency: "INR" }),
      Object.freeze({ stayDate: "2026-09-28", unitTypeCode: "KING", blocked: 8, pickedUp: 6, rateMinor: 950000, currency: "INR" }),
    ]),
  }),
  Object.freeze({
    id: "grp-social-2026-10-mehra",
    code: "MEHRA-WED",
    name: "Mehra Wedding",
    kind: "block",
    status: "tentative",
    arrivalDate: "2026-10-03",
    cutoffDate: "2026-09-28",
    accountName: "Mehra Family",
    marketSegmentGroup: "GROUPS",
    marketSegment: "Social",
    source: "events-team",
    elastic: true,
    washSchedule: Object.freeze([Object.freeze({ daysBeforeArrival: 5, releasePct: 50 })]),
    roomingList: Object.freeze({
      expectedRooms: 16,
      namedRooms: 0,
      unnamedRooms: 16,
      importStatus: "not_started",
    }),
    allotment: Object.freeze([
      Object.freeze({ stayDate: "2026-10-03", unitTypeCode: "DLX", blocked: 10, pickedUp: 0, rateMinor: 780000, currency: "INR" }),
      Object.freeze({ stayDate: "2026-10-03", unitTypeCode: "SUITE", blocked: 6, pickedUp: 0, rateMinor: 1800000, currency: "INR" }),
    ]),
  }),
]);

export function buildGroupBlocksWorkbench(today: string): GroupBlocksWorkbench {
  return Object.freeze({
    property: Object.freeze({
      code: "YELLOW-DEMO",
      name: "Yellow Grand Demo Hotel",
      businessDate: today,
    }),
    statusDefinitions: DEMO_BLOCK_STATUS_DEFINITIONS,
    blocks: DEMO_GROUP_BLOCKS.map((block) => buildGroupBlockRuntime(block, today)),
    invariants: Object.freeze([
      "Block status deduction is configuration, not hard-coded workflow magic.",
      "Pickup consumes block allotment first; house inventory remains PostgreSQL-authoritative.",
      "Wash releases only remaining unpicked allotment and never creates negative rooms.",
      "Rooming-list import readiness is tracked separately from fiscal/folio posting.",
    ]),
  });
}

export function buildGroupBlockManager(today: string): GroupBlockManager {
  const workbench = buildGroupBlocksWorkbench(today);
  return Object.freeze({
    property: workbench.property,
    purpose: "Manage group reservations from enquiry to block, pickup, rooming-list completion, wash/release and checkout handoff.",
    statusDefinitions: workbench.statusDefinitions,
    blocks: Object.freeze(workbench.blocks.map((block) => buildManagerItem(block, today))),
    operatingRules: Object.freeze([
      "Prospect and tentative groups remain visible pipeline but do not deduct house inventory.",
      "Definite groups deduct house inventory by configured status and date/unit-type allotment.",
      "Pickup converts block demand into named or placeholder reservations against the block before house inventory.",
      "Wash/release only returns remaining unpicked rooms; it never reduces already picked-up rooms.",
      "Rooming-list gaps are operational blockers, not financial postings.",
    ]),
  });
}

export function buildGroupBlockRuntime(block: ReservationGroupBlock, today: string): GroupBlockRuntime {
  const status = findStatus(block.status);
  const nights = block.allotment.map((night) => buildNightRuntime(night, block, today));
  const totals = nights.reduce(
    (acc, night) => ({
      blocked: acc.blocked + night.blocked,
      pickedUp: acc.pickedUp + night.pickedUp,
      remainingBeforeWash: acc.remainingBeforeWash + night.remainingBeforeWash,
      washed: acc.washed + night.washed,
      availableForPickup: acc.availableForPickup + night.availableForPickup,
    }),
    { blocked: 0, pickedUp: 0, remainingBeforeWash: 0, washed: 0, availableForPickup: 0 },
  );
  return Object.freeze({
    id: block.id,
    code: block.code,
    name: block.name,
    kind: block.kind,
    status: block.status,
    statusLabel: status.label,
    deductsHouseInventory: status.deductsInventory,
    accountName: block.accountName,
    marketSegmentGroup: block.marketSegmentGroup,
    marketSegment: block.marketSegment,
    source: block.source,
    arrivalDate: block.arrivalDate,
    cutoffDate: block.cutoffDate,
    elastic: block.elastic,
    roomingList: block.roomingList,
    totals: Object.freeze(totals),
    nights: Object.freeze(nights),
    operationalPurpose: status.deductsInventory
      ? "Controls contracted group pickup against allocated block rooms before unsold rooms return to house availability."
      : "Tracks sales pipeline demand without deducting house inventory until status changes to a deducting block status.",
  });
}

function buildNightRuntime(night: BlockAllotmentNight, block: ReservationGroupBlock, today: string): BlockNightRuntime {
  const remainingBeforeWash = Math.max(0, night.blocked - night.pickedUp);
  const washed = Math.min(remainingBeforeWash, calculateWashRooms(block, today, remainingBeforeWash));
  return Object.freeze({
    stayDate: night.stayDate,
    unitTypeCode: night.unitTypeCode,
    blocked: night.blocked,
    pickedUp: night.pickedUp,
    remainingBeforeWash,
    washed,
    availableForPickup: remainingBeforeWash - washed,
    rateMinor: night.rateMinor,
    currency: night.currency,
  });
}

function buildManagerItem(block: GroupBlockRuntime, today: string): GroupBlockManagerItem {
  const roomingListGap = block.roomingList.unnamedRooms;
  const releaseRisk = block.totals.availableForPickup === 0
    ? "none"
    : daysBetween(today, block.cutoffDate) <= 1
      ? "urgent"
      : block.roomingList.importStatus === "partial"
        ? "watch"
        : "none";
  const nextOperationalStep = releaseRisk === "urgent"
    ? "Review cutoff today and release or protect remaining rooms."
    : roomingListGap > 0
      ? "Complete rooming list names before arrival."
      : block.totals.availableForPickup > 0
        ? "Continue pickup monitoring by date and room type."
        : "No immediate block action required.";

  return Object.freeze({
    ...block,
    releaseRisk,
    roomingListGap,
    nextOperationalStep,
    actions: Object.freeze([
      managerAction("pickup-from-block", "Pickup from block", "Create or attach reservations against selected date/unit-type allotment.", [
        "reservation",
        "block_allotment",
        "occupancy_hold",
      ]),
      managerAction("import-rooming-list", "Import rooming list", "Attach guest names and sharing/room preferences to expected rooms.", [
        "guest_profile",
        "reservation_party",
        "rooming_list",
      ]),
      managerAction("wash-or-release", "Wash/release unpicked rooms", "Return unpicked rooms to house availability according to cutoff and wash rules.", [
        "block_allotment",
        "availability_projection",
      ]),
      managerAction("convert-status", "Change block status", "Move prospect/tentative/definite/cancelled status with inventory deduction rules reread.", [
        "block_status",
        "availability_projection",
      ]),
    ]),
  });
}

function managerAction(
  id: string,
  label: string,
  operationalPurpose: string,
  affects: readonly string[],
): GroupBlockManagerAction {
  return Object.freeze({
    id,
    label,
    operationalPurpose,
    requiresConfirmation: true,
    executionEnabled: false,
    affects: Object.freeze([...affects]),
  });
}

function calculateWashRooms(block: ReservationGroupBlock, today: string, remainingBeforeWash: number): number {
  if (remainingBeforeWash <= 0) return 0;
  const daysUntilArrival = daysBetween(today, block.arrivalDate);
  const activeRules = block.washSchedule.filter((rule) => daysUntilArrival <= rule.daysBeforeArrival);
  if (activeRules.length === 0) return 0;
  const releasePct = Math.max(...activeRules.map((rule) => rule.releasePct));
  return Math.min(remainingBeforeWash, Math.floor((remainingBeforeWash * releasePct) / 100));
}

function findStatus(code: BlockStatusCode): BlockStatusDefinition {
  const status = DEMO_BLOCK_STATUS_DEFINITIONS.find((candidate) => candidate.code === code);
  if (status === undefined) {
    throw new Error(`Missing block status definition: ${code}`);
  }
  return status;
}

function daysBetween(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00.000Z`);
  const to = Date.parse(`${toDate}T00:00:00.000Z`);
  return Math.ceil((to - from) / 86_400_000);
}
