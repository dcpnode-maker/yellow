import { SQL, type ReservedSQL } from "bun";

import { PROPERTY_NAME, SEED_PROPERTY, SEED_TENANT } from "./seed";
import { REVIEW_ROLE_NAME } from "./seed-review";
import { uuidV5 } from "./lib/uuid-v5";

const LOCK_NAME = "yellow.local.order194.hosted-deposit-uat";

export const LOCAL_HOSTED_DEPOSIT_PERMISSIONS = Object.freeze([
  Object.freeze({ code: "financials.payments:read", description: "Read governed payment operations" }),
  Object.freeze({ code: "financials.payments:write", description: "Execute governed payment operations" }),
  Object.freeze({ code: "financials.deposits:apply", description: "Apply captured deposits to guest folios" }),
]);

const ACCOUNT_SPECS = Object.freeze([
  Object.freeze({ key: "cardClearing" as const, role: "card_clearing", name: "Local Deposit Card Clearing" }),
  Object.freeze({ key: "depositLiability" as const, role: "deposit_liability", name: "Local Deposit Liability" }),
]);

const TX_CODE_SPECS = Object.freeze([
  Object.freeze({ code: "CARD_PAYMENT", name: "Card payment", grp: "payment", usali_line: null,
    default_dr: "card_clearing", default_cr: "guest" }),
  Object.freeze({ code: "DEP", name: "Deposit Liability", grp: "deposit", usali_line: null,
    default_dr: null, default_cr: "deposit_liability" }),
]);

const INSTRUMENT = Object.freeze({
  kind: "card_network_token",
  token: "tok_yellow_order194_local_deposit_opaque",
  brand: "Yellow Local",
  last4: "0194",
  expiry: "12/99",
  psp: "local-deposit",
  status: "active",
});

type CountState = "created" | "already exact";

export interface ProvisionLocalHostedDepositUatOptions {
  readonly databaseUrl: string;
  readonly logger?: (line: string) => void;
}

export interface ProvisionLocalHostedDepositUatResult {
  readonly tenant: typeof SEED_TENANT.slug;
  readonly propertyId: typeof SEED_PROPERTY.id;
  readonly folioReference: "FOL-1";
  readonly currency: "USD";
  readonly roleId: string;
  readonly guestPartyId: string;
  readonly cardClearingAccountId: string;
  readonly depositLiabilityAccountId: string;
  readonly instrumentId: string;
  readonly permissions: Readonly<Record<string, CountState>>;
  readonly accounts: Readonly<Record<"cardClearing" | "depositLiability", CountState>>;
  readonly transactionCodes: Readonly<Record<"CARD_PAYMENT" | "DEP", CountState>>;
  readonly routes: Readonly<Record<"CARD_PAYMENT" | "DEP", CountState>>;
  readonly instrument: CountState;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function exact(actual: unknown, expected: unknown, label: string): void {
  if (stableJson(actual) !== stableJson(expected)) {
    throw new Error(`${label} collides with non-canonical Order 194 local UAT data`);
  }
}

function localDatabaseUrl(value: string): URL {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("YELLOW_DEPLOY_DATABASE_URL must be a valid PostgreSQL URL"); }
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) {
    throw new Error("YELLOW_DEPLOY_DATABASE_URL must use the PostgreSQL protocol");
  }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)) {
    throw new Error("Order 194 provisioning is restricted to a loopback PostgreSQL host");
  }
  if (parsed.username === "" || parsed.password === "") {
    throw new Error("YELLOW_DEPLOY_DATABASE_URL must include deployment credentials");
  }
  if (parsed.hash !== "") throw new Error("YELLOW_DEPLOY_DATABASE_URL must not contain a fragment");
  return parsed;
}

function redact(error: unknown, databaseUrl: string): Error {
  let message = error instanceof Error ? error.message : String(error);
  message = message.split(databaseUrl).join("[REDACTED_DATABASE_URL]");
  try {
    const parsed = new URL(databaseUrl);
    for (const secret of [parsed.username, parsed.password, decodeURIComponent(parsed.username),
      decodeURIComponent(parsed.password)]) {
      if (secret) message = message.split(secret).join("[REDACTED]");
    }
  } catch { /* validation already provides a constant error */ }
  message = message.replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1[REDACTED]@");
  return new Error(message, { cause: error });
}

async function canonicalIds(guestPartyId: string) {
  return {
    cardClearing: await uuidV5(SEED_TENANT.id, `${PROPERTY_NAME}/order194/card-clearing/USD`),
    depositLiability: await uuidV5(SEED_TENANT.id, `${PROPERTY_NAME}/order194/deposit-liability/USD`),
    instrument: await uuidV5(SEED_TENANT.id, `${PROPERTY_NAME}/order194/local-deposit-instrument/${guestPartyId}`),
  };
}

