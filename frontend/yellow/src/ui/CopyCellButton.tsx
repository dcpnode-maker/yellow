import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { copyVisibleCellText, type CellCopyOutcome } from "./cell-copy";
import "./table-controls.css";

const feedbackFor = (outcome: CellCopyOutcome | null): string => {
  switch (outcome) {
    case "copied": return "Copied";
    case "unavailable": return "Unavailable";
    case "failed": return "Failed";
    case null: return "";
  }
};

/** Explicitly copies the caller-supplied visible cell text. */
export function CopyCellButton({ value, label }: Readonly<{ value: string; label: string }>) {
  const [outcome, setOutcome] = useState<CellCopyOutcome | null>(null);
  const copy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setOutcome(await copyVisibleCellText(value));
  };
  const keepRowClosed = (event: KeyboardEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };
  const feedback = feedbackFor(outcome);

  return <span className="copy-cell-control">
    <button type="button" className="copy-cell-button" data-outcome={outcome ?? "idle"} aria-label={`Copy ${label} cell text`} title={outcome === "copied" ? `${label} copied` : outcome === "failed" ? `Could not copy ${label}` : outcome === "unavailable" ? `Clipboard unavailable for ${label}` : `Copy ${label}`} onClick={copy} onKeyDown={keepRowClosed}>
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="5.25" y="4.25" width="8" height="9" rx="1.25" stroke="currentColor" strokeWidth="1.3" />
        <path d="M10.75 4V3.5A1.5 1.5 0 0 0 9.25 2h-5A1.5 1.5 0 0 0 2.75 3.5v7A1.5 1.5 0 0 0 4.25 12h1" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    </button>
    <span className="copy-cell-feedback" role="status" aria-live="polite">{feedback}</span>
  </span>;
}
