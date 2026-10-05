import { buildColleagueOperatingJourney, type ColleagueOperatingJourney, type DemoAction, type DemoWorkflowCard } from "./operating-journey";

export interface DemoActionConfirmationInput {
  readonly actionId: string;
  readonly confirmationPhrase?: string;
}

export interface DemoActionConfirmationResult {
  readonly actionId: string;
  readonly actionLabel: string;
  readonly workflowId: string;
  readonly requiresConfirmation: true;
  readonly confirmationPhrase: "CONFIRM YELLOW OPERATION";
  readonly confirmed: boolean;
  readonly executed: false;
  readonly executionEnabled: false;
  readonly reason: string;
  readonly authoritativeReread: ColleagueOperatingJourney;
}

export interface DemoActionConfirmationError {
  readonly error: "action_required" | "unknown_action";
}

const CONFIRMATION_PHRASE = "CONFIRM YELLOW OPERATION";
const DISABLED_REASON =
  "Confirmation was evaluated, but real PMS execution remains disabled until database-backed governed workflow services and independent proof are connected.";

export function confirmDemoAction(input: DemoActionConfirmationInput): DemoActionConfirmationResult | DemoActionConfirmationError {
  if (input.actionId.trim() === "") return Object.freeze({ error: "action_required" as const });
  const journey = buildColleagueOperatingJourney();
  const found = findAction(journey, input.actionId);
  if (found === null) return Object.freeze({ error: "unknown_action" as const });
  return Object.freeze({
    actionId: found.action.id,
    actionLabel: found.action.label,
    workflowId: found.workflow.id,
    requiresConfirmation: true,
    confirmationPhrase: CONFIRMATION_PHRASE,
    confirmed: input.confirmationPhrase === CONFIRMATION_PHRASE,
    executed: false,
    executionEnabled: false,
    reason: DISABLED_REASON,
    authoritativeReread: journey,
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