async function artifactCounts(connection: ReservedSQL): Promise<Record<string, number>> {
  const rows = await connection<Array<Record<string, number>>>`
    SELECT
      (SELECT count(*)::int FROM hosted_payment_request WHERE tenant_id=${SEED_TENANT.id}::uuid) AS hosted_requests,
      (SELECT count(*)::int FROM payment_operation WHERE tenant_id=${SEED_TENANT.id}::uuid) AS payment_operations,
      (SELECT count(*)::int FROM provider_event_receipt WHERE tenant_id=${SEED_TENANT.id}::uuid) AS provider_receipts,
      (SELECT count(*)::int FROM payment WHERE tenant_id=${SEED_TENANT.id}::uuid) AS payment_attempts,
      (SELECT count(*)::int FROM deposit_application WHERE tenant_id=${SEED_TENANT.id}::uuid) AS deposit_applications,
      (SELECT count(*)::int FROM journal WHERE tenant_id=${SEED_TENANT.id}::uuid) AS journals,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${SEED_TENANT.id}::uuid) AS posting_lines
  `;
  if (!rows[0]) throw new Error("Order 194 financial-artifact preflight returned no row");
  return rows[0];
}

async function requireBase(connection: ReservedSQL): Promise<{ roleId: string; guestPartyId: string }> {
  const base = await connection<Array<{
    tenant_ok: boolean; property_ok: boolean; role_id: string | null; role_count: number;
    property_grants: number; folio_id: string | null; guest_party_id: string | null; folio_count: number;
  }>>`
    SELECT
      EXISTS (SELECT 1 FROM tenant WHERE id=${SEED_TENANT.id}::uuid AND slug=${SEED_TENANT.slug}
        AND name=${SEED_TENANT.name} AND status='active') AS tenant_ok,
      EXISTS (SELECT 1 FROM org_node WHERE id=${SEED_PROPERTY.id}::uuid AND tenant_id=${SEED_TENANT.id}::uuid
        AND path=${SEED_PROPERTY.path}::ltree AND kind='property' AND name=${SEED_PROPERTY.name}
        AND currency='USD') AS property_ok,
      (SELECT id::text FROM role WHERE tenant_id=${SEED_TENANT.id}::uuid AND name=${REVIEW_ROLE_NAME}
        ORDER BY id LIMIT 1) AS role_id,
      (SELECT count(*)::int FROM role WHERE tenant_id=${SEED_TENANT.id}::uuid AND name=${REVIEW_ROLE_NAME}) AS role_count,
      (SELECT count(*)::int FROM user_role grant_row JOIN role r ON r.id=grant_row.role_id
        WHERE grant_row.tenant_id=${SEED_TENANT.id}::uuid AND grant_row.scope_node=${SEED_PROPERTY.id}::uuid
          AND r.tenant_id=${SEED_TENANT.id}::uuid AND r.name=${REVIEW_ROLE_NAME}) AS property_grants,
      (SELECT f.id::text FROM folio f JOIN account a ON a.tenant_id=f.tenant_id AND a.id=f.account_id
        JOIN party p ON p.tenant_id=a.tenant_id AND p.id=a.party_id
        WHERE f.tenant_id=${SEED_TENANT.id}::uuid AND f.folio_no='FOL-1' AND f.window_no=1 AND f.status='open'
          AND a.property_node=${SEED_PROPERTY.id}::uuid AND a.role='guest' AND a.currency='USD' AND a.status='open'
          AND p.status='active' ORDER BY f.id LIMIT 1) AS folio_id,
      (SELECT a.party_id::text FROM folio f JOIN account a ON a.tenant_id=f.tenant_id AND a.id=f.account_id
        JOIN party p ON p.tenant_id=a.tenant_id AND p.id=a.party_id
        WHERE f.tenant_id=${SEED_TENANT.id}::uuid AND f.folio_no='FOL-1' AND f.window_no=1 AND f.status='open'
          AND a.property_node=${SEED_PROPERTY.id}::uuid AND a.role='guest' AND a.currency='USD' AND a.status='open'
          AND p.status='active' ORDER BY f.id LIMIT 1) AS guest_party_id,
      (SELECT count(*)::int FROM folio f JOIN account a ON a.tenant_id=f.tenant_id AND a.id=f.account_id
        JOIN party p ON p.tenant_id=a.tenant_id AND p.id=a.party_id
        WHERE f.tenant_id=${SEED_TENANT.id}::uuid AND f.folio_no='FOL-1' AND f.window_no=1 AND f.status='open'
          AND a.property_node=${SEED_PROPERTY.id}::uuid AND a.role='guest' AND a.currency='USD' AND a.status='open'
          AND p.status='active') AS folio_count
  `;
  const row = base[0];
  if (!row?.tenant_ok || !row.property_ok) throw new Error("Canonical Yellow Demo Property/USD base is absent");
  if (row.role_count !== 1 || !row.role_id || row.property_grants < 1) {
    throw new Error("Existing Local Availability Reviewer property grant is absent or ambiguous");
  }
  if (row.folio_count !== 1 || !row.folio_id || !row.guest_party_id) {
    throw new Error("Existing Yellow Demo FOL-1 USD guest is absent or ambiguous");
  }
  return { roleId: row.role_id, guestPartyId: row.guest_party_id };
}

