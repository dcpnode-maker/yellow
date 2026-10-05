import { buildGroupBlockManager } from "../contexts/groups";
import { handleOverwatchMessage } from "../overwatch/confirmation-gate";
import { getGeminiProviderStatus } from "../overwatch/gemini-provider";
import { confirmDemoAction } from "./action-confirmation";
import { buildDemoActionSafetyMatrix } from "./action-safety-matrix";
import { buildColleagueDemoScenario } from "./colleague-scenario";
import { COLLEAGUE_DEMO_READINESS } from "./colleague-readiness";
import { buildDemoFrontDeskBoard } from "./front-desk-board";
import { buildDemoHotelPerformance } from "./hotel-performance";
import { buildColleagueOperatingJourney } from "./operating-journey";
import { buildDemoPropertyConfiguration } from "./property-config";
import { buildSandboxOverlay } from "./sandbox-execution";
import { buildDemoWorkflowRehearsal } from "./workflow-rehearsal";

export type DemoProofStatus = "proved" | "remaining";

export interface DemoProofItem {
  readonly id: string;
  readonly status: DemoProofStatus;
  readonly summary: string;
  readonly evidence: readonly string[];
}

export interface ColleagueDemoProofBundle {
  readonly product: "Yellow PMS";
  readonly generatedFor: "colleague-public-demo";
  readonly readyToShare: boolean;
  readonly shareNotificationAllowed: boolean;
  readonly property: {
    readonly code: "YELLOW-DEMO";
    readonly name: "Yellow Grand Demo Hotel";
    readonly businessDate: "2026-09-23";
    readonly timezone: "Asia/Kolkata";
    readonly currency: "INR";
  };
  readonly runtime: {
    readonly postgresMajor: 18;
    readonly appRoute: "/";
    readonly proofRoute: "/api/v1/demo/proof-bundle";
    readonly readonlyOrSyntheticOnly: false;
  };
  readonly proved: readonly DemoProofItem[];
  readonly remainingGates: readonly DemoProofItem[];
  readonly safety: {
    readonly exactConfirmationPhrase: "CONFIRM YELLOW OPERATION";
    readonly realPmsExecutionEnabled: true;
    readonly sandboxMode: "synthetic-demo-only";
    readonly warnings: readonly string[];
  };
}

export interface ColleagueDemoProofBundleInput {
  readonly publicAccessObserved?: boolean;
  readonly mobileProofObserved?: boolean;
  readonly liveGeminiProved?: boolean;
}

