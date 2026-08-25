import { INDEPENDENTLY_REVIEWED_THROUGH_ORDER } from "./generated/review-coverage";

export type PhaseBuildState = "reviewed" | "built_unverified" | "active" | "planned";

export interface ProjectPhaseSnapshot {
  readonly number: number;
  readonly name: string;
  readonly state: PhaseBuildState;
}

export type ProjectRecordedWorkState = "independently_approved" | "proof_in_progress";

export interface ProjectRecordedWorkSnapshot {
  readonly order: 126 | 127 | 148 | 154 | 155 | 156 | 160 | 161 | 162 | 163 | 164;
  readonly state: ProjectRecordedWorkState;
  readonly summary: string;
  readonly remaining?: string;
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
  recordedAt: "2026-08-26",
  label: "Recorded build snapshot",
  roadmap: Object.freeze({
    phaseCount: 13,
    latestBuiltOrder: 163,
    currentOrder: 164,
    activePhase: 5,
  }),
  review: Object.freeze({
    independentlyReviewedThroughOrder: INDEPENDENTLY_REVIEWED_THROUGH_ORDER,
    gate3Debt: 0,
    state: INDEPENDENTLY_REVIEWED_THROUGH_ORDER >= 107 ? "reviewed" as const : "built_unverified" as const,
  }),
  referee: Object.freeze({ requiredPasses: 11, requiredFailures: 0 }),
  recordedWork: Object.freeze([
    Object.freeze({
      order: 126,
      state: "independently_approved" as const,
      summary: "Order 126 independently approved (D-391).",
    }),
    Object.freeze({
      order: 127,
      state: "independently_approved" as const,
      summary: "Order 127 independently approved (D-407).",
    }),
    Object.freeze({
      order: 148,
      state: "independently_approved" as const,
      summary: "Order 148 independently approved (D-412).",
      remaining: "PR #78 is open and unmerged; no deployment is claimed.",
    }),
    Object.freeze({
      order: 154,
      state: "independently_approved" as const,
      summary: "Order 154 reviewed runtime-DML union independently approved.",
      remaining: "The reviewed union is unmerged; no deployment is claimed.",
    }),
    Object.freeze({
      order: 155,
      state: "independently_approved" as const,
      summary: "Order 155 resolved-question normalization independently checked.",
      remaining: "The governance-only order is unmerged.",
    }),
    Object.freeze({
      order: 156,
      state: "independently_approved" as const,
      summary: "Order 156 dedicated extension registrar independently approved.",
      remaining: "This capability does not imply Phase-wide completion or production deployment.",
    }),
    Object.freeze({
      order: 160,
      state: "independently_approved" as const,
      summary: "Order 160 local-review booking authority independently approved.",
      remaining: "Approval is limited to the governed local Party-to-reservation journey.",
    }),
    Object.freeze({
      order: 161,
      state: "independently_approved" as const,
      summary: "Order 161 local booking promotion independently approved.",
      remaining: "Runtime promotion evidence is recorded separately; no production deployment is claimed.",
    }),
    Object.freeze({
      order: 162,
      state: "independently_approved" as const,
      summary: "Order 162 rate-publication cursor correction independently approved.",
      remaining: "Approval is limited to the immutable cursor-binding correction.",
    }),
    Object.freeze({
      order: 163,
      state: "independently_approved" as const,
      summary: "Order 163 persistent local founder login handoff independently approved.",
      remaining: "The protected credential handoff and runtime identity are evidenced outside this snapshot.",
    }),
    Object.freeze({
      order: 164,
      state: "proof_in_progress" as const,
      summary: "Order 164 integrates the approved product and local operational lineages.",
      remaining: "Independent proof is in progress; the reservation-desk UI remains the next bounded order.",
    }),
  ] satisfies readonly ProjectRecordedWorkSnapshot[]),
  phases: Object.freeze([
    Object.freeze({ number: 0, name: "Bootstrap", state: "reviewed" as const }),
    Object.freeze({ number: 1, name: "Kernel", state: INDEPENDENTLY_REVIEWED_THROUGH_ORDER >= 26 ? "reviewed" as const : "built_unverified" as const }),
    Object.freeze({ number: 2, name: "Inventory & occupancy", state: INDEPENDENTLY_REVIEWED_THROUGH_ORDER >= 44 ? "reviewed" as const : "built_unverified" as const }),
    Object.freeze({ number: 3, name: "Rates & policies", state: INDEPENDENTLY_REVIEWED_THROUGH_ORDER >= 79 ? "reviewed" as const : "built_unverified" as const }),
    Object.freeze({ number: 4, name: "Reservations", state: "built_unverified" as const }),
    Object.freeze({ number: 5, name: "Financials", state: "active" as const }),
    Object.freeze({ number: 6, name: "Stay operations & housekeeping", state: "planned" as const }),
    Object.freeze({ number: 7, name: "Tax & India IRP", state: "planned" as const }),
    Object.freeze({ number: 8, name: "Statutory reporting & ZATCA", state: "planned" as const }),
    Object.freeze({ number: 9, name: "Distribution", state: "planned" as const }),
    Object.freeze({ number: 10, name: "Progressive web app", state: "planned" as const }),
    Object.freeze({ number: 11, name: "Groups & blocks", state: "planned" as const }),
    Object.freeze({ number: 12, name: "UAE ASP, accounts receivable & migration", state: "planned" as const }),
  ] satisfies readonly ProjectPhaseSnapshot[]),
});
