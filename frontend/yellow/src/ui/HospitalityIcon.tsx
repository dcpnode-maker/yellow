import type { ReactNode } from "react";

export type HospitalityIconName = "arrival" | "departure" | "in-house";

const shapes: Record<HospitalityIconName, ReactNode> = {
  arrival: <><path d="M12 4h7a1 1 0 0 1 1 1v15h-8M3 12h12m-4-4 4 4-4 4" /><path d="M17 12h.01" /></>,
  departure: <><path d="M12 4H5a1 1 0 0 0-1 1v15h8M10 12h11m-4-4 4 4-4 4" /><path d="M7 12h.01" /></>,
  "in-house": <><path d="M3 7v13m18-7v7M3 17h18M11 13V9h6a4 4 0 0 1 4 4H3" /><circle cx="7" cy="10" r="2" /></>,
};

/** Decorative only: the visible movement label and button name carry meaning. */
export function HospitalityIcon({ name }: { name: HospitalityIconName }) {
  return <svg className="hospitality-icon" data-hospitality-icon={name} viewBox="0 0 24 24"
    aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round">{shapes[name]}</svg>;
}
