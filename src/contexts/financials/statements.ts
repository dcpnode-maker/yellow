import type { Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FOLIO_REFERENCE = /^[A-Z0-9][A-Z0-9._\/-]{0,63}$/;
const CURSOR_TEXT = /^[A-Za-z0-9_-]{1,512}$/;
const BUSINESS_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MICROSECOND_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const CURSOR_KEYS = ["d", "f", "j", "p", "s", "t", "v"] as const;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_CHARGE_OPTIONS = 100;

export interface FolioStatementInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reference: string;
  readonly after?: string;
  readonly limit?: number;
  readonly canCorrectCharge?: boolean;
  readonly canPostSealAdjustment?: boolean;
}

export interface FolioStatementMetadata {
  readonly id: string;
  readonly reference: string | null;
  readonly name: string | null;
  readonly windowNo: number;
  readonly status: string;
  readonly currency: string;
  readonly createdAt: string;
}

export interface FolioSiblingWindow {
  readonly id: string;
  readonly windowNo: number;
  readonly reference: string | null;
  readonly name: string | null;
  readonly status: string;
  readonly balanceMinor: string;
}

export interface FolioTransferGroup {
  readonly id: string;
  readonly memberCount: number;
  readonly eligible: boolean;
  readonly reason: string | null;
  readonly currentWindowId: string;
}

export interface FolioStatementRow {
  readonly lineId: string;
  readonly journalId: string;
  readonly kind: string;
  readonly businessDate: string;
  readonly postedAt: string;
  readonly reversesJournalId: string | null;
  readonly reversedByJournalId: string | null;
  readonly correctionEligible: boolean;
  readonly correctionReason: string | null;
  readonly txCode: string;
  readonly description: string | null;
  readonly quantity: string;
  readonly amountMinor: string;
  readonly runningBalanceMinor: string;
  readonly transferGroup: FolioTransferGroup;
}

export interface FolioChargeOption {
  readonly code: string;
  readonly name: string;
  readonly usaliLine: string;
}

export interface FolioChargeAvailability {
  readonly allowed: boolean;
  readonly reason: string | null;
}

export interface FolioStatementResult {
  readonly reservationId: string | null;
  readonly folio: FolioStatementMetadata;
  readonly siblingWindows: readonly FolioSiblingWindow[];
  readonly balanceMinor: string;
  readonly stayTotalMinor: string;
  readonly generation: string;
  readonly lineCount: number;
  readonly rows: readonly FolioStatementRow[];
  readonly chargeOptions: readonly FolioChargeOption[];
  readonly chargeAvailability: FolioChargeAvailability;
  readonly nextCursor: string | null;
}

interface StatementCursor {
  readonly v: 1;
  readonly p: string;
  readonly f: string;
  readonly d: string;
  readonly t: string;
  readonly j: string;
  readonly s: number;
}

interface StatementSnapshotRow {
  readonly reservation_id: string | null;
  readonly folio_id: string;
  readonly folio_reference: string | null;
  readonly folio_name: string | null;
  readonly window_no: number;
  readonly folio_status: string;
  readonly currency: string;
  readonly folio_created_at: string;
  readonly balance_minor: string;
  readonly stay_total_minor: string;
  readonly generation: string;
  readonly sibling_windows: FolioSiblingWindow[];
  readonly line_count: number;
  readonly rows: FolioStatementRow[];
  readonly charge_options: FolioChargeOption[];
  readonly charge_allowed: boolean;
  readonly charge_reason: string | null;
  readonly has_more: boolean;
  readonly next_business_date: string | null;
  readonly next_posted_at: string | null;
  readonly next_journal_id: string | null;
  readonly next_seq: number | null;
}

export class FolioStatementValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FolioStatementValidationError";
  }
}

export class FolioStatementNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FolioStatementNotFoundError";
  }
}

