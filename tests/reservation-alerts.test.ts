import { describe, expect, test } from "bun:test";

import {
  ReservationAlertService,
  ReservationAlertValidationError,
  type CreateReservationAlertInput,
} from "../src/contexts/reservations";
import { createAuditEnvelope, PostgresIdempotency, type EventBus, type Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000046301";
const PROPERTY = "00000000-0000-0000-0000-000000046311";
const ACTOR = "00000000-0000-0000-0000-000000046321";
const RESERVATION = "00000000-0000-0000-0000-000000046331";

function input(): CreateReservationAlertInput {
  return {
    reservationId: RESERVATION,
    code: "VIP",
    message: "Meet at reception",
    showOn: "checkin",
    idempotencyKey: "order463-alert-validation",
    envelope: createAuditEnvelope({
      actorId: ACTOR, tenantId: TENANT, propertyNode: PROPERTY,
      requestId: "00000000-0000-0000-0000-000000046341", operation: "reservation.modified",
    }),
  };
}

describe("Order 463 reservation alert validation", () => {
  test("rejects malformed, unsafe and over-bound commands before any SQL", async () => {
    let calls = 0;
    const noSql = (() => { calls += 1; return Promise.resolve([]); }) as unknown as Tx;
    const alerts = new ReservationAlertService({ events: {} as EventBus, idempotency: new PostgresIdempotency() });
    const valid = input();
    const invalid = [
      { ...valid, reservationId: "not-a-uuid" },
      { ...valid, code: "  " },
      { ...valid, code: "x".repeat(65) },
      { ...valid, code: "VIP\nCHECK" },
      { ...valid, message: "  " },
      { ...valid, message: "x".repeat(1001) },
      { ...valid, message: "unsafe\u0000control" },
      { ...valid, message: "unsafe\u000bcontrol" },
      { ...valid, showOn: "arrival" },
      { ...valid, idempotencyKey: "short" },
      { ...valid, envelope: { ...valid.envelope, operation: "reservation.alert.create" } },
    ];
    for (const candidate of invalid) {
      await expect(alerts.create(noSql, candidate as CreateReservationAlertInput))
        .rejects.toBeInstanceOf(ReservationAlertValidationError);
    }
    expect(calls).toBe(0);
  });

  test("normal multiline notes pass validation before the transaction executes", async () => {
    let calls = 0;
    const tx = (() => { calls++; throw new Error("SQL validation boundary reached"); }) as unknown as Tx;
    const alerts = new ReservationAlertService({ events: {} as EventBus, idempotency: new PostgresIdempotency() });
    await expect(alerts.create(tx, { ...input(), message: "Arrival\r\nCall guest\tfirst." }))
      .rejects.toThrow("SQL validation boundary reached");
    expect(calls).toBe(1);
  });
});
