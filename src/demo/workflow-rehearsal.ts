import { handleOverwatchMessage } from "../overwatch/confirmation-gate";
import { buildColleagueOperatingJourney, type DemoWorkflowId } from "./operating-journey";

export interface DemoWorkflowRehearsalStep {
  readonly order: number;
  readonly workflowId: DemoWorkflowId;
  readonly actionId: string;
  readonly title: string;
  readonly operatorPrompt: string;
  readonly confirmationPhrase: "CONFIRM YELLOW OPERATION";
  readonly confirmedForRehearsal: true;
  readonly syntheticResult: string;
  readonly realPmsExecuted: false;
  readonly authoritativeReread: {
    readonly route: string;
    readonly reason: string;
  };
}

export interface DemoWorkflowRehearsal {
  readonly property: {
    readonly code: "YELLOW-DEMO";
    readonly name: "Yellow Grand Demo Hotel";
    readonly businessDate: "2026-09-23";
  };
  readonly mode: "synthetic-rehearsal-only";
  readonly readyToShare: false;
  readonly exactConfirmationPhrase: "CONFIRM YELLOW OPERATION";
  readonly coverage: {
    readonly workflowIds: readonly DemoWorkflowId[];
    readonly coveredWorkflowIds: readonly DemoWorkflowId[];
    readonly complete: true;
  };
  readonly steps: readonly DemoWorkflowRehearsalStep[];
  readonly overwatchProof: {
    readonly prompt: string;
    readonly intent: string;
    readonly suggestedWorkbench: string;
    readonly suggestedActionId: string | null;
    readonly executed: false;
    readonly provider: "deterministic-local" | "gemini";
  };
  readonly safety: readonly string[];
}

const CONFIRMATION_PHRASE = "CONFIRM YELLOW OPERATION";

const REHEARSAL_PLAN: readonly Omit<DemoWorkflowRehearsalStep, "order" | "confirmationPhrase" | "confirmedForRehearsal" | "realPmsExecuted">[] = Object.freeze([
  stepSeed("arrival", "check-in-arrival", "Guided arrival check-in", "Check in Sara Al Harbi", "Synthetic arrival completed; Sara is shown in-house for rehearsal only.", "/api/v1/demo/front-desk-board"),
  stepSeed("stay", "create-service-task", "In-house service follow-up", "Create a service task for room 303", "Synthetic stay task added to the rehearsal timeline only.", "/api/v1/demo/operating-journey"),
  stepSeed("cashier", "post-charge", "Cashier posting preparation", "Post a dinner charge", "Synthetic charge preview recorded; no journal, tax, payment or document row was created.", "/api/v1/demo/sandbox/actions/execute"),
  stepSeed("housekeeping", "mark-inspected", "Housekeeping readiness", "Mark the departure room inspected", "Synthetic room status moved to inspected in the rehearsal overlay only.", "/api/v1/demo/front-desk-board"),
  stepSeed("group-blocks", "import-rooming-list", "Group rooming-list completion", "Import the Yellow Cloud Conference rooming list", "Synthetic rooming-list import completed for rehearsal only.", "/api/v1/demo/group-blocks/manager"),
  stepSeed("group-blocks", "apply-wash", "Group wash review", "Apply wash to remaining unpicked rooms", "Synthetic wash preview recorded; no allotment or occupancy row changed.", "/api/v1/demo/group-blocks/manager"),
  stepSeed("checkout", "complete-checkout", "Guided checkout completion", "Complete Nina Kapoor checkout", "Synthetic checkout completed; no folio, occupancy, document or outbox mutation occurred.", "/api/v1/demo/front-desk-board"),
  stepSeed("overwatch", "ai-check-in", "Overwatch operator routing", "Ask Overwatch to check in Sara", "Synthetic Overwatch command captured; execution remains gated and disabled.", "/api/v1/overwatch/message"),
]);

export function buildDemoWorkflowRehearsal(): DemoWorkflowRehearsal {
  const journey = buildColleagueOperatingJourney();
  const workflowIds = journey.workflows.map((workflow) => workflow.id);
  const steps = REHEARSAL_PLAN.map((seed, index) => Object.freeze({
    ...seed,
    order: index + 1,
    confirmationPhrase: CONFIRMATION_PHRASE,
    confirmedForRehearsal: true as const,
    realPmsExecuted: false as const,
  }));
  const coveredWorkflowIds = uniqueWorkflowIds(steps.map((step) => step.workflowId));
  const overwatch = handleOverwatchMessage({ prompt: "Check in Sara Al Harbi", confirmationPhrase: CONFIRMATION_PHRASE });

  return Object.freeze({
    property: Object.freeze({
      code: journey.property.code,
      name: journey.property.name,
      businessDate: journey.property.businessDate,
    }),
    mode: "synthetic-rehearsal-only" as const,
    readyToShare: false as const,
    exactConfirmationPhrase: CONFIRMATION_PHRASE,
    coverage: Object.freeze({
      workflowIds: Object.freeze(workflowIds),
      coveredWorkflowIds: Object.freeze(coveredWorkflowIds),
      complete: workflowIds.every((workflowId) => coveredWorkflowIds.includes(workflowId)) as true,
    }),
    steps: Object.freeze(steps),
    overwatchProof: Object.freeze({
      prompt: "Check in Sara Al Harbi",
      intent: overwatch.intent,
      suggestedWorkbench: overwatch.suggestedWorkbench,
      suggestedActionId: overwatch.suggestedActionId,
      executed: overwatch.executed,
      provider: overwatch.provider,
    }),
    safety: Object.freeze([
      "This rehearsal is deterministic and synthetic-only.",
      "Every step shows the confirmation phrase but no real PMS command is executed.",
      "No occupancy, folio, journal, payment, fiscal document, statutory submission or outbox row is written.",
      "Production enablement still requires governed command services and independent proof.",
    ]),
  });
}

function stepSeed(
  workflowId: DemoWorkflowId,
  actionId: string,
  title: string,
  operatorPrompt: string,
  syntheticResult: string,
  rereadRoute: string,
): Omit<DemoWorkflowRehearsalStep, "order" | "confirmationPhrase" | "confirmedForRehearsal" | "realPmsExecuted"> {
  return Object.freeze({
    workflowId,
    actionId,
    title,
    operatorPrompt,
    syntheticResult,
    authoritativeReread: Object.freeze({
      route: rereadRoute,
      reason: "Public demo rereads deterministic route state; production commands must reread PostgreSQL-authoritative state.",
    }),
  });
}

function uniqueWorkflowIds(workflowIds: readonly DemoWorkflowId[]): readonly DemoWorkflowId[] {
  return Object.freeze([...new Set(workflowIds)]);
}
