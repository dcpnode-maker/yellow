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
  readonly folio: FolioStatementMetadata;
  readonly balanceMinor: string;
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
  readonly folio_id: string;
  readonly folio_reference: string | null;
  readonly folio_name: string | null;
  readonly window_no: number;
  readonly folio_status: string;
  readonly currency: string;
  readonly folio_created_at: string;
  readonly balance_minor: string;
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
    const rows = await tx<StatementSnapshotRow[]>`
      WITH resolved AS MATERIALIZED (
        SELECT
          folio.id,
          folio.folio_no,
          folio.name,
          folio.window_no,
          folio.status,
          folio.created_at,
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
      ), ledger AS MATERIALIZED (
        SELECT
          line.id AS line_id,
          header.id AS journal_id,
          header.kind,
          line.business_date,
          header.created_at,
          header.reverses AS reverses_journal_id,
          reversed_by.id AS reversed_by_journal_id,
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
            WHEN NOT shape.canonical_pair THEN false
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
            WHEN NOT shape.canonical_pair THEN 'inconsistent_posting_set'
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
        JOIN LATERAL (
          SELECT
            count(*) = 2
            AND EXISTS (
              SELECT 1
                FROM posting_line AS guest_line
                JOIN account AS guest_account
                  ON guest_account.tenant_id = guest_line.tenant_id
                 AND guest_account.id = guest_line.account_id
                JOIN posting_line AS revenue_line
                  ON revenue_line.tenant_id = guest_line.tenant_id
                 AND revenue_line.journal_id = guest_line.journal_id
                 AND revenue_line.seq = 2
                JOIN account AS revenue_account
                  ON revenue_account.tenant_id = revenue_line.tenant_id
                 AND revenue_account.id = revenue_line.account_id
               WHERE guest_line.tenant_id = header.tenant_id
                 AND guest_line.journal_id = header.id
                 AND guest_line.seq = 1
                 AND guest_line.account_id = resolved.account_id
                 AND guest_line.folio_id = resolved.id
                 AND guest_account.role = 'guest'
                 AND guest_account.property_node = resolved.property_node
                 AND guest_account.currency = resolved.currency::char(3)
                 AND guest_line.amount_minor > 0
                 AND revenue_line.account_id <> guest_line.account_id
                 AND revenue_line.folio_id IS NULL
                 AND revenue_account.role = 'revenue'
                 AND revenue_account.property_node = resolved.property_node
                 AND revenue_account.currency = resolved.currency::char(3)
                 AND revenue_line.amount_minor = -guest_line.amount_minor
                 AND revenue_line.tx_code = guest_line.tx_code
                 AND revenue_line.quantity = guest_line.quantity
                 AND revenue_line.description = guest_line.description
                 AND guest_line.business_date = header.business_date
                 AND revenue_line.business_date = header.business_date
                 AND guest_line.currency = header.currency
                 AND revenue_line.currency = header.currency
                 AND guest_line.tax_detail IS NULL
                 AND revenue_line.tax_detail IS NULL
            ) AS canonical_pair
            FROM posting_line AS original
           WHERE original.tenant_id = header.tenant_id
             AND original.journal_id = header.id
        ) AS shape ON true
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
      )
      SELECT
        resolved.id AS folio_id,
        resolved.folio_no AS folio_reference,
        resolved.name AS folio_name,
        resolved.window_no,
        resolved.status AS folio_status,
        resolved.currency,
        to_char(resolved.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS folio_created_at,
        COALESCE((SELECT sum(amount_minor::numeric)::text FROM ledger), '0') AS balance_minor,
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
            'runningBalanceMinor', running_balance_minor
          ) ORDER BY business_date DESC, created_at DESC, journal_id DESC, seq DESC)
          FROM visible_page
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
      folio: Object.freeze({
        id: snapshot.folio_id,
        reference: snapshot.folio_reference,
        name: snapshot.folio_name,
        windowNo: snapshot.window_no,
        status: snapshot.folio_status,
        currency: snapshot.currency,
        createdAt: snapshot.folio_created_at,
      }),
      balanceMinor: snapshot.balance_minor,
      lineCount: snapshot.line_count,
      rows: Object.freeze(snapshot.rows.map((row) => Object.freeze(row))),
      chargeOptions: Object.freeze(snapshot.charge_options.map((option) => Object.freeze(option))),
      chargeAvailability: Object.freeze({ allowed: snapshot.charge_allowed, reason: snapshot.charge_reason }),
      nextCursor,
    });
  }
}
