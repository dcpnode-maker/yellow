import type { Tx } from "../../kernel";

const LTREE_PATH = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/;
const LTREE_LABEL = /^[A-Za-z0-9_]+$/;

export type OrgNodeKind = "group" | "brand" | "region" | "property" | "outlet";

export interface OrgHierarchyNode {
  readonly id: string;
  readonly tenantId: string;
  readonly path: string;
  readonly label: string;
  readonly depth: number;
  readonly kind: OrgNodeKind;
  readonly name: string;
}

interface OrgNodeRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly path: string;
  readonly label: string;
  readonly depth: number;
  readonly kind: OrgNodeKind;
  readonly name: string;
}

function requirePath(path: string): void {
  if (!LTREE_PATH.test(path)) throw new Error("org path must be a canonical ltree path");
}

function requireLabel(label: string): void {
  if (!LTREE_LABEL.test(label)) throw new Error("org label must be one ltree label");
}

function toNode(row: OrgNodeRow): OrgHierarchyNode {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    path: row.path,
    label: row.label,
    depth: row.depth,
    kind: row.kind,
    name: row.name,
  };
}

const NODE_COLUMNS = `
  id,
  tenant_id,
  path::text AS path,
  subpath(path, nlevel(path) - 1, 1)::text AS label,
  nlevel(path)::int AS depth,
  kind,
  name
`;

export class OrgHierarchy {
  async descendants(tx: Tx, ancestorPath: string, kind?: OrgNodeKind): Promise<readonly OrgHierarchyNode[]> {
    requirePath(ancestorPath);
    const rows = kind === undefined
      ? await tx.unsafe<OrgNodeRow[]>(`
          SELECT ${NODE_COLUMNS}
          FROM org_node
          WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
            AND path <@ $1::ltree
            AND path <> $1::ltree
          ORDER BY path
        `, [ancestorPath])
      : await tx.unsafe<OrgNodeRow[]>(`
          SELECT ${NODE_COLUMNS}
          FROM org_node
          WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
            AND path <@ $1::ltree
            AND path <> $1::ltree
            AND kind = $2
          ORDER BY path
        `, [ancestorPath, kind]);
    return rows.map(toNode);
  }

  propertiesUnder(tx: Tx, ancestorPath: string): Promise<readonly OrgHierarchyNode[]> {
    return this.descendants(tx, ancestorPath, "property");
  }

  brandsUnder(tx: Tx, ancestorPath: string): Promise<readonly OrgHierarchyNode[]> {
    return this.descendants(tx, ancestorPath, "brand");
  }

  async ancestors(tx: Tx, descendantPath: string): Promise<readonly OrgHierarchyNode[]> {
    requirePath(descendantPath);
    const rows = await tx.unsafe<OrgNodeRow[]>(`
      SELECT ${NODE_COLUMNS}
      FROM org_node
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        AND path @> $1::ltree
      ORDER BY nlevel(path), path
    `, [descendantPath]);
    return rows.map(toNode);
  }

  async siblings(tx: Tx, nodePath: string): Promise<readonly OrgHierarchyNode[]> {
    requirePath(nodePath);
    const labels = nodePath.split(".");
    if (labels.length === 1) return [];
    const parentPath = labels.slice(0, -1).join(".");
    const pattern = `${parentPath}.*{1}`;
    const rows = await tx.unsafe<OrgNodeRow[]>(`
      SELECT ${NODE_COLUMNS}
      FROM org_node
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        AND path ~ $1::lquery
        AND path <> $2::ltree
      ORDER BY path
    `, [pattern, nodePath]);
    return rows.map(toNode);
  }

  async assertWellFormed(tx: Tx, nodeId: string, ownLabel: string): Promise<void> {
    requireLabel(ownLabel);
    const rows = await tx.unsafe<Array<{ actual_label: string; missing_prefixes: string[] }>>(`
      SELECT
        subpath(node.path, nlevel(node.path) - 1, 1)::text AS actual_label,
        COALESCE(array_agg(prefix.path::text ORDER BY prefix.depth)
          FILTER (WHERE parent.id IS NULL), ARRAY[]::text[]) AS missing_prefixes
      FROM org_node AS node
      LEFT JOIN LATERAL (
        SELECT depth, subpath(node.path, 0, depth) AS path
        FROM generate_series(1, nlevel(node.path) - 1) AS depth
      ) AS prefix ON true
      LEFT JOIN org_node AS parent
        ON parent.tenant_id = node.tenant_id
       AND parent.path = prefix.path
      WHERE node.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND node.id = $1::uuid
      GROUP BY node.path
    `, [nodeId]);
    const row = rows[0];
    if (!row) throw new Error("Org node was not found in the active tenant");
    if (row.actual_label !== ownLabel) {
      throw new Error(`Org path must end with its own label ${ownLabel}`);
    }
    if (row.missing_prefixes.length > 0) {
      throw new Error(`Org path has missing same-tenant prefixes: ${row.missing_prefixes.join(", ")}`);
    }
  }
}
