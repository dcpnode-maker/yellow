import { INDEPENDENTLY_REVIEWED_THROUGH_ORDER } from "./generated/review-coverage";

export type PhaseBuildState = "reviewed" | "built_unverified" | "active" | "planned";

export interface ProjectPhaseSnapshot {
  readonly number: number;
  readonly name: string;
  readonly state: PhaseBuildState;
}

export interface OperatorRuntimeStatus {
  readonly workbenchEnabled: boolean;
  readonly holdExpiryWorkerEnabled: boolean;
  readonly availabilityProjectionWorkerEnabled: boolean;
  readonly processStartedAt: string;
}

export const DEFAULT_OPERATOR_RUNTIME_STATUS: OperatorRuntimeStatus = Object.freeze({
  workbenchEnabled: false,
  holdExpiryWorkerEnabled: false,
  availabilityProjectionWorkerEnabled: false,
  processStartedAt: new Date(0).toISOString(),
});

export const PROJECT_BUILD_SNAPSHOT = Object.freeze({
  schemaVersion: 1,
  recordedAt: "2026-08-24",
  label: "Recorded build snapshot",
  roadmap: Object.freeze({
    phaseCount: 13,
    latestBuiltOrder: 99,
    currentOrder: 99,
    activePhase: 4,
  }),
  review: Object.freeze({
    independentlyReviewedThroughOrder: INDEPENDENTLY_REVIEWED_THROUGH_ORDER,
    gate3Debt: 0,
    state: "reviewed" as const,
  }),
  referee: Object.freeze({ requiredPasses: 11, requiredFailures: 0 }),
  phases: Object.freeze([
    Object.freeze({ number: 0, name: "Bootstrap", state: "reviewed" as const }),
    Object.freeze({ number: 1, name: "Kernel", state: INDEPENDENTLY_REVIEWED_THROUGH_ORDER >= 26 ? "reviewed" as const : "built_unverified" as const }),
    Object.freeze({ number: 2, name: "Inventory & occupancy", state: INDEPENDENTLY_REVIEWED_THROUGH_ORDER >= 44 ? "reviewed" as const : "built_unverified" as const }),
    Object.freeze({ number: 3, name: "Rates & policies", state: INDEPENDENTLY_REVIEWED_THROUGH_ORDER >= 79 ? "reviewed" as const : "built_unverified" as const }),
    Object.freeze({ number: 4, name: "Reservations", state: "active" as const }),
    Object.freeze({ number: 5, name: "Financials", state: "planned" as const }),
    Object.freeze({ number: 6, name: "Stay operations & housekeeping", state: "planned" as const }),
    Object.freeze({ number: 7, name: "Tax & India IRP", state: "planned" as const }),
    Object.freeze({ number: 8, name: "Statutory reporting & ZATCA", state: "planned" as const }),
    Object.freeze({ number: 9, name: "Distribution", state: "planned" as const }),
    Object.freeze({ number: 10, name: "Progressive web app", state: "planned" as const }),
    Object.freeze({ number: 11, name: "Groups & blocks", state: "planned" as const }),
    Object.freeze({ number: 12, name: "UAE ASP, accounts receivable & migration", state: "planned" as const }),
  ] satisfies readonly ProjectPhaseSnapshot[]),
});
