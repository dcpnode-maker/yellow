import { SQL, type ReservedSQL } from "bun";

import { uuidV5 } from "./lib/uuid-v5";

export const LOCANDA_TENANT_ID = "6d9b7ce2-2d14-5576-b8c3-80f06501a603";
export const LOCANDA_PROPERTY_ID = "6081b544-22a1-534f-a86d-bb1ae0519e14";
export const LOCANDA_PROPERTY_NAME = "Locanda Homes · Jareed Riyadh";
export const LOCANDA_CURRENCY = "SAR";
export const LOCANDA_EXPECTED_DATABASE = "yellow_public_demo";
const LOCK_NAME = "yellow.order563.locanda-charge-catalogue.v1";

export const LOCANDA_REVENUE_ACCOUNTS = Object.freeze([
  Object.freeze({ key: "rooms", name: "Locanda Rooms Revenue" }),
  Object.freeze({ key: "foodAndBeverage", name: "Locanda Food and Beverage Revenue" }),
  Object.freeze({ key: "wellness", name: "Locanda Wellness Revenue" }),
  Object.freeze({ key: "guestServices", name: "Locanda Guest Services Revenue" }),
  Object.freeze({ key: "other", name: "Locanda Other Operated Revenue" }),
] as const);

export const LOCANDA_CHARGE_CODES = Object.freeze([
  Object.freeze({ code: "ROOM", name: "Room charge", usaliLine: "Rooms", accountKey: "rooms" }),
  Object.freeze({ code: "L3R_FOOD", name: "Food", usaliLine: "Food and Beverage", accountKey: "foodAndBeverage" }),
  Object.freeze({ code: "L3R_BEVERAGE", name: "Beverage", usaliLine: "Food and Beverage", accountKey: "foodAndBeverage" }),
  Object.freeze({ code: "L3R_DESSERT", name: "Dessert", usaliLine: "Food and Beverage", accountKey: "foodAndBeverage" }),
  Object.freeze({ code: "L3R_SPA", name: "Spa and wellness", usaliLine: "Spa and Wellness", accountKey: "wellness" }),
  Object.freeze({ code: "L3R_LAUNDRY", name: "Laundry", usaliLine: "Guest Services", accountKey: "guestServices" }),
  Object.freeze({ code: "L3R_TRANSFER", name: "Guest transfer", usaliLine: "Guest Services", accountKey: "guestServices" }),
  Object.freeze({ code: "L3R_MISC", name: "Other guest charge", usaliLine: "Other Operated Departments", accountKey: "other" }),
] as const);

type ProvisionState = "created" | "already exact";
type AccountKey = (typeof LOCANDA_REVENUE_ACCOUNTS)[number]["key"];

export type LocandaChargeCatalogueResult = Readonly<{
  database: string;
  propertyId: string;
  accounts: Readonly<Record<AccountKey, ProvisionState>>;
  transactionCodes: Readonly<Record<string, ProvisionState>>;
  routes: Readonly<Record<string, ProvisionState>>;
}>;

type Options = Readonly<{
  databaseUrl: string;
  expectedDatabase?: string;
  logger?: (line: string) => void;
}>;

