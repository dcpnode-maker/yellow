import { randomUUID } from "node:crypto";
import { SQL, type ReservedSQL } from "bun";

import {
  MARKET_COMPSET_EXTENSION_TYPE,
  MARKET_COMPSET_READ_SCOPE,
  MARKET_COMPSET_SCHEMA,
  MARKET_COMPSET_WRITE_SCOPE,
} from "../../src/contexts/distribution";
import { readMarketCompsetIntegrationEnvironment } from "./market-compset-environment";

/** Exact grants consumed by the Order472 current-authority capability. */
export const MARKET_COMPSET_FIXTURE_PERMISSIONS = Object.freeze({
  read: MARKET_COMPSET_READ_SCOPE,
  write: MARKET_COMPSET_WRITE_SCOPE,
});

export interface MarketCompsetFixture {
  readonly runId: string;
  readonly tenantA: string;
  readonly tenantB: string;
  readonly propertyA: string;
  readonly propertyA2: string;
  readonly propertyB: string;
  readonly actorA: string;
  readonly readerA: string;
  readonly wrongPropertyActorA: string;
  readonly actorB: string;
  readonly inactiveActorA: string;
  readonly ungrantedActorA: string;
  readonly additionalPropertyIds: readonly string[];
  readonly writerRoleA: string;
  readonly readerRoleA: string;
  readonly wrongPropertyRoleA: string;
  readonly writerRoleB: string;
  readonly readPermission: typeof MARKET_COMPSET_READ_SCOPE;
  readonly writePermission: typeof MARKET_COMPSET_WRITE_SCOPE;
}

export interface MarketCompsetFixtureOptions {
  /** A label for target-local synthetic rows only; it never forms an SQL identifier. */
  readonly label?: string;
  /** Fresh nodes beneath only this call's newly generated tenant A root. */
  readonly additionalProperties?: number;
}

const LABEL = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const TYPE_SCHEMA_JSON = JSON.stringify(MARKET_COMPSET_SCHEMA);
type Transaction = SQL | ReservedSQL;

function checkedLabel(value: string | undefined): string {
  if (value === undefined) return "market-compset";
  if (!LABEL.test(value)) throw new Error("Market compset fixture label is invalid");
  return value;
}

async function assertSyntheticTarget(tx: Transaction, database: string): Promise<void> {
  const rows = await tx<Array<{ readonly database_name: string; readonly session_role: string; readonly effective_role: string }>>`
    SELECT current_database() AS database_name, session_user AS session_role, current_user AS effective_role
  `;
  const current = rows[0];
  if (
    rows.length !== 1
    || current?.database_name !== database
    || current.session_role !== "yellow_deploy"
    || current.effective_role !== "yellow_deploy"
  ) {
    throw new Error("Market compset fixture requires the dedicated Order472 deploy target");
  }
}

async function ensurePermission(tx: Transaction, code: string, description: string): Promise<void> {
  await tx`
    INSERT INTO permission (code, description) VALUES (${code}, ${description})
    ON CONFLICT (code) DO NOTHING
  `;
  const rows = await tx<Array<{ description: string }>>`
    SELECT description FROM permission WHERE code = ${code} LIMIT 2
  `;
  if (rows.length !== 1 || rows[0]?.description !== description) {
    throw new Error("Market compset fixture permission catalogue differs");
  }
}

async function ensureMarketCompsetType(tx: Transaction): Promise<void> {
  await tx`
    INSERT INTO extension_type (type, json_schema)
    VALUES (${MARKET_COMPSET_EXTENSION_TYPE}, ${TYPE_SCHEMA_JSON}::text::jsonb)
    ON CONFLICT (type) DO NOTHING
  `;
  const rows = await tx<Array<{ exact: boolean }>>`
    SELECT json_schema = ${TYPE_SCHEMA_JSON}::text::jsonb AS exact
      FROM extension_type WHERE type = ${MARKET_COMPSET_EXTENSION_TYPE} LIMIT 2
  `;
  if (rows.length !== 1 || rows[0]?.exact !== true) {
    throw new Error("Market compset fixture extension type differs");
  }
}

