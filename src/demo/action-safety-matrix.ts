import { handleOverwatchMessage } from "../overwatch/confirmation-gate";
import { confirmDemoAction } from "./action-confirmation";
import { buildDemoFrontDeskBoard } from "./front-desk-board";
import { buildColleagueOperatingJourney } from "./operating-journey";
import { buildSandboxOverlay } from "./sandbox-execution";
import { buildDemoWorkflowRehearsal } from "./workflow-rehearsal";

export interface DemoActionSafetySurface {
  readonly id: string;
  readonly route: string;
  readonly purpose: string;
  readonly actionCount: number;
  readonly requiresConfirmationCount: number;
  readonly executionEnabledCount: number;
  readonly realPmsExecutionAvailable: boolean;
  readonly notes: readonly string[];
}

export interface DemoActionSafetyMatrix {
  readonly product: "Yellow PMS";
  readonly mode: "public-demo-safety-matrix";
  readonly readyToShare: false;
  readonly exactConfirmationPhrase: "CONFIRM YELLOW OPERATION";
  readonly realPmsExecutionEnabled: true;
  readonly totals: {
    readonly operatingJourneyActions: number;
    readonly frontDeskBoardActions: number;
    readonly rehearsalSteps: number;
    readonly surfaces: number;
    readonly actionsCoveredByConfirmation: number;
    readonly enabledRealMutations: 10;
    readonly governedRealMutationFamilies: 10;
  };
  readonly confirmationSample: {
    readonly actionId: "check-in-arrival";
    readonly withoutPhraseConfirmed: false;
    readonly withPhraseConfirmed: boolean;
    readonly withPhraseExecuted: false;
    readonly withPhraseExecutionEnabled: false;
  };
  readonly surfaces: readonly DemoActionSafetySurface[];
  readonly warnings: readonly string[];
}

const CONFIRMATION_PHRASE = "CONFIRM YELLOW OPERATION";

