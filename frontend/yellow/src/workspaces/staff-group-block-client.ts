import type { StaffGroupBlockEvidence } from "./StaffGroupBlockEvidenceCard.mjs";
import { createStaffReadClient, staffRecord, staffCount, STAFF_UUID, StaffModuleError, type StaffClientOptions } from "./staff-crs-client";

type Workbench = Readonly<{ groups: readonly StaffGroupBlockEvidence[] }>;
function invalid(): never { throw new StaffModuleError("Group block evidence could not be verified. Read it again."); }
function text(value: unknown): value is string { return typeof value === "string" && value.length > 0; }
function nullableText(value: unknown): value is string | null { return value === null || typeof value === "string"; }
function uuid(value: unknown): value is string { return typeof value === "string" && STAFF_UUID.test(value); }
function nullableUuid(value: unknown): value is string | null { return value === null || uuid(value); }
function date(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function nullableDate(value: unknown): value is string | null { return value === null || date(value); }
function instant(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value) &&
    date(value.slice(0, 10)) && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === `${value.slice(0, 23)}Z`;
}

/** Shape validation of the returned native DTO; scope is authorized by the server and captured read transport. */
export function parseStaffGroupBlocks(value: unknown): Workbench {
  if (!staffRecord(value) || !Array.isArray(value.groups)) invalid();
  const ids = new Set<string>();
  const groups = value.groups.map((group: unknown) => {
    if (!staffRecord(group) || !uuid(group.groupId) || ids.has(group.groupId) || !text(group.code) ||
        !nullableText(group.name) || !text(group.status) || typeof group.statusDeductsInventory !== "boolean" ||
        !nullableUuid(group.accountPartyId) || !nullableText(group.accountPartyName) || !nullableDate(group.cutoffDate) ||
        typeof group.elastic !== "boolean" || !Object.hasOwn(group, "washSchedule") || group.washSchedule === undefined ||
        !nullableUuid(group.masterFolioId) || !nullableText(group.masterFolioNo) || !nullableText(group.masterFolioStatus) ||
        !nullableDate(group.arrivalDate) || !nullableDate(group.departureDate) ||
        !staffCount(group.blockedRooms) || !staffCount(group.pickedUpRooms) || !staffCount(group.remainingRooms) ||
        !staffCount(group.pickupPercent) || typeof group.cutoffState !== "string" ||
        !["future", "due_today", "past_due", "not_set"].includes(group.cutoffState) ||
        !Array.isArray(group.allotment) || !Array.isArray(group.roomingList)) invalid();
    ids.add(group.groupId);
    const allotmentIds = new Set<string>(), roomingIds = new Set<string>();
    const allotment = group.allotment.map((row: unknown) => {
      if (!staffRecord(row) || !uuid(row.unitTypeId) || !text(row.unitTypeCode) || !text(row.unitTypeName) ||
          !date(row.stayDate) || !staffCount(row.blocked) || !staffCount(row.pickedUp) || !staffCount(row.remaining) ||
          !Object.hasOwn(row, "rateOverride") || row.rateOverride === undefined) invalid();
      const key = `${row.unitTypeId}:${row.stayDate}`;
      if (allotmentIds.has(key)) invalid(); allotmentIds.add(key);
      return Object.freeze({ unitTypeId: row.unitTypeId, unitTypeCode: row.unitTypeCode, unitTypeName: row.unitTypeName,
        stayDate: row.stayDate, blocked: row.blocked, pickedUp: row.pickedUp, remaining: row.remaining, rateOverride: row.rateOverride });
    });
    const roomingList = group.roomingList.map((row: unknown) => {
      if (!staffRecord(row) || !uuid(row.reservationId) ||
          !text(row.confirmationNo) || !text(row.primaryGuestDisplayName) || !text(row.status) ||
          !nullableText(row.unitTypeCode) || !nullableText(row.unitTypeName) || !instant(row.stayFrom) ||
          !instant(row.stayTo) || !staffCount(row.pickedUpNights)) invalid();
      // Native SQL groups by reservation and room-type code/name; split stays legitimately repeat a reservation ID.
      const key = JSON.stringify([row.reservationId, row.unitTypeCode, row.unitTypeName]);
      if (roomingIds.has(key)) invalid(); roomingIds.add(key);
      return Object.freeze({ reservationId: row.reservationId, confirmationNo: row.confirmationNo,
        primaryGuestDisplayName: row.primaryGuestDisplayName, status: row.status, unitTypeCode: row.unitTypeCode,
        unitTypeName: row.unitTypeName, stayFrom: row.stayFrom, stayTo: row.stayTo, pickedUpNights: row.pickedUpNights });
    });
    return Object.freeze({ groupId: group.groupId, code: group.code, name: group.name, status: group.status,
      statusDeductsInventory: group.statusDeductsInventory, accountPartyId: group.accountPartyId, accountPartyName: group.accountPartyName,
      cutoffDate: group.cutoffDate, elastic: group.elastic, washSchedule: group.washSchedule, masterFolioId: group.masterFolioId,
      masterFolioNo: group.masterFolioNo, masterFolioStatus: group.masterFolioStatus, arrivalDate: group.arrivalDate,
      departureDate: group.departureDate, blockedRooms: group.blockedRooms, pickedUpRooms: group.pickedUpRooms,
      remainingRooms: group.remainingRooms, pickupPercent: group.pickupPercent,
      cutoffState: group.cutoffState as Workbench["groups"][number]["cutoffState"],
      allotment: Object.freeze(allotment), roomingList: Object.freeze(roomingList) });
  });
  return Object.freeze({ groups: Object.freeze(groups) });
}

export function createStaffGroupBlockClient(options: StaffClientOptions = {}) {
  const client = createStaffReadClient(options);
  return Object.freeze({ async read(propertyId: string, signal?: AbortSignal) {
    const response = await client.read(`/api/v1/properties/${propertyId}/group-blocks`, [propertyId], () => ({}), signal);
    return Object.freeze({ property: response.properties[0]!, ...parseStaffGroupBlocks(response.value) });
  } });
}
