import { isIP } from "node:net";
import type { BrowserSessionIdentityReader, TokenSigner } from "../contexts/identity";

const COOKIE = "__Host-yellow-browser-session";
const MARKER = "x-yellow-browser-session";
const VERSION = "v1";
type Peer = Readonly<{ address: string }> | null | undefined;
export type BrowserSessionOriginPolicy = Readonly<{
  httpsOrigins: readonly string[];
  localhostHttpOrigin?: string;
  /** Explicit TLS termination at a trusted loopback proxy, never inferred from headers. */
  allowLoopbackTlsProxy?: boolean;
}>;

function canonicalOrigin(value: string, protocol: "https:" | "http:"): URL {
  const url = new URL(value);
  if (url.protocol !== protocol || url.origin !== value || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) throw new Error("Browser session origin must be canonical");
  return url;
}
function loopback(peer: Peer): boolean {
  if (!peer) return false;
  const address = peer.address.toLowerCase();
  return address === "::1" || isIP(address) === 4 && address.startsWith("127.") ||
    address.startsWith("::ffff:") && isIP(address.slice(7)) === 4 && address.slice(7).startsWith("127.");
}
function response(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}
function cookie(token: string, seconds: number): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
}
function readCookie(request: Request): string | null {
  const raw = request.headers.get("cookie");
  if (!raw || raw.length > 16_384) return null;
  const values = raw.split(";").map(part => part.trim()).filter(part => part.startsWith(`${COOKIE}=`));
  if (values.length !== 1) return null;
  const token = values[0]!.slice(COOKIE.length + 1);
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) ? token : null;
}
function emptyBody(body: unknown): boolean {
  return body !== null && typeof body === "object" && !Array.isArray(body) && Object.keys(body).length === 0;
}

/** Only these explicit endpoints turn a browser cookie into a memory bearer. */
export class BrowserSessionHttpApi {
  readonly #origins: ReadonlySet<string>;
  readonly #localhostOrigin: string | undefined;
  constructor(
    readonly tokens: Pick<TokenSigner, "verify">,
    readonly identities: BrowserSessionIdentityReader,
    readonly policy: BrowserSessionOriginPolicy,
    readonly now: () => number = () => Math.floor(Date.now() / 1_000),
  ) {
    if (policy.httpsOrigins.length > 8 || new Set(policy.httpsOrigins).size !== policy.httpsOrigins.length) {
      throw new Error("Browser session origins must be a bounded explicit set");
    }
    for (const origin of policy.httpsOrigins) canonicalOrigin(origin, "https:");
    if (policy.localhostHttpOrigin !== undefined) {
      if (canonicalOrigin(policy.localhostHttpOrigin, "http:").hostname !== "localhost") {
        throw new Error("HTTP browser sessions require the explicit localhost development origin");
      }
    }
    if (policy.httpsOrigins.length === 0 && policy.localhostHttpOrigin === undefined) {
      throw new Error("Browser session origins are not configured");
    }
    this.#origins = new Set(policy.httpsOrigins);
    this.#localhostOrigin = policy.localhostHttpOrigin;
  }

  isBrowserLogin(request: Request): boolean { return request.headers.has(MARKER); }

  admission(request: Request, peer?: Peer): Response | null {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");
    const mode = request.headers.get("sec-fetch-mode");
    if (request.method !== "POST" || url.search !== "" || request.headers.get(MARKER) !== VERSION ||
        request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json" ||
        !origin || origin === "null" || site !== null && site !== "same-origin" ||
        mode !== null && mode !== "cors" && mode !== "same-origin") {
      return response(403, "browser_session_origin_forbidden");
    }
    if (origin === this.#localhostOrigin && url.origin === origin && loopback(peer)) return null;
    if (!this.#origins.has(origin)) return response(403, "browser_session_origin_forbidden");
    if (url.protocol === "https:" && url.origin === origin) return null;
    // Exact public HTTPS origin is configured independently of the internal Host.
    // No Forwarded, X-Forwarded-Host/Proto or CF header creates this trust.
    if (url.protocol === "http:" && this.policy.allowLoopbackTlsProxy === true && loopback(peer)) return null;
    return response(403, "browser_session_transport_forbidden");
  }

  async captureCredentialLogin(request: Request, login: Response, peer?: Peer): Promise<Response> {
    const denied = this.admission(request, peer);
    if (denied) return denied;
    if (!login.ok) return login;
    try {
      const value: unknown = await login.clone().json();
      if (!value || typeof value !== "object" || !("accessToken" in value) ||
          typeof value.accessToken !== "string" || value.accessToken.length > 3_800 || !("tokenType" in value) || value.tokenType !== "Bearer" ||
          !("user" in value) || !value.user || typeof value.user !== "object" || !("id" in value.user)) {
        return response(503, "browser_session_unavailable");
      }
      const claims = await this.tokens.verify(value.accessToken);
      const remaining = claims ? claims.exp - this.now() : 0;
      if (!claims || claims.sub !== value.user.id || !Number.isInteger(remaining) || remaining <= 0 || remaining > 900) {
        return response(503, "browser_session_unavailable");
      }
      const headers = new Headers(login.headers);
      headers.set("set-cookie", cookie(value.accessToken, remaining));
      headers.set("cache-control", "no-store");
      return new Response(login.body, { status: login.status, headers });
    } catch { return response(503, "browser_session_unavailable"); }
  }

  async resume(request: Request, body: unknown, peer?: Peer): Promise<Response> {
    const denied = this.admission(request, peer);
    if (denied) return denied;
    if (!emptyBody(body)) return response(400, "browser_session_invalid");
    const token = readCookie(request);
    if (!token) return response(401, "browser_session_unauthenticated");
    try {
      const claims = await this.tokens.verify(token);
      if (!claims || claims.exp <= this.now()) return response(401, "browser_session_unauthenticated");
      const user = await this.identities.readActiveActor(claims);
      const remaining = claims.exp - this.now();
      if (!user || user.id !== claims.sub || !Number.isInteger(remaining) || remaining <= 0 || remaining > 900) {
        return response(401, "browser_session_unauthenticated");
      }
      return Response.json({ accessToken: token, tokenType: "Bearer", expiresInSeconds: remaining, user },
        { headers: { "cache-control": "no-store" } });
    } catch { return response(503, "browser_session_unavailable"); }
  }

  logout(request: Request, body: unknown, peer?: Peer): Response {
    const denied = this.admission(request, peer);
    if (denied) return denied;
    if (!emptyBody(body)) return response(400, "browser_session_invalid");
    return new Response(null, { status: 204, headers: { "cache-control": "no-store", "set-cookie": cookie("", 0) } });
  }
}
