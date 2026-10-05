import type { AccessTokenClaims } from "./token";
import type { Database } from "../../kernel";

export type ActiveBrowserActor = Readonly<{ id: string; displayName: string }>;
export interface BrowserSessionIdentityReader {
  readActiveActor(claims: AccessTokenClaims): Promise<ActiveBrowserActor | null>;
}

/** Reads an already-verified actor without issuing a token or changing any grant. */
export class PostgresBrowserSessionIdentityReader implements BrowserSessionIdentityReader {
  constructor(readonly database: Pick<Database, "withTenantTransaction">) {}

  async readActiveActor(claims: AccessTokenClaims): Promise<ActiveBrowserActor | null> {
    return this.database.withTenantTransaction(claims.tid, async tx => {
      const rows = await tx<{ id: string; display_name: string }[]>`
        SELECT actor.id::text AS id, actor.display_name
        FROM app_user actor
        JOIN tenant ON tenant.id = actor.tenant_id AND tenant.status = 'active'
        WHERE actor.tenant_id = ${claims.tid}::uuid
          AND actor.id = ${claims.sub}::uuid
          AND actor.status = 'active'
      `;
      const row = rows[0];
      return rows.length === 1 && row?.id === claims.sub &&
        typeof row.display_name === "string" && row.display_name.trim().length > 0
        ? { id: row.id, displayName: row.display_name } : null;
    });
  }
}
