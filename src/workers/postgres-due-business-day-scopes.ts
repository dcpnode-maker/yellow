import type { SQL } from "bun";

import type { DueBusinessDayScope, DueBusinessDayScopeSource } from "../contexts/financials";

const MAX_SCOPE_BATCH_SIZE = 1_000;

interface DueBusinessDayScopeRow {
  readonly tenant_id: string;
  readonly property_node: string;
}

export class PostgresDueBusinessDayScopeSource implements DueBusinessDayScopeSource {
  readonly #pool: SQL;

  constructor(pool: SQL) {
    this.#pool = pool;
  }

  async listDueScopes(limit: number): Promise<readonly DueBusinessDayScope[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_SCOPE_BATCH_SIZE) {
      throw new Error(`limit must be between 1 and ${MAX_SCOPE_BATCH_SIZE}`);
    }
    const rows = await this.#pool<DueBusinessDayScopeRow[]>`
      SELECT tenant_id, property_node
      FROM runtime_due_business_day_scopes(${limit})
    `;
    return rows.map(({ tenant_id, property_node }) => ({
      tenantId: tenant_id,
      propertyNode: property_node,
    }));
  }
}
