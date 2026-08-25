import type { AuditEnvelope } from "./audit";
import type { ConnectionPool, Tx } from "./db";
import { recordFact } from "./fact-log";

const TYPE_NAME = /^[a-z][a-z0-9_.-]*$/;
const INSTANCE_KEY = /^[a-z0-9][a-z0-9_.:-]*$/;
const URL_NAMESPACE_UUID = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
const SUPPORTED_KEYWORDS = new Set([
  "$id",
  "additionalProperties",
  "default",
  "enum",
  "items",
  "minimum",
  "pattern",
  "properties",
  "required",
  "type",
]);

type JsonObject = Record<string, unknown>;

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export class ExtensionValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(issues.map(({ path, message }) => `${path}: ${message}`).join("; "));
    this.name = "ExtensionValidationError";
    this.issues = issues;
  }
}

export interface RegisterExtensionTypeInput {
  readonly type: string;
  readonly jsonSchema: Readonly<JsonObject>;
  readonly envelope: AuditEnvelope;
}

export interface CreateExtensionInput {
  readonly type: string;
  readonly key: string;
  readonly content: Readonly<JsonObject>;
  readonly status?: "draft" | "active" | "retired";
  readonly envelope: AuditEnvelope;
}

export interface CreateExtensionVersionInput extends CreateExtensionInput {
  readonly factPayload?: Readonly<JsonObject>;
}

export interface ExtensionInstance {
  readonly id: string;
  readonly tenantId: string | null;
  readonly type: string;
  readonly key: string;
  readonly version: number;
  readonly content: Readonly<JsonObject>;
  readonly status: "draft" | "active" | "retired";
}

export interface CompatibilityFailure {
  readonly extensionId: string;
  readonly issues: readonly ValidationIssue[];
}

interface ExtensionRow {
  readonly id: string;
  readonly tenant_id: string | null;
  readonly type: string;
  readonly key: string;
  readonly version: number;
  readonly content: JsonObject;
  readonly status: ExtensionInstance["status"];
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameJson(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => sameJson(value, right[index]));
  }
  if (isObject(left) && isObject(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length &&
      leftKeys.every((key, index) => key === rightKeys[index] && sameJson(left[key], right[key]));
  }
  return false;
}

function valueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function typeMatches(value: unknown, expected: string): boolean {
  if (expected === "number") return typeof value === "number" && Number.isFinite(value);
  if (expected === "integer") return typeof value === "number" && Number.isInteger(value);
  if (expected === "object") return isObject(value);
  if (expected === "array") return Array.isArray(value);
  if (expected === "null") return value === null;
  return typeof value === expected;
}

function schemaDefinitionIssues(schema: unknown, path = "$schema"): ValidationIssue[] {
  if (!isObject(schema)) return [{ path, message: "schema must be an object" }];
  const issues: ValidationIssue[] = [];
  for (const keyword of Object.keys(schema)) {
    if (!SUPPORTED_KEYWORDS.has(keyword)) issues.push({ path: `${path}.${keyword}`, message: "unsupported keyword" });
  }
  const types = typeof schema.type === "string" ? [schema.type] : schema.type;
  if (types !== undefined && (!Array.isArray(types) || types.length === 0 || types.some((item) =>
    typeof item !== "string" || !["array", "boolean", "integer", "null", "number", "object", "string"].includes(item)
  ))) {
    issues.push({ path: `${path}.type`, message: "invalid type declaration" });
  }
  if (schema.required !== undefined && (!Array.isArray(schema.required) || schema.required.some((item) => typeof item !== "string"))) {
    issues.push({ path: `${path}.required`, message: "must be an array of property names" });
  }
  if (schema.properties !== undefined) {
    if (!isObject(schema.properties)) issues.push({ path: `${path}.properties`, message: "must be an object" });
    else for (const [name, child] of Object.entries(schema.properties)) {
      issues.push(...schemaDefinitionIssues(child, `${path}.properties.${name}`));
    }
  }
  if (schema.items !== undefined) issues.push(...schemaDefinitionIssues(schema.items, `${path}.items`));
  if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== "boolean") {
    issues.push(...schemaDefinitionIssues(schema.additionalProperties, `${path}.additionalProperties`));
  }
  if (schema.enum !== undefined && (!Array.isArray(schema.enum) || schema.enum.length === 0)) {
    issues.push({ path: `${path}.enum`, message: "must be a non-empty array" });
  }
  if (schema.minimum !== undefined && (typeof schema.minimum !== "number" || !Number.isFinite(schema.minimum))) {
    issues.push({ path: `${path}.minimum`, message: "must be a finite number" });
  }
  if (schema.pattern !== undefined) {
    if (typeof schema.pattern !== "string") issues.push({ path: `${path}.pattern`, message: "must be a string" });
    else try { new RegExp(schema.pattern); } catch { issues.push({ path: `${path}.pattern`, message: "invalid regular expression" }); }
  }
  return issues;
}

