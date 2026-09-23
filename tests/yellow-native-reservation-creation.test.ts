import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

test("keeps reservation creation inside Yellow with canonical server boundaries", () => {
  for (const contract of [
    "ReservationCreateWorkspace",
    "New reservation",
    "Find an existing guest",
    "/availability:search",
    "/api/v1/reservations:commit",
    '"idempotency-key"',
    "promise=false",
    "commit arbitration",
    "I confirm these stay, guest and offer details",
    "Reservation created",
    "offerSearchGeneration",
    "generation !== offerSearchGeneration.current",
    "commitAttempt.current?.fingerprint !== fingerprint",
  ]) expect(app).toContain(contract);
  const fingerprint = app.slice(app.indexOf("const fingerprint = JSON.stringify"), app.indexOf("if (commitAttempt.current?.fingerprint"));
  expect(fingerprint).not.toContain("optionRef");
  expect(app).not.toContain("/operator/reservations?new=1");
});

test("renders an explicit four-stage, mobile-contained confirmation flow", () => {
  for (const step of ["Stay", "Guest", "Offer", "Review"])
    expect(app).toContain(`>${step}<`);
  expect(app).toContain('type="checkbox"');
  expect(css).toContain(".reservation-create-next");
  expect(css).toContain(".reservation-create-steps");
  expect(css).toContain("@media (max-width: 760px)");
});
