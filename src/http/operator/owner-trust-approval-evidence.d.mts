import type { OwnerTrustApprovalView } from "../../contexts/financials/index";

export type ReadyOwnerTrustApprovalEvidenceProps = Readonly<{
  state: "ready";
  propertyNode: string;
  propertyLabel: string;
  readIdentity: string;
  page: Readonly<{ approvals: readonly OwnerTrustApprovalView[]; nextCursor: string | null }>;
  formattedAmounts?: Readonly<Record<string, Readonly<{ before?: string; expense?: string; projected?: string }> | undefined>>;
}>;

export type OwnerTrustApprovalEvidenceProps = ReadyOwnerTrustApprovalEvidenceProps
  | Readonly<{ state: "loading" | "unavailable" }>;

/** Fresh detached historical evidence; parent owns scope/read admission and all actions. */
export function renderOwnerTrustApprovalEvidence(document: Document, props: OwnerTrustApprovalEvidenceProps): HTMLElement;
