import type { Tx } from "../../kernel";
import { CommercialTaxonomyService, resolveCommercialAttribution, type CommercialLeaf } from "./commercial-attribution";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type CommercialContributionPeriod = "today" | "week" | "month" | "quarter" | "year";
export function isCommercialContributionPeriod(value: unknown): value is CommercialContributionPeriod {
  return value === "today" || value === "week" || value === "month" || value === "quarter" || value === "year";
}
export function commercialContributionWindow(businessDate: string, period: CommercialContributionPeriod) {
  if (!isCommercialContributionPeriod(period) || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) throw new TypeError("Invalid contribution period");
  const date = new Date(`${businessDate}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== businessDate || date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9998) throw new TypeError("Invalid business date");
  const from = new Date(date);
  if (period === "week") from.setUTCDate(from.getUTCDate() - (from.getUTCDay() + 6) % 7);
  if (period === "month") from.setUTCDate(1);
  if (period === "quarter") { from.setUTCDate(1); from.setUTCMonth(Math.floor(from.getUTCMonth() / 3) * 3); }
  if (period === "year") { from.setUTCDate(1); from.setUTCMonth(0); }
  const to = new Date(date); to.setUTCDate(to.getUTCDate() + 1);
  return Object.freeze({ period, fromDate: from.toISOString().slice(0,10), toDateExclusive: to.toISOString().slice(0,10), expectedDays: Math.round((to.getTime()-from.getTime()) / 86_400_000) });
}

type PropertyRow = Readonly<{
  name: string;
  currency: string;
  business_date: string;
}>;

type StatsRow = Readonly<{
  unit_type_id: string;
  market_code: string;
  source_code: string;
  channel_code: string;
  rooms_available: number;
  room_nights: number;
  room_revenue_minor: string;
  recorded_dates: string[];
}>;

export type CommercialContributionMetric = Readonly<{
  roomNights: number;
  roomsAvailable: number;
  occupancyBasisPoints: number;
  roomRevenueMinor: string;
  adrMinor: string;
  revparMinor: string;
}>;

export type CommercialContributionSource = Readonly<{
  source: CommercialLeaf;
  channelCode: CommercialLeaf;
  metric: CommercialContributionMetric;
}>;

export type CommercialContributionSegment = Readonly<{
  marketSegment: CommercialLeaf;
  metric: CommercialContributionMetric;
  sources: readonly CommercialContributionSource[];
}>;

export type CommercialContributionGroup = Readonly<{
  marketSegmentGroup: CommercialLeaf;
  metric: CommercialContributionMetric;
  segments: readonly CommercialContributionSegment[];
}>;

export type CommercialContribution = Readonly<{
  property: Readonly<{ id: string; name: string; businessDate: string; currency: string }>;
  window: ReturnType<typeof commercialContributionWindow> & Readonly<{ recordedDays: number }>;
  total: CommercialContributionMetric;
  groups: readonly CommercialContributionGroup[];
  provenance: "stats_daily_commercial_taxonomy";
}>;

type MutableMetric = { roomNights: number; roomsAvailable: number; roomRevenue: bigint };

function emptyMetric(): MutableMetric {
  return { roomNights: 0, roomsAvailable: 0, roomRevenue: 0n };
}

function addMetric(target: MutableMetric, row: Readonly<{ roomNights: number; roomsAvailable: number; roomRevenueMinor: string }>): void {
  target.roomNights += Math.max(0, Math.trunc(row.roomNights));
  target.roomsAvailable += Math.max(0, Math.trunc(row.roomsAvailable));
  target.roomRevenue += BigInt(row.roomRevenueMinor);
}

function clampBasisPoints(value: number): number {
  return Math.max(0, Math.min(10_000, Math.round(value)));
}

function freezeMetric(metric: MutableMetric): CommercialContributionMetric {
  const roomNights = Math.max(0, metric.roomNights);
  const roomsAvailable = Math.max(0, metric.roomsAvailable);
  const roomRevenue = metric.roomRevenue;
  return Object.freeze({
    roomNights,
    roomsAvailable,
    occupancyBasisPoints: roomsAvailable === 0 ? 0 : clampBasisPoints(roomNights * 10_000 / roomsAvailable),
    roomRevenueMinor: roomRevenue.toString(),
    adrMinor: roomNights === 0 ? "0" : (roomRevenue / BigInt(roomNights)).toString(),
    revparMinor: roomsAvailable === 0 ? "0" : (roomRevenue / BigInt(roomsAvailable)).toString(),
  });
}

function leafKey(value: CommercialLeaf): string {
  return `${value.code}:${value.reason ?? "mapped"}`;
}

function sourceKey(source: CommercialLeaf, channel: CommercialLeaf): string {
  return `${leafKey(source)}|${leafKey(channel)}`;
}

function compareLabel(a: { label: string; code: string }, b: { label: string; code: string }): number {
  return a.label.localeCompare(b.label) || a.code.localeCompare(b.code);
}

export class CommercialContributionService {
  readonly #taxonomy = new CommercialTaxonomyService();

  async load(tx: Tx, input: Readonly<{ tenantId: string; propertyNode: string; period?: CommercialContributionPeriod }>): Promise<CommercialContribution> {
    if (!UUID.test(input.tenantId) || !UUID.test(input.propertyNode)) throw new TypeError("tenantId and propertyNode must be UUIDs");
    const propertyRows = await tx<PropertyRow[]>`
      SELECT name, currency::text AS currency,
             (transaction_timestamp() AT TIME ZONE timezone)::date::text AS business_date
      FROM org_node
      WHERE tenant_id=${input.tenantId}::uuid
        AND tenant_id=current_setting('app.tenant_id', true)::uuid
        AND id=${input.propertyNode}::uuid
        AND kind='property'
    `;
    const property = propertyRows[0];
    if (!property || propertyRows.length !== 1) throw new Error("Property contribution scope was not found");
    const window = commercialContributionWindow(property.business_date, input.period ?? "today");

    const taxonomy = await this.#taxonomy.load(tx, input);
    const rows = await tx<StatsRow[]>`
      SELECT unit_type_id::text, market_code, source_code, channel_code,
             sum(rooms_available)::int AS rooms_available,
             sum(rooms_sold)::int AS room_nights,
             sum(room_revenue_minor)::text AS room_revenue_minor,
             array_agg(DISTINCT business_date::text) AS recorded_dates
      FROM stats_daily
      WHERE tenant_id=${input.tenantId}::uuid
        AND tenant_id=current_setting('app.tenant_id', true)::uuid
        AND property_node=${input.propertyNode}::uuid
        AND business_date >= ${window.fromDate}::date
        AND business_date < ${window.toDateExclusive}::date
      GROUP BY unit_type_id, market_code, source_code, channel_code
      ORDER BY market_code, source_code, channel_code, unit_type_id
    `;

    const total = emptyMetric();
    const recordedDates = new Set<string>();
    const groups = new Map<string, {
      leaf: CommercialLeaf;
      metric: MutableMetric;
      segments: Map<string, {
        leaf: CommercialLeaf;
        metric: MutableMetric;
        sources: Map<string, { source: CommercialLeaf; channel: CommercialLeaf; metric: MutableMetric }>;
      }>;
    }>();

    for (const row of rows) {
      for (const date of row.recorded_dates) recordedDates.add(date);
      const attribution = resolveCommercialAttribution(taxonomy, {
        marketCode: row.market_code,
        sourceCode: row.source_code,
        channelCode: row.channel_code,
        unitTypeId: row.unit_type_id,
      });
      const contribution = Object.freeze({
        roomNights: row.room_nights,
        roomsAvailable: row.rooms_available,
        roomRevenueMinor: row.room_revenue_minor,
      });
      addMetric(total, contribution);
      const groupKey = leafKey(attribution.demand.group);
      const group = groups.get(groupKey) ?? {
        leaf: attribution.demand.group,
        metric: emptyMetric(),
        segments: new Map(),
      };
      groups.set(groupKey, group);
      addMetric(group.metric, contribution);

      const segmentKey = leafKey(attribution.demand.segment);
      const segment = group.segments.get(segmentKey) ?? {
        leaf: attribution.demand.segment,
        metric: emptyMetric(),
        sources: new Map(),
      };
      group.segments.set(segmentKey, segment);
      addMetric(segment.metric, contribution);

      const mappedSourceKey = sourceKey(attribution.distribution.source, attribution.distribution.channelCode);
      const source = segment.sources.get(mappedSourceKey) ?? {
        source: attribution.distribution.source,
        channel: attribution.distribution.channelCode,
        metric: emptyMetric(),
      };
      segment.sources.set(mappedSourceKey, source);
      addMetric(source.metric, contribution);
    }

    const frozenGroups = [...groups.values()]
      .sort((a, b) => compareLabel(a.leaf, b.leaf))
      .map((group) => Object.freeze({
        marketSegmentGroup: group.leaf,
        metric: freezeMetric(group.metric),
        segments: Object.freeze([...group.segments.values()]
          .sort((a, b) => compareLabel(a.leaf, b.leaf))
          .map((segment) => Object.freeze({
            marketSegment: segment.leaf,
            metric: freezeMetric(segment.metric),
            sources: Object.freeze([...segment.sources.values()]
              .sort((a, b) => compareLabel(a.source, b.source) || compareLabel(a.channel, b.channel))
              .map((source) => Object.freeze({
                source: source.source,
                channelCode: source.channel,
                metric: freezeMetric(source.metric),
              }))),
          }))),
      }));

    return Object.freeze({
      property: Object.freeze({ id: input.propertyNode, name: property.name, businessDate: property.business_date, currency: property.currency }),
      window: Object.freeze({ ...window, recordedDays: recordedDates.size }),
      total: freezeMetric(total),
      groups: Object.freeze(frozenGroups),
      provenance: "stats_daily_commercial_taxonomy",
    });
  }
}
