import { createStaffReadClient } from "./workspaces/staff-crs-client";

export const BUSINESS_MIX_PERIODS = ["today", "week", "month", "quarter", "year"] as const;
export type BusinessMixPeriod = typeof BUSINESS_MIX_PERIODS[number];
export type BusinessMixRow = Readonly<{ marketSegmentGroup: string; marketSegment: string; source: string; channel: string; roomNights: number; roomRevenueMinor: string; adrMinor: string; shareBasisPoints: number }>;
export type BusinessMixSnapshot = Readonly<{ currency: string; fromDate: string; toDateExclusive: string; recordedDays: number; expectedDays: number; rows: readonly BusinessMixRow[] }>;
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function count(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function minor(value: unknown): value is string { return typeof value === "string" && /^-?(?:0|[1-9]\d*)$/.test(value); }
function label(value: unknown): string {
  if (!record(value) || typeof value.label !== "string" || !value.label.trim() || typeof value.code !== "string") throw new Error("Business mix attribution is malformed.");
  return value.label;
}
function expectedWindow(businessDate: unknown, period: BusinessMixPeriod) {
  if (typeof businessDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) throw new Error("Invalid business date.");
  const day = new Date(`${businessDate}T00:00:00.000Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0,10) !== businessDate || day.getUTCFullYear() < 1 || day.getUTCFullYear() > 9998) throw new Error("Invalid business date.");
  const from = new Date(day), to = new Date(day);
  to.setUTCDate(to.getUTCDate()+1);
  if (period === "week") from.setUTCDate(from.getUTCDate()-(from.getUTCDay()+6)%7);
  if (period === "month") from.setUTCDate(1);
  if (period === "quarter") { from.setUTCDate(1); from.setUTCMonth(Math.floor(from.getUTCMonth()/3)*3); }
  if (period === "year") { from.setUTCDate(1); from.setUTCMonth(0); }
  return { fromDate: from.toISOString().slice(0,10), toDateExclusive: to.toISOString().slice(0,10), expectedDays: Math.round((to.getTime()-from.getTime())/86_400_000) };
}
export function parseBusinessMix(value: unknown, propertyId: string, period: BusinessMixPeriod): BusinessMixSnapshot {
  const invalid = () => { throw new Error("Business mix evidence is incomplete or belongs to a different scope."); };
  if (!record(value) || value.provenance !== "stats_daily_commercial_taxonomy" || !record(value.property) || value.property.id !== propertyId ||
      typeof value.property.currency !== "string" || !/^[A-Z]{3}$/.test(value.property.currency) || !record(value.window) || value.window.period !== period ||
      typeof value.window.fromDate !== "string" || typeof value.window.toDateExclusive !== "string" || !count(value.window.expectedDays) || value.window.expectedDays < 1 || value.window.expectedDays > 366 ||
      !count(value.window.recordedDays) || value.window.recordedDays > value.window.expectedDays || !record(value.total) || !count(value.total.roomNights) || !minor(value.total.roomRevenueMinor) || !Array.isArray(value.groups)) return invalid();
  const rows: BusinessMixRow[] = [];
  let expected;
  try { expected = expectedWindow(value.property.businessDate,period); } catch { return invalid(); }
  if (expected.fromDate !== value.window.fromDate || expected.toDateExclusive !== value.window.toDateExclusive || expected.expectedDays !== value.window.expectedDays) return invalid();
  const totalNights = value.total.roomNights;
  for (const group of value.groups) {
    if (!record(group) || !Array.isArray(group.segments)) return invalid();
    const marketSegmentGroup = label(group.marketSegmentGroup);
    for (const segment of group.segments) {
      if (!record(segment) || !Array.isArray(segment.sources)) return invalid();
      const marketSegment = label(segment.marketSegment);
      for (const source of segment.sources) {
        if (!record(source) || !record(source.metric) || !count(source.metric.roomNights) || !minor(source.metric.roomRevenueMinor) || !minor(source.metric.adrMinor)) return invalid();
        rows.push(Object.freeze({ marketSegmentGroup, marketSegment, source: label(source.source), channel: label(source.channelCode),
          roomNights: source.metric.roomNights, roomRevenueMinor: source.metric.roomRevenueMinor, adrMinor: source.metric.adrMinor,
          shareBasisPoints: totalNights === 0 ? 0 : Number(BigInt(source.metric.roomNights) * 10_000n / BigInt(totalNights)) }));
      }
    }
  }
  if (rows.reduce((sum,row) => sum + row.roomNights,0) !== totalNights || rows.reduce((sum,row) => sum + BigInt(row.roomRevenueMinor),0n) !== BigInt(value.total.roomRevenueMinor)) return invalid();
  rows.sort((a,b) => b.roomNights - a.roomNights || a.source.localeCompare(b.source) || a.marketSegment.localeCompare(b.marketSegment));
  return Object.freeze({ currency: value.property.currency, fromDate: value.window.fromDate, toDateExclusive: value.window.toDateExclusive,
    recordedDays: value.window.recordedDays, expectedDays: value.window.expectedDays, rows: Object.freeze(rows) });
}
export async function loadBusinessMix(propertyId: string, period: BusinessMixPeriod, signal?: AbortSignal) {
  const response = await createStaffReadClient().read(`/api/v1/properties/${propertyId}/commercial-contribution?period=${period}`, [propertyId], () => ({}), signal);
  return parseBusinessMix(response.value, propertyId, period);
}
export function movementHaptic(): void {
  try { if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(12); }
  catch { /* Optional device feedback must never interrupt navigation. */ }
}
