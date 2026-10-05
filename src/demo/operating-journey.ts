import { buildGroupBlocksWorkbench, type GroupBlockRuntime } from "../contexts/groups";

export type DemoWorkflowId =
  | "arrival"
  | "stay"
  | "cashier"
  | "housekeeping"
  | "group-blocks"
  | "checkout"
  | "overwatch";

export type DemoWorkflowStatus = "ready_to_show" | "needs_governed_execution";

export interface DemoAction {
  readonly id: string;
  readonly label: string;
  readonly operationalMutation: boolean;
  readonly requiresConfirmation: boolean;
  readonly confirmationPhrase: "CONFIRM YELLOW OPERATION" | null;
  readonly executionEnabled: false;
  readonly reasonExecutionDisabled: string;
}

export interface DemoWorkflowCard {
  readonly id: DemoWorkflowId;
  readonly title: string;
  readonly status: DemoWorkflowStatus;
  readonly purpose: string;
  readonly currentState: readonly string[];
  readonly actions: readonly DemoAction[];
}

export interface ColleagueOperatingJourney {
  readonly property: {
    readonly code: "YELLOW-DEMO";
    readonly name: "Yellow Grand Demo Hotel";
    readonly businessDate: "2026-09-23";
    readonly timezone: "Asia/Kolkata";
    readonly currency: "INR";
  };
  readonly guestScenario: {
    readonly reservationCode: "L3R-HX-0126";
    readonly guestName: "Sara Al Harbi";
    readonly room: "303";
    readonly marketSegmentGroup: "OTA";
    readonly marketSegment: "Booking.com";
    readonly source: "mobile";
  };
  readonly workflows: readonly DemoWorkflowCard[];
  readonly groupBlocks: readonly GroupBlockRuntime[];
  readonly invariants: readonly string[];
}

const MUTATION_DISABLED_REASON =
  "Demo route is read-only until the governed workflow command, authoritative reread and independent proof are connected.";