async function provisionPermission(connection: ReservedSQL, roleId: string,
  spec: typeof LOCAL_HOSTED_DEPOSIT_PERMISSIONS[number]): Promise<CountState> {
  const rows = await connection<Array<{ code: string; description: string }>>`
    SELECT code,description FROM permission WHERE code=${spec.code}`;
  let state: CountState = "already exact";
  if (rows.length === 0) {
    await connection`INSERT INTO permission(code,description) VALUES(${spec.code},${spec.description})`;
    state = "created";
  } else {
    if (rows.length !== 1) throw new Error(`Permission ${spec.code} is ambiguous`);
    exact(rows[0], spec, `Permission ${spec.code}`);
  }
  await connection`INSERT INTO role_permission(role_id,permission_code) VALUES(${roleId}::uuid,${spec.code})
    ON CONFLICT (role_id,permission_code) DO NOTHING`;
  return state;
}

async function provisionAccount(connection: ReservedSQL, id: string,
  spec: typeof ACCOUNT_SPECS[number]): Promise<CountState> {
  const rows = await connection<Array<Record<string, unknown>>>`
    SELECT id::text,tenant_id::text,property_node::text,role,party_id::text,name,currency::text,status
    FROM account WHERE id=${id}::uuid OR (tenant_id=${SEED_TENANT.id}::uuid
      AND property_node=${SEED_PROPERTY.id}::uuid AND role=${spec.role} AND name=${spec.name} AND currency='USD')
    ORDER BY id`;
  const expected = { id, tenant_id: SEED_TENANT.id, property_node: SEED_PROPERTY.id, role: spec.role,
    party_id: null, name: spec.name, currency: "USD", status: "open" };
  if (rows.length === 0) {
    await connection`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status)
      VALUES(${id}::uuid,${SEED_TENANT.id}::uuid,${SEED_PROPERTY.id}::uuid,${spec.role},NULL,${spec.name},'USD','open')`;
    return "created";
  }
  if (rows.length !== 1) throw new Error(`${spec.name} account is ambiguous`);
  exact(rows[0], expected, spec.name);
  return "already exact";
}

async function provisionTxCode(connection: ReservedSQL,
  spec: typeof TX_CODE_SPECS[number]): Promise<CountState> {
  const rows = await connection<Array<Record<string, unknown>>>`
    SELECT code,name,grp,usali_line,default_dr,default_cr FROM tx_code WHERE code=${spec.code}`;
  if (rows.length === 0) {
    await connection`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr)
      VALUES(${spec.code},${spec.name},${spec.grp},${spec.usali_line},${spec.default_dr},${spec.default_cr})`;
    return "created";
  }
  if (rows.length !== 1) throw new Error(`Transaction code ${spec.code} is ambiguous`);
  exact(rows[0], spec, `Transaction code ${spec.code}`);
  return "already exact";
}

async function provisionRoute(connection: ReservedSQL, code: "CARD_PAYMENT" | "DEP",
  debit: string | null, credit: string | null): Promise<CountState> {
  const rows = await connection<Array<Record<string, unknown>>>`
    SELECT tenant_id::text,property_node::text,currency::text,tx_code,debit_account_id::text,credit_account_id::text
    FROM tx_code_route WHERE tenant_id=${SEED_TENANT.id}::uuid AND property_node=${SEED_PROPERTY.id}::uuid
      AND currency='USD' AND tx_code=${code}`;
  const expected = { tenant_id: SEED_TENANT.id, property_node: SEED_PROPERTY.id, currency: "USD",
    tx_code: code, debit_account_id: debit, credit_account_id: credit };
  if (rows.length === 0) {
    await connection`INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,debit_account_id,credit_account_id)
      VALUES(${SEED_TENANT.id}::uuid,${SEED_PROPERTY.id}::uuid,'USD',${code},${debit}::uuid,${credit}::uuid)`;
    return "created";
  }
  if (rows.length !== 1) throw new Error(`Transaction route ${code} is ambiguous`);
  exact(rows[0], expected, `Transaction route ${code}`);
  return "already exact";
}

