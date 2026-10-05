import { buildColleagueOperatingJourney, type ColleagueOperatingJourney, type DemoAction, type DemoWorkflowCard } from "./operating-journey";

export interface DemoSandboxActionInput {
  readonly actionId: string;
  readonly confirmationPhrase?: string;
}

export interface DemoSandboxOverlay {
  readonly mode: "synthetic-demo-only";
  readonly completedActionIds: readonly string[];
  readonly timeline: readonly string[];
  readonly warnings: readonly string[];
}

export interface DemoSandboxActionResult {
  readonly actionId: string;
  readonly actionLabel: string;
  readonly workflowId: string;
  readonly requiresConfirmation: true;
  readonly confirmationPhrase: "CONFIRM YELLOW OPERATION";
  readonly confirmed: boolean;
  readonly sandboxExecuted: boolean;
  readonly realPmsExecuted: false;
  readonly authoritativeReread: {
    readonly journey: ColleagueOperatingJourney;
    readonly sandbox: DemoSandboxOverlay;
  };
}

export interface DemoSandboxActionError {
  readonly error: "action_required" | "unknown_action";
}

const CONFIRMATION_PHRASE = "CONFIRM YELLOW OPERATION";
const completedActionIds = new Set<string>();
const timeline: string[] = [];

const ACTION_TIMELINE: Readonly<Record<string, string>> = Object.freeze({
  "check-in-arrival": "Synthetic arrival completed: Sara Al Harbi is shown as checked in for demo purposes.",
  "move-room": "Synthetic room move prepared: room-change command is represented in the demo timeline only.",
  "add-stay-note": "Synthetic stay note added to the demo timeline.",
  "create-service-task": "Synthetic service task created for the demo journey.",
  "post-charge": "Synthetic cashier charge preview recorded; no journal, payment, tax or document row was created.",
  "settle-payment": "Synthetic settlement preview recorded; no payment instrument, capture, refund or cash drawer mutation occurred.",
  "transfer-line": "Synthetic bill-window transfer preview recorded; no posting line was moved.",
  "mark-inspected": "Synthetic housekeeping status moved to inspected in the demo overlay.",
  "raise-discrepancy": "Synthetic housekeeping discrepancy added to the demo overlay.",
  "pickup-room": "Synthetic group pickup recorded in the demo overlay; house inventory remains database-authoritative.",
  "import-rooming-list": "Synthetic rooming-list import marked complete in the demo overlay.",
  "apply-wash": "Synthetic block wash preview recorded; no allotment or occupancy row changed.",
  "prepare-checkout": "Synthetic checkout preparation completed in the demo overlay.",
  "complete-checkout": "Synthetic checkout completion preview recorded; no folio, occupancy or document mutation occurred.",
  "ai-check-in": "Synthetic Overwatch check-in command captured; execution remains gated to the demo overlay.",
  "ai-post-charge": "Synthetic Overwatch cashier command captured; no finance mutation occurred.",
});

const WARNINGS = Object.freeze([
  "Synthetic sandbox only: no PostgreSQL table is changed.",
  "No occupancy, folio, journal, payment, fiscal document, statutory submission or outbox row is written.",
  "Production workflow completion still requires database-backed command services and independent proof.",
]);

export function executeDemoSandboxAction(input: DemoSandboxActionInput): DemoSandboxActionResult | DemoSandboxActionError {
  if (input.actionId.trim() === "") return Object.freeze({ error: "action_required" as const });
  const journey = buildColleagueOperatingJourney();
  const found = findAction(journey, input.actionId);
  if (found === null) return Object.freeze({ error: "unknown_action" as const });
  const confirmed = input.confirmationPhrase === CONFIRMATION_PHRASE;
  if (confirmed) {
    completedActionIds.add(found.action.id);
    const entry = ACTION_TIMELINE[found.action.id] ?? `Synthetic action recorded: ${found.action.label}`;
    if (!timeline.includes(entry)) timeline.push(entry);
  }
  return Object.freeze({
    actionId: found.action.id,
    actionLabel: found.action.label,
    workflowId: found.workflow.id,
    requiresConfirmation: true,
    confirmationPhrase: CONFIRMATION_PHRASE,
    confirmed,
    sandboxExecuted: confirmed,
    realPmsExecuted: false,
    authoritativeReread: Object.freeze({
      journey,
      sandbox: buildSandboxOverlay(),
    }),
  });
}

export function resetDemoSandbox(): DemoSandboxOverlay {
  completedActionIds.clear();
  timeline.length = 0;
  return buildSandboxOverlay();
}

export function buildSandboxOverlay(): DemoSandboxOverlay {
  return Object.freeze({
    mode: "synthetic-demo-only",
    completedActionIds: Object.freeze([...completedActionIds].sort()),
    timeline: Object.freeze([...timeline]),
    warnings: WARNINGS,
  });
}

function findAction(
  journey: ColleagueOperatingJourney,
  actionId: string,
): { readonly workflow: DemoWorkflowCard; readonly action: DemoAction } | null {
  for (const workflow of journey.workflows) {
    const action = workflow.actions.find((candidate) => candidate.id === actionId);
    if (action !== undefined) return { workflow, action };
  }
  return null;
}
