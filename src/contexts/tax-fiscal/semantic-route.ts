import type { Tx } from "../../kernel";
import {
  PositiveTaxFolioEligibilityService,
  type PositiveTaxFolioEligibilityInput,
  type PositiveTaxFolioEligibilityResult,
} from "./folio-eligibility";
import {
  PositiveTaxPostingPlanError,
  derivePositiveTaxPostingPlan,
  type PositiveTaxPostingPlanBlocker,
  type PositiveTaxPostingPlanV1,
} from "./posting-plan";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TX_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

interface PositiveTaxEligibilityResolver {
  discover?(
    tx: Tx,
    input: PositiveTaxFolioEligibilityInput,
  ): Promise<PositiveTaxFolioEligibilityResult>;
  resolve(
    tx: Tx,
    input: PositiveTaxFolioEligibilityInput,
  ): Promise<PositiveTaxFolioEligibilityResult>;
}

interface SemanticRouteRow {
  readonly mapping_id: string;
  readonly semantic_kind: string;
  readonly semantic_code: string;
  readonly tx_code: string;
  readonly route_credit_account_id: string | null;
  readonly tx_code_value: string | null;
  readonly tx_code_group: string | null;
  readonly usali_line: string | null;
  readonly account_id: string | null;
  readonly account_property_node: string | null;
  readonly account_role: string | null;
  readonly account_currency: string | null;
  readonly account_status: string | null;
}

export interface PositiveTaxSemanticRevenueRoute {
  readonly mappingId: string;
  readonly semanticCode: "room_revenue";
  readonly txCode: string;
  readonly creditAccountId: string;
}

export interface PositiveTaxSemanticTaxRoute {
  readonly taxIndex: string;
  readonly taxCode: string;
  readonly mappingId: string;
  readonly txCode: string;
  readonly creditAccountId: string;
}

export interface PositiveTaxSemanticPolicyBlockedResult {
  readonly state: "policy_blocked";
  readonly eligibility: PositiveTaxFolioEligibilityResult;
  readonly plan: PositiveTaxPostingPlanV1;
  readonly blockers: readonly PositiveTaxPostingPlanBlocker[];
}

export interface PositiveTaxSemanticResolvedResult {
  readonly state: "resolved";
  readonly eligibility: PositiveTaxFolioEligibilityResult;
  readonly plan: PositiveTaxPostingPlanV1;
  readonly jurisdiction: Readonly<{
    extensionId: string;
    ownerTenantId: string | null;
    key: string;
    version: string;
    contentHash: string;
  }>;
  readonly revenueRoute: PositiveTaxSemanticRevenueRoute;
  readonly taxRoutes: readonly PositiveTaxSemanticTaxRoute[];
}

export type PositiveTaxSemanticRouteResult =
  | PositiveTaxSemanticPolicyBlockedResult
  | PositiveTaxSemanticResolvedResult;

export class PositiveTaxSemanticRouteNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositiveTaxSemanticRouteNotFoundError";
  }
}

export class PositiveTaxSemanticRouteConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositiveTaxSemanticRouteConflictError";
  }
}

function storedUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new PositiveTaxSemanticRouteConflictError(`${subject} is invalid`);
  }
  return value;
}

function storedTxCode(value: unknown): string {
  if (typeof value !== "string" || !TX_CODE.test(value)) {
    throw new PositiveTaxSemanticRouteConflictError(
      "Configured transaction code is not canonical",
    );
  }
  return value;
}

function oneMapping(
  mappings: ReadonlyMap<string, SemanticRouteRow>,
  key: string,
): SemanticRouteRow {
  const row = mappings.get(key);
  if (!row) {
    throw new PositiveTaxSemanticRouteNotFoundError(
      `Configured positive-tax semantic route is unavailable for ${key}`,
    );
  }
  return row;
}

