import { recordFact, validateJsonSchema, type AuditEnvelope, type Tx } from "../../kernel";
import { parseCommercialTaxonomy, type CommercialTaxonomy } from "./commercial-attribution";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TYPE = "commercial_attribution";
const MAX_CONTENT_BYTES = 256 * 1024;

export class CommercialMappingValidationError extends Error {}
export class CommercialMappingConflictError extends Error {}
export class CommercialMappingUnavailableError extends Error {}

export type CommercialMappingVersion = Readonly<{
  id: string;
  version: number;
  content: Omit<CommercialTaxonomy, "version">;
}>;

export type CommercialMappingSnapshot = Readonly<{
  active: CommercialMappingVersion | null;
  draft: CommercialMappingVersion | null;
  latestVersion: number;
}>;

type ExtensionRow = Readonly<{ id: string; version: number; content: unknown; status: "active" | "draft" | "retired" }>;

function scope(tenantId: string, propertyNode: string): string {
  if (!UUID.test(tenantId) || !UUID.test(propertyNode)) {
    throw new CommercialMappingValidationError("Tenant and property must be UUIDs");
  }
  return `property:${propertyNode}`;
}

function version(row: ExtensionRow): CommercialMappingVersion {
  try {
    const { version: _version, ...content } = parseCommercialTaxonomy(row.content, row.version);
    return Object.freeze({ id: row.id, version: row.version, content });
  } catch {
    throw new CommercialMappingUnavailableError("Stored commercial mappings are invalid");
  }
}

async function assertProperty(tx: Tx, tenantId: string, propertyNode: string): Promise<void> {
  const rows = await tx<{ id: string }[]>`
    SELECT id FROM org_node
    WHERE tenant_id=${tenantId}::uuid
      AND tenant_id=current_setting('app.tenant_id', true)::uuid
      AND id=${propertyNode}::uuid AND kind='property'
    LIMIT 1`;
  if (rows.length !== 1) throw new CommercialMappingUnavailableError("Property is unavailable in the active tenant");
}

async function assertReferences(tx: Tx, tenantId: string, propertyNode: string, taxonomy: CommercialTaxonomy): Promise<void> {
  const companyIds = taxonomy.companies.map((item) => item.partyId);
  if (companyIds.length > 0) {
    const rows = await tx<{ id: string }[]>`
      SELECT DISTINCT party.id
      FROM party JOIN party_role ON party_role.party_id=party.id
        AND party_role.tenant_id=party.tenant_id AND party_role.role='company'
      WHERE party.tenant_id=${tenantId}::uuid
        AND party.tenant_id=current_setting('app.tenant_id', true)::uuid
        AND party.kind='org' AND party.status='active'
        AND party.id IN ${tx(companyIds)} `;
    if (rows.length !== companyIds.length) {
      throw new CommercialMappingValidationError("Company mappings must reference active company parties in this tenant");
    }
  }
  const unitIds = taxonomy.roomClasses.flatMap((item) => item.unitTypeIds);
  if (unitIds.length > 0) {
    const rows = await tx<{ id: string }[]>`
      SELECT id FROM unit_type
      WHERE tenant_id=${tenantId}::uuid
        AND tenant_id=current_setting('app.tenant_id', true)::uuid
        AND property_node=${propertyNode}::uuid
        AND id IN ${tx(unitIds)} `;
    if (rows.length !== unitIds.length) {
      throw new CommercialMappingValidationError("Room classes must reference unit types in this property");
    }
  }
}

