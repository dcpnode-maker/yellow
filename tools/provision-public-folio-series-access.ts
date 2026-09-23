import { SQL } from "bun";

const CONFIGURE_PERMISSION = "financials.folio-series:configure";

export const EXPECTED_PUBLIC_FOLIO_SERIES_ACCESS = Object.freeze({
  database: "yellow_public_demo",
  hostname: "127.0.0.1",
  port: "55432",
  migrationChecksum: "27ef8bf95f5ca18b54abb031298825ab6536f28a9ca1a0afbff762bba3b53dca",
  tenantId: "6d9b7ce2-2d14-5576-b8c3-80f06501a603",
  tenantSlug: "yellow-demo",
  propertyId: "6081b544-22a1-534f-a86d-bb1ae0519e14",
  propertyPath: "yellow_demo.locanda_jareed_v3",
  actorId: "9f90d3e9-94f9-54de-95ec-35bd00b99b15",
  roleId: "05802175-9b05-5a8d-8596-bccfbe36e99f",
  roleName: "Local Availability Reviewer",
  permission: CONFIGURE_PERMISSION,
  permissionDescription: "Configure the property non-fiscal folio numbering series",
  rolePermissionsBefore: Object.freeze([
    "business_day.seal",
    "crm.parties:read",
    "crm.parties:write",
    "financials.adjustments:write",
    "financials.business-day:carry-discrepancy",
    "financials.business-days:read",
    "financials.business-days:seal",
    "financials.cashiers:operate",
    "financials.cashiers:read",
    "financials.charges:write",
    "financials.folios:close",
    "financials.folios:open",
    "financials.folios:read",
    "financials.folios:settle",
    "financials.receivables:read",
    "financials.receivables:transfer",
    "financials.transfers:write",
    "financials.trust:post",
    "housekeeping.arrival-tasks:create",
    "housekeeping.arrival-tasks:read",
    "housekeeping.conditions:initialize",
    "housekeeping.discrepancies:read",
    "housekeeping.discrepancies:report",
    "housekeeping.sheets:generate",
    "housekeeping.sheets:read",
    "housekeeping.tasks:read",
    "housekeeping.tasks:work",
    "inventory.availability:read",
    "inventory.blocks:read",
    "inventory.blocks:write",
    "inventory.configuration:read",
    "inventory.configuration:write",
    "inventory.holds:read",
    "inventory.holds:write",
    "inventory.offline_leases:read",
    "inventory.offline_leases:write",
    "inventory.policy:read",
    "inventory.policy:write",
    "inventory.restriction:read",
    "inventory.restriction:write",
    "rates.configuration:read",
    "rates.configuration:write",
    "rates.pricing:read",
    "rates.pricing:write",
    "reservations.booking:write",
    "reservations.guests:read",
    "reservations.guests:write",
    "reservations.lifecycle:read",
    "reservations.lifecycle:write",
    "reservations.segments:read",
    "reservations.segments:write",
    "stay-operations.checkin:commit",
    "stay-operations.checkin:read",
    "stay-operations.checkout:commit",
    "stay-operations.checkout:read",
    "stay-operations.pickup-tasks:dispatch",
    "stay-operations.pickup-tasks:work",
    "stay-operations.vehicles:park",
    "stay-operations.vehicles:read",
    "tax-fiscal.documents:issue",
    "tax-fiscal.documents:read",
    "tax-fiscal.india-valuation:finalize",
    "tax-fiscal.submissions:read",
    "tax-fiscal.submissions:request",
    "tax-fiscal.submissions:retry",
  ]),
  memberships: Object.freeze([
    ["01e4e102-c54f-5205-9542-d84d103084f8", "yellow_demo.harrington_london_v3"],
    ["0554cfb0-4db0-500b-aff2-c65b9d9b12b6", "yellow_demo.harrington_london_v2"],
    ["4518a22f-b455-54c6-a50a-4584383749b9", "yellow_demo.property"],
    ["53d37060-da1e-5144-b5a2-fc24b4182ede", "yellow_demo.review_identity"],
    ["6081b544-22a1-534f-a86d-bb1ae0519e14", "yellow_demo.locanda_jareed_v3"],
    ["95699203-494c-5d5e-9c40-74d4c07c452d", "yellow_demo.locanda_jareed"],
    ["9b87b01c-e02a-5aba-ab50-225bb51235af", "yellow_demo.locanda_jareed_v2"],
    ["c02453b5-8efb-5413-bbd0-5cbb02c85c53", "yellow_demo.colleague_current"],
    ["d98c208c-4337-5fd5-9e05-7a310e473b36", "yellow_demo.harrington_london"],
  ] as const),
});

