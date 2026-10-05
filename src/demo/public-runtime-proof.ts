export interface DemoPublicRuntimeProofInput {
  readonly requestUrl: string;
  readonly forwardedProto?: string | null;
  readonly forwardedHost?: string | null;
  readonly userAgent?: string | null;
}

export interface DemoPublicRuntimeProof {
  readonly product: "Yellow PMS";
  readonly mode: "public-runtime-proof";
  readonly requestUrl: string;
  readonly protocol: "http:" | "https:" | "other";
  readonly host: string;
  readonly hostClass: "localhost" | "private-lan" | "public";
  readonly publicAccessObserved: boolean;
  readonly mobileProofObserved: boolean;
  readonly mobileProofRequired: boolean;
  readonly readyToShare: boolean;
  readonly checkedRoutes: readonly string[];
  readonly nextProof: string;
  readonly userAgentObserved: string | null;
}

const CHECKED_ROUTES = Object.freeze([
  "/",
  "/api/v1/demo/proof-bundle",
  "/api/v1/demo/action-safety-matrix",
  "/api/v1/demo/share-packet",
]);

export function buildDemoPublicRuntimeProof(input: DemoPublicRuntimeProofInput): DemoPublicRuntimeProof {
  const parsed = safeParseUrl(input.requestUrl);
  const protocol = normalizeProtocol(firstForwardedValue(input.forwardedProto) ?? parsed?.protocol ?? "");
  const host = firstForwardedValue(input.forwardedHost) ?? parsed?.host ?? "unknown";
  const hostname = stripPort(host);
  const hostClass = classifyHost(hostname);
  const publicAccessObserved = protocol === "https:" && hostClass === "public";
  const mobileProofObserved = publicAccessObserved && isMobileUserAgent(input.userAgent);

  return Object.freeze({
    product: "Yellow PMS" as const,
    mode: "public-runtime-proof" as const,
    requestUrl: input.requestUrl,
    protocol,
    host,
    hostClass,
    publicAccessObserved,
    mobileProofObserved,
    mobileProofRequired: !mobileProofObserved,
    readyToShare: publicAccessObserved && mobileProofObserved,
    checkedRoutes: CHECKED_ROUTES,
    nextProof: publicAccessObserved
      ? mobileProofObserved
        ? "Public HTTPS mobile runtime proof is observed for this request."
        : "Open this public URL from a mobile browser or mobile-sized viewport and reread this route."
      : "Expose the demo through an HTTPS public host, then load this route from that public URL.",
    userAgentObserved: input.userAgent?.slice(0, 240) ?? null,
  });
}

function isMobileUserAgent(value: string | null | undefined): boolean {
  if (value === undefined || value === null) return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(value);
}

function safeParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeProtocol(protocol: string): "http:" | "https:" | "other" {
  const normalized = protocol.endsWith(":") ? protocol : `${protocol}:`;
  if (normalized === "http:" || normalized === "https:") return normalized;
  return "other";
}

function firstForwardedValue(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const first = value.split(",")[0]?.trim();
  return first === "" || first === undefined ? null : first;
}

function stripPort(host: string): string {
  if (host.startsWith("[") && host.includes("]")) return host.slice(1, host.indexOf("]"));
  return host.split(":")[0] ?? host;
}

function classifyHost(hostname: string): "localhost" | "private-lan" | "public" {
  const host = hostname.toLowerCase();
  if (host === "" || host === "localhost" || host === "127.0.0.1" || host === "::1") return "localhost";
  if (
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith(".local")
  ) {
    return "private-lan";
  }
  return "public";
}
