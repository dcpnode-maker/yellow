export type LoginCredentials = Readonly<{ tenant: string; email: string; password: string }>;
export type GrantedProperty = Readonly<{ id: string; name: string; timezone: string }>;
export type SessionPrincipal = Readonly<{ actorId: string; tenantId: string; displayName: string }>;
export type AuthSnapshot = Readonly<{
  status: "anonymous" | "authenticated" | "expired";
  principal: SessionPrincipal | null;
  properties: readonly GrantedProperty[];
}>;
type Transport = (url: string, init?: RequestInit) => Promise<Response>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMPTY_PROPERTIES: readonly GrantedProperty[] = Object.freeze([]);

export class AuthenticationError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message); this.name = "AuthenticationError";
  }
}
export class SignInRequiredError extends AuthenticationError {
  constructor() { super("Sign in to continue this session."); this.name = "SignInRequiredError"; }
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseProperties(value: unknown): readonly GrantedProperty[] {
  if (!record(value) || !Array.isArray(value.properties)) throw new AuthenticationError("Property access could not be verified.");
  const ids = new Set<string>();
  const properties = value.properties.map((item: unknown) => {
    if (!record(item) || typeof item.id !== "string" || !UUID.test(item.id) || ids.has(item.id) ||
        typeof item.name !== "string" || !item.name.trim() || typeof item.timezone !== "string" || !item.timezone.trim()) {
      throw new AuthenticationError("Property access could not be verified.");
    }
    ids.add(item.id);
    return Object.freeze({ id: item.id, name: item.name, timezone: item.timezone });
  });
  if (!properties.length) throw new AuthenticationError("No properties are granted to this account.");
  return Object.freeze(properties);
}
function parseLogin(value: unknown): Readonly<{ token: string; expiresInSeconds: number; principal: SessionPrincipal }> {
  if (!record(value) || typeof value.accessToken !== "string" || value.tokenType !== "Bearer" ||
      typeof value.expiresInSeconds !== "number" || !Number.isInteger(value.expiresInSeconds) ||
      value.expiresInSeconds <= 0 || value.expiresInSeconds > 900 || !record(value.user) ||
      typeof value.user.id !== "string" || !UUID.test(value.user.id) ||
      typeof value.user.displayName !== "string" || !value.user.displayName.trim()) {
    throw new AuthenticationError("The sign-in response could not be verified.");
  }
  const parts = value.accessToken.split(".");
  let claims: unknown;
  try {
    if (parts.length !== 3 || parts.some(part => !part)) throw new Error();
    const payload = parts[1]!;
    claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=")));
  } catch { throw new AuthenticationError("The sign-in response could not be verified."); }
  // These claims bind local recovery identity only. Server scope/RLS checks authorize every request.
  if (!record(claims) || claims.sub !== value.user.id || typeof claims.tid !== "string" || !UUID.test(claims.tid)) {
    throw new AuthenticationError("The sign-in response could not be verified.");
  }
  return { token: value.accessToken, expiresInSeconds: value.expiresInSeconds,
    principal: Object.freeze({ actorId: value.user.id, tenantId: claims.tid, displayName: value.user.displayName }) };
}
async function json(response: Response, message: string): Promise<unknown> {
  try { return await response.json(); } catch { throw new AuthenticationError(message, response.status); }
}
function loginFailure(status: number): AuthenticationError {
  return new AuthenticationError(status === 401 ? "The tenant, email or password is incorrect." :
    status === 429 ? "Sign-in is temporarily limited. Try again later." : "Sign-in is temporarily unavailable.", status);
}

export function createAuthSession(options: Readonly<{ fetch?: Transport; now?: () => number }> = {}) {
  const transport = options.fetch ?? ((url, init) => fetch(url, init));
  const now = options.now ?? Date.now;
  let snapshot: AuthSnapshot = Object.freeze({ status: "anonymous", principal: null, properties: EMPTY_PROPERTIES });
  let token: string | null = null;
  let expiresAt = 0;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };
  const stopTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  function expire(): void {
    if (!token || now() < expiresAt) return;
    token = null; stopTimer();
    snapshot = Object.freeze({ ...snapshot, status: "expired" });
    notify();
  }
  async function session(): Promise<string> {
    expire();
    if (!token) throw new SignInRequiredError();
    return token;
  }
  async function grantedProperties(): Promise<readonly GrantedProperty[]> {
    const currentToken = await session();
    const response = await transport("/api/v1/me/properties", {
      headers: { authorization: `Bearer ${currentToken}` }, cache: "no-store",
    });
    if (!response.ok) throw new AuthenticationError("Property access is unavailable.", response.status);
    return parseProperties(await json(response, "Property access could not be verified."));
  }
  async function signIn(credentials: LoginCredentials, requiredPropertyId?: string): Promise<AuthSnapshot> {
    const attempt = ++generation;
    const previousPrincipal = snapshot.principal;
    let response: Response;
    try {
      response = await transport("/api/v1/auth/local:login", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant: credentials.tenant, email: credentials.email, password: credentials.password }),
      });
    } catch { throw new AuthenticationError("Sign-in could not reach the server. Try again."); }
    if (!response.ok) throw loginFailure(response.status);
    const candidate = parseLogin(await json(response, "The sign-in response could not be verified."));
    if (attempt !== generation) throw new AuthenticationError("A newer sign-in attempt has replaced this request.");
    if (previousPrincipal && (candidate.principal.actorId !== previousPrincipal.actorId || candidate.principal.tenantId !== previousPrincipal.tenantId)) {
      throw new AuthenticationError("Sign in with the same account to continue this session.");
    }
    const responseAt = now();
    let properties: readonly GrantedProperty[];
    try {
      const propertyResponse = await transport("/api/v1/me/properties", {
        headers: { authorization: `Bearer ${candidate.token}` }, cache: "no-store",
      });
      if (!propertyResponse.ok) throw new AuthenticationError("Property access is unavailable.", propertyResponse.status);
      properties = parseProperties(await json(propertyResponse, "Property access could not be verified."));
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError("Property access could not reach the server. Try again.");
    }
    if (attempt !== generation) throw new AuthenticationError("A newer sign-in attempt has replaced this request.");
    if (requiredPropertyId && !properties.some(property => property.id === requiredPropertyId)) {
      throw new AuthenticationError("Access to this property is no longer granted. The current work remains locked.");
    }
    expiresAt = responseAt + candidate.expiresInSeconds * 1000;
    if (now() >= expiresAt) throw new AuthenticationError("Sign-in expired before property access was verified. Try again.");
    token = candidate.token;
    snapshot = Object.freeze({ status: "authenticated", principal: candidate.principal, properties });
    stopTimer(); timer = setTimeout(expire, expiresAt - now()); notify();
    return snapshot;
  }
  return Object.freeze({ session, signIn, grantedProperties,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispose() { ++generation; stopTimer(); token = null; listeners.clear(); },
  });
}
export type AuthSession = ReturnType<typeof createAuthSession>;
export type AuthSessionAccess = Omit<AuthSession, "dispose">;
const defaultSession = createAuthSession();
export const reactAuthSession: AuthSessionAccess = Object.freeze({
  session: defaultSession.session, signIn: defaultSession.signIn, grantedProperties: defaultSession.grantedProperties,
  getSnapshot: defaultSession.getSnapshot, subscribe: defaultSession.subscribe,
});

export function requestedGrantedRoute(pathname: string, search: string, properties: readonly GrantedProperty[]): string | null {
  const match = /^\/p\/([0-9a-f-]+)(?:\/.*)?$/.exec(pathname);
  return match && UUID.test(match[1]!) && properties.some(property => property.id === match[1]) ? pathname + search : null;
}
export function grantedPropertyRoute(propertyId: string, properties: readonly GrantedProperty[]): string {
  if (!UUID.test(propertyId) || !properties.some(property => property.id === propertyId)) throw new AuthenticationError("Choose a granted property.");
  return `/p/${propertyId}/today`;
}