export function buildColleagueOperatingJourney(): ColleagueOperatingJourney {
  const groupWorkbench = buildGroupBlocksWorkbench("2026-09-23");
  return Object.freeze({
    property: Object.freeze({
      code: "YELLOW-DEMO",
      name: "Yellow Grand Demo Hotel",
      businessDate: "2026-09-23",
      timezone: "Asia/Kolkata",
      currency: "INR",
    }),
    guestScenario: Object.freeze({
      reservationCode: "L3R-HX-0126",
      guestName: "Sara Al Harbi",
      room: "303",
      marketSegmentGroup: "OTA",
      marketSegment: "Booking.com",
      source: "mobile",
    }),
    workflows: Object.freeze([
      workflowCard({
        id: "arrival",
        title: "Guided arrival",
        status: "needs_governed_execution",
        purpose: "Front desk can see due-in guest context, room readiness, identity gaps and the exact check-in action to confirm.",
        currentState: [
          "Reservation L3R-HX-0126 is due in today.",
          "Room 303 is assigned and inspected.",
          "Guest profile is linked to OTA source and mobile origin.",
        ],
        actions: [
          mutationAction("check-in-arrival", "Check in Sara Al Harbi"),
          mutationAction("move-room", "Move room if guest requests a change"),
        ],
      }),
      workflowCard({
        id: "stay",
        title: "In-house stay",
        status: "ready_to_show",
        purpose: "Operations can track the guest, room, alerts and service tasks without hunting across modules.",
        currentState: [
          "Guest is mapped to room, reservation, folio and housekeeping state.",
          "Stay timeline is the shared spine for front office, HK and cashier.",
        ],
        actions: [
          mutationAction("add-stay-note", "Add an operational note"),
          mutationAction("create-service-task", "Create a service task"),
        ],
      }),
      workflowCard({
        id: "cashier",
        title: "Cashier and folio",
        status: "needs_governed_execution",
        purpose: "Cashier can view balance, bill windows and charge/payment actions while finance remains journal-authoritative.",
        currentState: [
          "Primary folio is visible for the named stay.",
          "Charge posting and cash-marker settlement execute only through reviewed governed proof routes.",
          "Cash drawer access is optional for this read demo; cashier authority is still required before posting.",
        ],
        actions: [
          mutationAction("post-charge", "Post room, food, beverage or miscellaneous charge"),
          mutationAction("settle-payment", "Settle payment or advance deposit"),
          mutationAction("transfer-line", "Transfer line to another bill window"),
        ],
      }),
      workflowCard({
        id: "housekeeping",
        title: "Housekeeping readiness",
        status: "needs_governed_execution",
        purpose: "Room condition, inspection, discrepancy and task queues are shown with color/status grouping for operations.",
        currentState: [
          "Room 303 is inspected for arrival.",
          "Dirty, clean, pickup and inspected states are grouped as operational status containers.",
        ],
        actions: [
          mutationAction("mark-inspected", "Mark room inspected"),
          mutationAction("raise-discrepancy", "Raise sleep/skip discrepancy"),
        ],
      }),
      workflowCard({
        id: "group-blocks",
        title: "Group blocks",
        status: "ready_to_show",
        purpose: "Sales and reservations can manage group status, pickup, wash/release and rooming-list gaps before rooms return to house inventory.",
        currentState: [
          `${groupWorkbench.blocks[0]?.code ?? "YCC-0926"} has pickup and remaining allotment visible by date and room type.`,
          "Manager endpoint exposes next operational step and confirmation-gated pickup/import/wash/status actions.",
        ],
        actions: [
          mutationAction("pickup-room", "Pickup room from block"),
          mutationAction("import-rooming-list", "Import rooming list"),
          mutationAction("apply-wash", "Apply wash/release"),
        ],
      }),
      workflowCard({
        id: "checkout",
        title: "Guided checkout",
        status: "needs_governed_execution",
        purpose: "Departure flow checks open balance, unsettled folios, room release and final confirmation before checkout.",
        currentState: [
          "Checkout is blocked if folio has open balance.",
          "Departure completion must reread authoritative folio and stay state after confirmation.",
        ],
        actions: [
          mutationAction("prepare-checkout", "Prepare checkout"),
          mutationAction("complete-checkout", "Complete checkout"),
        ],
      }),
      workflowCard({
        id: "overwatch",
        title: "Yellow Overwatch",
        status: "needs_governed_execution",
        purpose: "Multilingual AI can guide operators and classify PMS intents while every state-changing command remains confirmation-gated.",
        currentState: [
          "English and Hindi/Indian English prompts are detected locally.",
          "Gemini is not connected in this checkout yet.",
          "Operational execution remains disabled until governed command services are proved.",
        ],
        actions: [
          mutationAction("ai-check-in", "Ask Overwatch to check in guest"),
          mutationAction("ai-post-charge", "Ask Overwatch to post a charge"),
        ],
      }),
    ]),
    groupBlocks: groupWorkbench.blocks,
    invariants: Object.freeze([
      "Every state-changing action is confirmation-gated.",
      "This operating journey is read-only and cannot mutate hotel state.",
      "PostgreSQL remains authoritative for occupancy, folio and finance truth.",
      "Hotel KPIs are server-owned and not computed from decorative UI cards.",
    ]),
  });
}

function workflowCard(input: DemoWorkflowCard): DemoWorkflowCard {
  return Object.freeze({
    ...input,
    currentState: Object.freeze([...input.currentState]),
    actions: Object.freeze([...input.actions]),
  });
}

function mutationAction(id: string, label: string): DemoAction {
  return Object.freeze({
    id,
    label,
    operationalMutation: true,
    requiresConfirmation: true,
    confirmationPhrase: "CONFIRM YELLOW OPERATION",
    executionEnabled: false,
    reasonExecutionDisabled: MUTATION_DISABLED_REASON,
  });
}
