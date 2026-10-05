import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  EXPECTED_PUBLIC_FOLIO_SERIES_ACCESS as EXPECTED,
  provisionFolioSeriesAccess,
} from "../tools/provision-public-folio-series-access";

const DATABASE_URL = process.env.YELLOW_ORDER562_DEPLOY_DATABASE_URL;
const required = process.env.YELLOW_REQUIRE_ORDER562_DATABASE === "1";
if (required && !DATABASE_URL) throw new Error("Order562 provisioning proof requires the deploy database URL");
const dbDescribe = required ? describe.serial : describe.skip;
const EXTRA_ACTOR = "56210000-0000-4000-8000-000000000001";
const EXTRA_ROLE = "56210000-0000-4000-8000-000000000002";

let deploy: SQL | undefined;
const insertedPermissionCodes = new Set<string>();

async function clean(): Promise<void> {
  if (!deploy) return;
  await deploy`DELETE FROM role_permission WHERE role_id IN (${EXPECTED.roleId}::uuid,${EXTRA_ROLE}::uuid)`;
  await deploy`DELETE FROM user_role WHERE tenant_id=${EXPECTED.tenantId}::uuid`;
  await deploy`DELETE FROM role WHERE tenant_id=${EXPECTED.tenantId}::uuid`;
  await deploy`DELETE FROM app_user WHERE tenant_id=${EXPECTED.tenantId}::uuid`;
  await deploy`DELETE FROM org_node WHERE tenant_id=${EXPECTED.tenantId}::uuid`;
  await deploy`DELETE FROM tenant WHERE id=${EXPECTED.tenantId}::uuid`;
  for (const code of insertedPermissionCodes) {
    await deploy`DELETE FROM permission WHERE code=${code}`;
  }
  insertedPermissionCodes.clear();
}

async function seedExactTopology(): Promise<void> {
  await clean();
  await deploy!`INSERT INTO tenant(id,slug,name,tier,status)
    VALUES(${EXPECTED.tenantId}::uuid,${EXPECTED.tenantSlug},'Order562 public topology','shared','active')`;
  for (const [scopeNode, scopePath] of EXPECTED.memberships) {
    await deploy!`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency)
      VALUES(${scopeNode}::uuid,${EXPECTED.tenantId}::uuid,${scopePath}::ltree,'property',
        ${`Order562 ${scopePath}`},'Asia/Riyadh','SAR')`;
  }
  await deploy!`INSERT INTO app_user(id,tenant_id,email,display_name,status)
    VALUES(${EXPECTED.actorId}::uuid,${EXPECTED.tenantId}::uuid,
      'operator@yellow.local','Order562 operator','active')`;
  await deploy!`INSERT INTO role(id,tenant_id,name)
    VALUES(${EXPECTED.roleId}::uuid,${EXPECTED.tenantId}::uuid,${EXPECTED.roleName})`;
  for (const code of EXPECTED.rolePermissionsBefore) {
    const inserted = await deploy!<{ code: string }[]>`INSERT INTO permission(code,description)
      VALUES(${code},${`Order562 existing ${code}`}) ON CONFLICT(code) DO NOTHING RETURNING code`;
    if (inserted.length === 1) insertedPermissionCodes.add(code);
    await deploy!`INSERT INTO role_permission(role_id,permission_code)
      VALUES(${EXPECTED.roleId}::uuid,${code})`;
  }
  for (const [scopeNode] of EXPECTED.memberships) {
    await deploy!`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node)
      VALUES(${EXPECTED.tenantId}::uuid,${EXPECTED.actorId}::uuid,
        ${EXPECTED.roleId}::uuid,${scopeNode}::uuid)`;
  }
}

async function expectedGrantCount(): Promise<number> {
  const [row] = await deploy!<{ count: number }[]>`SELECT count(*)::int count FROM role_permission
    WHERE role_id=${EXPECTED.roleId}::uuid AND permission_code=${EXPECTED.permission}`;
  return row!.count;
}

