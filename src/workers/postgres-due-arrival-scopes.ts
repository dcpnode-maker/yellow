import type { SQL } from "bun";

import type { DueArrivalScope, DueArrivalScopeSource } from "../contexts/reservations";

const MAX_SCOPE_BATCH_SIZE = 1_000;

interface DueArrivalScopeRow {
  readonly tenant_id: string;
  readonly property_node: string;
}

export class PostgresDueArrivalScopeSource implements DueArrivalScopeSource {
  readonly #pool: SQL;

  constructor(pool: SQL) {
    this.#pool = pool;
  }

  async listDueScopes(limit: number): Promise<readonly DueArrivalScope[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_SCOPE_BATCH_SIZE) {
      throw new Error(`limit must be between 1 and ${MAX_SCOPE_BATCH_SIZE}`);
    }
    const rows = await this.#pool<DueArrivalScopeRow[]>`
      SELECT tenant_id, property_node
      FROM runtime_due_arrival_scopes(${limit})
    `;
    return rows.map(({ tenant_id, property_node }) => ({
      tenantId: tenant_id,
      propertyNode: property_node,
    }));
  }
}