function validateCreditRoute(
  row: SemanticRouteRow,
  propertyNode: string,
  currency: string,
  role: "revenue" | "tax_payable",
): Readonly<{ mappingId: string; txCode: string; creditAccountId: string }> {
  const mappingId = storedUuid(row.mapping_id, "stored semantic-route id");
  const txCode = storedTxCode(row.tx_code);
  const creditAccountId = storedUuid(
    row.route_credit_account_id,
    "configured credit-account id",
  );
  if (row.tx_code_value !== txCode ||
      row.tx_code_group !== (role === "revenue" ? "revenue" : "tax") ||
      (role === "revenue" &&
        (row.usali_line === null || row.usali_line.trim().length === 0)) ||
      row.account_id !== creditAccountId || row.account_property_node !== propertyNode ||
      row.account_role !== role || row.account_currency !== currency ||
      row.account_status !== "open") {
    throw new PositiveTaxSemanticRouteConflictError(
      `Configured ${role} semantic route is incoherent`,
    );
  }
  return Object.freeze({ mappingId, txCode, creditAccountId });
}

export class PositiveTaxSemanticRouteService {
  constructor(
    private readonly eligibility: PositiveTaxEligibilityResolver =
      new PositiveTaxFolioEligibilityService(),
  ) {}

  private async route(
    tx: Tx,
    tenantId: string,
    propertyNode: string,
    eligibility: PositiveTaxFolioEligibilityResult,
  ): Promise<PositiveTaxSemanticRouteResult> {
    let plan: PositiveTaxPostingPlanV1;
    try {
      plan = derivePositiveTaxPostingPlan(eligibility.snapshot);
    } catch (error) {
      if (error instanceof PositiveTaxPostingPlanError) {
        throw new PositiveTaxSemanticRouteConflictError(
          "Stored positive-tax attribution cannot produce a posting plan",
        );
      }
      throw error;
    }

    if (plan.state === "policy_blocked") {
      return Object.freeze({
        state: "policy_blocked",
        eligibility,
        plan,
        blockers: plan.blockers,
      });
    }

    const taxLines = plan.lines.filter((line) => line.role === "tax_payable");
    const taxCodes = [...new Set(taxLines.map(({ taxCode }) => taxCode))];
    const jurisdiction = eligibility.snapshot.jurisdiction;
    const version = Number(jurisdiction.version);
    if (!Number.isSafeInteger(version) || version <= 0) {
      throw new PositiveTaxSemanticRouteConflictError(
        "Stored tax-jurisdiction version is invalid",
      );
    }

    const rows = await tx<SemanticRouteRow[]>`
      SELECT mapping.id::text AS mapping_id,
             mapping.semantic_kind,
             mapping.semantic_code,
             mapping.tx_code,
             route.credit_account_id::text AS route_credit_account_id,
             code.code AS tx_code_value,
             code.grp AS tx_code_group,
             code.usali_line,
             account.id::text AS account_id,
             account.property_node::text AS account_property_node,
             account.role AS account_role,
             account.currency::text AS account_currency,
             account.status AS account_status
        FROM tax_semantic_route AS mapping
        LEFT JOIN tx_code AS code
          ON code.code = mapping.tx_code
        LEFT JOIN tx_code_route AS route
          ON route.tenant_id = mapping.tenant_id
         AND route.property_node = mapping.property_node
         AND route.currency = mapping.currency
         AND route.tx_code = mapping.tx_code
        LEFT JOIN account
          ON account.tenant_id = route.tenant_id
         AND account.property_node = route.property_node
         AND account.currency = route.currency
         AND account.id = route.credit_account_id
       WHERE mapping.tenant_id = ${tenantId}::uuid
         AND mapping.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND mapping.property_node = ${propertyNode}::uuid
         AND mapping.currency = ${eligibility.currency}::char(3)
         AND mapping.jurisdiction_extension_id = ${jurisdiction.extensionId}::uuid
         AND mapping.jurisdiction_owner_tenant_id IS NOT DISTINCT FROM
             ${jurisdiction.ownerTenantId}::uuid
         AND mapping.jurisdiction_key = ${jurisdiction.key}
         AND mapping.jurisdiction_version = ${version}::integer
         AND mapping.jurisdiction_content_hash = ${jurisdiction.contentHash}
         AND (
           (mapping.semantic_kind = 'revenue' AND mapping.semantic_code = 'room_revenue')
           OR
           (mapping.semantic_kind = 'tax' AND mapping.semantic_code IN (
             SELECT value
               FROM jsonb_array_elements_text(${JSON.stringify(taxCodes)}::jsonb)
           ))
         )
       ORDER BY mapping.semantic_kind, mapping.semantic_code, mapping.id
    `;

    const expectedKeys = new Set([
      "revenue:room_revenue",
      ...taxCodes.map((taxCode) => `tax:${taxCode}`),
    ]);
    const mappings = new Map<string, SemanticRouteRow>();
    for (const row of rows) {
      const key = `${row.semantic_kind}:${row.semantic_code}`;
      if (!expectedKeys.has(key) || mappings.has(key)) {
        throw new PositiveTaxSemanticRouteConflictError(
          "Configured positive-tax semantic routes are ambiguous",
        );
      }
      mappings.set(key, row);
    }
    if (mappings.size !== expectedKeys.size) {
      const missing = [...expectedKeys].find((key) => !mappings.has(key));
      throw new PositiveTaxSemanticRouteNotFoundError(
        `Configured positive-tax semantic route is unavailable for ${missing ?? "the plan"}`,
      );
    }

    const revenue = validateCreditRoute(
      oneMapping(mappings, "revenue:room_revenue"),
      eligibility.propertyNode,
      eligibility.currency,
      "revenue",
    );
    const revenueRoute: PositiveTaxSemanticRevenueRoute = Object.freeze({
      mappingId: revenue.mappingId,
      semanticCode: "room_revenue",
      txCode: revenue.txCode,
      creditAccountId: revenue.creditAccountId,
    });
    const taxRoutes: readonly PositiveTaxSemanticTaxRoute[] = Object.freeze(
      taxLines.map(({ taxIndex, taxCode }) => {
        const route = validateCreditRoute(
          oneMapping(mappings, `tax:${taxCode}`),
          eligibility.propertyNode,
          eligibility.currency,
          "tax_payable",
        );
        return Object.freeze({
          taxIndex,
          taxCode,
          mappingId: route.mappingId,
          txCode: route.txCode,
          creditAccountId: route.creditAccountId,
        });
      }),
    );

    return Object.freeze({
      state: "resolved",
      eligibility,
      plan,
      jurisdiction: Object.freeze({
        extensionId: jurisdiction.extensionId,
        ownerTenantId: jurisdiction.ownerTenantId,
        key: jurisdiction.key,
        version: jurisdiction.version,
        contentHash: jurisdiction.contentHash,
      }),
      revenueRoute,
      taxRoutes,
    });
  }

  async discover(
    tx: Tx,
    input: PositiveTaxFolioEligibilityInput,
  ): Promise<PositiveTaxSemanticRouteResult> {
    if (!this.eligibility.discover) {
      throw new PositiveTaxSemanticRouteConflictError(
        "Read-only positive-tax eligibility discovery is unavailable",
      );
    }
    // Retain caller identity before the first await. Eligibility owns exact input
    // validation; this method only prevents later mutation from changing route keys.
    const tenantId = input.tenantId;
    const propertyNode = input.propertyNode;
    const eligibility = await this.eligibility.discover(tx, input);
    return this.route(tx, tenantId, propertyNode, eligibility);
  }

  async resolve(
    tx: Tx,
    input: PositiveTaxFolioEligibilityInput,
  ): Promise<PositiveTaxSemanticRouteResult> {
    // Eligibility validates this exact object synchronously before its first read.
    // Retain that validated identity across later awaits rather than re-reading a
    // caller-owned object that could be mutated while the transaction is pending.
    const tenantId = input.tenantId;
    const propertyNode = input.propertyNode;
    const eligibility = await this.eligibility.resolve(tx, input);
    return this.route(tx, tenantId, propertyNode, eligibility);
  }
}
