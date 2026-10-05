import type { OwnerTrustExpensePreview } from "../../contexts/financials/index";

export type ReadyOwnerTrustExpensePreviewEvidenceProps = Readonly<{
  state: "ready";
  propertyNode: string;
  propertyLabel: string;
  readIdentity: string;
  draftIdentity: string;
  preview: Readonly<OwnerTrustExpensePreview>;
  draft: Readonly<{ accountReference: string; amountMinor: string; reason: string }>;
  formattedAmounts?: Readonly<{ before?: string; expense?: string; projected?: string }>;
}>;

export type OwnerTrustExpensePreviewEvidenceProps = ReadyOwnerTrustExpensePreviewEvidenceProps
  | Readonly<{ state: "loading" | "unavailable" }>;

/** Fresh detached evidence. Parent owns property/session/draft admission and all actions. */
export function renderOwnerTrustExpensePreviewEvidence(document: Document, props: OwnerTrustExpensePreviewEvidenceProps): HTMLElement;
