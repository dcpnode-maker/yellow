import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const INTEGER = /^(?:0|[1-9][0-9]*)$/;
const MAX = 9_223_372_036_854_775_807n;
const INPUT_KEYS = ["tenantId", "propertyNode", "reservationId", "folioId"] as const;
const IDENTITIES = ["igst", "cgst", "sgst", "utgst"] as const;

type ComponentIdentity = (typeof IDENTITIES)[number];
type SemanticCode = "IGST" | "CGST" | "SGST" | "UTGST";
type Row = Readonly<Record<string, unknown>>;

export interface IndiaGstAccommodationFinalComponentTaxSemanticRouteInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
}
export interface IndiaGstAccommodationFinalComponentTaxSemanticRoute {
  readonly mappingId: string;
  readonly semanticCode: "room_revenue" | SemanticCode;
  readonly txCode: string;
  readonly creditAccountId: string;
}

export interface IndiaGstAccommodationFinalComponentTaxSemanticComponent {
  readonly componentIdentity: ComponentIdentity;
  readonly semanticCode: SemanticCode;
  readonly amountMinor: string;
  readonly route: IndiaGstAccommodationFinalComponentTaxSemanticRoute | null;
}

export interface IndiaGstAccommodationFinalComponentTaxSemanticRouteResult {
  readonly taxId: string;
  readonly taxGeneration: number;
  readonly evidenceHash: string;
  readonly valuationId: string;
  readonly valuationGeneration: number;
  readonly applicabilityId: string;
  readonly applicabilityEvidenceHash: string;
  readonly finalValuationEvidenceHash: string;
  readonly componentFamily: "igst" | "cgst_sgst" | "cgst_utgst";
  readonly currency: "INR";
  readonly transactionValueMinor: string;
  readonly taxMinor: string;
  readonly grandTotalMinor: string;
  readonly jurisdiction: Readonly<{
    extensionId: string;
    ownerTenantId: string | null;
    key: string;
    version: number;
    contentHash: string;
  }>;
  readonly revenueRoute: IndiaGstAccommodationFinalComponentTaxSemanticRoute;
  readonly components: readonly IndiaGstAccommodationFinalComponentTaxSemanticComponent[];
}

export class IndiaGstAccommodationFinalComponentTaxSemanticRouteValidationError extends Error {
  constructor(message: string) { super(message); this.name = "IndiaGstAccommodationFinalComponentTaxSemanticRouteValidationError"; }
}

export class IndiaGstAccommodationFinalComponentTaxSemanticRouteNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "IndiaGstAccommodationFinalComponentTaxSemanticRouteNotFoundError"; }
}

export class IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError extends Error {
  constructor(message: string) { super(message); this.name = "IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError"; }
}

function validation(message: string): never {
  throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteValidationError(message);
}

function exactInput(value: unknown): IndiaGstAccommodationFinalComponentTaxSemanticRouteInput {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)
      || Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length !== 0) {
    return validation("semantic-route input must be an exact plain object");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const expected = [...INPUT_KEYS].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])
      || Object.values(descriptors).some((descriptor) => descriptor.enumerable !== true
        || descriptor.get !== undefined || descriptor.set !== undefined || !("value" in descriptor))) {
    return validation("semantic-route input shape is invalid");
  }
  return value as IndiaGstAccommodationFinalComponentTaxSemanticRouteInput;
}

function inputUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) return validation(`${subject} must be a lowercase UUID`);
  return value;
}

function storedString(value: unknown, subject: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError(`${subject} is invalid`);
  }
  return value;
}

function storedUuid(value: unknown, subject: string): string {
  const result = storedString(value, subject);
  if (!UUID.test(result)) throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError(`${subject} is invalid`);
  return result;
}

function storedHash(value: unknown, subject: string): string {
  const result = storedString(value, subject);
  if (!HASH.test(result)) throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError(`${subject} is invalid`);
  return result;
}

