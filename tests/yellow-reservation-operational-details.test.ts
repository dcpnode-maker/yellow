import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

test("edits the six canonical operational fields through the existing command", () => {
  for (const contract of [
    "modifyReservationOperationalDetails",
    'method: "PATCH"',
    'authorization: `Bearer ${await session()}`',
    '"idempotency-key": idempotencyKey',
    'notes: reservation.notes ?? ""',
    'eta: reservation.eta ?? ""',
    'etd: reservation.etd ?? ""',
    'marketCode: reservation.marketCode ?? ""',
    'sourceCode: reservation.sourceCode ?? ""',
    'originCode: reservation.originCode ?? ""',
    "Operational details",
    "Review operational changes",
    "Confirm and save details",
    "operationalAttempt.current?.fingerprint !== fingerprint",
    "normalizeReservationOperationalValue(field, operationalBaseline[field])",
    "normalizeReservationOperationalValue(field, operationalDraft[field])",
    "if (!reservation || operationalEditing || operationalPosting) return;",
    "await detail.refetch()",
    'await queryClient.invalidateQueries({ queryKey: ["reservation-board", propertyId] });',
    "onLifecycleBusyChange?.(true)",
    "onLifecycleBusyChange?.(false)",
  ]) expect(app).toContain(contract);

  expect(app).toContain('new Set(["reserved", "due_in", "in_house", "due_out"])');
  expect(app).toContain("maxLength={4000}");
  expect(app).toContain("changedOperationalFields.length === 0");
  expect(app).toContain("setOperationalConfirmed(false)");
  expect(app).toContain('if (match[2] === "Z") return `${match[1]}+00:00`;');
  expect(app).toContain('digits.length === 2 ? "00" : digits.slice(2, 4)');
  expect(app).toContain("setOperationalBaseline(canonicalOperationalFields)");
});

test("keeps the editor bounded and mobile contained", () => {
  expect(css).toContain(".reservation-operational-card");
  expect(css).toContain(".reservation-operational-fields");
  expect(css).toContain(".reservation-operational-review");
  expect(css).toContain("@media (max-width: 760px)");
});
