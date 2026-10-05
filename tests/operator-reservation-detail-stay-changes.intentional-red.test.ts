import { expect, test } from "bun:test";

test("Order 210 intentional red: reservation detail does not yet host governed stay changes", async () => {
  const script = await Bun.file("src/http/operator/operator.js").text();

  expect(script).toContain("Stay changes");
  expect(script).toContain("openReservationStayChanges");
  expect(script).toContain("reservationSegmentRequestGeneration");
  expect(script).toContain("restoreReservationSegmentEditorHome");
  expect(script).toContain("refreshReservationDetailAfterSegmentCommand");
});