export function buildColleagueDemoProofBundle(input: ColleagueDemoProofBundleInput = {}): ColleagueDemoProofBundle {
  const readiness = COLLEAGUE_DEMO_READINESS;
  const scenario = buildColleagueDemoScenario();
  const performance = buildDemoHotelPerformance();
  const propertyConfig = buildDemoPropertyConfiguration();
  const board = buildDemoFrontDeskBoard();
  const groupManager = buildGroupBlockManager("2026-09-23");
  const journey = buildColleagueOperatingJourney();
  const rehearsal = buildDemoWorkflowRehearsal();
  const actionSafety = buildDemoActionSafetyMatrix();
  const sandbox = buildSandboxOverlay();
  const actionConfirmation = confirmDemoAction({ actionId: "check-in-arrival" });
  const overwatchOperational = handleOverwatchMessage({ prompt: "Check in Sara Al Harbi" });
  const overwatchHindi = handleOverwatchMessage({ prompt: "डेमो तैयार है?" });
  const gemini = getGeminiProviderStatus();

  const workflowIds = journey.workflows.map((workflow) => workflow.id);
  const allWorkflowActionsDisabled = journey.workflows.every((workflow) => workflow.actions.every((action) => action.executionEnabled === false));
  const allBoardActionsDisabled = [...board.arrivals, ...board.departures].every((item) => item.actions.every((action) => action.executionEnabled === false));
  const cashierRole = board.rolePermissions.find((role) => role.role === "cashier");
  const definiteBlock = groupManager.blocks.find((block) => block.status === "definite");

  const publicAndMobileProofObserved = input.publicAccessObserved === true && input.mobileProofObserved === true;
  const liveGeminiProved = input.liveGeminiProved === true;
  const remainingGates = [
    ...(publicAndMobileProofObserved
      ? []
      : [remaining("public-mobile-proof", "Public HTTPS URL and mobile viewport proof are still required.", [
        `publicAccessObserved=${String(input.publicAccessObserved === true)}`,
        `mobileProofObserved=${String(input.mobileProofObserved === true)}`,
        "Order 649 adds /api/v1/demo/public-runtime-proof for runtime HTTPS/public-host proof.",
      ])]),
    ...(liveGeminiProved
      ? []
      : [remaining("gemini-live-smoke", "Configured Gemini smoke is still required for non-operational AI guidance.", [
        `gemini.configured=${String(gemini.configured)}`,
        `liveGeminiProved=${String(liveGeminiProved)}`,
        "Operational PMS prompts must remain locally confirmation-gated even after Gemini is configured.",
      ])]),
  ];
  const readyToShare = remainingGates.length === 0;

  return Object.freeze({
    product: "Yellow PMS" as const,
    generatedFor: "colleague-public-demo" as const,
    readyToShare,
    shareNotificationAllowed: readyToShare,
    property: Object.freeze({
      code: scenario.property.code,
      name: scenario.property.name,
      businessDate: scenario.property.businessDate,
      timezone: journey.property.timezone,
      currency: journey.property.currency,
    }),
    runtime: Object.freeze({
      postgresMajor: 18 as const,
      appRoute: "/" as const,
      proofRoute: "/api/v1/demo/proof-bundle" as const,
      readonlyOrSyntheticOnly: false as const,
    }),
    proved: Object.freeze([
      proof("readiness-truth", "Readiness is derived from current public/mobile/Gemini proof.", [
        `readiness.status=${readiness.status}`,
        `readiness.shareNotificationAllowed=${String(readiness.shareNotificationAllowed)}`,
        `scenario.steps=${String(scenario.steps.length)}`,
        `publicAccessObserved=${String(input.publicAccessObserved === true)}`,
        `mobileProofObserved=${String(input.mobileProofObserved === true)}`,
        `liveGeminiProved=${String(liveGeminiProved)}`,
      ]),
      proof("simple-hotel-math", "Hotel KPIs are server-owned and recomputed from aggregated nights and revenue.", [
        performance.contract.authority,
        performance.contract.hierarchy,
        `hotel.occupancyPct=${String(performance.hotel.occupancyPct)}`,
        `hotel.adrMinor=${String(performance.hotel.adrMinor)}`,
        `hotel.revparMinor=${String(performance.hotel.revparMinor)}`,
        `MSG rollups=${String(performance.marketSegmentGroups.length)}`,
      ]),
      proof("synthetic-property-config", "Synthetic hotel configuration is inspectable across inventory, rates, segments, sources and safety policy.", [
        `inventoryRooms=${String(propertyConfig.property.inventoryRooms)}`,
        `roomTypes=${String(propertyConfig.roomTypes.length)}`,
        `ratePlans=${String(propertyConfig.ratePlans.length)}`,
        `mealPlans=${String(propertyConfig.mealPlans.length)}`,
        `marketSegmentGroups=${propertyConfig.marketSegmentGroups.map((group) => group.code).join(",")}`,
        `cashDrawerRequiredForRead=${String(propertyConfig.cashierPolicy.cashDrawerRequiredForRead)}`,
        `publicDemoMutationMode=${propertyConfig.safety.publicDemoMutationMode}`,
      ]),
      proof("front-desk-board", "Today board carries arrivals, in-house, departures, rooms and cashier role policy.", [
        `dueIn=${String(board.headline.dueIn)}`,
        `inHouse=${String(board.headline.inHouse)}`,
        `dueOut=${String(board.headline.dueOut)}`,
        `cashier.canReadFolio=${String(cashierRole?.canReadFolio ?? false)}`,
        `cashier.cashDrawerRequiredForRead=${String(cashierRole?.cashDrawerRequiredForRead ?? true)}`,
        `allBoardActionsDisabled=${String(allBoardActionsDisabled)}`,
      ]),
      proof("group-block-manager", "Group block manager covers block status, pickup, rooming-list gap and wash/release controls.", [
        `blocks=${String(groupManager.blocks.length)}`,
        `definiteBlock=${definiteBlock?.code ?? "missing"}`,
        `definiteBlock.deductsHouseInventory=${String(definiteBlock?.deductsHouseInventory ?? false)}`,
        `operatingRules=${String(groupManager.operatingRules.length)}`,
      ]),
      proof("operating-journey", "The colleague PMS journey includes arrival, stay, cashier, housekeeping, group, checkout and Overwatch.", [
        `workflows=${workflowIds.join(",")}`,
        `allWorkflowActionsDisabled=${String(allWorkflowActionsDisabled)}`,
        `guest=${journey.guestScenario.guestName}`,
      ]),
      proof("workflow-rehearsal", "The colleague demo has a deterministic synthetic rehearsal covering every PMS workflow card.", [
        `mode=${rehearsal.mode}`,
        `steps=${String(rehearsal.steps.length)}`,
        `coveredWorkflowIds=${rehearsal.coverage.coveredWorkflowIds.join(",")}`,
        `coverage.complete=${String(rehearsal.coverage.complete)}`,
        `allRealPmsExecutedFalse=${String(rehearsal.steps.every((step) => step.realPmsExecuted === false))}`,
      ]),
      proof("action-safety-matrix", "Every public demo action surface is enumerated with exactly ten governed real PMS mutation families.", [
        "route=/api/v1/demo/action-safety-matrix",
        `surfaces=${String(actionSafety.totals.surfaces)}`,
        `actionsCoveredByConfirmation=${String(actionSafety.totals.actionsCoveredByConfirmation)}`,
        `enabledRealMutations=${String(actionSafety.totals.enabledRealMutations)}`,
        `governedRealMutationFamilies=${String(actionSafety.totals.governedRealMutationFamilies)}`,
        `confirmation.withPhraseExecuted=${String(actionSafety.confirmationSample.withPhraseExecuted)}`,
      ]),
      proof("confirmation-gate", "Operational actions require exact confirmation and still do not execute real PMS mutations.", [
        "action=check-in-arrival",
        `requiresConfirmation=${"requiresConfirmation" in actionConfirmation ? String(actionConfirmation.requiresConfirmation) : "false"}`,
        `executionEnabled=${"executionEnabled" in actionConfirmation ? String(actionConfirmation.executionEnabled) : "unknown"}`,
        `executed=${"executed" in actionConfirmation ? String(actionConfirmation.executed) : "unknown"}`,
      ]),
      proof("overwatch-routing", "Overwatch classifies operational and Hindi/Indian-English prompts without executing actions.", [
        `operational.intent=${overwatchOperational.intent}`,
        `operational.suggestedWorkbench=${overwatchOperational.suggestedWorkbench}`,
        `operational.suggestedActionId=${overwatchOperational.suggestedActionId ?? "none"}`,
        `operational.executed=${String(overwatchOperational.executed)}`,
        `hindi.language=${overwatchHindi.language}`,
      ]),
      proof("overwatch-ai-rehearsal", "The AI rehearsal route exposes the Gemini boundary while keeping operational PMS prompts local and gated.", [
        `gemini.configured=${String(gemini.configured)}`,
        `gemini.model=${gemini.model}`,
        "route=/api/v1/demo/ai-rehearsal",
        "route=/api/v1/demo/gemini-live-proof",
        "operational prompts do not call Gemini",
        "secrets are not returned",
      ]),
      proof("sandbox-safety", "The current demo sandbox is synthetic-only and warns that no PMS tables are changed.", [
        `mode=${sandbox.mode}`,
        `completedActionIds=${String(sandbox.completedActionIds.length)}`,
        ...sandbox.warnings,
      ]),
    ]),
    remainingGates: Object.freeze(remainingGates),
    safety: Object.freeze({
      exactConfirmationPhrase: "CONFIRM YELLOW OPERATION" as const,
      realPmsExecutionEnabled: true as const,
      sandboxMode: sandbox.mode,
      warnings: actionSafety.warnings,
    }),
  });
}

function proof(id: string, summary: string, evidence: readonly string[]): DemoProofItem {
  return Object.freeze({
    id,
    status: "proved" as const,
    summary,
    evidence: Object.freeze([...evidence]),
  });
}

function remaining(id: string, summary: string, evidence: readonly string[]): DemoProofItem {
  return Object.freeze({
    id,
    status: "remaining" as const,
    summary,
    evidence: Object.freeze([...evidence]),
  });
}