function exact(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} conflicts with the reviewed Order 563 definition`);
  }
}

async function accountIds(): Promise<Record<AccountKey, string>> {
  const entries = await Promise.all(LOCANDA_REVENUE_ACCOUNTS.map(async (spec) => [
    spec.key,
    await uuidV5(LOCANDA_TENANT_ID, `${LOCK_NAME}/account/${spec.key}`),
  ] as const));
  return Object.fromEntries(entries) as Record<AccountKey, string>;
}

async function requireTarget(connection: ReservedSQL, expectedDatabase: string): Promise<string> {
  const databaseRows = await connection<Array<{ database: string; user_name: string }>>`
    SELECT current_database() database,current_user user_name`;
  const database = databaseRows[0]?.database;
  if (database !== expectedDatabase) throw new Error(`Refusing database ${database ?? "unknown"}; expected ${expectedDatabase}`);
  const properties = await connection<Array<{ id: string; tenant_id: string; name: string; kind: string; currency: string }>>`
    SELECT id::text,tenant_id::text,name,kind,currency::text FROM org_node
    WHERE id=${LOCANDA_PROPERTY_ID}::uuid FOR UPDATE`;
  exact(properties, [{
    id: LOCANDA_PROPERTY_ID,
    tenant_id: LOCANDA_TENANT_ID,
    name: LOCANDA_PROPERTY_NAME,
    kind: "property",
    currency: LOCANDA_CURRENCY,
  }], "Locanda property binding");
  return database;
}

async function provisionAccount(
  connection: ReservedSQL,
  id: string,
  name: string,
): Promise<ProvisionState> {
  const rows = await connection<Array<Record<string, unknown>>>`
    SELECT id::text,tenant_id::text,property_node::text,role,party_id::text,name,currency::text,status
    FROM account WHERE id=${id}::uuid OR (
      tenant_id=${LOCANDA_TENANT_ID}::uuid AND property_node=${LOCANDA_PROPERTY_ID}::uuid
      AND currency=${LOCANDA_CURRENCY} AND name=${name}
    ) ORDER BY id FOR UPDATE`;
  const expected = {
    id,
    tenant_id: LOCANDA_TENANT_ID,
    property_node: LOCANDA_PROPERTY_ID,
    role: "revenue",
    party_id: null,
    name,
    currency: LOCANDA_CURRENCY,
    status: "open",
  };
  if (rows.length === 0) {
    await connection`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status)
      VALUES(${id}::uuid,${LOCANDA_TENANT_ID}::uuid,${LOCANDA_PROPERTY_ID}::uuid,
        'revenue',NULL,${name},${LOCANDA_CURRENCY},'open')`;
    return "created";
  }
  if (rows.length !== 1) throw new Error(`Revenue account ${name} is ambiguous`);
  exact(rows[0], expected, `Revenue account ${name}`);
  return "already exact";
}

async function provisionTxCode(
  connection: ReservedSQL,
  spec: (typeof LOCANDA_CHARGE_CODES)[number],
): Promise<ProvisionState> {
  const rows = await connection<Array<Record<string, unknown>>>`
    SELECT code,name,grp,usali_line,default_dr,default_cr FROM tx_code WHERE code=${spec.code} FOR UPDATE`;
  const expected = {
    code: spec.code,
    name: spec.name,
    grp: "revenue",
    usali_line: spec.usaliLine,
    default_dr: "guest",
    default_cr: "revenue",
  };
  if (rows.length === 0) {
    await connection`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr)
      VALUES(${spec.code},${spec.name},'revenue',${spec.usaliLine},'guest','revenue')`;
    return "created";
  }
  if (rows.length !== 1) throw new Error(`Transaction code ${spec.code} is ambiguous`);
  exact(rows[0], expected, `Transaction code ${spec.code}`);
  return "already exact";
}

async function provisionRoute(
  connection: ReservedSQL,
  spec: (typeof LOCANDA_CHARGE_CODES)[number],
  creditAccountId: string,
): Promise<ProvisionState> {
  const rows = await connection<Array<Record<string, unknown>>>`
    SELECT tenant_id::text,property_node::text,currency::text,tx_code,
      debit_account_id::text,credit_account_id::text
    FROM tx_code_route WHERE tenant_id=${LOCANDA_TENANT_ID}::uuid
      AND property_node=${LOCANDA_PROPERTY_ID}::uuid AND currency=${LOCANDA_CURRENCY}
      AND tx_code=${spec.code} FOR UPDATE`;
  const expected = {
    tenant_id: LOCANDA_TENANT_ID,
    property_node: LOCANDA_PROPERTY_ID,
    currency: LOCANDA_CURRENCY,
    tx_code: spec.code,
    debit_account_id: null,
    credit_account_id: creditAccountId,
  };
  if (rows.length === 0) {
    await connection`INSERT INTO tx_code_route(
      tenant_id,property_node,currency,tx_code,debit_account_id,credit_account_id
    ) VALUES(
      ${LOCANDA_TENANT_ID}::uuid,${LOCANDA_PROPERTY_ID}::uuid,${LOCANDA_CURRENCY},
      ${spec.code},NULL,${creditAccountId}::uuid
    )`;
    return "created";
  }
  if (rows.length !== 1) throw new Error(`Transaction route ${spec.code} is ambiguous`);
  exact(rows[0], expected, `Transaction route ${spec.code}`);
  return "already exact";
}

export async function provisionPublicLocandaChargeCatalogue(options: Options): Promise<LocandaChargeCatalogueResult> {
  const pool = new SQL(options.databaseUrl, { max: 1 });
  const connection = await pool.reserve();
  let open = false;
  try {
    await connection.unsafe("BEGIN");
    open = true;
    await connection`SELECT pg_advisory_xact_lock(hashtextextended(${LOCK_NAME},0))`;
    // This is a short offline configuration transaction. Predicate-safe table locks
    // prevent concurrent inserts or renames from creating a conflicting account,
    // transaction code or route after the exact checks but before commit.
    await connection.unsafe(
      "LOCK TABLE public.account, public.tx_code, public.tx_code_route IN SHARE ROW EXCLUSIVE MODE",
    );
    await connection`SELECT set_config('app.tenant_id',${LOCANDA_TENANT_ID},true)`;
    const database = await requireTarget(connection, options.expectedDatabase ?? LOCANDA_EXPECTED_DATABASE);
    const ids = await accountIds();
    const accounts = {} as Record<AccountKey, ProvisionState>;
    for (const spec of LOCANDA_REVENUE_ACCOUNTS) {
      accounts[spec.key] = await provisionAccount(connection, ids[spec.key], spec.name);
    }
    const transactionCodes: Record<string, ProvisionState> = {};
    const routes: Record<string, ProvisionState> = {};
    for (const spec of LOCANDA_CHARGE_CODES) {
      transactionCodes[spec.code] = await provisionTxCode(connection, spec);
      routes[spec.code] = await provisionRoute(connection, spec, ids[spec.accountKey]);
    }
    await connection.unsafe("COMMIT");
    open = false;
    const result = { database, propertyId: LOCANDA_PROPERTY_ID, accounts, transactionCodes, routes } as const;
    (options.logger ?? console.log)(`Locanda charge catalogue ready: ${LOCANDA_CHARGE_CODES.length} routes, no postings created`);
    return result;
  } catch (error) {
    if (open) try { await connection.unsafe("ROLLBACK"); } catch { /* preserve original failure */ }
    throw error;
  } finally {
    connection.release();
    await pool.close();
  }
}

async function runCli(): Promise<void> {
  const databaseUrl = process.env.YELLOW_DEPLOY_DATABASE_URL;
  if (!databaseUrl) throw new Error("YELLOW_DEPLOY_DATABASE_URL is required");
  if (process.env.YELLOW_APPLY_ORDER563 !== "APPLY_REVIEWED_LOCANDA_CATALOGUE") {
    throw new Error("YELLOW_APPLY_ORDER563 exact confirmation is required");
  }
  await provisionPublicLocandaChargeCatalogue({
    databaseUrl,
    expectedDatabase: process.env.YELLOW_EXPECT_DATABASE ?? LOCANDA_EXPECTED_DATABASE,
  });
}

if (import.meta.main) {
  try { await runCli(); }
  catch (error) {
    console.error(`Order 563 provisioning failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
