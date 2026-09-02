import type { Database } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FIVE_MINUTES_MS = 300_000 as const;

export type ReadinessReasonCode =
  | "unresolved_due_in"
  | "unresolved_due_out"
  | "open_cashier_session"
  | "unresolved_discrepancy"
  | "outbox_lag_exceeded"
  | "financial_interface_pending"
  | "fiscal_interface_pending"
  | "statutory_interface_pending"
  | "channel_delivery_pending"
  | "source_attribution_unknown";

export type ReadinessSource =
  | "reservations" | "cashiers" | "discrepancies" | "outbox"
  | "financial" | "fiscal" | "statutory" | "channel";

export interface ReadinessReason {
  readonly code: ReadinessReasonCode;
  readonly source: ReadinessSource;
  readonly count: number;
}

export type OutboxLag =
  | { readonly kind: "none"; readonly ageMilliseconds: 0 }
  | {
      readonly kind: "within_threshold" | "over_threshold";
      readonly oldestCreatedAt: string;
      readonly ageMilliseconds: number;
      readonly thresholdMilliseconds: 300000;
    }
  | { readonly kind: "unknown"; readonly count: number };

export interface BusinessDayCloseReadinessInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly businessDate: string;
  readonly actorId: string;
}

export interface BusinessDayCloseReadiness {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly businessDate: string;
  readonly capturedAt: string;
  readonly ready: boolean;
  readonly reasons: readonly ReadinessReason[];
  readonly counts: {
    readonly unresolvedDueIn: number;
    readonly unresolvedDueOut: number;
    readonly openCashiers: number;
    readonly unresolvedDiscrepancies: number;
    readonly financialInterface: number;
    readonly fiscalInterface: number;
    readonly statutoryInterface: number;
    readonly channelDelivery: number;
    readonly unknownAttribution: number;
  };
  readonly outboxLag: OutboxLag;
}

export interface BusinessDayCloseReadinessServiceOptions {
  readonly database: Database;
}

interface ReadinessRow {
  readonly tenant_id: unknown;
  readonly property_node: unknown;
  readonly business_date: unknown;
  readonly captured_at: unknown;
  readonly due_in: unknown;
  readonly due_out: unknown;
  readonly open_cashiers: unknown;
  readonly discrepancies: unknown;
  readonly financial_interface: unknown;
  readonly fiscal_interface: unknown;
  readonly statutory_interface: unknown;
  readonly channel_delivery: unknown;
  readonly unknown_due: unknown;
  readonly unknown_discrepancy: unknown;
  readonly unknown_outbox: unknown;
  readonly unknown_financial: unknown;
  readonly unknown_fiscal: unknown;
  readonly unknown_statutory: unknown;
  readonly unknown_channel: unknown;
  readonly oldest_unpublished: unknown;
  readonly outbox_age_ms: unknown;
  readonly outbox_over_threshold: unknown;
}

export class BusinessDayCloseReadinessValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessDayCloseReadinessValidationError";
  }
}

export class BusinessDayCloseReadinessUnavailableError extends Error {
  constructor() {
    super("Business-day close readiness is unavailable");
    this.name = "BusinessDayCloseReadinessUnavailableError";
  }
}

function plain(value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new BusinessDayCloseReadinessValidationError("business-day close readiness input must be a plain object");
  }
}

function identifier(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new BusinessDayCloseReadinessValidationError(`${field} must be a lowercase UUID`);
  }
  return value;
}

