import type { ConnectionPool, Tx } from "../../kernel";

import { verifyLocalPassword, type LocalAuthRecord } from "./password";
import { isValidScope, type TokenSigner } from "./token";

const TENANT_SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NIL_TENANT = "00000000-0000-0000-0000-000000000000";
const DUMMY_AUTH: LocalAuthRecord = Object.freeze({
  provider: "local",
  hash: "$argon2id$v=19$m=65536,t=2,p=1$oNuo/DqXLI7tco+0lf1g6u+uIR56sPoaksWHVKngADE$ILlXe/J7wHRbwu2uO2smXFPRn339paMAxPHIX2QO+90",
});

export interface LocalLoginInput {
  readonly tenant: string;
  readonly email: string;
  readonly password: string;
}

export interface LocalLoginResult {
  readonly accessToken: string;
  readonly tokenType: "Bearer";
  readonly expiresInSeconds: 900;
  readonly user: {
    readonly id: string;
    readonly displayName: string;
  };
}

interface UserRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly display_name: string;
  readonly auth: unknown;
  readonly scopes: string[];
}

interface NormalizedLogin {
  readonly tenant: string;
  readonly email: string;
  readonly password: string;
}

function normalize(input: LocalLoginInput): NormalizedLogin | null {
  if (typeof input.tenant !== "string" || typeof input.email !== "string" || typeof input.password !== "string") {
    return null;
  }
  const tenant = input.tenant.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();
  const passwordBytes = new TextEncoder().encode(input.password).length;
  if (!TENANT_SLUG.test(tenant) || email.length > 254 || !EMAIL.test(email) ||
      passwordBytes === 0 || passwordBytes > 1024) {
    return null;
  }
  return { tenant, email, password: input.password };
}

async function loadUser(tx: Tx, tenant: string, email: string): Promise<UserRow | null> {
  await tx.unsafe("SET LOCAL ROLE app_role");
  const tenants = await tx<{ id: string }[]>`
    SELECT id
    FROM tenant
    WHERE slug = ${tenant}
      AND status = 'active'
  `;
  const tenantId = tenants[0]?.id ?? NIL_TENANT;
  await tx`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

  const users = await tx<UserRow[]>`
    SELECT
      app_user.id,
      app_user.tenant_id,
      app_user.display_name,
      app_user.auth,
      COALESCE(
        array_agg(DISTINCT role_permission.permission_code)
          FILTER (WHERE role_permission.permission_code IS NOT NULL),
        ARRAY[]::text[]
      ) AS scopes
    FROM app_user
    LEFT JOIN user_role
      ON user_role.user_id = app_user.id
     AND user_role.tenant_id = app_user.tenant_id
    LEFT JOIN role
      ON role.id = user_role.role_id
     AND role.tenant_id = app_user.tenant_id
    LEFT JOIN role_permission ON role_permission.role_id = role.id
    WHERE app_user.tenant_id = ${tenantId}::uuid
      AND app_user.email = ${email}
      AND app_user.status = 'active'
    GROUP BY app_user.id, app_user.tenant_id, app_user.display_name, app_user.auth
  `;
  return users[0] ?? null;
}

export class LocalLoginService {
  readonly #pool: ConnectionPool;
  readonly #tokens: Pick<TokenSigner, "issue">;

  constructor(pool: ConnectionPool, tokens: Pick<TokenSigner, "issue">) {
    this.#pool = pool;
    this.#tokens = tokens;
  }

  async authenticate(input: LocalLoginInput): Promise<LocalLoginResult | null> {
    const normalized = normalize(input);
    if (!normalized) {
      await verifyLocalPassword("invalid", DUMMY_AUTH);
      return null;
    }

    const connection = await this.#pool.reserve();
    let began = false;
    let user: UserRow | null = null;
    try {
      await connection.unsafe("BEGIN");
      began = true;
      user = await loadUser(connection, normalized.tenant, normalized.email);
      await connection.unsafe("COMMIT");
      began = false;
    } catch (error) {
      if (began) {
        try { await connection.unsafe("ROLLBACK"); } catch { /* discard broken connection */ }
      }
      throw error;
    } finally {
      connection.release();
    }

    const validPassword = await verifyLocalPassword(normalized.password, user?.auth ?? DUMMY_AUTH);
    if (!user || !validPassword) return null;
    const scopes = [...new Set(user.scopes.filter(isValidScope))].sort();
    const accessToken = await this.#tokens.issue({
      userId: user.id,
      tenantId: user.tenant_id,
      scopes,
    });
    return {
      accessToken,
      tokenType: "Bearer",
      expiresInSeconds: 900,
      user: { id: user.id, displayName: user.display_name },
    };
  }
}
