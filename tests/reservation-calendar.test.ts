import { describe, expect, test } from "bun:test";
import { ReservationCalendarConflictError, ReservationCalendarService, ReservationCalendarValidationError, reservationCalendarDates } from "../src/contexts/reservations";
import type { Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000068101";
const PROPERTY = "00000000-0000-0000-0000-000000068102";
const ROOM = "00000000-0000-0000-0000-000000068103";
const TYPE = "00000000-0000-0000-0000-000000068104";
const RESERVATION = "00000000-0000-0000-0000-000000068105";
const SEGMENT = "00000000-0000-0000-0000-000000068106";
const input = (fromDate = "2026-11-01", toDateExclusive = "2026-11-04") => ({ tenantId: TENANT, propertyNode: PROPERTY, fromDate, toDateExclusive });
const room = () => ({ sellable_unit_id: ROOM, sellable_unit_label: "Room 101", unit_type_id: TYPE, unit_type_code: "DLX", unit_type_label: "Deluxe", room_condition: "clean", out_of_service: false });
const segment = () => ({ reservation_id: RESERVATION, confirmation_no: "R-681", display_name: "Calendar Guest", reservation_status: "reserved", segment_id: SEGMENT, segment_seq: 1, segment_status: "booked", stay_from: "2026-11-01T19:00:00.000000Z", stay_to: "2026-11-04T16:00:00.000000Z", local_from_date: "2026-11-01", local_to_date_exclusive: "2026-11-04", clip_from_date: "2026-11-01", clip_to_date_exclusive: "2026-11-04", continues_before: false, continues_after: false, segment_unit_type_id: TYPE, unit_type_id: TYPE, unit_type_code: "DLX", unit_type_label: "Deluxe", assigned_sellable_unit_id: ROOM, sellable_unit_id: ROOM, sellable_unit_label: "Room 101" });

function mockTx(rooms: Record<string, unknown>[] = [room()], segments: Record<string, unknown>[] = [segment()]): Tx {
  let call = 0;
  return ((..._args: unknown[]) => Promise.resolve((++call === 1 ? [{ id: PROPERTY, timezone: "America/New_York" }] : call === 2 ? rooms : segments))) as unknown as Tx;
}

describe("Order681 reservation calendar read contract", () => {
  test("strict date bounds reject rollover, zero, reverse and more than 31 local days before SQL", async () => {
    expect(reservationCalendarDates("2026-11-01", "2026-12-02")).toBe(31);
    for (const [from, to] of [["0000-01-01", "0000-01-02"], ["2026-02-30", "2026-03-01"], ["2026-11-01", "2026-11-01"], ["2026-11-02", "2026-11-01"], ["2026-11-01", "2026-12-03"], ["2026-1-01", "2026-11-02"]]) {
      expect(() => reservationCalendarDates(from!, to!)).toThrow(ReservationCalendarValidationError);
    }
    let calls = 0;
    const tx = (() => { calls++; return Promise.resolve([]); }) as unknown as Tx;
    await expect(new ReservationCalendarService().list(tx, input("2026-02-30", "2026-03-01"))).rejects.toBeInstanceOf(ReservationCalendarValidationError);
    expect(calls).toBe(0);
  });

  test("returns all row identities, local clipping and separate explicit room/segment limits", async () => {
    const page = await new ReservationCalendarService().list(mockTx(), input());
    expect(page).toMatchObject({ propertyId: PROPERTY, timezone: "America/New_York", fromDate: "2026-11-01", toDateExclusive: "2026-11-04", limit: 1000, limited: false, roomLimit: 500, roomsLimited: false });
    expect(page.rooms).toHaveLength(1);
    expect(page.segments).toHaveLength(1);
    expect(page.segments[0]).toMatchObject({ reservationId: RESERVATION, segmentId: SEGMENT, sellableUnitId: ROOM, clipFromDate: "2026-11-01", clipToDateExclusive: "2026-11-04", roomCondition: "clean", outOfService: false });
    expect(Object.isFrozen(page.segments[0])).toBe(true);
    const limited = await new ReservationCalendarService().list(mockTx(Array.from({ length: 501 }, room), Array.from({ length: 1001 }, segment)), input());
    expect(limited.rooms).toHaveLength(500);
    expect(limited.segments).toHaveLength(1000);
    expect(limited.roomsLimited).toBe(true);
    expect(limited.limited).toBe(true);
  });

  test("malformed or foreign joined assignments and missing guest fail closed", async () => {
    const service = new ReservationCalendarService();
    for (const bad of [{ assigned_sellable_unit_id: ROOM, sellable_unit_id: null, sellable_unit_label: null }, { unit_type_id: null, unit_type_code: null }, { display_name: null }]) {
      await expect(service.list(mockTx([room()], [{ ...segment(), ...bad }]), input())).rejects.toBeInstanceOf(ReservationCalendarConflictError);
    }
  });
});