function normalize(input: BusinessDayCloseReadinessInput): Readonly<BusinessDayCloseReadinessInput> {
  plain(input);
  const expected = ["tenantId", "propertyNode", "businessDate", "actorId"];
  if (Object.keys(input).length !== expected.length || expected.some((key) => !Object.hasOwn(input, key))) {
    throw new BusinessDayCloseReadinessValidationError("business-day close readiness input shape is invalid");
  }
  if (typeof input.businessDate !== "string" || !DATE.test(input.businessDate)) {
    throw new BusinessDayCloseReadinessValidationError("businessDate must be canonical YYYY-MM-DD");
  }
  const parsedDate = new Date(`${input.businessDate}T00:00:00.000Z`);
  if (!Number.isFinite(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== input.businessDate) {
    throw new BusinessDayCloseReadinessValidationError("businessDate must be a real canonical calendar date");
  }
  return Object.freeze({
    tenantId: identifier(input.tenantId, "tenantId"),
    propertyNode: identifier(input.propertyNode, "propertyNode"),
    businessDate: input.businessDate,
    actorId: identifier(input.actorId, "actorId"),
  });
}

function text(value: unknown, field: string, pattern?: RegExp): string {
  if (typeof value !== "string" || (pattern && !pattern.test(value))) throw new Error(`Database returned invalid ${field}`);
  return value;
}

function instant(value: unknown, field: string): string {
  const rendered = value instanceof Date ? value.toISOString() : text(value, field);
  const parsed = new Date(rendered);
  if (!Number.isFinite(parsed.valueOf())) throw new Error(`Database returned invalid ${field}`);
  return parsed.toISOString();
}

function count(value: unknown, field: string): number {
  const parsed = typeof value === "bigint" ? Number(value) :
    typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Database returned invalid ${field}`);
  return parsed;
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Database returned invalid ${field}`);
  return value;
}

function reason(code: ReadinessReasonCode, source: ReadinessSource, total: number): ReadinessReason {
  return Object.freeze({ code, source, count: total });
}