/**
 * Creates one atomic, UUID-namespaced cohort in the already admitted synthetic
 * Order472 database.  It deliberately never removes or rewrites a prior cohort.
 */
export async function seedMarketCompsetFixture(
  deploy: SQL,
  options: MarketCompsetFixtureOptions = {},
): Promise<MarketCompsetFixture> {
  const environment = readMarketCompsetIntegrationEnvironment();
  const label = checkedLabel(options.label);
  const additionalCount = options.additionalProperties ?? 0;
  if (!Number.isSafeInteger(additionalCount) || additionalCount < 0 || additionalCount > 60) {
    throw new Error("Market compset fixture additional property count is invalid");
  }
  const additionalPropertyIds = Object.freeze(Array.from({ length: additionalCount }, () => randomUUID()));
  const runId = randomUUID();
  const ids = Object.freeze({
    tenantA: randomUUID(), tenantB: randomUUID(), rootA: randomUUID(), rootB: randomUUID(),
    propertyA: randomUUID(), propertyA2: randomUUID(), propertyB: randomUUID(),
    actorA: randomUUID(), readerA: randomUUID(), wrongPropertyActorA: randomUUID(), actorB: randomUUID(),
    inactiveActorA: randomUUID(), ungrantedActorA: randomUUID(),
    writerRoleA: randomUUID(), readerRoleA: randomUUID(), wrongPropertyRoleA: randomUUID(), writerRoleB: randomUUID(),
  });
  const pathA = `order472_${runId.replaceAll("-", "")}`;
  const pathB = `order472b_${runId.replaceAll("-", "")}`;

  await deploy.begin(async tx => {
    await assertSyntheticTarget(tx, environment.database);
    await ensurePermission(tx, MARKET_COMPSET_READ_SCOPE, "Read confirmed market competitor evidence");
    await ensurePermission(tx, MARKET_COMPSET_WRITE_SCOPE, "Confirm market competitor evidence");
    await ensureMarketCompsetType(tx);

    await tx`
      INSERT INTO tenant (id, slug, name, status) VALUES
        (${ids.tenantA}::uuid, ${`${label}-a-${runId.slice(0, 8)}`}, 'Order472 synthetic tenant A', 'active'),
        (${ids.tenantB}::uuid, ${`${label}-b-${runId.slice(0, 8)}`}, 'Order472 synthetic tenant B', 'active')
    `;
    await tx`
      INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency, config) VALUES
        (${ids.rootA}::uuid, ${ids.tenantA}::uuid, ${pathA}::ltree, 'group', 'Order472 tenant A root', NULL, NULL, '{}'::jsonb),
        (${ids.propertyA}::uuid, ${ids.tenantA}::uuid, ${`${pathA}.property_a`}::ltree, 'property', 'Order472 property A', 'Asia/Riyadh', 'SAR', '{}'::jsonb),
        (${ids.propertyA2}::uuid, ${ids.tenantA}::uuid, ${`${pathA}.property_a2`}::ltree, 'property', 'Order472 property A2', 'Asia/Dubai', 'AED', '{}'::jsonb),
        (${ids.rootB}::uuid, ${ids.tenantB}::uuid, ${pathB}::ltree, 'group', 'Order472 tenant B root', NULL, NULL, '{}'::jsonb),
        (${ids.propertyB}::uuid, ${ids.tenantB}::uuid, ${`${pathB}.property_b`}::ltree, 'property', 'Order472 property B', 'America/Toronto', 'USD', '{}'::jsonb)
    `;
    await tx`
      INSERT INTO app_user (id, tenant_id, email, display_name, status) VALUES
        (${ids.actorA}::uuid, ${ids.tenantA}::uuid, ${`${runId}.writer-a@order472.invalid`}, 'Order472 writer A', 'active'),
        (${ids.readerA}::uuid, ${ids.tenantA}::uuid, ${`${runId}.reader-a@order472.invalid`}, 'Order472 reader A', 'active'),
        (${ids.wrongPropertyActorA}::uuid, ${ids.tenantA}::uuid, ${`${runId}.wrong-property-a@order472.invalid`}, 'Order472 property A2 writer', 'active'),
        (${ids.actorB}::uuid, ${ids.tenantB}::uuid, ${`${runId}.writer-b@order472.invalid`}, 'Order472 writer B', 'active'),
        (${ids.inactiveActorA}::uuid, ${ids.tenantA}::uuid, ${`${runId}.inactive-a@order472.invalid`}, 'Order472 disabled reader', 'disabled'),
        (${ids.ungrantedActorA}::uuid, ${ids.tenantA}::uuid, ${`${runId}.ungranted-a@order472.invalid`}, 'Order472 ungranted reader', 'active')
    `;
    for (const [index, id] of additionalPropertyIds.entries()) {
      await tx`
        INSERT INTO org_node (id,tenant_id,path,kind,name,timezone,currency,config)
        VALUES (${id}::uuid,${ids.tenantA}::uuid,${`${pathA}.pagination_${index}`}::ltree,'property',
          ${`Order472 pagination property ${index}`},'Asia/Riyadh','SAR','{}'::jsonb)
      `;
    }
    await tx`
      INSERT INTO role (id, tenant_id, name) VALUES
        (${ids.writerRoleA}::uuid, ${ids.tenantA}::uuid, 'Order472 writer A'),
        (${ids.readerRoleA}::uuid, ${ids.tenantA}::uuid, 'Order472 reader A'),
        (${ids.wrongPropertyRoleA}::uuid, ${ids.tenantA}::uuid, 'Order472 property A2 writer'),
        (${ids.writerRoleB}::uuid, ${ids.tenantB}::uuid, 'Order472 writer B')
    `;
    await tx`
      INSERT INTO role_permission (role_id, permission_code) VALUES
        (${ids.writerRoleA}::uuid, ${MARKET_COMPSET_READ_SCOPE}),
        (${ids.writerRoleA}::uuid, ${MARKET_COMPSET_WRITE_SCOPE}),
        (${ids.readerRoleA}::uuid, ${MARKET_COMPSET_READ_SCOPE}),
        (${ids.wrongPropertyRoleA}::uuid, ${MARKET_COMPSET_READ_SCOPE}),
        (${ids.wrongPropertyRoleA}::uuid, ${MARKET_COMPSET_WRITE_SCOPE}),
        (${ids.writerRoleB}::uuid, ${MARKET_COMPSET_READ_SCOPE}),
        (${ids.writerRoleB}::uuid, ${MARKET_COMPSET_WRITE_SCOPE})
    `;
    await tx`
      INSERT INTO user_role (tenant_id, user_id, role_id, scope_node) VALUES
        (${ids.tenantA}::uuid, ${ids.actorA}::uuid, ${ids.writerRoleA}::uuid, ${ids.rootA}::uuid),
        (${ids.tenantA}::uuid, ${ids.readerA}::uuid, ${ids.readerRoleA}::uuid, ${ids.propertyA}::uuid),
        (${ids.tenantA}::uuid, ${ids.inactiveActorA}::uuid, ${ids.readerRoleA}::uuid, ${ids.propertyA}::uuid),
        (${ids.tenantA}::uuid, ${ids.wrongPropertyActorA}::uuid, ${ids.wrongPropertyRoleA}::uuid, ${ids.propertyA2}::uuid),
        (${ids.tenantB}::uuid, ${ids.actorB}::uuid, ${ids.writerRoleB}::uuid, ${ids.rootB}::uuid)
    `;
  });

  return Object.freeze({
    runId,
    tenantA: ids.tenantA,
    tenantB: ids.tenantB,
    propertyA: ids.propertyA,
    propertyA2: ids.propertyA2,
    propertyB: ids.propertyB,
    actorA: ids.actorA,
    readerA: ids.readerA,
    wrongPropertyActorA: ids.wrongPropertyActorA,
    actorB: ids.actorB,
    inactiveActorA: ids.inactiveActorA,
    ungrantedActorA: ids.ungrantedActorA,
    additionalPropertyIds,
    writerRoleA: ids.writerRoleA,
    readerRoleA: ids.readerRoleA,
    wrongPropertyRoleA: ids.wrongPropertyRoleA,
    writerRoleB: ids.writerRoleB,
    readPermission: MARKET_COMPSET_READ_SCOPE,
    writePermission: MARKET_COMPSET_WRITE_SCOPE,
  });
}
