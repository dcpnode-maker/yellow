export type DemoRoleCode = "front_desk_agent" | "cashier" | "front_office_manager" | "housekeeping_supervisor";
export type DemoQueueStatus = "clear" | "watch" | "blocked" | "ready";

export interface DemoRolePermission {
  readonly role: DemoRoleCode;
  readonly label: string;
  readonly canReadFolio: boolean;
  readonly canPrepareCashierWork: boolean;
  readonly canPostCharge: boolean;
  readonly canSettlePayment: boolean;
  readonly cashDrawerRequiredForRead: false;
  readonly notes: readonly string[];
}

export interface DemoBoardAction {
  readonly id: string;
  readonly label: string;
  readonly roleRequired: DemoRoleCode;
  readonly requiresConfirmation: true;
  readonly confirmationPhrase: "CONFIRM YELLOW OPERATION";
  readonly executionEnabled: false;
  readonly cashDrawerRequired: boolean;
  readonly reasonDisabled: string;
}

export interface DemoArrivalItem {
  readonly reservationCode: string;
  readonly guestName: string;
  readonly room: string;
  readonly roomStatus: "inspected" | "clean" | "dirty" | "pickup";
  readonly marketSegmentGroup: string;
  readonly marketSegment: string;
  readonly source: string;
  readonly balanceMinor: number;
  readonly blockers: readonly string[];
  readonly actions: readonly DemoBoardAction[];
}

export interface DemoStayItem {
  readonly reservationCode: string;
  readonly guestName: string;
  readonly room: string;
  readonly serviceState: "none" | "open_task" | "vip_watch";
  readonly folioBalanceMinor: number;
}

export interface DemoDepartureItem {
  readonly reservationCode: string;
  readonly guestName: string;
  readonly room: string;
  readonly checkoutStatus: DemoQueueStatus;
  readonly openBalanceMinor: number;
  readonly actions: readonly DemoBoardAction[];
}

export interface DemoRoomStatusSummary {
  readonly inspected: number;
  readonly clean: number;
  readonly dirty: number;
  readonly pickup: number;
  readonly outOfOrder: number;
}

export interface DemoFrontDeskBoard {
  readonly property: {
    readonly code: "YELLOW-DEMO";
    readonly name: "Yellow Grand Demo Hotel";
    readonly businessDate: "2026-09-23";
    readonly timezone: "Asia/Kolkata";
  };
  readonly headline: {
    readonly dueIn: number;
    readonly inHouse: number;
    readonly dueOut: number;
    readonly roomsNeedingAttention: number;
    readonly cashierExceptions: number;
  };
  readonly rolePermissions: readonly DemoRolePermission[];
  readonly roomStatus: DemoRoomStatusSummary;
  readonly arrivals: readonly DemoArrivalItem[];
  readonly inHouse: readonly DemoStayItem[];
  readonly departures: readonly DemoDepartureItem[];
  readonly operatingRules: readonly string[];
}

const DISABLED_REASON = "Public demo action is confirmation-gated and disabled until database-backed command proof is connected.";

