import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 224 intentional red requires exact reservation-to-Folio return continuity", () => {
  const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
  expect(script).toContain("function reservationFolioReturnIsCurrent(");
  expect(script).toContain("function openReservationFolioWorkspace(");
  expect(script).toContain("function returnFromFolioWorkspaceToReservation(");
  expect(css).toContain(".folio-reservation-return");
});