async function provision(applicationName = "order562-provisioner"):
Promise<Readonly<Record<string, string | number | boolean>>> {
  const target = new URL(DATABASE_URL!);
  target.searchParams.set("application_name", applicationName);
  const isolated = new SQL(target.toString(), { max: 1, prepare: false });
  try {
    return await provisionFolioSeriesAccess(isolated);
  } finally {
    await isolated.close();
  }
}

async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(async () => {
        const activity = await deploy!<{ application_name: string; state: string;
          wait_event_type: string | null; wait_event: string | null; blockers: number[] }[]>`
          SELECT application_name,state,wait_event_type,wait_event,
            pg_catalog.pg_blocking_pids(pid) blockers
          FROM pg_catalog.pg_stat_activity
          WHERE datname=current_database() AND pid<>pg_backend_pid()
          ORDER BY pid`;
        reject(new Error(`Order562 ${label} timed out: ${JSON.stringify(activity)}`));
      }, 10_000);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

async function waitForWaiterBlockedBy(blockerPid: number): Promise<number> {
  const deadline = performance.now() + 5_000;
  while (performance.now() < deadline) {
    const rows = await deploy!<{ pid: number }[]>`
      SELECT activity.pid::int pid
      FROM pg_catalog.pg_stat_activity activity
      WHERE ${blockerPid}::int=ANY(pg_catalog.pg_blocking_pids(activity.pid))
      ORDER BY activity.pid`;
    if (rows[0]) return rows[0].pid;
    await Bun.sleep(20);
  }
  throw new Error("Order562 expected a blocked provisioning backend");
}

async function waitForSpecificBlock(waiterPid: number, blockerPid: number): Promise<void> {
  const deadline = performance.now() + 5_000;
  while (performance.now() < deadline) {
    const [row] = await deploy!<{ blocked: boolean }[]>`
      SELECT ${blockerPid}::int=ANY(pg_catalog.pg_blocking_pids(${waiterPid}::int)) blocked`;
    if (row?.blocked) return;
    await Bun.sleep(20);
  }
  throw new Error(`Order562 backend ${waiterPid} did not block behind ${blockerPid}`);
}

async function seedExtraPrincipals(): Promise<void> {
  await deploy!`INSERT INTO app_user(id,tenant_id,email,display_name,status)
    VALUES(${EXTRA_ACTOR}::uuid,${EXPECTED.tenantId}::uuid,'extra@order562.test','Extra','active')`;
  await deploy!`INSERT INTO role(id,tenant_id,name)
    VALUES(${EXTRA_ROLE}::uuid,${EXPECTED.tenantId}::uuid,'Unexpected Order562 role')`;
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  deploy = new SQL(DATABASE_URL, { max: 4, prepare: false });
}, 30_000);

afterAll(async () => {
  await clean();
  await deploy?.close();
}, 30_000);