function materialize(row: ReadinessRow, expected: Readonly<BusinessDayCloseReadinessInput>): BusinessDayCloseReadiness {
  const tenantId = text(row.tenant_id, "tenant id", UUID);
  const propertyNode = text(row.property_node, "property node", UUID);
  const businessDate = text(row.business_date, "business date", DATE);
  if (tenantId !== expected.tenantId || propertyNode !== expected.propertyNode || businessDate !== expected.businessDate) {
    throw new Error("Database returned readiness for a different target");
  }

  const unresolvedDueIn = count(row.due_in, "due-in count");
  const unresolvedDueOut = count(row.due_out, "due-out count");
  const openCashiers = count(row.open_cashiers, "cashier count");
  const unresolvedDiscrepancies = count(row.discrepancies, "discrepancy count");
  const financialInterface = count(row.financial_interface, "financial interface count");
  const fiscalInterface = count(row.fiscal_interface, "fiscal interface count");
  const statutoryInterface = count(row.statutory_interface, "statutory interface count");
  const channelDelivery = count(row.channel_delivery, "channel delivery count");
  const unknown = Object.freeze({
    reservations: count(row.unknown_due, "unknown reservation count"),
    discrepancies: count(row.unknown_discrepancy, "unknown discrepancy count"),
    outbox: count(row.unknown_outbox, "unknown outbox count"),
    financial: count(row.unknown_financial, "unknown financial count"),
    fiscal: count(row.unknown_fiscal, "unknown fiscal count"),
    statutory: count(row.unknown_statutory, "unknown statutory count"),
    channel: count(row.unknown_channel, "unknown channel count"),
  });
  const unknownAttribution = Object.values(unknown).reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(unknownAttribution)) throw new Error("Database returned excessive unknown attribution");

  let outboxLag: OutboxLag;
  if (unknown.outbox > 0) {
    outboxLag = Object.freeze({ kind: "unknown", count: unknown.outbox });
  } else if (row.oldest_unpublished === null) {
    if (row.outbox_age_ms !== null || row.outbox_over_threshold !== null) {
      throw new Error("Database returned incoherent empty outbox lag");
    }
    outboxLag = Object.freeze({ kind: "none", ageMilliseconds: 0 });
  } else {
    const ageMilliseconds = count(row.outbox_age_ms, "outbox age");
    const over = boolean(row.outbox_over_threshold, "outbox threshold classification");
    if (over !== (ageMilliseconds >= FIVE_MINUTES_MS)) throw new Error("Database returned incoherent outbox threshold");
    outboxLag = Object.freeze({
      kind: over ? "over_threshold" : "within_threshold",
      oldestCreatedAt: instant(row.oldest_unpublished, "oldest unpublished instant"),
      ageMilliseconds,
      thresholdMilliseconds: FIVE_MINUTES_MS,
    });
  }

  const reasons: ReadinessReason[] = [];
  if (unresolvedDueIn) reasons.push(reason("unresolved_due_in", "reservations", unresolvedDueIn));
  if (unresolvedDueOut) reasons.push(reason("unresolved_due_out", "reservations", unresolvedDueOut));
  if (openCashiers) reasons.push(reason("open_cashier_session", "cashiers", openCashiers));
  if (unresolvedDiscrepancies) reasons.push(reason("unresolved_discrepancy", "discrepancies", unresolvedDiscrepancies));
  if (outboxLag.kind === "over_threshold") reasons.push(reason("outbox_lag_exceeded", "outbox", 1));
  if (financialInterface) reasons.push(reason("financial_interface_pending", "financial", financialInterface));
  if (fiscalInterface) reasons.push(reason("fiscal_interface_pending", "fiscal", fiscalInterface));
  if (statutoryInterface) reasons.push(reason("statutory_interface_pending", "statutory", statutoryInterface));
  if (channelDelivery) reasons.push(reason("channel_delivery_pending", "channel", channelDelivery));
  if (unknownAttribution) {
    const source = (Object.entries(unknown) as Array<[ReadinessSource, number]>).find(([, value]) => value > 0)![0];
    reasons.push(reason("source_attribution_unknown", source, unknownAttribution));
  }
  const counts = Object.freeze({ unresolvedDueIn, unresolvedDueOut, openCashiers, unresolvedDiscrepancies,
    financialInterface, fiscalInterface, statutoryInterface, channelDelivery, unknownAttribution });
  const frozenReasons = Object.freeze(reasons);
  return Object.freeze({
    tenantId,
    propertyNode,
    businessDate,
    capturedAt: instant(row.captured_at, "capture instant"),
    ready: frozenReasons.length === 0 && (outboxLag.kind === "none" || outboxLag.kind === "within_threshold"),
    reasons: frozenReasons,
    counts,
    outboxLag,
  });
}

export class BusinessDayCloseReadinessService {
  readonly #database: Database;

  constructor(options: BusinessDayCloseReadinessServiceOptions) {
    this.#database = options.database;
  }

