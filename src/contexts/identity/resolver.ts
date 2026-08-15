import type { TenantIdentity, TenantResolver } from "../../kernel";

import type { TokenSigner } from "./token";

export class BearerTenantResolver implements TenantResolver {
  readonly #tokens: Pick<TokenSigner, "verify">;

  constructor(tokens: Pick<TokenSigner, "verify">) {
    this.#tokens = tokens;
  }

  async resolve(request: Request): Promise<TenantIdentity | null> {
    const authorization = request.headers.get("authorization");
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);
    if (!match?.[1]) return null;

    const claims = await this.#tokens.verify(match[1]);
    return claims === null ? null : { tenantId: claims.tid };
  }
}
