import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const coverage = {
  "ui/HotelSearch.tsx": 1, "ui/TableControls.tsx": 2, "ui/TableColumnMenu.tsx": 2,
  "ui/BusinessMappings.tsx": 4, "workspaces/ReservationWorkspace.tsx": 8,
  "workspaces/FinanceWorkspace.tsx": 4, "workspaces/GroupReservationWorkspace.tsx": 2,
  "workspaces/ArrivalPickupWorkspace.tsx": 3,
};
function expression(tag: string, key: string) {
  const at = tag.indexOf(key + "={");
  if (at < 0) throw new Error(`Missing ${key}`);
  const from = at + key.length + 2;
  let depth = 1, quote = "", escape = false;
  for (let i = from; i < tag.length; i++) {
    const ch = tag[i]!;
    if (quote) { if (escape) escape = false; else if (ch === "\\") escape = true; else if (ch === quote) quote = ""; continue; }
    if (['"', "'", "`"].includes(ch)) { quote = ch; continue; }
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (!depth) return tag.slice(from, i);
  }
  throw new Error(`Unclosed ${key}`);
}
test("26 active field adapters preserve the same draft updates and confirmation resets as typing", () => {
  let total = 0;
  for (const [file, expected] of Object.entries(coverage)) {
    const text = readFileSync(`frontend/yellow/src/${file}`, "utf8");
    const fields = [...text.matchAll(/<Voice(?:Input|Textarea)\b[\s\S]*?\/>/g)];
    expect(fields.length).toBe(expected);
    total += fields.length;
    for (const [tag] of fields) {
      const typed = expression(tag, "onChange").replace(/^\(?event\)?\s*=>/, "voiceValue =>")
        .replaceAll("event.target.value", "voiceValue").replace(/\s+/g, " ");
      expect(expression(tag, "onVoiceValue")).toBe(typed);
      expect(expression(tag, "contextKey").length).toBeGreaterThan(0);
      expect(tag).not.toMatch(/type="(?:password|number|date|email|tel)"|inputMode="(?:decimal|numeric)"/);
    }
  }
  expect(total).toBe(26);
});
test("reservation and finance microphones bind to the current record; floating assistant is removed", () => {
  const reservation = readFileSync("frontend/yellow/src/workspaces/ReservationWorkspace.tsx", "utf8");
  const finance = readFileSync("frontend/yellow/src/workspaces/FinanceWorkspace.tsx", "utf8");
  expect(reservation).toContain("contextKey={`${propertyId}:${reservationId}`}");
  expect(finance).toContain("contextKey={`${propertyId}:${selectedReservationId}:${selectedFolioId}`}");
  expect(readFileSync("frontend/yellow/src/App.tsx", "utf8")).not.toContain('<button className="yellow-launch"');
});
