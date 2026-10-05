export type CellCopyOutcome = "copied" | "unavailable" | "failed";
export type ClipboardTextWriter = (text: string) => Promise<void>;

/** Writes only the caller-provided visible cell text, and only when explicitly invoked. */
export async function copyVisibleCellText(
  visibleText: string,
  writeText?: ClipboardTextWriter | null,
): Promise<CellCopyOutcome> {
  const writer = writeText === undefined
    ? typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function"
      ? navigator.clipboard.writeText.bind(navigator.clipboard)
      : undefined
    : writeText;
  if (!writer) return "unavailable";
  try {
    await writer(visibleText);
    return "copied";
  } catch {
    return "failed";
  }
}