dbDescribe("Order562 exact public permission provisioning topology", () => {
  test("creates one reviewed role grant and exact replay is a no-op", async () => {
    await seedExactTopology();
    const first = await provision();
    expect(first).toMatchObject({ created: true, grantCount: 1, membershipCount: 9,
      rolePermissionCount: 66 });
    expect(await expectedGrantCount()).toBe(1);
    const replay = await provision();
    expect(replay).toEqual({ ...first, created: false });
    expect(await expectedGrantCount()).toBe(1);
  }, 30_000);

  test("rejects missing permissions, extra recipients and foreign role grants before mutation", async () => {
    await seedExactTopology();
    const missing = EXPECTED.rolePermissionsBefore[0]!;
    await deploy!`DELETE FROM role_permission WHERE role_id=${EXPECTED.roleId}::uuid
      AND permission_code=${missing}`;
    await expect(provision()).rejects.toThrow(
      "complete role permission topology differs",
    );
    expect(await expectedGrantCount()).toBe(0);
    await deploy!`INSERT INTO role_permission(role_id,permission_code)
      VALUES(${EXPECTED.roleId}::uuid,${missing})`;

    await deploy!`INSERT INTO app_user(id,tenant_id,email,display_name,status)
      VALUES(${EXTRA_ACTOR}::uuid,${EXPECTED.tenantId}::uuid,'extra@order562.test','Extra','active')`;
    await deploy!`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node)
      VALUES(${EXPECTED.tenantId}::uuid,${EXTRA_ACTOR}::uuid,
        ${EXPECTED.roleId}::uuid,${EXPECTED.propertyId}::uuid)`;
    await expect(provision()).rejects.toThrow(
      "complete role membership topology differs",
    );
    expect(await expectedGrantCount()).toBe(0);
    await deploy!`DELETE FROM user_role WHERE tenant_id=${EXPECTED.tenantId}::uuid
      AND user_id=${EXTRA_ACTOR}::uuid`;

    await deploy!`INSERT INTO role(id,tenant_id,name)
      VALUES(${EXTRA_ROLE}::uuid,${EXPECTED.tenantId}::uuid,'Unexpected Order562 role')`;
    await deploy!`INSERT INTO role_permission(role_id,permission_code)
      VALUES(${EXTRA_ROLE}::uuid,${EXPECTED.permission})`;
    await expect(provision()).rejects.toThrow(
      "permission already has an unreviewed recipient",
    );
    expect(await expectedGrantCount()).toBe(0);
  }, 30_000);

  test("writer-first membership and permission phantoms serialize then reject before grant", async () => {
    await seedExactTopology();
    await seedExtraPrincipals();
    const membershipSql = new SQL(DATABASE_URL!, { max: 1, prepare: false });
    const membershipWriter = await membershipSql.reserve();
    let membershipOpen = false;
    try {
      await membershipWriter.unsafe("BEGIN");
      membershipOpen = true;
      await membershipWriter.unsafe("SET LOCAL statement_timeout='10s'");
      await membershipWriter`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node)
        VALUES(${EXPECTED.tenantId}::uuid,${EXTRA_ACTOR}::uuid,
          ${EXPECTED.roleId}::uuid,${EXPECTED.propertyId}::uuid)`;
      const helper = provision("order562-writer-first-membership");
      await expect(bounded(helper, "writer-first membership contention")).rejects.toThrow(
        "authority topology is concurrently changing",
      );
      expect(await expectedGrantCount()).toBe(0);
      await membershipWriter.unsafe("COMMIT");
      membershipOpen = false;
      await expect(provision("order562-writer-first-membership-retry")).rejects.toThrow(
        "complete role membership topology differs",
      );
      expect(await expectedGrantCount()).toBe(0);
    } finally {
      if (membershipOpen) await membershipWriter.unsafe("ROLLBACK");
      membershipWriter.release();
      await membershipSql.close();
    }

    await seedExactTopology();
    await seedExtraPrincipals();
    const permissionSql = new SQL(DATABASE_URL!, { max: 1, prepare: false });
    const permissionWriter = await permissionSql.reserve();
    let permissionOpen = false;
    try {
      await permissionWriter.unsafe("BEGIN");
      permissionOpen = true;
      await permissionWriter.unsafe("SET LOCAL statement_timeout='10s'");
      await permissionWriter`INSERT INTO role_permission(role_id,permission_code)
        VALUES(${EXTRA_ROLE}::uuid,${EXPECTED.permission})`;
      const helper = provision("order562-writer-first-permission");
      await expect(bounded(helper, "writer-first permission contention")).rejects.toThrow(
        "authority topology is concurrently changing",
      );
      expect(await expectedGrantCount()).toBe(0);
      await permissionWriter.unsafe("COMMIT");
      permissionOpen = false;
      await expect(provision("order562-writer-first-permission-retry")).rejects.toThrow(
        "permission already has an unreviewed recipient",
      );
      expect(await expectedGrantCount()).toBe(0);
    } finally {
      if (permissionOpen) await permissionWriter.unsafe("ROLLBACK");
      permissionWriter.release();
      await permissionSql.close();
    }
  }, 60_000);

  test("helper-first root locks serialize incoming membership and permission recipients", async () => {
    await seedExactTopology();
    await seedExtraPrincipals();
    const blockerSql = new SQL(DATABASE_URL!, { max: 1, prepare: false });
    const membershipSql = new SQL(DATABASE_URL!, { max: 1, prepare: false });
    const recipientSql = new SQL(DATABASE_URL!, { max: 1, prepare: false });
    const blocker = await blockerSql.reserve();
    const membershipWriter = await membershipSql.reserve();
    const recipientWriter = await recipientSql.reserve();
    let blockerOpen = false;
    let membershipOpen = false;
    let recipientOpen = false;
    let membershipWrite: Promise<unknown> | undefined;
    let recipientWrite: Promise<unknown> | undefined;
    try {
      await blocker.unsafe("BEGIN");
      blockerOpen = true;
      await blocker.unsafe("SET LOCAL statement_timeout='10s'");
      const [blockerRow] = await blocker<{ pid: number }[]>`SELECT pg_backend_pid()::int pid`;
      await blocker`SELECT permission_code FROM role_permission
        WHERE role_id=${EXPECTED.roleId}::uuid
          AND permission_code=${EXPECTED.rolePermissionsBefore[0]!} FOR UPDATE`;

      const helper = provision("order562-helper-first");
      const helperPid = await bounded(
        waitForWaiterBlockedBy(blockerRow!.pid),
        "helper-first root-lock witness",
      );

      await membershipWriter.unsafe("BEGIN");
      membershipOpen = true;
      await membershipWriter.unsafe("SET LOCAL statement_timeout='10s'");
      const [membershipRow] = await membershipWriter<{ pid: number }[]>`SELECT pg_backend_pid()::int pid`;
      membershipWrite = membershipWriter`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node)
        VALUES(${EXPECTED.tenantId}::uuid,${EXTRA_ACTOR}::uuid,
          ${EXPECTED.roleId}::uuid,${EXPECTED.propertyId}::uuid)`.then(() => undefined);
      await bounded(
        waitForSpecificBlock(membershipRow!.pid, helperPid),
        "helper-first membership serialization",
      );

      await recipientWriter.unsafe("BEGIN");
      recipientOpen = true;
      await recipientWriter.unsafe("SET LOCAL statement_timeout='10s'");
      const [recipientRow] = await recipientWriter<{ pid: number }[]>`SELECT pg_backend_pid()::int pid`;
      recipientWrite = recipientWriter`INSERT INTO role_permission(role_id,permission_code)
        VALUES(${EXTRA_ROLE}::uuid,${EXPECTED.permission})`.then(() => undefined);
      await bounded(
        waitForSpecificBlock(recipientRow!.pid, helperPid),
        "helper-first permission serialization",
      );

      await blocker.unsafe("COMMIT");
      blockerOpen = false;
      const receipt = await bounded(helper, "helper-first provisioner");
      expect(receipt).toMatchObject({ created: true, grantCount: 1, membershipCount: 9,
        rolePermissionCount: 66 });

      await bounded(membershipWrite, "serialized membership writer");
      await membershipWriter.unsafe("COMMIT");
      membershipOpen = false;
      await bounded(recipientWrite, "serialized permission writer");
      await recipientWriter.unsafe("COMMIT");
      recipientOpen = false;

      const [topology] = await deploy!<{ memberships: number; recipients: number }[]>`SELECT
        (SELECT count(*)::int FROM user_role WHERE tenant_id=${EXPECTED.tenantId}::uuid
          AND role_id=${EXPECTED.roleId}::uuid) memberships,
        (SELECT count(*)::int FROM role_permission WHERE permission_code=${EXPECTED.permission}) recipients`;
      expect(topology).toEqual({ memberships: 10, recipients: 2 });
      await expect(provision("order562-helper-first-replay")).rejects.toThrow(
        "complete role membership topology differs",
      );
    } finally {
      if (blockerOpen) await blocker.unsafe("ROLLBACK");
      if (membershipOpen) await membershipWriter.unsafe("ROLLBACK");
      if (recipientOpen) await recipientWriter.unsafe("ROLLBACK");
      await Promise.allSettled([membershipWrite, recipientWrite].filter(
        (candidate): candidate is Promise<unknown> => candidate !== undefined,
      ));
      blocker.release();
      membershipWriter.release();
      recipientWriter.release();
      await Promise.all([blockerSql.close(), membershipSql.close(), recipientSql.close()]);
    }
  }, 60_000);
});