  async read(input: BusinessDayCloseReadinessInput): Promise<BusinessDayCloseReadiness> {
    const target = normalize(input);
    const rows = await this.#database.withTenantTransaction(target.tenantId, (tx) => tx<ReadinessRow[]>`
      WITH target AS MATERIALIZED (
        SELECT day.tenant_id, day.property_node, day.business_date,
               pg_catalog.transaction_timestamp() AS captured_at
          FROM business_day AS day
          JOIN tenant ON tenant.id=day.tenant_id AND tenant.status='active'
          JOIN org_node AS property ON property.tenant_id=day.tenant_id
            AND property.id=day.property_node AND property.kind='property'
          JOIN app_user AS actor ON actor.tenant_id=day.tenant_id
            AND actor.id=${target.actorId}::uuid AND actor.status='active'
         WHERE day.tenant_id=${target.tenantId}::uuid
           AND day.property_node=${target.propertyNode}::uuid
           AND day.business_date=${target.businessDate}::date
           AND day.sealed_at IS NULL
      ),
      due AS MATERIALIZED (
        SELECT count(*) FILTER (WHERE reservation.status='due_in' AND transition.safe
          AND transition.property_node=(SELECT property_node FROM target)
          AND transition.business_date=(SELECT business_date FROM target))::bigint AS due_in,
               count(*) FILTER (WHERE reservation.status='due_out' AND transition.safe
          AND transition.property_node=(SELECT property_node FROM target)
          AND transition.business_date=(SELECT business_date FROM target))::bigint AS due_out,
               count(*) FILTER (WHERE NOT pg_catalog.coalesce(transition.safe,false))::bigint AS unknown_due
          FROM reservation
          LEFT JOIN LATERAL (
            SELECT event.property_node, event.business_date,
                   event.event_type=('reservation.' || reservation.status) AND event.property_node IS NOT NULL
                     AND property.id IS NOT NULL AS safe
              FROM outbox AS event
              LEFT JOIN org_node AS property ON property.tenant_id=event.tenant_id
                AND property.id=event.property_node AND property.kind='property'
             WHERE event.tenant_id=reservation.tenant_id
               AND event.aggregate_type='reservation' AND event.aggregate_id=reservation.id
               AND event.event_type IN ('reservation.due_in','reservation.due_out')
             ORDER BY event.seq DESC LIMIT 1
          ) AS transition ON true
         WHERE reservation.tenant_id=(SELECT tenant_id FROM target)
           AND reservation.status IN ('due_in','due_out')
      ),
      cashiers AS MATERIALIZED (
        SELECT count(*)::bigint AS open_cashiers FROM cashier_session
         WHERE tenant_id=(SELECT tenant_id FROM target)
           AND property_node=(SELECT property_node FROM target)
           AND business_date=(SELECT business_date FROM target) AND closed_at IS NULL
      ),
      discrepancy_evidence AS MATERIALIZED (
        SELECT discrepancy.id, space.property_node AS space_property,
               count(event.seq)::bigint AS event_count,
               min(event.property_node::text)::uuid AS event_property,
               min(event.business_date) AS event_date
          FROM discrepancy
          LEFT JOIN space ON space.tenant_id=discrepancy.tenant_id AND space.id=discrepancy.space_id
          LEFT JOIN outbox AS event ON event.tenant_id=discrepancy.tenant_id
            AND event.aggregate_type='discrepancy' AND event.aggregate_id=discrepancy.id
            AND event.event_type='discrepancy.reported'
         WHERE discrepancy.tenant_id=(SELECT tenant_id FROM target) AND discrepancy.resolved_at IS NULL
         GROUP BY discrepancy.id, space.property_node
      ),
      discrepancies AS MATERIALIZED (
        SELECT count(*) FILTER (WHERE event_count=1 AND space_property=event_property
          AND event_property=(SELECT property_node FROM target)
          AND event_date=(SELECT business_date FROM target))::bigint AS discrepancies,
               count(*) FILTER (WHERE event_count<>1 OR space_property IS NULL OR event_property IS NULL
                 OR space_property<>event_property)::bigint AS unknown_discrepancy
          FROM discrepancy_evidence
      ),
      target_outbox AS MATERIALIZED (
        SELECT min(created_at) AS oldest_unpublished
          FROM outbox
         WHERE tenant_id=(SELECT tenant_id FROM target)
           AND property_node=(SELECT property_node FROM target)
           AND business_date=(SELECT business_date FROM target)
           AND published_at IS NULL AND created_at<=(SELECT captured_at FROM target)
      ),
      unsafe_outbox AS MATERIALIZED (
        SELECT count(*)::bigint AS unknown_outbox
          FROM outbox AS event
          LEFT JOIN org_node AS property ON property.tenant_id=event.tenant_id
            AND property.id=event.property_node AND property.kind='property'
         WHERE event.tenant_id=(SELECT tenant_id FROM target)
           AND event.business_date=(SELECT business_date FROM target) AND event.published_at IS NULL
           AND (event.property_node IS NULL OR property.id IS NULL OR
                (event.property_node=(SELECT property_node FROM target)
                  AND event.created_at>(SELECT captured_at FROM target)))
      ),
      financial AS MATERIALIZED (
        SELECT 0::bigint AS financial_interface,
               count(*)::bigint AS unknown_financial
          FROM payment_operation
          JOIN LATERAL (
            SELECT attempt.status
              FROM payment AS attempt
             WHERE attempt.tenant_id=payment_operation.tenant_id
               AND attempt.operation_id=payment_operation.id
             ORDER BY attempt.attempt_no DESC, attempt.id DESC LIMIT 1
          ) AS head ON true
         WHERE payment_operation.tenant_id=(SELECT tenant_id FROM target)
           AND payment_operation.property_node=(SELECT property_node FROM target)
           AND head.status='pending'
      ),
      fiscal AS MATERIALIZED (
        SELECT count(*) FILTER (WHERE document.property_node=(SELECT property_node FROM target)
          AND document.business_date=(SELECT business_date FROM target))::bigint AS fiscal_interface,
               count(*) FILTER (WHERE document.id IS NULL OR document.property_node IS NULL
                 OR document.business_date IS NULL OR property.id IS NULL)::bigint AS unknown_fiscal
          FROM fiscal_submission
          LEFT JOIN document ON document.tenant_id=fiscal_submission.tenant_id
            AND document.id=fiscal_submission.document_id
          LEFT JOIN org_node AS property ON property.tenant_id=document.tenant_id
            AND property.id=document.property_node AND property.kind='property'
         WHERE fiscal_submission.tenant_id=(SELECT tenant_id FROM target)
           AND fiscal_submission.status IN ('pending','submitted','rejected','error')
      ),
      statutory AS MATERIALIZED (
        SELECT 0::bigint AS statutory_interface,
               count(*)::bigint AS unknown_statutory
          FROM statutory_submission
         WHERE tenant_id=(SELECT tenant_id FROM target)
           AND property_node=(SELECT property_node FROM target)
           AND status IN ('pending','submitted','failed')
      ),
      channel_work AS MATERIALIZED (
        SELECT 0::bigint AS channel_delivery,
          ((SELECT count(*) FROM inbound_message
             WHERE tenant_id=(SELECT tenant_id FROM target) AND status IN ('received','error'))
           + (SELECT count(*) FROM outbox
               WHERE tenant_id=(SELECT tenant_id FROM target)
                 AND property_node=(SELECT property_node FROM target)
                 AND business_date=(SELECT business_date FROM target)
                 AND event_type='ari.push_requested' AND published_at IS NULL))::bigint AS unknown_channel
      )
      SELECT target.tenant_id::text, target.property_node::text, target.business_date::text,
             target.captured_at, due.due_in, due.due_out, cashiers.open_cashiers,
             discrepancies.discrepancies, financial.financial_interface,
             fiscal.fiscal_interface, statutory.statutory_interface, channel_work.channel_delivery,
             due.unknown_due, discrepancies.unknown_discrepancy, unsafe_outbox.unknown_outbox,
             financial.unknown_financial, fiscal.unknown_fiscal, statutory.unknown_statutory,
             channel_work.unknown_channel, target_outbox.oldest_unpublished,
             CASE WHEN target_outbox.oldest_unpublished IS NULL THEN NULL ELSE
               floor(extract(epoch FROM (target.captured_at-target_outbox.oldest_unpublished))*1000)::bigint END AS outbox_age_ms,
             CASE WHEN target_outbox.oldest_unpublished IS NULL THEN NULL ELSE
               target.captured_at-target_outbox.oldest_unpublished >= interval '5 minutes' END AS outbox_over_threshold
        FROM target CROSS JOIN due CROSS JOIN cashiers CROSS JOIN discrepancies
        CROSS JOIN target_outbox CROSS JOIN unsafe_outbox CROSS JOIN financial CROSS JOIN fiscal
        CROSS JOIN statutory CROSS JOIN channel_work
    `);
    if (rows.length !== 1 || !rows[0]) throw new BusinessDayCloseReadinessUnavailableError();
    return materialize(rows[0], target);
  }
}
