import { describe, expect, test } from "bun:test";
import { OPERATOR_INVOICE_FIXTURE_TIMEZONES as zones } from
  "./fixtures/order440-operator-invoices";

function calendar(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  });
}

describe("Q216 operator invoice replay calendar", () => {
  const initial = calendar(zones.initial);
  const shifted = calendar(zones.shifted);
  const replay = calendar(zones.replay);
  const utc = calendar("UTC");

  test("retains the earlier-hour positive control", () => {
    const instant = new Date("2026-09-07T04:40:04.528Z");
    expect(shifted.format(instant)).not.toBe(utc.format(instant));
    expect(shifted.format(instant)).not.toBe(replay.format(instant));
  });

  test("changes the actual replay date at the previously failing CI instant", () => {
    const instant = new Date("2026-09-07T12:40:04.528Z");
    // Keep the old choice as a negative control: UTC did not move this date.
    expect(shifted.format(instant)).toBe(utc.format(instant));
    expect(shifted.format(instant)).not.toBe(replay.format(instant));
  });

  for (const day of ["2026-09-07", "2028-02-29", "2026-12-31"]) {
    test(`initial and replay dates differ from shifted at every minute on ${day}`, () => {
      const start = Date.parse(`${day}T00:00:00.000Z`);
      for (let minute = 0; minute < 1440; minute++) {
        const instant = new Date(start + minute * 60_000);
        expect(shifted.format(instant)).not.toBe(initial.format(instant));
        expect(shifted.format(instant)).not.toBe(replay.format(instant));
      }
    });
  }
});
