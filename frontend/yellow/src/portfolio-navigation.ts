export type PortfolioNodeKind = "group" | "brand" | "region" | "property";

export type PortfolioNode = Readonly<{
  id: string;
  name: string;
  kind: PortfolioNodeKind;
  parentId: string | null;
  authorizedPropertyCount: number;
  timezone: string | null;
  currency: string | null;
}>;

export type PortfolioPage = Readonly<{
  scope: PortfolioNode | null;
  nodes: readonly PortfolioNode[];
  nextCursor: string | null;
}>;

export function shouldLoadInitialPortfolioPage(open: boolean, hasLoaded: boolean, loading: boolean, hasError: boolean): boolean {
  return open && !hasLoaded && !loading && !hasError;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NODE_KINDS = new Set<PortfolioNodeKind>(["group", "brand", "region", "property"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNode(value: unknown): PortfolioNode | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort().join(",");
  if (keys !== "authorizedPropertyCount,currency,id,kind,name,parentId,timezone") return null;
  if (typeof value.id !== "string" || !UUID.test(value.id) ||
      typeof value.name !== "string" || value.name.trim().length === 0 ||
      typeof value.kind !== "string" || !NODE_KINDS.has(value.kind as PortfolioNodeKind) ||
      !(value.parentId === null || typeof value.parentId === "string" && UUID.test(value.parentId)) ||
      !Number.isSafeInteger(value.authorizedPropertyCount) || (value.authorizedPropertyCount as number) < 0 ||
      !(value.timezone === null || typeof value.timezone === "string") ||
      !(value.currency === null || typeof value.currency === "string")) return null;
  if (value.kind === "property" && typeof value.timezone !== "string") return null;
  if (value.kind !== "property" && (value.timezone !== null || value.currency !== null)) return null;
  return value as PortfolioNode;
}

/** Validate an API page before it reaches the explorer or contributes a visible count. */
export function parsePortfolioPage(value: unknown, requestedScopeId: string | null): PortfolioPage | null {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "nextCursor,nodes,scope" || !Array.isArray(value.nodes)) return null;
  if (value.nodes.length > 100) return null;
  if (requestedScopeId !== null && !UUID.test(requestedScopeId)) return null;
  const scope = value.scope === null ? null : parseNode(value.scope);
  if ((value.scope !== null && scope === null) ||
      (requestedScopeId === null && scope !== null) ||
      (requestedScopeId !== null && (!scope || scope.id !== requestedScopeId))) return null;
  if (!(value.nextCursor === null || typeof value.nextCursor === "string" && UUID.test(value.nextCursor))) return null;
  const nodes: PortfolioNode[] = [];
  const ids = new Set<string>();
  let previousId = "";
  for (const rawNode of value.nodes) {
    const node = parseNode(rawNode);
    if (!node || ids.has(node.id) || node.id === requestedScopeId || node.id.toLowerCase() <= previousId) return null;
    if (requestedScopeId === null && node.parentId !== null) return null;
    if (requestedScopeId !== null && node.parentId !== requestedScopeId) return null;
    ids.add(node.id);
    previousId = node.id.toLowerCase();
    nodes.push(node);
  }
  if (value.nextCursor !== null && (nodes.length === 0 || value.nextCursor.toLowerCase() !== nodes.at(-1)!.id.toLowerCase())) return null;
  return { scope, nodes, nextCursor: value.nextCursor as string | null };
}

/** Change only the property segment while retaining the active workspace and deep-link context. */
export function propertyWorkspaceUrl(currentUrl: string, propertyId: string): string {
  if (!UUID.test(propertyId)) throw new TypeError("A canonical property identifier is required.");
  const url = new URL(currentUrl, "https://yellow.invalid");
  const match = /^\/p\/[^/]+(?=\/|$)/.exec(url.pathname);
  if (match) {
    url.pathname = "/p/" + propertyId + url.pathname.slice(match[0].length);
  } else if (url.pathname === "/" || url.pathname === "/yellow-next" || url.pathname === "/yellow-next/") {
    url.pathname = "/p/" + propertyId + "/today";
  } else {
    throw new TypeError("The current URL is not a property workspace.");
  }
  return url.pathname + url.search + url.hash;
}