function storedInteger(value: unknown, subject: string): bigint {
  const result = storedString(value, subject);
  if (!INTEGER.test(result) || BigInt(result) > MAX) {
    throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError(`${subject} is invalid`);
  }
  return BigInt(result);
}

function storedNumber(value: unknown, subject: string): number {
  const result = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError(`${subject} is invalid`);
  }
  return result;
}

function componentIdentity(value: unknown): ComponentIdentity {
  if (typeof value !== "string" || !IDENTITIES.includes(value as ComponentIdentity)) {
    throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError("component identity is invalid");
  }
  return value as ComponentIdentity;
}

function semanticCode(identity: ComponentIdentity): SemanticCode {
  switch (identity) {
    case "igst": return "IGST";
    case "cgst": return "CGST";
    case "sgst": return "SGST";
    case "utgst": return "UTGST";
  }
}

function expectedFamily(family: unknown): readonly ComponentIdentity[] {
  switch (family) {
    case "igst": return ["igst"];
    case "cgst_sgst": return ["cgst", "sgst"];
    case "cgst_utgst": return ["cgst", "utgst"];
    default: throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError("component family is invalid");
  }
}

function routeFromRow(row: Row, semantic: "room_revenue" | SemanticCode, propertyNode: string): IndiaGstAccommodationFinalComponentTaxSemanticRoute {
  const mappingId = storedUuid(row.mapping_id, `${semantic} mapping id`);
  const txCode = storedString(row.tx_code, `${semantic} transaction code`);
  const creditAccountId = storedUuid(row.route_credit_account_id, `${semantic} credit account`);
  const expectedGroup = semantic === "room_revenue" ? "revenue" : "tax";
  const expectedRole = semantic === "room_revenue" ? "revenue" : "tax_payable";
  if (row.semantic_kind !== (semantic === "room_revenue" ? "revenue" : "tax")
      || row.semantic_code !== semantic || row.tx_code_value !== txCode || row.tx_code_group !== expectedGroup
      || row.account_id !== creditAccountId || row.account_role !== expectedRole
      || row.account_property_node !== propertyNode || row.account_currency !== "INR" || row.account_status !== "open"
      || (semantic === "room_revenue" && (typeof row.usali_line !== "string" || row.usali_line.trim().length === 0))) {
    throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError(`${semantic} semantic route is incoherent`);
  }
  return Object.freeze({ mappingId, semanticCode: semantic, txCode, creditAccountId });
}