function exactStrings(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

export function assertPublicFolioSeriesAccessTarget(databaseUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("Order562 public database URL is invalid");
  }
  if (parsed.protocol !== "postgresql:" || decodeURIComponent(parsed.username) !== "yellow_deploy" ||
      parsed.password === "" || parsed.hostname !== EXPECTED_PUBLIC_FOLIO_SERIES_ACCESS.hostname ||
      parsed.port !== EXPECTED_PUBLIC_FOLIO_SERIES_ACCESS.port ||
      decodeURIComponent(parsed.pathname) !== `/${EXPECTED_PUBLIC_FOLIO_SERIES_ACCESS.database}` ||
      parsed.search !== "" || parsed.hash !== "") {
    throw new Error("Order562 public database target is not the reviewed loopback deployment");
  }
}

export async function provisionFolioSeriesAccess(sql: SQL): Promise<Readonly<Record<string, string | number | boolean>>> {
  const expected = EXPECTED_PUBLIC_FOLIO_SERIES_ACCESS;
  const tx = await sql.reserve();
  let open = false;
  try {
    await tx.unsafe("BEGIN");
    open = true;
    await tx`SELECT set_config('app.tenant_id',${expected.tenantId},true)`;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(
      ${`order562:role-permission:${expected.roleId}:${expected.permission}`},0))`;

    const ledger = await tx<{ version: number; filename: string; checksum_sha256: string }[]>`
      SELECT version,filename,checksum_sha256 FROM schema_migration ORDER BY version FOR SHARE`;
    if (ledger.length !== 97 || ledger.some((row, index) => Number(row.version) !== index + 1) ||
        ledger[96]?.filename !== "0097_governed_nonfiscal_folio_series_configuration.sql" ||
        ledger[96]?.checksum_sha256 !== expected.migrationChecksum) {
      throw new Error("Order562 canonical migration frontier is not exact");
    }

    let authority: { tenant_id: string; tenant_slug: string; tenant_status: string;
      property_id: string; property_path: string; property_kind: string; role_id: string;
      role_name: string; permission_description: string }[];
    try {
      authority = await tx.unsafe(`
        SELECT tenant.id::text tenant_id,tenant.slug tenant_slug,tenant.status tenant_status,
          property.id::text property_id,property.path::text property_path,property.kind property_kind,
          actor_role.id::text role_id,actor_role.name role_name,
          permission.description permission_description
        FROM tenant
        JOIN org_node property ON property.tenant_id=tenant.id AND property.id=$1::uuid
        JOIN role actor_role ON actor_role.tenant_id=tenant.id AND actor_role.id=$2::uuid
        JOIN permission ON permission.code=$3
        WHERE tenant.id=$4::uuid AND property.path::text=$5
        FOR UPDATE OF actor_role,permission NOWAIT
        FOR SHARE OF tenant,property`, [
        expected.propertyId,
        expected.roleId,
        expected.permission,
        expected.tenantId,
        expected.propertyPath,
      ]) as typeof authority;
    } catch (error) {
      const sqlState = String((error as { errno?: string; code?: string }).errno ??
        (error as { code?: string }).code ?? "");
      if (sqlState === "55P03") {
        throw new Error("Order562 authority topology is concurrently changing");
      }
      throw error;
    }
    if (authority.length !== 1) throw new Error("Order562 public authority root is not exact");
    const root = authority[0]!;
    if (root.tenant_id !== expected.tenantId || root.tenant_slug !== expected.tenantSlug ||
        root.tenant_status !== "active" || root.property_id !== expected.propertyId ||
        root.property_path !== expected.propertyPath || root.property_kind !== "property" ||
        root.role_id !== expected.roleId || root.role_name !== expected.roleName ||
        root.permission_description !== expected.permissionDescription) {
      throw new Error("Order562 public authority root differs from the reviewed allowlist");
    }

    const memberships = await tx<{ user_id: string; actor_status: string; scope_node: string;
      scope_path: string; scope_kind: string }[]>`
      SELECT membership.user_id::text,actor.status actor_status,membership.scope_node::text,
        scope.path::text scope_path,scope.kind scope_kind
      FROM user_role membership
      JOIN app_user actor ON actor.tenant_id=membership.tenant_id AND actor.id=membership.user_id
      JOIN org_node scope ON scope.tenant_id=membership.tenant_id AND scope.id=membership.scope_node
      WHERE membership.tenant_id=${expected.tenantId}::uuid AND membership.role_id=${expected.roleId}::uuid
      ORDER BY membership.user_id,membership.scope_node
      FOR SHARE OF membership,actor,scope`;
    const expectedMemberships = expected.memberships.map(([scopeNode, scopePath]) => ({
      user_id: expected.actorId,
      actor_status: "active",
      scope_node: scopeNode,
      scope_path: scopePath,
      scope_kind: "property",
    }));
    if (JSON.stringify(memberships) !== JSON.stringify(expectedMemberships)) {
      throw new Error("Order562 complete role membership topology differs from the reviewed allowlist");
    }

    const permissionRows = await tx<{ permission_code: string }[]>`
      SELECT grant_row.permission_code
      FROM role_permission grant_row
      JOIN permission ON permission.code=grant_row.permission_code
      WHERE grant_row.role_id=${expected.roleId}::uuid
      ORDER BY grant_row.permission_code
      FOR SHARE OF grant_row,permission`;
    const before = expected.rolePermissionsBefore;
    const after = Object.freeze([...before, expected.permission].sort());
    const current = permissionRows.map((row) => row.permission_code);
    let created = false;
    if (exactStrings(current, before)) {
      const existingRecipients = await tx<{ role_id: string }[]>`
        SELECT role_id::text FROM role_permission WHERE permission_code=${expected.permission}
        ORDER BY role_id FOR SHARE`;
      if (existingRecipients.length !== 0) {
        throw new Error("Order562 permission already has an unreviewed recipient");
      }
      const inserted = await tx<{ role_id: string; permission_code: string }[]>`
        INSERT INTO role_permission(role_id,permission_code)
        VALUES(${expected.roleId}::uuid,${expected.permission})
        RETURNING role_id::text,permission_code`;
      if (inserted.length !== 1 || inserted[0]?.role_id !== expected.roleId ||
          inserted[0]?.permission_code !== expected.permission) {
        throw new Error("Order562 permission grant did not create the exact reviewed row");
      }
      created = true;
    } else if (!exactStrings(current, after)) {
      throw new Error("Order562 complete role permission topology differs from the reviewed allowlist");
    }

    const grants = await tx<{ role_id: string }[]>`
      SELECT role_id::text FROM role_permission WHERE permission_code=${expected.permission}
      ORDER BY role_id FOR SHARE`;
    const finalPermissions = await tx<{ permission_code: string }[]>`
      SELECT permission_code FROM role_permission WHERE role_id=${expected.roleId}::uuid
      ORDER BY permission_code FOR SHARE`;
    const finalMemberships = await tx<{ user_id: string; actor_status: string; scope_node: string;
      scope_path: string; scope_kind: string }[]>`
      SELECT membership.user_id::text,actor.status actor_status,membership.scope_node::text,
        scope.path::text scope_path,scope.kind scope_kind
      FROM user_role membership
      JOIN app_user actor ON actor.tenant_id=membership.tenant_id AND actor.id=membership.user_id
      JOIN org_node scope ON scope.tenant_id=membership.tenant_id AND scope.id=membership.scope_node
      WHERE membership.tenant_id=${expected.tenantId}::uuid AND membership.role_id=${expected.roleId}::uuid
      ORDER BY membership.user_id,membership.scope_node
      FOR SHARE OF membership,actor,scope`;
    if (grants.length !== 1 || grants[0]?.role_id !== expected.roleId ||
        !exactStrings(finalPermissions.map((row) => row.permission_code), after) ||
        JSON.stringify(finalMemberships) !== JSON.stringify(expectedMemberships)) {
      throw new Error("Order562 final permission topology exceeds the reviewed allowlist");
    }

    const receipt = Object.freeze({
      migration: 97,
      tenantId: expected.tenantId,
      propertyId: expected.propertyId,
      actorId: expected.actorId,
      roleId: expected.roleId,
      permission: expected.permission,
      created,
      grantCount: grants.length,
      membershipCount: finalMemberships.length,
      rolePermissionCount: finalPermissions.length,
    });
    await tx.unsafe("COMMIT");
    open = false;
    return receipt;
  } catch (error) {
    if (open) {
      try {
        await tx.unsafe("ROLLBACK");
      } catch {
        // Preserve the original failure while closing the reviewed transaction.
      }
    }
    throw error;
  } finally {
    tx.release();
  }
}

export async function runPublicFolioSeriesAccessProvisioning(databaseUrl: string): Promise<void> {
  assertPublicFolioSeriesAccessTarget(databaseUrl);
  const sql = new SQL(databaseUrl, { max: 1, prepare: false });
  try {
    const receipt = await provisionFolioSeriesAccess(sql);
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
  } finally {
    await sql.close();
  }
}

if (import.meta.main) {
  const databaseUrl = process.env.YELLOW_ORDER562_PUBLIC_DEPLOY_DATABASE_URL;
  if (!databaseUrl) throw new Error("YELLOW_ORDER562_PUBLIC_DEPLOY_DATABASE_URL is required");
  await runPublicFolioSeriesAccessProvisioning(databaseUrl);
}
