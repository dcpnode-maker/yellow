import type { Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const READ = "inventory.availability:read";
const DEMO_PROPERTIES = ["6081b544-22a1-534f-a86d-bb1ae0519e14", "01e4e102-c54f-5205-9542-d84d103084f8"];

export interface PortfolioNode {
  readonly id: string;
  readonly name: string;
  readonly kind: "group" | "brand" | "region" | "property";
  readonly parentId: string | null;
  readonly authorizedPropertyCount: number;
  readonly timezone: string | null;
  readonly currency: string | null;
}
export interface PortfolioPage {
  readonly scope: PortfolioNode | null;
  readonly nodes: readonly PortfolioNode[];
  readonly nextCursor: string | null;
}
export interface PortfolioQuery {
  readonly scopeNode?: string;
  readonly after?: string;
  readonly limit: number;
}
export class PortfolioValidationError extends Error {}
export class PortfolioAuthorizationError extends Error {}

export function parsePortfolioQuery(query: URLSearchParams): PortfolioQuery {
  const seen = new Set<string>();
  for (const [key, value] of query) {
    if (!["scopeNode", "after", "limit"].includes(key) || seen.has(key) || value === "") {
      throw new PortfolioValidationError("Invalid portfolio query");
    }
    seen.add(key);
  }
  const scopeNode = query.get("scopeNode");
  const after = query.get("after");
  const rawLimit = query.get("limit");
  if ((scopeNode !== null && !UUID.test(scopeNode)) || (after !== null && !UUID.test(after)) ||
      (rawLimit !== null && !/^(?:[1-9][0-9]?|100)$/.test(rawLimit))) {
    throw new PortfolioValidationError("Invalid portfolio query");
  }
  return { ...(scopeNode === null ? {} : { scopeNode }), ...(after === null ? {} : { after }),
    limit: rawLimit === null ? 50 : Number(rawLimit) };
}

/** Current DB grants are intersected before any hierarchy/count calculation. */
export class PortfolioReadService {
  async read(tx: Tx, input: PortfolioQuery & { readonly tenantId: string; readonly actorId: string;
    readonly demoRestricted?: boolean }): Promise<PortfolioPage> {
    if (![input.tenantId, input.actorId, ...(input.scopeNode ? [input.scopeNode] : []),
      ...(input.after ? [input.after] : [])].every(value => UUID.test(value)) ||
      !Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100 ||
      input.scopeNode === "" || input.after === "") throw new PortfolioValidationError("Invalid portfolio input");
    const rows = await tx.unsafe<Array<{ authorized: boolean; scope: PortfolioNode | null; nodes: PortfolioNode[] }>>(`
      WITH grants AS MATERIALIZED (
        SELECT DISTINCT scope.id, scope.path
        FROM tenant t JOIN app_user actor ON actor.tenant_id=t.id AND actor.id=$2::uuid AND actor.status='active'
        JOIN user_role membership ON membership.tenant_id=actor.tenant_id AND membership.user_id=actor.id
        JOIN role r ON r.tenant_id=membership.tenant_id AND r.id=membership.role_id
        JOIN role_permission permission ON permission.role_id=r.id AND permission.permission_code=$3
        JOIN org_node scope ON scope.tenant_id=membership.tenant_id AND scope.id=membership.scope_node
        WHERE t.id=$1::uuid AND t.id=current_setting('app.tenant_id',true)::uuid AND t.status='active'
      ), permitted_properties AS MATERIALIZED (
        SELECT p.id,p.path FROM org_node p
        WHERE p.tenant_id=$1::uuid AND p.kind='property'
          AND EXISTS(SELECT 1 FROM grants g WHERE g.path @> p.path)
          AND (NOT $7::boolean OR p.id IN ($8::uuid,$9::uuid))
      ), visible AS MATERIALIZED (
        SELECT n.id,n.path,n.name,n.kind,
          CASE WHEN n.kind='property' THEN n.timezone ELSE NULL END timezone,
          CASE WHEN n.kind='property' THEN n.currency ELSE NULL END currency,
          count(p.id)::int property_count
        FROM permitted_properties p
        CROSS JOIN LATERAL generate_series(1,nlevel(p.path)) depth
        JOIN org_node n ON n.tenant_id=$1::uuid AND n.path=subpath(p.path,0,depth)
        WHERE n.kind IN ('group','brand','region','property')
          AND EXISTS(SELECT 1 FROM grants g WHERE g.path @> n.path)
        GROUP BY n.id
      ), shaped AS MATERIALIZED (
        SELECT n.id,n.path,jsonb_build_object('id',n.id,'name',n.name,'kind',n.kind,
          'parentId',parent.id,
          'authorizedPropertyCount',n.property_count,'timezone',n.timezone,'currency',n.currency) body
        FROM visible n LEFT JOIN visible parent ON parent.path=CASE WHEN nlevel(n.path)>1 THEN subpath(n.path,0,nlevel(n.path)-1) ELSE NULL END
      ), selected AS (SELECT * FROM shaped WHERE id=$4::uuid), page AS (
        SELECT n.id,n.body FROM shaped n
        WHERE ($5::uuid IS NULL OR n.id>$5::uuid) AND (
          ($4::uuid IS NULL AND n.id IN (SELECT g.id FROM grants g WHERE NOT EXISTS(SELECT 1 FROM grants ancestor WHERE ancestor.path @> g.path AND ancestor.id<>g.id)))
          OR ($4::uuid IS NOT NULL AND EXISTS(SELECT 1 FROM selected s WHERE s.path @> n.path AND nlevel(n.path)=nlevel(s.path)+1)))
        ORDER BY n.id LIMIT $6
      )
      SELECT EXISTS(SELECT 1 FROM grants) AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM selected)) authorized,
        (SELECT body FROM selected) scope,
        COALESCE((SELECT jsonb_agg(body ORDER BY id) FROM page),'[]'::jsonb) nodes
    `, [input.tenantId, input.actorId, READ, input.scopeNode ?? null, input.after ?? null,
      input.limit + 1, input.demoRestricted === true, DEMO_PROPERTIES[0]!, DEMO_PROPERTIES[1]!]);
    const row = rows[0];
    if (!row?.authorized) throw new PortfolioAuthorizationError("Portfolio authority unavailable");
    const nodes = row.nodes.slice(0, input.limit);
    return { scope: row.scope, nodes, nextCursor: row.nodes.length > input.limit ? nodes.at(-1)!.id : null };
  }
}