export function validateJsonSchema(schema: unknown, value: unknown, path = "$"): ValidationIssue[] {
  const definitionIssues = schemaDefinitionIssues(schema);
  if (definitionIssues.length > 0) return definitionIssues;
  const node = schema as JsonObject;
  const issues: ValidationIssue[] = [];
  const types = typeof node.type === "string" ? [node.type] : node.type as string[] | undefined;
  if (types && !types.some((type) => typeMatches(value, type))) {
    return [{ path, message: `expected ${types.join(" or ")}, received ${valueType(value)}` }];
  }
  if (Array.isArray(node.enum) && !node.enum.some((candidate) => sameJson(candidate, value))) {
    issues.push({ path, message: "value is not in enum" });
  }
  if (typeof node.minimum === "number" && typeof value === "number" && value < node.minimum) {
    issues.push({ path, message: `must be at least ${node.minimum}` });
  }
  if (typeof node.pattern === "string" && typeof value === "string" && !new RegExp(node.pattern).test(value)) {
    issues.push({ path, message: `does not match ${node.pattern}` });
  }
  if (isObject(value)) {
    const required = Array.isArray(node.required) ? node.required as string[] : [];
    for (const name of required) {
      if (!Object.hasOwn(value, name)) issues.push({ path: `${path}.${name}`, message: "is required" });
    }
    const properties = isObject(node.properties) ? node.properties : {};
    for (const [name, child] of Object.entries(value)) {
      if (Object.hasOwn(properties, name)) issues.push(...validateJsonSchema(properties[name], child, `${path}.${name}`));
      else if (node.additionalProperties === false) issues.push({ path: `${path}.${name}`, message: "additional property is not allowed" });
      else if (isObject(node.additionalProperties)) {
        issues.push(...validateJsonSchema(node.additionalProperties, child, `${path}.${name}`));
      }
    }
  }
  if (Array.isArray(value) && node.items !== undefined) {
    value.forEach((item, index) => issues.push(...validateJsonSchema(node.items, item, `${path}[${index}]`)));
  }
  return issues;
}

function namespaceBytes(namespace: string): Uint8Array {
  return Uint8Array.from(namespace.replaceAll("-", "").match(/../g) ?? [], (value) => Number.parseInt(value, 16));
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function extensionTypeSubjectId(type: string): Promise<string> {
  const namespace = namespaceBytes(URL_NAMESPACE_UUID);
  const name = new TextEncoder().encode(`https://yellow.local/extension-type/${type}`);
  const input = new Uint8Array(namespace.length + name.length);
  input.set(namespace);
  input.set(name, namespace.length);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", input));
  const uuid = digest.slice(0, 16);
  uuid[6] = (uuid[6]! & 0x0f) | 0x50;
  uuid[8] = (uuid[8]! & 0x3f) | 0x80;
  return formatUuid(uuid);
}

function toInstance(row: ExtensionRow): ExtensionInstance {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.type,
    key: row.key,
    version: row.version,
    content: row.content,
    status: row.status,
  };
}

