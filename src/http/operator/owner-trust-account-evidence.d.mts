import type { OwnerTrustAccountView } from "../../contexts/financials/index";

export type ReadyOwnerTrustAccountEvidenceProps = Readonly<{
  state: "ready";
  propertyNode: string;
  propertyLabel: string;
  readIdentity: string;
  page: Readonly<{
    accounts: readonly OwnerTrustAccountView[];
    nextCursor: string | null;
  }>;
  selectedAccountReference?: string | null;
  formattedBalances?: Readonly<Record<string, string | undefined>>;
}>;

export type OwnerTrustAccountEvidenceProps = ReadyOwnerTrustAccountEvidenceProps
  | Readonly<{ state: "loading" | "unavailable" }>;

/** Returns a fresh detached element. Admission, scope fences and commands belong to the caller. */
export function renderOwnerTrustAccountEvidence(document: Document, props: OwnerTrustAccountEvidenceProps): HTMLElement;
