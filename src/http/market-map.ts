import {
  PlaceCatalogInputError,
  type PlaceCatalog,
  type PlaceCatalogSearchInput,
} from "../contexts/distribution";
import type { TenantRequestContext } from "../kernel";

const SCOPE = "rates.configuration:read";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PLACE_ID = /^[A-Za-z0-9][A-Za-z0-9_:.-]{0,127}$/;

function response(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function problem(status: number, code: string, detail: string): Response {
  return Response.json({ type: `urn:yellow:${code}`, title: code, status, detail }, {
    status, headers: { "cache-control": "no-store", "content-type": "application/problem+json" },
  });
}

/** Public-data access is still scoped to the signed actor's actual property grant. */
async function authorize(context: TenantRequestContext, property: string): Promise<Response | null> {
  const actor = context.identity.actorId;
  if (!actor || !UUID.test(actor) || context.tenantId !== context.identity.tenantId) {
    return problem(401, "auth/unauthorized", "A valid operator identity is required.");
  }
  if (!context.identity.scopes?.includes(SCOPE)) {
    return problem(403, "auth/scope_missing", "Rate configuration access is required.");
  }
  if (!UUID.test(property)) return problem(400, "request/invalid", "Property identifier is invalid.");
  const grants = await context.tx<{ id: string }[]>`
    SELECT DISTINCT target.id
    FROM user_role
    JOIN role ON role.id = user_role.role_id AND role.tenant_id = user_role.tenant_id
    JOIN role_permission ON role_permission.role_id = role.id
      AND role_permission.permission_code = ${SCOPE}
    JOIN org_node AS grant_node ON grant_node.id = user_role.scope_node
      AND grant_node.tenant_id = user_role.tenant_id
    JOIN org_node AS target ON target.tenant_id = user_role.tenant_id
      AND target.kind = 'property' AND target.path <@ grant_node.path
    JOIN app_user ON app_user.id = user_role.user_id
      AND app_user.tenant_id = user_role.tenant_id AND app_user.status = 'active'
    WHERE user_role.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND user_role.tenant_id = ${context.tenantId}::uuid
      AND user_role.user_id = ${actor}::uuid AND target.id = ${property}::uuid
    LIMIT 1
  `;
  return grants.length === 1 && grants[0]?.id === property ? null
    : problem(403, "auth/property_forbidden", "Access is not granted for this property.");
}

function queryInput(request: Request): PlaceCatalogSearchInput {
  const params = new URL(request.url).searchParams;
  const keys = [...params.keys()];
  if (keys.length !== new Set(keys).size) throw new PlaceCatalogInputError("duplicate_query_parameter");
  const mode = params.get("mode");
  const common = new Set(["mode", "limit", "cursor"]);
  const fields = mode === "bbox" ? ["west", "south", "east", "north"]
    : mode === "keyword" ? ["q"] : mode === "url" ? ["url"]
      : mode === "domain" ? ["domain"] : mode === "id" ? ["id"] : [];
  if (fields.length === 0 || keys.some((key) => !common.has(key) && !fields.includes(key))) {
    throw new PlaceCatalogInputError("invalid_query_parameter");
  }
  const rawLimit = params.get("limit");
  if (rawLimit !== null && !/^[1-9][0-9]{0,2}$/.test(rawLimit)) throw new PlaceCatalogInputError("invalid_limit");
  const limit = rawLimit === null ? 100 : Number(rawLimit);
  const cursor = params.get("cursor") ?? undefined;
  const base = { limit, ...(cursor === undefined ? {} : { cursor }) };
  const field = (name: string): string => {
    const value = params.get(name);
    if (!value || value.length > 2048) throw new PlaceCatalogInputError("missing_query_parameter");
    return value;
  };
  switch (mode) {
    case "bbox": {
      const number = (name: string) => {
        const raw = field(name);
        if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) throw new PlaceCatalogInputError("invalid_coordinate");
        return Number(raw);
      };
      return { mode, ...base, west: number("west"), south: number("south"), east: number("east"), north: number("north") };
    }
    case "keyword": return { mode, ...base, q: field("q") };
    case "url": return { mode, ...base, url: field("url") };
    case "domain": return { mode, ...base, domain: field("domain") };
    case "id": return { mode, ...base, id: field("id") };
    default: throw new PlaceCatalogInputError("invalid_query_mode");
  }
}

export class MarketMapHttpApi {
  constructor(private readonly catalog?: Pick<PlaceCatalog, "search" | "byIds">,
    private readonly now: () => Date = () => new Date()) {}

  async places(context: TenantRequestContext, property: string): Promise<Response> {
    try {
      const denied = await authorize(context, property);
      if (denied) return denied;
      if (!this.catalog) return problem(503, "market/catalog_unavailable", "Property discovery data has not been loaded. Ask your administrator to configure the catalog.");
      return response(this.catalog.search(queryInput(context.request)));
    } catch (error) { return this.failure(error); }
  }

  async selection(context: TenantRequestContext, property: string, body: unknown): Promise<Response> {
    try {
      const denied = await authorize(context, property);
      if (denied) return denied;
      if (!this.catalog) return problem(503, "market/catalog_unavailable", "Property discovery data is unavailable.");
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new PlaceCatalogInputError("invalid_selection");
      const data = body as Record<string, unknown>;
      if (Object.keys(data).length !== 2 || typeof data.subjectId !== "string" || !PLACE_ID.test(data.subjectId)
          || !Array.isArray(data.competitorIds) || data.competitorIds.length < 1 || data.competitorIds.length > 50
          || data.competitorIds.some((id) => typeof id !== "string" || !PLACE_ID.test(id))
          || new Set(data.competitorIds).size !== data.competitorIds.length
          || data.competitorIds.includes(data.subjectId)) throw new PlaceCatalogInputError("invalid_selection");
      // Reload the immutable index records. Browser-supplied names, prices, provenance
      // and tenant IDs are never accepted as source or operational authority.
      const ids = [data.subjectId, ...data.competitorIds as string[]];
      let records;
      try { records = this.catalog.byIds(ids); } catch (error) {
        if (error instanceof PlaceCatalogInputError && error.code === "unknown_ids") {
          return problem(409, "market/selection_changed", "A selected property is missing. Refresh the selection.");
        }
        throw error;
      }
      if (records.length !== ids.length || records.some((record, index) => record.id !== ids[index])) {
        return problem(409, "market/selection_changed", "A selected property is missing. Refresh the selection.");
      }
      const meta = this.catalog.search({ mode: "id", id: data.subjectId, limit: 1 });
      return response({ schemaVersion: "yellow.market-map-selection/v1", propertyId: property,
        generatedAt: this.now().toISOString(), release: meta.release, catalogSchemaVersion: meta.schemaVersion,
        subject: records[0], competitors: records.slice(1), status: "requires-provider-mapping",
        automaticPricingEligible: false, operationalWrites: false });
    } catch (error) { return this.failure(error); }
  }

  private failure(error: unknown): Response {
    return error instanceof PlaceCatalogInputError
      ? problem(400, "request/invalid", "Check the search area, identifiers and query values.")
      : problem(503, "market/unavailable", "Property discovery is temporarily unavailable. Please retry.");
  }
}
