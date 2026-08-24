import {
  createAuditEnvelope,
  ExtensionRegistry,
  ExtensionValidationError,
  type TenantRequestContext,
} from "../kernel";

const TYPE_REGISTER_SCOPE = "identity.extension-type:register";
const INSTANCE_WRITE_SCOPE = "identity.extension:write";
const INSTANCE_READ_SCOPE = "identity.extension:read";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(body: Record<string, unknown>, name: string): string {
  const value = body[name];
  if (typeof value !== "string" || value === "") throw new Error(`${name} is required`);
  return value;
}

function authorized(context: TenantRequestContext, scope: string): context is TenantRequestContext & {
  identity: { actorId: string; scopes: readonly string[] };
} {
  return typeof context.identity.actorId === "string" && context.identity.scopes?.includes(scope) === true;
}

function errorResponse(error: unknown): Response {
  if (error instanceof ExtensionValidationError) {
    return Response.json({ error: "validation_failed", issues: error.issues }, { status: 422 });
  }
  const message = error instanceof Error ? error.message : String(error);
  const status = message.includes("already exists with divergent") ? 409 : 400;
  return Response.json({ error: message }, { status });
}

export class ExtensionHttpApi {
  readonly #registry: ExtensionRegistry;

  constructor(registry: ExtensionRegistry) {
    this.#registry = registry;
  }

  async registerType(context: TenantRequestContext, body: unknown): Promise<Response> {
    if (!authorized(context, TYPE_REGISTER_SCOPE)) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    try {
      if (!isObject(body) || !isObject(body.jsonSchema)) throw new Error("jsonSchema is required");
      const result = await this.#registry.registerType({
        type: requiredString(body, "type"),
        jsonSchema: body.jsonSchema,
        envelope: createAuditEnvelope({
          actorId: context.identity.actorId,
          tenantId: context.tenantId,
          propertyNode: requiredString(body, "propertyNode"),
          requestId: context.request.headers.get("x-request-id") ?? crypto.randomUUID(),
          operation: "extension_type.registered",
        }),
      });
      return Response.json({ result }, { status: result === "inserted" ? 201 : 200 });
    } catch (error) {
      return errorResponse(error);
    }
  }

  async createInstance(context: TenantRequestContext, body: unknown): Promise<Response> {
    if (!authorized(context, INSTANCE_WRITE_SCOPE)) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    try {
      if (!isObject(body) || !isObject(body.content)) throw new Error("content is required");
      const status = body.status;
      if (status !== undefined && status !== "draft" && status !== "active" && status !== "retired") {
        throw new Error("status must be draft, active, or retired");
      }
      const instance = await this.#registry.createInstance(context.tx, {
        type: requiredString(body, "type"),
        key: requiredString(body, "key"),
        content: body.content,
        status,
        envelope: createAuditEnvelope({
          actorId: context.identity.actorId,
          tenantId: context.tenantId,
          propertyNode: requiredString(body, "propertyNode"),
          requestId: context.request.headers.get("x-request-id") ?? crypto.randomUUID(),
          operation: "extension.created",
        }),
      });
      return Response.json(instance, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }

  async listInstances(context: TenantRequestContext): Promise<Response> {
    if (!authorized(context, INSTANCE_READ_SCOPE)) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    return Response.json({ extensions: await this.#registry.listVisible(context.tenantId) });
  }
}