async function withTenantRole<T>(
  pool: ConnectionPool,
  tenantId: string,
  operation: (connection: Tx) => Promise<T>,
): Promise<T> {
  if (tenantId === "") throw new Error("tenant context is required");
  const connection = await pool.reserve();
  let began = false;
  try {
    await connection.unsafe("BEGIN");
    began = true;
    const context = await connection<{ tenant_id: string }[]>`
      SELECT set_config('app.tenant_id', ${tenantId}, true) AS tenant_id
    `;
    if (context[0]?.tenant_id !== tenantId) {
      throw new Error("PostgreSQL did not establish the requested tenant context");
    }
    await connection.unsafe("SET LOCAL ROLE app_role");
    const result = await operation(connection);
    await connection.unsafe("COMMIT");
    began = false;
    return result;
  } catch (error) {
    if (began) {
      try { await connection.unsafe("ROLLBACK"); } catch { /* discard broken connection */ }
    }
    throw error;
  } finally {
    connection.release();
  }
}

export class ExtensionRegistry {
  readonly #platformPool: ConnectionPool;

  constructor(platformPool: ConnectionPool) {
    this.#platformPool = platformPool;
  }

  async registerType(input: RegisterExtensionTypeInput): Promise<"inserted" | "already exact"> {
    if (!TYPE_NAME.test(input.type)) throw new Error("extension type must be a stable lowercase identifier");
    const definitionIssues = schemaDefinitionIssues(input.jsonSchema);
    if (definitionIssues.length > 0) throw new ExtensionValidationError(definitionIssues);
    return await withTenantRole(this.#platformPool, input.envelope.tenantId, async (connection) => {
      const existing = await connection<Array<{ json_schema: JsonObject }>>`
        SELECT json_schema FROM extension_type WHERE type = ${input.type} FOR UPDATE
      `;
      if (existing[0]) {
        if (!sameJson(existing[0].json_schema, input.jsonSchema)) {
          throw new Error(`extension type ${input.type} already exists with divergent schema`);
        }
        return "already exact";
      }
      await connection`
        INSERT INTO extension_type (type, json_schema)
        VALUES (${input.type}, ${JSON.stringify(input.jsonSchema)}::text::jsonb)
      `;
      await recordFact(connection, {
        entityType: "extension_type",
        entityId: await extensionTypeSubjectId(input.type),
        envelope: input.envelope,
        payload: { type: input.type, json_schema: input.jsonSchema },
      });
      return "inserted";
    });
  }

  async createInstance(tx: Tx, input: CreateExtensionInput): Promise<ExtensionInstance> {
    if (input.envelope.tenantId === "") throw new Error("tenant audit envelope is required");
    if (!TYPE_NAME.test(input.type)) throw new Error("extension type must be a stable lowercase identifier");
    if (!INSTANCE_KEY.test(input.key)) throw new Error("extension key must be stable lowercase text");
    const schemas = await tx<Array<{ json_schema: JsonObject }>>`
      SELECT json_schema FROM extension_type WHERE type = ${input.type}
    `;
    if (!schemas[0]) throw new Error(`unknown extension type ${input.type}`);
    const issues = validateJsonSchema(schemas[0].json_schema, input.content);
    if (issues.length > 0) throw new ExtensionValidationError(issues);
    const rows = await tx<ExtensionRow[]>`
      INSERT INTO extension (tenant_id, type, key, content, status)
      VALUES (
        ${input.envelope.tenantId}::uuid,
        ${input.type},
        ${input.key},
        ${JSON.stringify(input.content)}::text::jsonb,
        ${input.status ?? "active"}
      )
      RETURNING id, tenant_id, type, key, version, content, status
    `;
    const row = rows[0];
    if (!row) throw new Error("PostgreSQL did not return the extension instance");
    await recordFact(tx, {
      entityType: "extension",
      entityId: row.id,
      envelope: input.envelope,
      payload: { type: row.type, key: row.key, version: row.version, content: row.content, status: row.status },
    });
    return toInstance(row);
  }

  async createVersion(tx: Tx, input: CreateExtensionVersionInput): Promise<ExtensionInstance> {
    if (input.envelope.tenantId === "") throw new Error("tenant audit envelope is required");
    if (!TYPE_NAME.test(input.type)) throw new Error("extension type must be a stable lowercase identifier");
    if (!INSTANCE_KEY.test(input.key)) throw new Error("extension key must be stable lowercase text");
    const schemas = await tx<Array<{ json_schema: JsonObject }>>`
      SELECT json_schema FROM extension_type WHERE type = ${input.type}
    `;
    if (!schemas[0]) throw new Error(`unknown extension type ${input.type}`);
    const issues = validateJsonSchema(schemas[0].json_schema, input.content);
    if (issues.length > 0) throw new ExtensionValidationError(issues);

    const lockKey = `extension-version:${input.envelope.tenantId}:${input.type}:${input.key}`;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const versions = await tx<Array<{ version: number }>>`
      SELECT (COALESCE(max(version), 0) + 1)::int AS version
      FROM extension
      WHERE tenant_id = ${input.envelope.tenantId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND type = ${input.type}
        AND key = ${input.key}
    `;
    const version = versions[0]?.version;
    if (version === undefined || !Number.isInteger(version) || version < 1) {
      throw new Error("PostgreSQL did not derive the next extension version");
    }
    const rows = await tx<ExtensionRow[]>`
      INSERT INTO extension (tenant_id, type, key, version, content, status)
      VALUES (
        ${input.envelope.tenantId}::uuid,
        ${input.type},
        ${input.key},
        ${version},
        ${JSON.stringify(input.content)}::text::jsonb,
        ${input.status ?? "draft"}
      )
      RETURNING id, tenant_id, type, key, version, content, status
    `;
    const row = rows[0];
    if (!row) throw new Error("PostgreSQL did not return the versioned extension instance");
    await recordFact(tx, {
      entityType: "extension",
      entityId: row.id,
      envelope: input.envelope,
      payload: {
        ...input.factPayload,
        type: row.type,
        key: row.key,
        version: row.version,
        status: row.status,
      },
    });
    return toInstance(row);
  }

  async listVisible(tenantId: string): Promise<readonly ExtensionInstance[]> {
    const connection = await this.#platformPool.reserve();
    try {
      const rows = await connection<ExtensionRow[]>`
        SELECT id, tenant_id, type, key, version, content, status
        FROM runtime_visible_extensions(${tenantId}::uuid)
      `;
      return rows.map(toInstance);
    } finally {
      connection.release();
    }
  }

  async checkCompatibility(
    tenantId: string,
    type: string,
    proposedSchema: Readonly<JsonObject>,
  ): Promise<readonly CompatibilityFailure[]> {
    if (!TYPE_NAME.test(type)) throw new Error("extension type must be a stable lowercase identifier");
    const definitionIssues = schemaDefinitionIssues(proposedSchema);
    if (definitionIssues.length > 0) throw new ExtensionValidationError(definitionIssues);
    void tenantId;
    const connection = await this.#platformPool.reserve();
    try {
      const rows = await connection<Array<{ id: string; content: JsonObject }>>`
        SELECT id, content
        FROM runtime_extension_compatibility_inputs(${type})
      `;
      return rows.flatMap(({ id, content }) => {
        const issues = validateJsonSchema(proposedSchema, content);
        return issues.length === 0 ? [] : [{ extensionId: id, issues }];
      });
    } finally {
      connection.release();
    }
  }
}