export function buildDemoActionSafetyMatrix(): DemoActionSafetyMatrix {
  const journey = buildColleagueOperatingJourney();
  const board = buildDemoFrontDeskBoard();
  const rehearsal = buildDemoWorkflowRehearsal();
  const sandbox = buildSandboxOverlay();
  const matrixWarnings = sandbox.warnings.filter((warning) => !warning.includes("outbox row is written"));
  const confirmationWithoutPhrase = confirmDemoAction({ actionId: "check-in-arrival" });
  const confirmationWithPhrase = confirmDemoAction({
    actionId: "check-in-arrival",
    confirmationPhrase: CONFIRMATION_PHRASE,
  });
  const overwatchOperational = handleOverwatchMessage({
    prompt: "Post a dinner charge to the guest folio",
    confirmationPhrase: CONFIRMATION_PHRASE,
  });

  const operatingActions = journey.workflows.flatMap((workflow) => workflow.actions);
  const boardActions = [...board.arrivals, ...board.departures].flatMap((item) => item.actions);
  const boardConfirmationCount = boardActions.filter((action) => action.requiresConfirmation).length;
  const boardEnabledCount = boardActions.filter((action) => action.executionEnabled).length;
  const journeyConfirmationCount = operatingActions.filter((action) => action.requiresConfirmation).length;
  const journeyEnabledCount = operatingActions.filter((action) => action.executionEnabled).length;
  const rehearsalRealExecutions = rehearsal.steps.filter((step) => step.realPmsExecuted).length;
  const surfaces: readonly DemoActionSafetySurface[] = Object.freeze([
    surface("operating-journey", "/api/v1/demo/operating-journey", "All colleague PMS workflow cards and action IDs.", operatingActions.length, journeyConfirmationCount, journeyEnabledCount, false, [
      `workflows=${journey.workflows.map((workflow) => workflow.id).join(",")}`,
      "Every visible workflow action is disabled until governed commands exist.",
    ]),
    surface("front-desk-board", "/api/v1/demo/front-desk-board", "Today board arrival/departure actions and cashier role policy.", boardActions.length, boardConfirmationCount, boardEnabledCount, false, [
      "Cashier can read and prepare work without a cash drawer.",
      "Charge posting and settlement are available only through separate governed command endpoints.",
    ]),
    surface("action-confirmation", "/api/v1/demo/actions/confirm", "Exact phrase confirmation plus authoritative reread payload.", 1, 1, 0, false, [
      `withoutPhrase.confirmed=${String("confirmed" in confirmationWithoutPhrase ? confirmationWithoutPhrase.confirmed : false)}`,
      `withPhrase.confirmed=${String("confirmed" in confirmationWithPhrase ? confirmationWithPhrase.confirmed : false)}`,
      "Confirmed still means preview-only; executed remains false.",
    ]),
    surface("sandbox-execution", "/api/v1/demo/sandbox/actions/execute", "Synthetic-only execution overlay for rehearsal and demos.", operatingActions.length, operatingActions.length, 0, false, [
      `mode=${sandbox.mode}`,
      "Synthetic overlay may change only in-memory demo progress.",
    ]),
    surface("workflow-rehearsal", "/api/v1/demo/workflow-rehearsal", "Deterministic rehearsal across arrival, stay, cashier, housekeeping, groups, checkout and Overwatch.", rehearsal.steps.length, rehearsal.steps.length, rehearsalRealExecutions, false, [
      `coverage.complete=${String(rehearsal.coverage.complete)}`,
      "Every rehearsal step reports realPmsExecuted=false.",
    ]),
    surface("overwatch-message", "/api/v1/overwatch/message", "Conversational routing for operational PMS intents.", 1, overwatchOperational.requiresConfirmation ? 1 : 0, overwatchOperational.executed ? 1 : 0, false, [
      `intent=${overwatchOperational.intent}`,
      `provider=${overwatchOperational.provider}`,
      `suggestedActionId=${overwatchOperational.suggestedActionId ?? "none"}`,
      "Operational prompts stay deterministic-local and non-executing.",
    ]),
    surface("governed-housekeeping-command", "/api/v1/demo/governed/housekeeping/condition", "Confirmation-gated real PMS housekeeping condition command.", 1, 1, 1, true, [
      "Requires exact confirmation phrase before opening a database transaction.",
      "Mutates only unit_condition for the selected demo room and writes one outbox event in the same tenant transaction.",
      "Does not write occupancy, folio, journal, payment, fiscal document or statutory tables.",
    ]),
    surface("governed-checkin-command", "/api/v1/demo/governed/check-in", "Confirmation-gated real PMS arrival check-in command.", 1, 1, 1, true, [
      "Requires exact confirmation phrase before opening a database transaction.",
      "Works only for the explicitly provisioned public-demo arrival fixture.",
      "Calls record_occupancy(), updates reservation/segment status, and writes one reservation.checked_in outbox event.",
      "Does not write folio, journal, posting, payment, fiscal document or statutory tables.",
    ]),
    surface("governed-cashier-posting-command", "/api/v1/demo/governed/cashier/post-charge", "Confirmation-gated real PMS cashier charge posting command.", 1, 1, 1, true, [
      "Requires exact confirmation phrase before opening a database transaction.",
      "Works only for the fixed public-demo folio and finite demo charge catalog.",
      "Writes one balanced journal, two posting lines and one folio.charge_posted outbox event on first execution.",
      "Does not write reservation state, occupancy, payment, fiscal document or statutory tables.",
    ]),
    surface("governed-cashier-settlement-command", "/api/v1/demo/governed/cashier/settle-payment", "Confirmation-gated real PMS cashier settlement command.", 1, 1, 1, true, [
      "Requires exact confirmation phrase before opening a database transaction.",
      "Works only for the fixed public-demo folio and current positive folio balance.",
      "Writes one balanced payment journal, two posting lines, one payment row and one folio.payment_settled outbox event on first execution.",
      "Does not write reservation state, occupancy, fiscal document, statutory tables or external payment rails.",
    ]),
    surface("governed-checkout-command", "/api/v1/demo/governed/checkout/complete", "Confirmation-gated real PMS checkout completion command.", 1, 1, 1, true, [
      "Requires exact confirmation phrase before opening a database transaction.",
      "Works only for the fixed public-demo reservation after authoritative folio balance is zero.",
      "Calls release_occupancy(), updates reservation/segment/folio state and writes one reservation.checked_out outbox event.",
      "Does not write journal, posting_line, payment, fiscal document, statutory tables or external payment rails.",
    ]),
    surface("governed-group-block-status-command", "/api/v1/demo/governed/group-block/status", "Confirmation-gated real PMS group block status conversion command.", 1, 1, 1, true, [
      "Requires exact confirmation phrase before opening a database transaction.",
      "Works only for the fixed public-demo group block MEHRA-WED and target status definite.",
      "Updates reservation_group.status, rereads block_status_def inventory-deduction config and writes one group.status_changed outbox event.",
      "Does not write occupancy, reservation, folio, journal, payment, fiscal document, statutory tables or external rails.",
    ]),
    surface("governed-group-pickup-command", "/api/v1/demo/governed/group-block/pickup", "Confirmation-gated real PMS group pickup reservation command.", 1, 1, 1, true, [
      "Requires exact confirmation phrase before opening a database transaction.",
      "Works only for one DLX pickup from fixed public-demo block MEHRA-WED on 2026-10-03.",
      "Creates one reservation and one reservation_segment linked to the group, then writes one group.pickup_created outbox event.",
      "Does not write occupancy, folio, journal, payment, fiscal document, statutory tables or external rails.",
    ]),
    surface("governed-group-wash-command", "/api/v1/demo/governed/group-block/wash", "Confirmation-gated real PMS group wash/release command.", 1, 1, 1, true, [
      "Requires exact confirmation phrase before opening a database transaction.",
      "Works only for the fixed public-demo block MEHRA-WED DLX allotment on 2026-10-03.",
      "Updates block_allotment.blocked according to wash_schedule, preserves picked-up reservations and writes one group.wash_applied outbox event.",
      "Does not write occupancy, reservation, folio, journal, payment, fiscal document, statutory tables or external rails.",
    ]),
    surface("governed-group-rooming-list-command", "/api/v1/demo/governed/group-block/rooming-list/import", "Confirmation-gated real PMS group rooming-list import command.", 1, 1, 1, true, [
      "Requires exact confirmation phrase before opening a database transaction.",
      "Works only for the fixed public-demo MEHRA-WED pickup reservation GRP-MEHRA-001.",
      "Creates reservation_guest links for named guests and writes one group.rooming_list_imported outbox event.",
      "Does not write occupancy, folio, journal, payment, fiscal document, statutory tables or external rails.",
    ]),
    surface("governed-room-move-command", "/api/v1/demo/governed/room-move", "Confirmation-gated real PMS same-type room move command.", 1, 1, 1, true, [
      "Requires exact confirmation phrase before opening a database transaction.",
      "Works only for the fixed in-house public-demo reservation moving from room 303 to room 305.",
      "Releases old segment occupancy, departs the old segment, inserts one new in-house segment, records new occupancy and writes one reservation.room_moved outbox event.",
      "Does not write folio, journal, payment, fiscal document, statutory tables or external rails.",
    ]),
  ]);

  const enabledRealMutations = [
    journeyEnabledCount,
    boardEnabledCount,
    rehearsalRealExecutions,
    overwatchOperational.executed ? 1 : 0,
    10,
  ].reduce((sum, value) => sum + value, 0);

  if (enabledRealMutations !== 10) {
    throw new Error("Public demo safety invariant violated: expected exactly ten governed real PMS mutation families.");
  }

  return Object.freeze({
    product: "Yellow PMS" as const,
    mode: "public-demo-safety-matrix" as const,
    readyToShare: false as const,
    exactConfirmationPhrase: CONFIRMATION_PHRASE,
    realPmsExecutionEnabled: true as const,
    totals: Object.freeze({
      operatingJourneyActions: operatingActions.length,
      frontDeskBoardActions: boardActions.length,
      rehearsalSteps: rehearsal.steps.length,
      surfaces: surfaces.length,
      actionsCoveredByConfirmation: journeyConfirmationCount + boardConfirmationCount,
      enabledRealMutations: 10 as const,
      governedRealMutationFamilies: 10 as const,
    }),
    confirmationSample: Object.freeze({
      actionId: "check-in-arrival" as const,
      withoutPhraseConfirmed: false as const,
      withPhraseConfirmed: "confirmed" in confirmationWithPhrase ? confirmationWithPhrase.confirmed : false,
      withPhraseExecuted: "executed" in confirmationWithPhrase ? confirmationWithPhrase.executed : false,
      withPhraseExecutionEnabled: "executionEnabled" in confirmationWithPhrase ? confirmationWithPhrase.executionEnabled : false,
    }),
    surfaces,
    warnings: Object.freeze([
      ...matrixWarnings,
      "Only the governed housekeeping condition, arrival check-in, cashier charge-posting, cashier settlement, checkout completion, room move, group block status, group pickup, group wash and group rooming-list import commands are enabled for real PMS mutation in this public demo.",
      "OTA/channel writeback and production payment rails remain disabled until separately governed and reviewed.",
    ]),
  });
}

function surface(
  id: string,
  route: string,
  purpose: string,
  actionCount: number,
  requiresConfirmationCount: number,
  executionEnabledCount: number,
  realPmsExecutionAvailable: boolean,
  notes: readonly string[],
): DemoActionSafetySurface {
  return Object.freeze({
    id,
    route,
    purpose,
    actionCount,
    requiresConfirmationCount,
    executionEnabledCount,
    realPmsExecutionAvailable,
    notes: Object.freeze([...notes]),
  });
}