export class IndiaGstAccommodationFinalComponentTaxSemanticRouteService {
  async resolve(tx: Tx, raw: IndiaGstAccommodationFinalComponentTaxSemanticRouteInput): Promise<IndiaGstAccommodationFinalComponentTaxSemanticRouteResult> {
    if (typeof tx !== "function") return validation("tenant transaction is unavailable");
    const input = exactInput(raw);
    if (!Object.isFrozen(input)) return validation("semantic-route input must be frozen");
    const tenant = inputUuid(input.tenantId, "tenantId");
    const property = inputUuid(input.propertyNode, "propertyNode");
    const reservation = inputUuid(input.reservationId, "reservationId");
    const folio = inputUuid(input.folioId, "folioId");
    const roots = await tx<Row[]>`
      SELECT tax.id::text AS tax_id, tax.generation, tax.evidence_hash,
             tax.valuation_id::text AS valuation_id, tax.valuation_generation,
             tax.applicability_id::text AS applicability_id,
             applicability.evidence_hash AS applicability_evidence_hash,
             tax.final_valuation_evidence_hash,
             tax.quoted_rate_applicability_evidence_hash,
             tax.component_family, tax.currency::text AS currency,
             tax.transaction_value_minor::text, tax.tax_minor::text, tax.grand_total_minor::text,
             tax.selected_extension_id::text AS selected_extension_id,
             NULL::text AS selected_extension_owner_tenant_id,
             'in-gst-lodging'::text AS selected_extension_key,
             tax.selected_extension_version AS selected_extension_version,
             applicability.selected_content_hash AS selected_extension_content_hash
        FROM public.india_gst_accommodation_final_component_tax AS tax
        JOIN public.india_gst_accommodation_final_valuation AS valuation
          ON valuation.tenant_id=tax.tenant_id AND valuation.id=tax.valuation_id
         AND valuation.property_node=tax.property_node AND valuation.reservation_id=tax.reservation_id
         AND valuation.folio_id=tax.folio_id AND valuation.generation=tax.valuation_generation
         AND valuation.disposition='ordinary_final' AND valuation.currency='INR'
         AND valuation.evidence_hash=tax.final_valuation_evidence_hash
        JOIN public.india_gst_accommodation_quoted_rate_applicability AS applicability
          ON applicability.tenant_id=tax.tenant_id AND applicability.id=tax.applicability_id
         AND applicability.property_node=tax.property_node AND applicability.reservation_id=tax.reservation_id
         AND applicability.folio_id=tax.folio_id AND applicability.final_valuation_id=tax.valuation_id
         AND applicability.component_family=tax.component_family
         AND applicability.selected_extension_id=tax.selected_extension_id
         AND applicability.selected_extension_version=tax.selected_extension_version
         AND applicability.evidence_hash=tax.quoted_rate_applicability_evidence_hash
       WHERE tax.tenant_id=${tenant}::uuid
         AND tax.tenant_id=current_setting('app.tenant_id',true)::uuid
         AND tax.property_node=${property}::uuid AND tax.reservation_id=${reservation}::uuid
         AND tax.folio_id=${folio}::uuid
         AND (
           (applicability.selected_extension_id='a806f516-fed6-5768-b310-94aa03286adb'::uuid
            AND applicability.selected_extension_version=1
            AND applicability.selected_extension_status='retired'
            AND applicability.selected_content_hash='2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08')
           OR
           (applicability.selected_extension_id='0b21daf2-ea6e-5568-9c21-69e4d4424574'::uuid
            AND applicability.selected_extension_version=2
            AND applicability.selected_extension_status='active'
            AND applicability.selected_content_hash='eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820')
         )
         AND NOT EXISTS (SELECT 1 FROM public.india_gst_accommodation_final_component_tax AS successor
                          WHERE successor.tenant_id=tax.tenant_id AND successor.supersedes_tax_id=tax.id)
         AND NOT EXISTS (SELECT 1 FROM public.india_gst_accommodation_final_valuation AS successor
                          WHERE successor.tenant_id=valuation.tenant_id AND successor.supersedes_valuation_id=valuation.id)
    `;
    if (roots.length === 0) throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteNotFoundError("current final component-tax evidence is unavailable");
    if (roots.length !== 1 || !roots[0]) throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError("current final component-tax evidence is ambiguous");
    const root = roots[0];
    const family = root.component_family;
    const familyIdentities = expectedFamily(family);
    const rootTax = storedInteger(root.tax_minor, "tax total");
    const rootValue = storedInteger(root.transaction_value_minor, "transaction value");
    const rootGrand = storedInteger(root.grand_total_minor, "grand total");
    if (rootValue === 0n || rootGrand === 0n || rootGrand !== rootValue + rootTax || root.currency !== "INR") {
      throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError("final component-tax totals are incoherent");
    }

    const componentRows = await tx<Row[]>`
      WITH night_totals AS (
        SELECT pg_catalog.count(*)::integer AS night_count,
               pg_catalog.min(ordinal)::integer AS first_night_ordinal,
               pg_catalog.max(ordinal)::integer AS last_night_ordinal,
               pg_catalog.sum(final_value_minor)::text AS night_value_total,
               pg_catalog.sum(tax_minor)::text AS night_tax_total
          FROM public.india_gst_accommodation_final_component_tax_room_night
         WHERE tenant_id=${tenant}::uuid
           AND tenant_id=current_setting('app.tenant_id',true)::uuid
           AND tax_id=${storedUuid(root.tax_id, "tax id")}::uuid AND currency='INR'
      ), component_totals AS (
        SELECT component_identity, pg_catalog.sum(tax_amount_minor)::text AS tax_amount_minor,
               pg_catalog.min(component_ordinal)::integer AS first_ordinal,
               pg_catalog.count(*)::integer AS component_count
          FROM public.india_gst_accommodation_final_component_tax_component
         WHERE tenant_id=${tenant}::uuid
           AND tenant_id=current_setting('app.tenant_id',true)::uuid
           AND tax_id=${storedUuid(root.tax_id, "tax id")}::uuid AND currency='INR'
         GROUP BY component_identity
      )
      SELECT component_totals.*, night_totals.*
        FROM component_totals CROSS JOIN night_totals
       ORDER BY first_ordinal, component_identity
    `;
    if (componentRows.length !== familyIdentities.length) {
      throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError("component-tax children do not reconcile to the root");
    }
    const componentTotals = new Map<ComponentIdentity, bigint>();
    let componentTaxTotal = 0n;
    let componentCount: number | null = null;
    const firstComponent = componentRows[0]!;
    const nightCount = storedNumber(firstComponent.night_count, "room-night count");
    if (nightCount === 0 || storedNumber(firstComponent.first_night_ordinal, "first room-night ordinal") !== 0
        || storedNumber(firstComponent.last_night_ordinal, "last room-night ordinal") !== nightCount - 1
        || storedInteger(firstComponent.night_value_total, "room-night value total") !== rootValue
        || storedInteger(firstComponent.night_tax_total, "room-night tax total") !== rootTax) {
      throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError("room-night children do not reconcile to the root");
    }
    for (const [ordinal, row] of componentRows.entries()) {
      const identity = componentIdentity(row.component_identity);
      const count = storedNumber(row.component_count, "component count");
      if (identity !== familyIdentities[ordinal] || storedNumber(row.first_ordinal, "component ordinal") !== ordinal
          || count !== nightCount || (componentCount !== null && count !== componentCount)
          || row.night_count !== firstComponent.night_count || row.first_night_ordinal !== firstComponent.first_night_ordinal
          || row.last_night_ordinal !== firstComponent.last_night_ordinal
          || row.night_value_total !== firstComponent.night_value_total || row.night_tax_total !== firstComponent.night_tax_total) {
        throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError("component-tax children are incomplete or unordered");
      }
      componentCount = count;
      const amount = storedInteger(row.tax_amount_minor, "component tax");
      componentTotals.set(identity, amount);
      componentTaxTotal += amount;
    }
    if (componentTaxTotal !== rootTax) throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError("component-tax children do not reconcile to the root");

    const extensionId = storedUuid(root.selected_extension_id, "jurisdiction extension id");
    const ownerTenantId = root.selected_extension_owner_tenant_id === null ? null : storedUuid(root.selected_extension_owner_tenant_id, "jurisdiction owner tenant id");
    if (ownerTenantId !== null && ownerTenantId !== tenant) throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError("jurisdiction owner is foreign");
    const extensionKey = storedString(root.selected_extension_key, "jurisdiction key");
    const extensionVersion = storedNumber(root.selected_extension_version, "jurisdiction version");
    if (extensionVersion === 0) throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError("jurisdiction version is invalid");
    const extensionContentHash = storedHash(root.selected_extension_content_hash, "jurisdiction content hash");
    const required = ["room_revenue", ...familyIdentities.filter((identity) => componentTotals.get(identity)! > 0n).map(semanticCode)];
    const routeRows = await tx<Row[]>`
      SELECT mapping.id::text AS mapping_id, mapping.semantic_kind,
             mapping.semantic_code, mapping.tx_code,
             route.credit_account_id::text AS route_credit_account_id,
             code.code AS tx_code_value, code.grp AS tx_code_group, code.usali_line,
             account.id::text AS account_id, account.property_node::text AS account_property_node,
             account.role AS account_role,
             account.currency::text AS account_currency, account.status AS account_status
        FROM public.tax_semantic_route AS mapping
        LEFT JOIN public.tx_code AS code ON code.code=mapping.tx_code
        LEFT JOIN public.tx_code_route AS route
          ON route.tenant_id=mapping.tenant_id AND route.property_node=mapping.property_node
         AND route.currency=mapping.currency AND route.tx_code=mapping.tx_code
        LEFT JOIN public.account AS account
          ON account.tenant_id=route.tenant_id AND account.property_node=route.property_node
         AND account.currency=route.currency AND account.id=route.credit_account_id
       WHERE mapping.tenant_id=${tenant}::uuid
         AND mapping.tenant_id=current_setting('app.tenant_id',true)::uuid
         AND mapping.property_node=${property}::uuid AND mapping.currency='INR'::char(3)
         AND mapping.jurisdiction_extension_id=${extensionId}::uuid
         AND mapping.jurisdiction_owner_tenant_id IS NOT DISTINCT FROM ${ownerTenantId}::uuid
         AND mapping.jurisdiction_key=${extensionKey} AND mapping.jurisdiction_version=${extensionVersion}
         AND mapping.jurisdiction_content_hash=${extensionContentHash}
         AND mapping.semantic_code IN (SELECT value FROM jsonb_array_elements_text(${JSON.stringify(required)}::jsonb))
       ORDER BY mapping.semantic_kind, mapping.semantic_code, mapping.id
    `;
    if (routeRows.length !== required.length) throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteNotFoundError("complete configured India semantic routes are unavailable");
    const bySemantic = new Map<string, Row>();
    for (const row of routeRows) {
      const code = storedString(row.semantic_code, "semantic code");
      if (!required.includes(code) || bySemantic.has(code)) throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError("configured India semantic routes are ambiguous");
      bySemantic.set(code, row);
    }
    const revenueRow = bySemantic.get("room_revenue");
    if (!revenueRow) throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteNotFoundError("room-revenue route is unavailable");
    const revenueRoute = routeFromRow(revenueRow, "room_revenue", property);
    const components = Object.freeze(familyIdentities.map((identity) => {
      const code = semanticCode(identity);
      const amount = componentTotals.get(identity)!;
      const routeRow = bySemantic.get(code);
      if (amount > 0n && !routeRow) throw new IndiaGstAccommodationFinalComponentTaxSemanticRouteNotFoundError(`${code} route is unavailable`);
      return Object.freeze({ componentIdentity: identity, semanticCode: code, amountMinor: amount.toString(), route: routeRow ? routeFromRow(routeRow, code, property) : null });
    }));
    const jurisdiction = Object.freeze({ extensionId, ownerTenantId, key: extensionKey, version: extensionVersion, contentHash: extensionContentHash });
    return Object.freeze({
      taxId: storedUuid(root.tax_id, "tax id"), taxGeneration: storedNumber(root.generation, "tax generation"),
      evidenceHash: storedHash(root.evidence_hash, "tax evidence hash"),
      valuationId: storedUuid(root.valuation_id, "valuation id"), valuationGeneration: storedNumber(root.valuation_generation, "valuation generation"),
      applicabilityId: storedUuid(root.applicability_id, "applicability id"),
      applicabilityEvidenceHash: storedHash(root.quoted_rate_applicability_evidence_hash, "applicability evidence hash"),
      finalValuationEvidenceHash: storedHash(root.final_valuation_evidence_hash, "final valuation evidence hash"),
      componentFamily: family as "igst" | "cgst_sgst" | "cgst_utgst", currency: "INR",
      transactionValueMinor: rootValue.toString(), taxMinor: rootTax.toString(), grandTotalMinor: rootGrand.toString(),
      jurisdiction, revenueRoute, components,
    });
  }
}
