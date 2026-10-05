export type FolioWindowComparisonWindow = Readonly<{
  folioId: string;
  windowNo: number;
  name: string | null;
  reference: string | null;
  status: string;
}>;

export type FolioComparisonStatement = Readonly<{
  reservationId: string | null;
  folio: Readonly<{ id: string; reference: string | null; name: string | null; windowNo: number; status: string; currency: string }>;
  balanceMinor: string;
  stayTotalMinor: string;
  rows: readonly Readonly<{
    lineId: string; journalId: string; kind: string; businessDate: string; description: string | null;
    quantity: string; amountMinor: string; runningBalanceMinor: string; txCode: string;
    transferGroup: Readonly<{ id: string; memberCount: number; eligible: boolean; reason: string | null; currentWindowId: string }>;
  }>[];
}>;

export const MAX_FOLIO_COMPARISON_PANES = 9;

export function initialFolioComparisonSelection(
  family: readonly FolioWindowComparisonWindow[],
  activeFolioId: string | null,
): readonly string[] {
  return activeFolioId !== null && family.some((window) => window.folioId === activeFolioId)
    ? [activeFolioId]
    : [];
}

/** Preserve selected server windows, prune deleted members, and include a newly active member if capacity remains. */
export function reconcileFolioComparisonSelection(
  selected: readonly string[],
  family: readonly FolioWindowComparisonWindow[],
  activeFolioId: string | null,
  maximum = MAX_FOLIO_COMPARISON_PANES,
): readonly string[] {
  const known = new Set(family.map((window) => window.folioId));
  const next = [...new Set(selected.filter((folioId) => known.has(folioId)))].slice(0, maximum);
  if (activeFolioId !== null && known.has(activeFolioId) && !next.includes(activeFolioId) && next.length < maximum) {
    next.push(activeFolioId);
  }
  return next;
}

export type FolioComparisonSelectionResult = Readonly<{
  selected: readonly string[];
  reason: "selected" | "deselected" | "unknown_folio" | "pane_limit";
}>;

export function toggleFolioComparisonSelection(
  selected: readonly string[],
  folioId: string,
  family: readonly FolioWindowComparisonWindow[],
  maximum = MAX_FOLIO_COMPARISON_PANES,
): FolioComparisonSelectionResult {
  if (!family.some((window) => window.folioId === folioId)) return { selected, reason: "unknown_folio" };
  if (selected.includes(folioId)) return { selected: selected.filter((id) => id !== folioId), reason: "deselected" };
  if (selected.length >= maximum) return { selected, reason: "pane_limit" };
  return { selected: [...selected, folioId], reason: "selected" };
}

export function validateFolioComparisonStatement(
  candidate: unknown,
  reservationId: string,
  window: FolioWindowComparisonWindow,
): FolioComparisonStatement {
  const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
  const isMinor = (value: unknown): value is string => typeof value === "string" && /^(?:0|[1-9][0-9]*|-[1-9][0-9]*)$/u.test(value);
  const isValidRow = (row: unknown): boolean => isObject(row) && isObject(row.transferGroup) &&
    typeof row.lineId === "string" && row.lineId.length > 0 &&
    typeof row.journalId === "string" && row.journalId.length > 0 &&
    typeof row.businessDate === "string" &&
    (typeof row.description === "string" || row.description === null) &&
    typeof row.kind === "string" && typeof row.txCode === "string" &&
    typeof row.quantity === "string" && isMinor(row.amountMinor) && isMinor(row.runningBalanceMinor) &&
    typeof row.transferGroup.id === "string" && typeof row.transferGroup.memberCount === "number" &&
    Number.isSafeInteger(row.transferGroup.memberCount) && typeof row.transferGroup.eligible === "boolean" &&
    (typeof row.transferGroup.reason === "string" || row.transferGroup.reason === null) &&
    typeof row.transferGroup.currentWindowId === "string";
  if (!isObject(candidate) || !isObject(candidate.folio) || !Array.isArray(candidate.rows) ||
      candidate.reservationId !== reservationId ||
      candidate.folio.id !== window.folioId ||
      candidate.folio.windowNo !== window.windowNo ||
      typeof candidate.folio.currency !== "string" || !/^[A-Z]{3}$/u.test(candidate.folio.currency) ||
      typeof candidate.folio.status !== "string" ||
      typeof candidate.folio.reference !== "string" && candidate.folio.reference !== null ||
      typeof candidate.folio.name !== "string" && candidate.folio.name !== null ||
      !isMinor(candidate.balanceMinor) || !isMinor(candidate.stayTotalMinor) ||
      !candidate.rows.every(isValidRow)) {
    throw new Error("The returned statement does not match this reservation and folio window. Retry this pane to reconcile the exact read.");
  }
  return candidate as unknown as FolioComparisonStatement;
}