export class CommercialMappingService {
  async load(tx: Tx, input: Readonly<{ tenantId: string; propertyNode: string }>): Promise<CommercialMappingSnapshot> {
    const key = scope(input.tenantId, input.propertyNode);
    await assertProperty(tx, input.tenantId, input.propertyNode);
    const latest = await tx<{ version: number }[]>`
      SELECT COALESCE(max(version),0)::int AS version FROM extension
      WHERE tenant_id=${input.tenantId}::uuid
        AND tenant_id=current_setting('app.tenant_id', true)::uuid
        AND type=${TYPE} AND key=${key}`;
    const draft = await tx<ExtensionRow[]>`
      SELECT id, version, content, status FROM extension
      WHERE tenant_id=${input.tenantId}::uuid
        AND tenant_id=current_setting('app.tenant_id', true)::uuid
        AND type=${TYPE} AND key=${key} AND status='draft'
      ORDER BY version DESC LIMIT 1`;
    const effective = await tx<ExtensionRow[]>`
      SELECT id, version, content, status FROM extension
      WHERE tenant_id=${input.tenantId}::uuid
        AND tenant_id=current_setting('app.tenant_id', true)::uuid
        AND type=${TYPE} AND key=${key} AND status='active'
        AND effective @> transaction_timestamp()
      ORDER BY version DESC LIMIT 2`;
    if (effective.length > 1) throw new CommercialMappingConflictError("Active commercial mappings overlap");
    return Object.freeze({
      active: effective[0] ? version(effective[0]) : null,
      draft: draft[0] ? version(draft[0]) : null,
      latestVersion: latest[0]?.version ?? 0,
    });
  }

  async saveDraft(tx: Tx, input: Readonly<{
    tenantId: string;
    propertyNode: string;
    content: unknown;
    expectedVersion: number;
    envelope: AuditEnvelope;
  }>): Promise<CommercialMappingVersion & { status: "draft" }> {
    const key = scope(input.tenantId, input.propertyNode);
    if (input.envelope.tenantId !== input.tenantId || input.envelope.propertyNode !== input.propertyNode ||
        input.envelope.operation !== "extension.draft_created" || !UUID.test(input.envelope.actorId) ||
        !UUID.test(input.envelope.requestId)) throw new CommercialMappingValidationError("Audit scope is invalid");
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 || input.expectedVersion >= 2147483647) {
      throw new CommercialMappingValidationError("expectedVersion must be a nonnegative version");
    }
    let serialized: string;
    try { serialized = JSON.stringify(input.content); } catch { throw new CommercialMappingValidationError("Content must be JSON"); }
    if (!serialized || new TextEncoder().encode(serialized).length > MAX_CONTENT_BYTES) {
      throw new CommercialMappingValidationError("Content exceeds the mapping size limit");
    }
    let taxonomy: CommercialTaxonomy;
    try { taxonomy = parseCommercialTaxonomy(input.content, input.expectedVersion + 1); }
    catch (error) { throw new CommercialMappingValidationError(error instanceof Error ? error.message : "Invalid taxonomy"); }
    await assertProperty(tx, input.tenantId, input.propertyNode);
    const schema = await tx<{ json_schema: unknown }[]>`SELECT json_schema FROM extension_type WHERE type=${TYPE}`;
    if (schema.length !== 1) throw new CommercialMappingUnavailableError("Commercial mapping extension type is unavailable");
    const issues = validateJsonSchema(schema[0]!.json_schema, input.content);
    if (issues.length) throw new CommercialMappingValidationError(issues.map((item) => `${item.path}: ${item.message}`).join("; "));
    await assertReferences(tx, input.tenantId, input.propertyNode, taxonomy);
    const lockKey = `extension-version:${input.tenantId}:${TYPE}:${key}`;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const current = await tx<{ version: number }[]>`
      SELECT COALESCE(max(version), 0)::int AS version FROM extension
      WHERE tenant_id=${input.tenantId}::uuid
        AND tenant_id=current_setting('app.tenant_id', true)::uuid
        AND type=${TYPE} AND key=${key}`;
    if (current[0]?.version !== input.expectedVersion) {
      throw new CommercialMappingConflictError("Commercial mappings changed; reload the latest draft");
    }
    const rows = await tx<ExtensionRow[]>`
      INSERT INTO extension(tenant_id,type,key,version,content,status)
      VALUES (${input.tenantId}::uuid,${TYPE},${key},${input.expectedVersion + 1},${serialized}::text::jsonb,'draft')
      RETURNING id,version,content,status`;
    const saved = rows[0];
    if (rows.length !== 1 || !saved || saved.status !== "draft") {
      throw new CommercialMappingUnavailableError("Commercial mapping draft was not saved");
    }
    await recordFact(tx, { entityType: "extension", entityId: saved.id, envelope: input.envelope,
      payload: { type: TYPE, key, version: saved.version, status: "draft", expectedVersion: input.expectedVersion } });
    return Object.freeze({ ...version(saved), status: "draft" });
  }
}