function requirePlainRecord(name: string, value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new FolioStatementValidationError(`${name} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new FolioStatementValidationError(`${name} must be a plain object`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new FolioStatementValidationError(`${name} must not contain symbol fields`);
  }
}

function requireExactKeys(value: Record<string, unknown>): void {
  const allowed = new Set([
    "tenantId", "propertyNode", "reference", "after", "limit",
    "canCorrectCharge", "canPostSealAdjustment",
  ]);
  const unsupported = Object.getOwnPropertyNames(value).filter((key) => !allowed.has(key)).sort();
  if (unsupported.length > 0) {
    throw new FolioStatementValidationError(`Statement input contains unsupported fields: ${unsupported.join(", ")}`);
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new FolioStatementValidationError(`${name} must be a lowercase UUID`);
  }
  return value;
}

function decodeCursor(value: unknown): StatementCursor | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || !CURSOR_TEXT.test(value)) {
    throw new FolioStatementValidationError("after must be a bounded canonical base64url cursor");
  }

  let decoded: string;
  let parsed: unknown;
  try {
    decoded = Buffer.from(value, "base64url").toString("utf8");
    if (Buffer.from(decoded, "utf8").toString("base64url") !== value) throw new Error("non-canonical");
    parsed = JSON.parse(decoded);
  } catch {
    throw new FolioStatementValidationError("after must be a valid canonical statement cursor");
  }
  requirePlainRecord("Statement cursor", parsed);
  const keys = Object.getOwnPropertyNames(parsed).sort();
  if (keys.length !== CURSOR_KEYS.length || keys.some((key, index) => key !== CURSOR_KEYS[index])) {
    throw new FolioStatementValidationError("after cursor shape is invalid");
  }
  if (parsed.v !== 1) throw new FolioStatementValidationError("after cursor version is unsupported");
  const p = requireUuid("after.property", parsed.p);
  const f = requireUuid("after.folio", parsed.f);
  const j = requireUuid("after.journal", parsed.j);
  if (typeof parsed.d !== "string" || !BUSINESS_DATE.test(parsed.d)) {
    throw new FolioStatementValidationError("after business date is invalid");
  }
  if (typeof parsed.t !== "string" || !MICROSECOND_UTC.test(parsed.t)) {
    throw new FolioStatementValidationError("after posted timestamp is invalid");
  }
  if (typeof parsed.s !== "number" || !Number.isSafeInteger(parsed.s) || parsed.s < 1 || parsed.s > 32_767) {
    throw new FolioStatementValidationError("after sequence is invalid");
  }
  return Object.freeze({ v: 1, p, f, d: parsed.d, t: parsed.t, j, s: parsed.s });
}

function encodeCursor(cursor: StatementCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function normalize(input: FolioStatementInput): {
  tenantId: string;
  propertyNode: string;
  reference: string;
  referenceIsUuid: boolean;
  referenceUuid: string;
  cursor: StatementCursor | null;
  limit: number;
  canCorrectCharge: boolean;
  canPostSealAdjustment: boolean;
} {
  requirePlainRecord("Statement input", input);
  requireExactKeys(input);
  const tenantId = requireUuid("tenantId", input.tenantId);
  const propertyNode = requireUuid("propertyNode", input.propertyNode);
  if (typeof input.reference !== "string" ||
      (!UUID.test(input.reference) && !FOLIO_REFERENCE.test(input.reference))) {
    throw new FolioStatementValidationError("reference must be a lowercase folio UUID or canonical human reference");
  }
  if (input.limit !== undefined &&
      (typeof input.limit !== "number" || !Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > MAX_LIMIT)) {
    throw new FolioStatementValidationError(`limit must be an integer from 1 to ${MAX_LIMIT}`);
  }
  if (input.canCorrectCharge !== undefined && typeof input.canCorrectCharge !== "boolean") {
    throw new FolioStatementValidationError("canCorrectCharge must be server-derived boolean authority");
  }
  if (input.canPostSealAdjustment !== undefined && typeof input.canPostSealAdjustment !== "boolean") {
    throw new FolioStatementValidationError("canPostSealAdjustment must be server-derived boolean authority");
  }
  const cursor = decodeCursor(input.after);
  if (cursor && cursor.p !== propertyNode) {
    throw new FolioStatementValidationError("after cursor belongs to another property");
  }
  return Object.freeze({
    tenantId,
    propertyNode,
    reference: input.reference,
    referenceIsUuid: UUID.test(input.reference),
    referenceUuid: UUID.test(input.reference) ? input.reference : "00000000-0000-0000-0000-000000000000",
    cursor,
    limit: input.limit ?? DEFAULT_LIMIT,
    canCorrectCharge: input.canCorrectCharge ?? false,
    canPostSealAdjustment: input.canPostSealAdjustment ?? false,
  });
}

export class FolioStatementService {
  async get(tx: Tx, input: FolioStatementInput): Promise<FolioStatementResult> {
    const normalized = normalize(input);
    const cursor = normalized.cursor;
    // This projection's tenant/folio cardinality is intentionally parameter-sensitive.
    // Keep planning transaction-local, avoid cardinality-sensitive nested-loop
    // amplification, and skip JIT triggered by the deliberately inflated fallback cost.
    await tx`SELECT
      set_config('plan_cache_mode', 'force_custom_plan', true),
      set_config('jit', 'off', true),
      set_config('enable_nestloop', 'off', true)`;
    const rows = await tx<StatementSnapshotRow[]>`
      WITH resolved AS MATERIALIZED (
        SELECT
          folio.id,
          folio.folio_no,
          folio.name,
          folio.window_no,
          folio.status,
          folio.created_at,
          folio.reservation_id,
          account.id AS account_id,
          account.role AS account_role,
          account.status AS account_status,
          account.currency::text AS currency,
          property.id AS property_node,
          (statement_timestamp() AT TIME ZONE property.timezone)::date AS current_business_date
        FROM folio
        JOIN account
          ON account.tenant_id = folio.tenant_id
         AND account.id = folio.account_id
        JOIN org_node AS property
          ON property.tenant_id = account.tenant_id
         AND property.id = account.property_node
         AND property.kind = 'property'
        WHERE folio.tenant_id = ${normalized.tenantId}::uuid
          AND folio.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND property.id = ${normalized.propertyNode}::uuid
          AND ((${normalized.referenceIsUuid} AND folio.id = ${normalized.referenceUuid}::uuid)
            OR (NOT ${normalized.referenceIsUuid} AND folio.folio_no = ${normalized.reference}))
      ), journal_line_counts AS MATERIALIZED (
        SELECT candidate.journal_id, count(*)::int AS line_count
        FROM posting_line AS candidate
        WHERE candidate.tenant_id = ${normalized.tenantId}::uuid
          AND candidate.tenant_id = current_setting('app.tenant_id', true)::uuid
        GROUP BY candidate.journal_id
      ), canonical_charge_shapes AS MATERIALIZED (
        SELECT header.id AS journal_id, true AS canonical_pair
        FROM resolved
        JOIN journal AS header
          ON header.tenant_id = ${normalized.tenantId}::uuid
         AND header.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND header.property_node = resolved.property_node
         AND header.currency = resolved.currency::char(3)
         AND header.kind = 'charge'
         AND header.reverses IS NULL
         AND header.source = '{"interface":"financials.charge.post"}'::jsonb
        JOIN journal_line_counts AS line_count
          ON line_count.journal_id = header.id AND line_count.line_count = 2
        JOIN posting_line AS guest_line
          ON guest_line.tenant_id = header.tenant_id
         AND guest_line.journal_id = header.id
         AND guest_line.seq = 1
         AND guest_line.account_id = resolved.account_id
         AND guest_line.folio_id = resolved.id
         AND guest_line.amount_minor > 0
         AND guest_line.business_date = header.business_date
         AND guest_line.currency = header.currency
         AND guest_line.tax_detail IS NULL
        JOIN account AS guest_account
          ON guest_account.tenant_id = guest_line.tenant_id
         AND guest_account.id = guest_line.account_id
         AND guest_account.role = 'guest'
         AND guest_account.property_node = resolved.property_node
         AND guest_account.currency = resolved.currency::char(3)
        JOIN posting_line AS revenue_line
          ON revenue_line.tenant_id = guest_line.tenant_id
         AND revenue_line.journal_id = guest_line.journal_id
         AND revenue_line.seq = 2
         AND revenue_line.account_id <> guest_line.account_id
         AND revenue_line.folio_id IS NULL
         AND revenue_line.amount_minor = -guest_line.amount_minor
         AND revenue_line.tx_code = guest_line.tx_code
         AND revenue_line.quantity = guest_line.quantity
         AND revenue_line.description IS NOT DISTINCT FROM guest_line.description
         AND revenue_line.business_date = header.business_date
         AND revenue_line.currency = header.currency
         AND revenue_line.tax_detail IS NULL
        JOIN account AS revenue_account
          ON revenue_account.tenant_id = revenue_line.tenant_id
         AND revenue_account.id = revenue_line.account_id
         AND revenue_account.role = 'revenue'
         AND revenue_account.property_node = resolved.property_node
         AND revenue_account.currency = resolved.currency::char(3)
      ), relevant_roots AS MATERIALIZED (
        SELECT DISTINCT COALESCE(line.folio_transfer_root_line_id, line.id) AS root_line_id
        FROM resolved
        JOIN posting_line AS line
          ON line.tenant_id = ${normalized.tenantId}::uuid
         AND line.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND line.account_id = resolved.account_id
         AND line.folio_id = resolved.id
      ), root_allocations AS MATERIALIZED (
        SELECT COALESCE(candidate.folio_transfer_root_line_id, candidate.id) AS root_line_id,
               candidate.folio_id AS current_folio_id,
               sum(candidate.amount_minor) AS amount_minor
        FROM resolved
        JOIN posting_line AS candidate
          ON candidate.tenant_id = ${normalized.tenantId}::uuid
         AND candidate.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND candidate.account_id = resolved.account_id
         AND candidate.folio_id IS NOT NULL
        JOIN relevant_roots AS root
          ON COALESCE(candidate.folio_transfer_root_line_id, candidate.id) = root.root_line_id
        GROUP BY COALESCE(candidate.folio_transfer_root_line_id, candidate.id), candidate.folio_id
        HAVING sum(candidate.amount_minor) <> 0
      ), root_allocation_shapes AS MATERIALIZED (
        SELECT root_line_id, count(*)::int AS allocation_count,
               min(current_folio_id::text)::uuid AS current_folio_id,
               max(amount_minor) AS amount_minor
        FROM root_allocations
        GROUP BY root_line_id
      ), ledger AS MATERIALIZED (
        SELECT
          line.id AS line_id,
          header.id AS journal_id,
          header.kind,
          line.business_date,
          header.created_at,
          header.reverses AS reverses_journal_id,
          reversed_by.id AS reversed_by_journal_id,
          line.folio_transfer_root_line_id,
          line.tx_code,
          line.description,
          line.quantity::text AS quantity,
          line.amount_minor::text AS amount_minor,
          sum(line.amount_minor::numeric) OVER (
            ORDER BY line.business_date, header.created_at, header.id, line.seq
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          )::text AS running_balance_minor,
          line.seq,
          CASE
            WHEN NOT ${normalized.canCorrectCharge} THEN false
            WHEN resolved.status <> 'open' OR resolved.account_role <> 'guest'
              OR resolved.account_status <> 'open' THEN false
            WHEN current_day.business_date IS NULL OR original_day.business_date IS NULL THEN false
            WHEN (current_day.sealed_at IS NOT NULL OR original_day.sealed_at IS NOT NULL)
              AND NOT ${normalized.canPostSealAdjustment} THEN false
            WHEN header.kind <> 'charge' OR header.reverses IS NOT NULL
              OR header.source <> '{"interface":"financials.charge.post"}'::jsonb THEN false
            WHEN reversed_by.id IS NOT NULL THEN false
            WHEN NOT COALESCE(shape.canonical_pair, false) THEN false
            WHEN NOT COALESCE(routing.allocation_count = 1
              AND routing.current_folio_id = resolved.id
              AND routing.amount_minor = line.amount_minor, false) THEN false
            ELSE true
          END AS correction_eligible,
          CASE
            WHEN NOT ${normalized.canCorrectCharge} THEN 'adjustment_not_authorized'
            WHEN resolved.status <> 'open' OR resolved.account_role <> 'guest'
              OR resolved.account_status <> 'open' THEN 'folio_not_open'
            WHEN current_day.business_date IS NULL OR original_day.business_date IS NULL THEN 'business_day_missing'
            WHEN (current_day.sealed_at IS NOT NULL OR original_day.sealed_at IS NOT NULL)
              AND NOT ${normalized.canPostSealAdjustment}
              THEN 'post_seal_not_authorized'
            WHEN header.kind <> 'charge' OR header.reverses IS NOT NULL
              OR header.source <> '{"interface":"financials.charge.post"}'::jsonb THEN 'not_original_charge'
            WHEN reversed_by.id IS NOT NULL THEN 'already_corrected'
            WHEN NOT COALESCE(shape.canonical_pair, false) THEN 'inconsistent_posting_set'
            WHEN NOT COALESCE(routing.allocation_count = 1
              AND routing.current_folio_id = resolved.id
              AND routing.amount_minor = line.amount_minor, false)
              THEN 'charge_routed_from_original_folio'
            ELSE NULL
          END AS correction_reason
        FROM resolved
        JOIN posting_line AS line
          ON line.tenant_id = ${normalized.tenantId}::uuid
         AND line.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND line.folio_id = resolved.id
         AND line.account_id = resolved.account_id
        JOIN journal AS header
          ON header.tenant_id = line.tenant_id
         AND header.id = line.journal_id
         AND header.property_node = resolved.property_node
         AND header.currency = resolved.currency::char(3)
         AND header.business_date = line.business_date
        LEFT JOIN journal AS reversed_by
          ON reversed_by.tenant_id = header.tenant_id
         AND reversed_by.reverses = header.id
         AND reversed_by.property_node = header.property_node
         AND reversed_by.currency = header.currency
        LEFT JOIN root_allocation_shapes AS routing
          ON routing.root_line_id = line.id
        LEFT JOIN canonical_charge_shapes AS shape
          ON shape.journal_id = header.id
        LEFT JOIN business_day AS current_day
          ON current_day.tenant_id = ${normalized.tenantId}::uuid
         AND current_day.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND current_day.property_node = resolved.property_node
         AND current_day.business_date = resolved.current_business_date
        LEFT JOIN business_day AS original_day
          ON original_day.tenant_id = ${normalized.tenantId}::uuid
         AND original_day.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND original_day.property_node = resolved.property_node
         AND original_day.business_date = header.business_date
      ), page AS MATERIALIZED (
        SELECT *
        FROM ledger
        WHERE ${cursor === null}
           OR (business_date, created_at, journal_id, seq) <
              (${cursor?.d ?? "1970-01-01"}::date, ${cursor?.t ?? "1970-01-01T00:00:00.000000Z"}::timestamptz,
               ${cursor?.j ?? "00000000-0000-0000-0000-000000000000"}::uuid, ${cursor?.s ?? 1}::smallint)
        ORDER BY business_date DESC, created_at DESC, journal_id DESC, seq DESC
        LIMIT ${normalized.limit + 1}
      ), visible_page AS MATERIALIZED (
        SELECT * FROM page
        ORDER BY business_date DESC, created_at DESC, journal_id DESC, seq DESC
        LIMIT ${normalized.limit}
      ), visible_group_context AS MATERIALIZED (
        SELECT visible_page.*,
               COALESCE(group_original.id, visible_page.journal_id) AS transfer_group_id,
               group_original.id AS governed_group_id
        FROM visible_page
        LEFT JOIN posting_line AS canonical_root
          ON canonical_root.tenant_id = ${normalized.tenantId}::uuid
         AND canonical_root.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND canonical_root.id = COALESCE(visible_page.folio_transfer_root_line_id, visible_page.line_id)
        LEFT JOIN journal AS canonical_header
          ON canonical_header.tenant_id = canonical_root.tenant_id
         AND canonical_header.id = canonical_root.journal_id
        LEFT JOIN journal AS group_original
          ON group_original.tenant_id = canonical_header.tenant_id
         AND group_original.id = CASE
           WHEN canonical_header.kind = 'adjustment' THEN canonical_header.reverses
           ELSE canonical_header.id
         END
         AND group_original.kind = 'charge'
         AND group_original.reverses IS NULL
         AND group_original.source = '{"interface":"financials.charge.post"}'::jsonb
      ), governed_group_roots AS MATERIALIZED (
        SELECT original.id AS group_id, original_guest.id AS root_line_id
        FROM resolved
        JOIN (SELECT DISTINCT governed_group_id FROM visible_group_context
              WHERE governed_group_id IS NOT NULL) AS visible_group
          ON true
        JOIN journal AS original
          ON original.tenant_id = ${normalized.tenantId}::uuid
         AND original.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND original.id = visible_group.governed_group_id
         AND original.property_node = resolved.property_node
         AND original.currency = resolved.currency::char(3)
        JOIN posting_line AS original_guest
          ON original_guest.tenant_id = original.tenant_id
         AND original_guest.journal_id = original.id
         AND original_guest.seq = 1
         AND original_guest.account_id = resolved.account_id
        UNION ALL
        SELECT original.id, correction_guest.id
        FROM resolved
        JOIN (SELECT DISTINCT governed_group_id FROM visible_group_context
              WHERE governed_group_id IS NOT NULL) AS visible_group
          ON true
        JOIN journal AS original
          ON original.tenant_id = ${normalized.tenantId}::uuid
         AND original.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND original.id = visible_group.governed_group_id
         AND original.property_node = resolved.property_node
         AND original.currency = resolved.currency::char(3)
        JOIN journal AS correction
          ON correction.tenant_id = original.tenant_id
         AND correction.reverses = original.id
         AND correction.kind = 'adjustment'
         AND correction.source = '{"interface":"financials.charge.reverse"}'::jsonb
        JOIN posting_line AS correction_guest
          ON correction_guest.tenant_id = correction.tenant_id
         AND correction_guest.journal_id = correction.id
         AND correction_guest.seq = 1
         AND correction_guest.account_id = resolved.account_id
      ), transfer_group_shapes AS MATERIALIZED (
        SELECT roots.group_id, count(*)::int AS member_count,
               count(*) BETWEEN 1 AND 2
                 AND bool_and(allocation.allocation_count = 1
                   AND allocation.current_folio_id = resolved.id) AS eligible,
               CASE
                 WHEN count(*) NOT BETWEEN 1 AND 2 THEN 'inconsistent_group_members'
                 WHEN NOT bool_and(allocation.allocation_count = 1) THEN 'split_group_allocation'
                 WHEN NOT bool_and(allocation.current_folio_id = resolved.id) THEN 'group_in_another_window'
                 ELSE NULL
               END AS reason
        FROM resolved
        JOIN governed_group_roots AS roots ON true
        LEFT JOIN root_allocation_shapes AS allocation
          ON allocation.root_line_id = roots.root_line_id
        GROUP BY roots.group_id
      ), routed_visible_page AS MATERIALIZED (
        SELECT visible.*,
               COALESCE(group_shape.member_count, 0) AS transfer_member_count,
               COALESCE(group_shape.eligible, false) AS transfer_eligible,
               COALESCE(group_shape.reason, 'not_governed_charge_group') AS transfer_reason,
               resolved.id AS transfer_current_window_id
        FROM resolved
        JOIN visible_group_context AS visible ON true
        LEFT JOIN transfer_group_shapes AS group_shape
          ON group_shape.group_id = visible.governed_group_id
      ), applicable_options AS MATERIALIZED (
        SELECT code.code, code.name, code.usali_line
        FROM resolved
        JOIN tx_code_route AS route
          ON route.tenant_id = ${normalized.tenantId}::uuid
         AND route.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND route.property_node = resolved.property_node
         AND route.currency = resolved.currency::char(3)
        JOIN tx_code AS code
          ON code.code = route.tx_code
         AND code.grp = 'revenue'
         AND code.default_cr = 'revenue'
         AND code.usali_line IS NOT NULL
         AND btrim(code.usali_line) <> ''
        JOIN account AS revenue
          ON revenue.tenant_id = route.tenant_id
         AND revenue.id = route.credit_account_id
         AND revenue.property_node = route.property_node
         AND revenue.currency = route.currency
         AND revenue.role = 'revenue'
         AND revenue.status = 'open'
        ORDER BY code.code
        LIMIT ${MAX_CHARGE_OPTIONS}
      ), availability AS MATERIALIZED (
        SELECT
          CASE
            WHEN resolved.status <> 'open' THEN false
            WHEN resolved.account_role <> 'guest' OR resolved.account_status <> 'open' THEN false
            WHEN day.business_date IS NULL OR day.sealed_at IS NOT NULL THEN false
            WHEN NOT EXISTS (SELECT 1 FROM applicable_options) THEN false
            ELSE true
          END AS allowed,
          CASE
            WHEN resolved.status <> 'open' THEN 'folio_not_open'
            WHEN resolved.account_role <> 'guest' OR resolved.account_status <> 'open' THEN 'guest_account_not_open'
            WHEN day.business_date IS NULL THEN 'business_day_missing'
            WHEN day.sealed_at IS NOT NULL THEN 'business_day_sealed'
            WHEN NOT EXISTS (SELECT 1 FROM applicable_options) THEN 'no_charge_options'
            ELSE NULL
          END AS reason
        FROM resolved
        LEFT JOIN business_day AS day
          ON day.tenant_id = ${normalized.tenantId}::uuid
         AND day.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND day.property_node = resolved.property_node
         AND day.business_date = resolved.current_business_date
      ), family AS MATERIALIZED (
        SELECT sibling.id, sibling.window_no, sibling.folio_no, sibling.name, sibling.status,
               COALESCE(balance.balance_minor, 0)::text AS balance_minor
        FROM resolved
        JOIN folio AS sibling
          ON sibling.tenant_id = ${normalized.tenantId}::uuid
         AND sibling.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND sibling.reservation_id IS NOT DISTINCT FROM resolved.reservation_id
         AND sibling.account_id = resolved.account_id
        LEFT JOIN folio_balance AS balance
          ON balance.tenant_id = sibling.tenant_id AND balance.folio_id = sibling.id
      )
      SELECT
        resolved.reservation_id,
        resolved.id AS folio_id,
        resolved.folio_no AS folio_reference,
        resolved.name AS folio_name,
        resolved.window_no,
        resolved.status AS folio_status,
        resolved.currency,
        to_char(resolved.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS folio_created_at,
        COALESCE((SELECT sum(amount_minor::numeric)::text FROM ledger), '0') AS balance_minor,
        COALESCE((SELECT sum(balance_minor::numeric)::text FROM family), '0') AS stay_total_minor,
        md5(
          COALESCE((SELECT string_agg(id::text || ':' || window_no::text || ':' || balance_minor,
            '|' ORDER BY window_no, id) FROM family), '')
        ) AS generation,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', id,
            'windowNo', window_no,
            'reference', folio_no,
            'name', name,
            'status', status,
            'balanceMinor', balance_minor
          ) ORDER BY window_no, id)
          FROM family
        ), '[]'::jsonb) AS sibling_windows,
        (SELECT count(*)::int FROM ledger) AS line_count,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'lineId', line_id,
            'journalId', journal_id,
            'kind', kind,
            'businessDate', business_date::text,
            'postedAt', to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
            'reversesJournalId', reverses_journal_id,
            'reversedByJournalId', reversed_by_journal_id,
            'correctionEligible', correction_eligible,
            'correctionReason', correction_reason,
            'txCode', tx_code,
            'description', description,
            'quantity', quantity,
            'amountMinor', amount_minor,
            'runningBalanceMinor', running_balance_minor,
            'transferGroup', jsonb_build_object(
              'id', transfer_group_id,
              'memberCount', transfer_member_count,
              'eligible', transfer_eligible,
              'reason', transfer_reason,
              'currentWindowId', transfer_current_window_id
            )
          ) ORDER BY business_date DESC, created_at DESC, journal_id DESC, seq DESC)
          FROM routed_visible_page
        ), '[]'::jsonb) AS rows,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'code', code,
            'name', name,
            'usaliLine', usali_line
          ) ORDER BY code)
          FROM applicable_options
        ), '[]'::jsonb) AS charge_options,
        availability.allowed AS charge_allowed,
        availability.reason AS charge_reason,
        (SELECT count(*) > ${normalized.limit} FROM page) AS has_more,
        (SELECT business_date::text FROM visible_page ORDER BY business_date, created_at, journal_id, seq LIMIT 1) AS next_business_date,
        (SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') FROM visible_page ORDER BY business_date, created_at, journal_id, seq LIMIT 1) AS next_posted_at,
        (SELECT journal_id FROM visible_page ORDER BY business_date, created_at, journal_id, seq LIMIT 1) AS next_journal_id,
        (SELECT seq::int FROM visible_page ORDER BY business_date, created_at, journal_id, seq LIMIT 1) AS next_seq
      FROM resolved
      CROSS JOIN availability
    `;

    const snapshot = rows[0];
    if (!snapshot) throw new FolioStatementNotFoundError("Folio was not found in the property");
    if (cursor && cursor.f !== snapshot.folio_id) {
      throw new FolioStatementValidationError("after cursor belongs to another folio");
    }
    let nextCursor: string | null = null;
    if (snapshot.has_more) {
      if (!snapshot.next_business_date || !snapshot.next_posted_at ||
          !snapshot.next_journal_id || snapshot.next_seq === null) {
        throw new Error("PostgreSQL returned an incomplete statement page boundary");
      }
      nextCursor = encodeCursor(Object.freeze({
        v: 1,
        p: normalized.propertyNode,
        f: snapshot.folio_id,
        d: snapshot.next_business_date,
        t: snapshot.next_posted_at,
        j: snapshot.next_journal_id,
        s: snapshot.next_seq,
      }));
    }

    return Object.freeze({
      reservationId: snapshot.reservation_id,
      folio: Object.freeze({
        id: snapshot.folio_id,
        reference: snapshot.folio_reference,
        name: snapshot.folio_name,
        windowNo: snapshot.window_no,
        status: snapshot.folio_status,
        currency: snapshot.currency,
        createdAt: snapshot.folio_created_at,
      }),
      siblingWindows: Object.freeze(snapshot.sibling_windows.map((sibling) => Object.freeze(sibling))),
      balanceMinor: snapshot.balance_minor,
      stayTotalMinor: snapshot.stay_total_minor,
      generation: snapshot.generation,
      lineCount: snapshot.line_count,
      rows: Object.freeze(snapshot.rows.map((row) => Object.freeze(row))),
      chargeOptions: Object.freeze(snapshot.charge_options.map((option) => Object.freeze(option))),
      chargeAvailability: Object.freeze({ allowed: snapshot.charge_allowed, reason: snapshot.charge_reason }),
      nextCursor,
    });
  }
}