async function provisionInstrument(connection: ReservedSQL, id: string, partyId: string): Promise<CountState> {
  const rows = await connection<Array<Record<string, unknown>>>`
    SELECT id::text,tenant_id::text,party_id::text,kind,token,brand,last4,expiry,psp,status
    FROM payment_instrument WHERE id=${id}::uuid OR (tenant_id=${SEED_TENANT.id}::uuid
      AND party_id=${partyId}::uuid AND psp=${INSTRUMENT.psp} AND token=${INSTRUMENT.token}) ORDER BY id`;
  const expected = { id, tenant_id: SEED_TENANT.id, party_id: partyId, ...INSTRUMENT };
  if (rows.length === 0) {
    await connection`INSERT INTO payment_instrument(id,tenant_id,party_id,kind,token,brand,last4,expiry,psp,status)
      VALUES(${id}::uuid,${SEED_TENANT.id}::uuid,${partyId}::uuid,${INSTRUMENT.kind},${INSTRUMENT.token},
        ${INSTRUMENT.brand},${INSTRUMENT.last4},${INSTRUMENT.expiry},${INSTRUMENT.psp},${INSTRUMENT.status})`;
    return "created";
  }
  if (rows.length !== 1) throw new Error("Order 194 local-deposit instrument is ambiguous");
  exact(rows[0], expected, "Order 194 local-deposit instrument");
  return "already exact";
}

export async function provisionLocalHostedDepositUat(
  options: ProvisionLocalHostedDepositUatOptions,
): Promise<ProvisionLocalHostedDepositUatResult> {
  const parsed = localDatabaseUrl(options.databaseUrl);
  const pool = new SQL(parsed.toString(), { max: 1 });
  const connection = await pool.reserve();
  let began = false;
  try {
    await connection.unsafe("BEGIN");
    began = true;
    await connection`SELECT pg_advisory_xact_lock(hashtextextended(${LOCK_NAME},0))`;
    const base = await requireBase(connection);
    const ids = await canonicalIds(base.guestPartyId);
    const before = await artifactCounts(connection);

    const permissions: Record<string, CountState> = {};
    for (const spec of LOCAL_HOSTED_DEPOSIT_PERMISSIONS) {
      permissions[spec.code] = await provisionPermission(connection, base.roleId, spec);
    }
    const accounts = {} as Record<"cardClearing" | "depositLiability", CountState>;
    for (const spec of ACCOUNT_SPECS) accounts[spec.key] = await provisionAccount(connection, ids[spec.key], spec);
    const transactionCodes = {} as Record<"CARD_PAYMENT" | "DEP", CountState>;
    for (const spec of TX_CODE_SPECS) transactionCodes[spec.code] = await provisionTxCode(connection, spec);
    const routes = {
      CARD_PAYMENT: await provisionRoute(connection, "CARD_PAYMENT", ids.cardClearing, null),
      DEP: await provisionRoute(connection, "DEP", null, ids.depositLiability),
    };
    const instrument = await provisionInstrument(connection, ids.instrument, base.guestPartyId);

    exact(await artifactCounts(connection), before, "Financial artifact cardinality");
    await connection.unsafe("COMMIT");
    began = false;
    const result: ProvisionLocalHostedDepositUatResult = {
      tenant: SEED_TENANT.slug, propertyId: SEED_PROPERTY.id, folioReference: "FOL-1", currency: "USD",
      roleId: base.roleId, guestPartyId: base.guestPartyId, cardClearingAccountId: ids.cardClearing,
      depositLiabilityAccountId: ids.depositLiability, instrumentId: ids.instrument,
      permissions, accounts, transactionCodes, routes, instrument,
    };
    (options.logger ?? console.log)(`local hosted-deposit UAT fixture: tenant=${result.tenant} property=${result.propertyId} folio=FOL-1 currency=USD`);
    return result;
  } catch (error) {
    if (began) try { await connection.unsafe("ROLLBACK"); } catch { /* preserve original error */ }
    throw redact(error, options.databaseUrl);
  } finally {
    connection.release();
    await pool.close();
  }
}

async function runCli(): Promise<void> {
  const databaseUrl = process.env.YELLOW_DEPLOY_DATABASE_URL;
  if (!databaseUrl) {
    console.error("YELLOW_DEPLOY_DATABASE_URL is required");
    process.exitCode = 1;
    return;
  }
  try { await provisionLocalHostedDepositUat({ databaseUrl }); }
  catch (error) {
    console.error(`local hosted-deposit UAT provisioning failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (import.meta.main) await runCli();