export function buildDemoFrontDeskBoard(): DemoFrontDeskBoard {
  const arrivals: readonly DemoArrivalItem[] = Object.freeze([
    Object.freeze({
      reservationCode: "L3R-HX-0126",
      guestName: "Sara Al Harbi",
      room: "303",
      roomStatus: "inspected",
      marketSegmentGroup: "OTA",
      marketSegment: "Booking.com",
      source: "mobile",
      balanceMinor: 0,
      blockers: Object.freeze([]),
      actions: Object.freeze([
        boardAction("check-in-arrival", "Check in guest", "front_desk_agent", false),
        boardAction("post-charge", "Post charge", "cashier", false),
      ]),
    }),
    Object.freeze({
      reservationCode: "YCC-0926-014",
      guestName: "Anika Rao",
      room: "418",
      roomStatus: "clean",
      marketSegmentGroup: "GROUPS",
      marketSegment: "MICE",
      source: "direct-sales",
      balanceMinor: 0,
      blockers: Object.freeze(["rooming_list_name_pending"]),
      actions: Object.freeze([
        boardAction("import-rooming-list", "Complete rooming-list name", "front_desk_agent", false),
        boardAction("check-in-arrival", "Check in after name completion", "front_desk_agent", false),
      ]),
    }),
    Object.freeze({
      reservationCode: "CORP-7712",
      guestName: "Dev Mehta",
      room: "512",
      roomStatus: "dirty",
      marketSegmentGroup: "CORP",
      marketSegment: "Corporate negotiated",
      source: "sales-office",
      balanceMinor: 0,
      blockers: Object.freeze(["room_not_ready"]),
      actions: Object.freeze([
        boardAction("mark-inspected", "Request inspected room", "housekeeping_supervisor", false),
        boardAction("move-room", "Move room", "front_office_manager", false),
      ]),
    }),
  ]);

  const departures: readonly DemoDepartureItem[] = Object.freeze([
    Object.freeze({
      reservationCode: "WEB-3309",
      guestName: "Nina Kapoor",
      room: "208",
      checkoutStatus: "ready",
      openBalanceMinor: 0,
      actions: Object.freeze([
        boardAction("prepare-checkout", "Prepare checkout", "front_desk_agent", false),
        boardAction("complete-checkout", "Complete checkout", "front_desk_agent", false),
      ]),
    }),
    Object.freeze({
      reservationCode: "OTA-8841",
      guestName: "Omar Siddiqui",
      room: "114",
      checkoutStatus: "blocked",
      openBalanceMinor: 4_250,
      actions: Object.freeze([
        boardAction("post-charge", "Review open charges", "cashier", false),
        boardAction("settle-payment", "Settle payment", "cashier", true),
      ]),
    }),
  ]);

  return Object.freeze({
    property: Object.freeze({
      code: "YELLOW-DEMO",
      name: "Yellow Grand Demo Hotel",
      businessDate: "2026-09-23",
      timezone: "Asia/Kolkata",
    }),
    headline: Object.freeze({
      dueIn: arrivals.length,
      inHouse: 42,
      dueOut: departures.length,
      roomsNeedingAttention: 18,
      cashierExceptions: departures.filter((departure) => departure.openBalanceMinor > 0).length,
    }),
    rolePermissions: Object.freeze([
      rolePermission("front_desk_agent", "Front desk agent", true, true, false, false, [
        "Can read folio and prepare check-in/checkout work.",
        "Cannot post charges or settle payments.",
      ]),
      rolePermission("cashier", "Cashier", true, true, true, true, [
        "Can prepare posting and settlement actions after confirmation.",
        "Cash drawer is not required for read-only review or non-cash preparation.",
      ]),
      rolePermission("front_office_manager", "Front office manager", true, true, false, false, [
        "Can approve operational exceptions such as room move escalation.",
      ]),
      rolePermission("housekeeping_supervisor", "Housekeeping supervisor", false, false, false, false, [
        "Can prepare room inspection and discrepancy actions.",
      ]),
    ]),
    roomStatus: Object.freeze({
      inspected: 39,
      clean: 51,
      dirty: 14,
      pickup: 4,
      outOfOrder: 2,
    }),
    arrivals,
    inHouse: Object.freeze([
      Object.freeze({ reservationCode: "DIR-2201", guestName: "Priya Nair", room: "707", serviceState: "vip_watch", folioBalanceMinor: 0 }),
      Object.freeze({ reservationCode: "OTA-5590", guestName: "Maya Chen", room: "615", serviceState: "open_task", folioBalanceMinor: 1_200 }),
    ]),
    departures,
    operatingRules: Object.freeze([
      "Cashier access is role-governed; a physical cash drawer is not required for folio read or preparation.",
      "Cash settlement would require cashier role, explicit confirmation and a live drawer/session policy before execution.",
      "Room readiness and checkout blockers are visible before the operator opens a detailed screen.",
      "Every action on this board is disabled in the public demo and must reread authoritative PMS state before any future execution.",
    ]),
  });
}

function boardAction(
  id: string,
  label: string,
  roleRequired: DemoRoleCode,
  cashDrawerRequired: boolean,
): DemoBoardAction {
  return Object.freeze({
    id,
    label,
    roleRequired,
    requiresConfirmation: true,
    confirmationPhrase: "CONFIRM YELLOW OPERATION",
    executionEnabled: false,
    cashDrawerRequired,
    reasonDisabled: DISABLED_REASON,
  });
}

function rolePermission(
  role: DemoRoleCode,
  label: string,
  canReadFolio: boolean,
  canPrepareCashierWork: boolean,
  canPostCharge: boolean,
  canSettlePayment: boolean,
  notes: readonly string[],
): DemoRolePermission {
  return Object.freeze({
    role,
    label,
    canReadFolio,
    canPrepareCashierWork,
    canPostCharge,
    canSettlePayment,
    cashDrawerRequiredForRead: false,
    notes: Object.freeze([...notes]),
  });
}
