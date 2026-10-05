import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
import { SQL } from "bun";

import {
  IndiaGstFolioBuyerCandidateConflictError,
  IndiaGstFolioBuyerCandidateNotFoundError,
  IndiaGstFolioBuyerCandidateService,
  IndiaGstFolioBuyerCandidateValidationError,
} from "../src/contexts/tax-fiscal";
import { Database, type Tx } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_INDIA_GST_FOLIO_BUYER_CANDIDATE_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_INDIA_GST_FOLIO_BUYER_CANDIDATE === "1" &&
    (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error(
    "Order 279 folio buyer-candidate proof requires deploy and runtime database URLs",
  );
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT_A = id(27901);
const TENANT_B = id(27902);
const PROPERTY_A = id(27911);
const PROPERTY_A_OTHER = id(27912);
const PROPERTY_B = id(27913);
const BOOKER_A = id(27921);
const BOOKER_A_OTHER = id(27922);
const BUYER_A = id(27923);
const BUYER_A_OTHER = id(27924);
const BUYER_B = id(27925);
const RESERVATION_A = id(27931);
const RESERVATION_A_OTHER = id(27932);
const RESERVATION_B = id(27933);
const ACCOUNT_A = id(27941);
const ACCOUNT_A_OTHER = id(27942);
const ACCOUNT_B = id(27943);
const FOLIO_A_1 = id(27951);
const FOLIO_A_2 = id(27952);
const FOLIO_A_OTHER = id(27953);
const FOLIO_B = id(27954);
const REGISTRATION_A = id(27961);
const REGISTRATION_A_OTHER = id(27962);
const REGISTRATION_B = id(27963);
const VALID_GSTIN_A = "27AAPFU0939F1ZV";
const VALID_GSTIN_OTHER = "29AAPFU0939F1ZR";

type MutableRecord = Record<PropertyKey, unknown>;

interface AnchorRow {
  readonly folio_id: string;
  readonly tenant_id: string;
  readonly account_id: string;
  readonly reservation_id: string;
  readonly window_no: number;
  readonly folio_status: string;
  readonly account_role: string;
  readonly account_status: string;
  readonly reservation_status: string;
  readonly account_currency: string;
  readonly reservation_currency: string;
  readonly account_property_node: string;
  readonly reservation_property_node: string;
}

interface RegistrationRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly party_id: string;
  readonly scheme: string;
  readonly registration_number: string;
  readonly region_code: string;
  readonly legal_name: string;
  readonly trade_name: string | null;
  readonly address_line1: string;
  readonly locality: string;
  readonly pin: string;
}

function input(overrides: Record<string, unknown> = {}): MutableRecord {
  return {
    tenantId: TENANT_A,
    propertyNode: PROPERTY_A,
    folioId: FOLIO_A_1,
    recipientPartyId: BUYER_A,
    registrationId: REGISTRATION_A,
    ...overrides,
  };
}

function anchor(overrides: Partial<AnchorRow> = {}): AnchorRow {
  return {
    folio_id: FOLIO_A_1,
    tenant_id: TENANT_A,
    account_id: ACCOUNT_A,
    reservation_id: RESERVATION_A,
    window_no: 1,
    folio_status: "open",
    account_role: "guest",
    account_status: "open",
    reservation_status: "in_house",
    account_currency: "INR",
    reservation_currency: "INR",
    account_property_node: PROPERTY_A,
    reservation_property_node: PROPERTY_A,
    ...overrides,
  };
}

function registration(overrides: Partial<RegistrationRow> = {}): RegistrationRow {
  return {
    id: REGISTRATION_A,
    tenant_id: TENANT_A,
    party_id: BUYER_A,
    scheme: "in-gstin",
    registration_number: VALID_GSTIN_A,
    region_code: "27",
    legal_name: "Order 279 Buyer Private Limited",
    trade_name: "Order 279 Buyer",
    address_line1: "1 Marine Drive",
    locality: "Mumbai",
    pin: "400001",
    ...overrides,
  };
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen((value as MutableRecord)[key], seen);
  }
}

function expectedEvidenceHash(row: RegistrationRow): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify({
    registrationId: row.id,
    tenantId: row.tenant_id,
    partyId: row.party_id,
    scheme: "in-gstin",
    gstin: row.registration_number,
    stateCode: row.region_code,
    legalName: row.legal_name,
    tradeName: row.trade_name,
    addressLine1: row.address_line1,
    locality: row.locality,
    pin: row.pin,
  })).digest("hex");
}

function fakeTx(
  anchors: readonly AnchorRow[],
  registrations: readonly RegistrationRow[],
  statements: string[] = [],
): Tx {
  return ((strings: TemplateStringsArray) => {
    const statement = strings.join("?");
    statements.push(statement);
    if (/\bFROM\s+(?:public\.)?folio\b/i.test(statement)) {
      return Promise.resolve([...anchors]);
    }
    if (/\bFROM\s+public\.party_fiscal_registration\b/i.test(statement)) {
      return Promise.resolve([...registrations]);
    }
    throw new Error(`Unexpected Order 279 SQL: ${statement}`);
  }) as unknown as Tx;
}

function sha256(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

test("Order 279 P0/P1: exact input composes exact Order276 and Order278 evidence read-only", async () => {
  const statements: string[] = [];
  const row = registration();
  const evidenceHash = expectedEvidenceHash(row);
  const service = new IndiaGstFolioBuyerCandidateService();
  const result = await service.resolve(fakeTx([anchor()], [row], statements), input() as never);
  const folio = {
    folioId: FOLIO_A_1,
    accountId: ACCOUNT_A,
    reservationId: RESERVATION_A,
    windowNo: 1,
    folioStatus: "open",
    accountRole: "guest",
    accountStatus: "open",
    reservationStatus: "in_house",
    currency: "INR",
    propertyNode: PROPERTY_A,
  };
  const recipient = { partyId: BUYER_A, registrationId: REGISTRATION_A, evidenceHash };
  const payloadJson =
    '{"BuyerDtls":{"Gstin":"27AAPFU0939F1ZV","LglNm":"Order 279 Buyer Private Limited","TrdNm":"Order 279 Buyer","Addr1":"1 Marine Drive","Loc":"Mumbai","Pin":400001,"Stcd":"27"}}';
  const buyer = {
    format: "irp_json_1_1" as const,
    payload: {
      BuyerDtls: {
        Gstin: VALID_GSTIN_A,
        LglNm: "Order 279 Buyer Private Limited",
        TrdNm: "Order 279 Buyer",
        Addr1: "1 Marine Drive",
        Loc: "Mumbai",
        Pin: 400001,
        Stcd: "27",
      },
    },
    payloadJson,
    payloadHash: sha256(payloadJson),
  };
  const associationJson = JSON.stringify({ folio, recipient, buyer });

  expect(result).toEqual({
    folio,
    recipient,
    buyer,
    associationJson,
    associationHash: sha256(associationJson),
  });
  expect(Object.keys(result)).toEqual([
    "folio", "recipient", "buyer", "associationJson", "associationHash",
  ]);
  expect(Object.keys(result.folio)).toEqual([
    "folioId", "accountId", "reservationId", "windowNo", "folioStatus",
    "accountRole", "accountStatus", "reservationStatus", "currency", "propertyNode",
  ]);
  expect(Object.keys(result.recipient)).toEqual([
    "partyId", "registrationId", "evidenceHash",
  ]);
  expect(Object.keys(result.buyer)).toEqual([
    "format", "payload", "payloadJson", "payloadHash",
  ]);
  expectDeepFrozen(result);
  expect(statements).toHaveLength(2);
  const sql = statements.join("\n");
  expect(sql).toMatch(/folio[\s\S]*JOIN\s+(?:public\.)?account[\s\S]*JOIN\s+(?:public\.)?reservation/i);
  expect(sql).toContain("current_setting('app.tenant_id', true)");
  expect(sql).toMatch(/folio\.id\s*=\s*\?/i);
  expect(sql).toMatch(/account\.property_node\s*=\s*\?/i);
  expect(sql).toContain("public.party_fiscal_registration");
  expect(sql).not.toMatch(/account\.party_id|reservation\.(?:primary_party|booker_party)|party_role|reservation_guest/i);
  expect(sql).not.toMatch(/folio\.(?:name|folio_no)/i);
  expect(sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/i);
  expect(sql).not.toMatch(/\b(?:FOR\s+UPDATE|pg_advisory|lock_financial_rows)\b/i);
});

test("Order 279 P1/P3: malformed input, missing and duplicate anchor truth fail before inference", async () => {
  const service = new IndiaGstFolioBuyerCandidateService();
  const cases: unknown[] = [
    null,
    [],
    Object.assign(Object.create({}), input()),
    { tenantId: TENANT_A, propertyNode: PROPERTY_A, folioId: FOLIO_A_1,
      recipientPartyId: BUYER_A },
    input({ extra: true }),
    input({ tenantId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" }),
    input({ propertyNode: "not-a-uuid" }),
    input({ folioId: "BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB" }),
    input({ recipientPartyId: "not-a-uuid" }),
    input({ registrationId: "CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC" }),
  ];
  const accessor = input();
  Object.defineProperty(accessor, "folioId", {
    enumerable: true,
    get: () => FOLIO_A_1,
  });
  cases.push(accessor);
  const symbolic = input();
  Object.defineProperty(symbolic, Symbol("hostile"), { value: true });
  cases.push(symbolic);
  cases.push(new Proxy(input(), {}));

  for (const hostile of cases) {
    let calls = 0;
    const tx = (() => {
      calls += 1;
      return Promise.resolve([]);
    }) as unknown as Tx;
    await expect(service.resolve(tx, hostile as never)).rejects
      .toBeInstanceOf(IndiaGstFolioBuyerCandidateValidationError);
    expect(calls).toBe(0);
  }

  await expect(service.resolve(fakeTx([], [registration()]), input() as never)).rejects
    .toBeInstanceOf(IndiaGstFolioBuyerCandidateNotFoundError);
  await expect(service.resolve(
    fakeTx([anchor(), anchor({ window_no: 2 })], [registration()]),
    input() as never,
  )).rejects.toBeInstanceOf(IndiaGstFolioBuyerCandidateConflictError);
  await expect(service.resolve(fakeTx([anchor()], []), input() as never)).rejects
    .toThrow();
  await expect(service.resolve(
    fakeTx([anchor()], [registration(), registration()]),
    input() as never,
  )).rejects.toThrow();
});

test("Order 279 P3/P4: malformed stored anchor and explicit association mismatches fail closed", async () => {
  const service = new IndiaGstFolioBuyerCandidateService();
  const defects: readonly Partial<AnchorRow>[] = [
    { folio_id: FOLIO_A_2 },
    { account_id: "not-a-uuid" },
    { reservation_id: "not-a-uuid" },
    { window_no: 0 },
    { window_no: 21 },
    { folio_status: "draft" },
    { account_role: "buyer" },
    { account_status: "pending" },
    { reservation_status: "draft" },
    { account_currency: "inr" },
    { reservation_currency: "USD" },
    { account_property_node: PROPERTY_A_OTHER },
    { reservation_property_node: PROPERTY_A_OTHER },
  ];
  for (const defect of defects) {
    await expect(service.resolve(
      fakeTx([anchor(defect)], [registration()]),
      input() as never,
    )).rejects.toBeInstanceOf(IndiaGstFolioBuyerCandidateConflictError);
  }

  const missing = { ...anchor() } as MutableRecord;
  delete missing.reservation_status;
  const surplus = { ...anchor(), account_party_id: BOOKER_A } as MutableRecord;
  const accessor = { ...anchor() } as MutableRecord;
  Object.defineProperty(accessor, "window_no", {
    enumerable: true,
    get: () => 1,
  });
  const symbolic = { ...anchor() } as MutableRecord;
  symbolic[Symbol("hostile")] = true;
  const proxy = new Proxy({ ...anchor() }, {});
  for (const hostile of [missing, surplus, accessor, symbolic, proxy]) {
    await expect(service.resolve(
      fakeTx([hostile as unknown as AnchorRow], [registration()]),
      input() as never,
    )).rejects.toBeInstanceOf(IndiaGstFolioBuyerCandidateConflictError);
  }

  await expect(service.resolve(
    fakeTx([anchor()], [registration({ party_id: BUYER_A_OTHER })]),
    input() as never,
  )).rejects.toThrow();
  await expect(service.resolve(
    fakeTx([anchor()], [registration({ id: REGISTRATION_A_OTHER })]),
    input() as never,
  )).rejects.toThrow();
});

test("Order 279 P5/P6: source has SELECT-only authority and no buyer inference", async () => {
  const source = await Bun.file(new URL(
    "../src/contexts/tax-fiscal/india-gst-folio-buyer-candidate.ts",
    import.meta.url,
  )).text();

  expect(source).toContain("IndiaGstRecipientRegistrationService");
  expect(source).toContain("buildIndiaIrpBuyerDetails");
  expect(source).toMatch(/current_setting\(['"]app\.tenant_id['"],\s*true\)/);
  expect(source).not.toMatch(/account\.party_id|reservation\.(?:primary_party|booker_party)/i);
  expect(source).not.toMatch(/party_role|reservation_guest|folio\.(?:name|folio_no)/i);
  expect(source).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z_]|DELETE\s+FROM)\b/i);
  expect(source).not.toMatch(/\b(?:FOR\s+UPDATE|FOR\s+SHARE|pg_advisory|lock_financial_rows)\b/i);
  expect(source).not.toMatch(/\b(?:recordFact|publish|emit|idempotency|document_series)\b/i);
  expect(source).not.toMatch(/\b(?:journal|posting_line|fiscal_submission|outbox)\b/i);
  expect(source).not.toMatch(/\bPos\s*[?:]/);
});

let deploy: SQL | undefined;
let database: Database | undefined;
let service: IndiaGstFolioBuyerCandidateService | undefined;

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await deploy`DELETE FROM fiscal_submission WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM posting_line WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM journal WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM document WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM outbox WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM fact_log WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM folio WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM account WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM party_fiscal_registration WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM reservation_guest WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM reservation WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM party_role WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM party WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM org_node WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

async function effects(): Promise<Record<string, number | string>> {
  const rows = await deploy!<Array<Record<string, number | string>>>`SELECT
    (SELECT count(*)::int FROM folio WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) folios,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5('')) FROM folio subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) folio_digest,
    (SELECT count(*)::int FROM account WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) accounts,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5('')) FROM account subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) account_digest,
    (SELECT count(*)::int FROM reservation WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) reservations,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5('')) FROM reservation subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) reservation_digest,
    (SELECT count(*)::int FROM party_fiscal_registration WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) registrations,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5('')) FROM party_fiscal_registration subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) registration_digest,
    (SELECT count(*)::int FROM fact_log WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) facts,
    (SELECT count(*)::int FROM outbox WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) events,
    (SELECT count(*)::int FROM document WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) documents,
    (SELECT count(*)::int FROM journal WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) journals,
    (SELECT count(*)::int FROM posting_line WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) postings,
    (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) submissions`;
  return rows[0]!;
}

function resolve(
  overrides: Record<string, unknown> = {},
  transactionTenant = (overrides.tenantId as string | undefined) ?? TENANT_A,
) {
  return database!.withTenantTransaction(transactionTenant, (tx) =>
    service!.resolve(tx, input(overrides) as never));
}

databaseDescribe("Order 279 exact read-only India GST folio buyer candidate", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 16, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 16, prepare: false });
    service = new IndiaGstFolioBuyerCandidateService();
    await cleanup();
    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT_A}::uuid,'order279-a','Order 279 A','shared','active'),
      (${TENANT_B}::uuid,'order279-b','Order 279 B','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order279a.property'::ltree,'property','Order 279 A','UTC','INR'),
      (${PROPERTY_A_OTHER}::uuid,${TENANT_A}::uuid,'order279a.other'::ltree,'property','Order 279 Other','UTC','INR'),
      (${PROPERTY_B}::uuid,${TENANT_B}::uuid,'order279b.property'::ltree,'property','Order 279 B','UTC','INR')`;
    await deploy`INSERT INTO party(id,tenant_id,kind,display_name,legal_name,status) VALUES
      (${BOOKER_A}::uuid,${TENANT_A}::uuid,'person','Order 279 Booker','Mutable Booker','active'),
      (${BOOKER_A_OTHER}::uuid,${TENANT_A}::uuid,'person','Order 279 Other Booker','Mutable Other','active'),
      (${BUYER_A}::uuid,${TENANT_A}::uuid,'org','Order 279 Buyer','Mutable Buyer','active'),
      (${BUYER_A_OTHER}::uuid,${TENANT_A}::uuid,'org','Order 279 Other Buyer','Mutable Other Buyer','active'),
      (${BUYER_B}::uuid,${TENANT_B}::uuid,'org','Order 279 Foreign Buyer','Mutable Foreign','active')`;
    await deploy`INSERT INTO party_role(tenant_id,party_id,role,detail) VALUES
      (${TENANT_A}::uuid,${BOOKER_A}::uuid,'guest','{}'::jsonb),
      (${TENANT_A}::uuid,${BUYER_A}::uuid,'company','{"gstin":"FAKE"}'::jsonb),
      (${TENANT_B}::uuid,${BUYER_B}::uuid,'company','{}'::jsonb)`;
    await deploy`INSERT INTO reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,booker_party,channel_code,currency
    ) VALUES
      (${RESERVATION_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O279-A','in_house',${BOOKER_A}::uuid,${BOOKER_A}::uuid,'direct','INR'),
      (${RESERVATION_A_OTHER}::uuid,${TENANT_A}::uuid,${PROPERTY_A_OTHER}::uuid,'O279-O','reserved',${BOOKER_A_OTHER}::uuid,${BOOKER_A_OTHER}::uuid,'direct','INR'),
      (${RESERVATION_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,'O279-B','in_house',${BUYER_B}::uuid,${BUYER_B}::uuid,'direct','INR')`;
    await deploy`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES
      (${ACCOUNT_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'guest',${BOOKER_A}::uuid,'Order 279 Account','INR','open'),
      (${ACCOUNT_A_OTHER}::uuid,${TENANT_A}::uuid,${PROPERTY_A_OTHER}::uuid,'guest',${BOOKER_A_OTHER}::uuid,'Order 279 Other','INR','open'),
      (${ACCOUNT_B}::uuid,${TENANT_B}::uuid,${PROPERTY_B}::uuid,'guest',${BUYER_B}::uuid,'Order 279 Foreign','INR','open')`;
    await deploy`INSERT INTO folio(id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status) VALUES
      (${FOLIO_A_1}::uuid,${TENANT_A}::uuid,${ACCOUNT_A}::uuid,${RESERVATION_A}::uuid,'O279-A-1',1,'Personal','open'),
      (${FOLIO_A_2}::uuid,${TENANT_A}::uuid,${ACCOUNT_A}::uuid,${RESERVATION_A}::uuid,'O279-A-2',2,'Business','open'),
      (${FOLIO_A_OTHER}::uuid,${TENANT_A}::uuid,${ACCOUNT_A_OTHER}::uuid,${RESERVATION_A_OTHER}::uuid,'O279-O-1',1,'Other','open'),
      (${FOLIO_B}::uuid,${TENANT_B}::uuid,${ACCOUNT_B}::uuid,${RESERVATION_B}::uuid,'O279-B-1',1,'Foreign','open')`;
    await deploy`INSERT INTO party_fiscal_registration(
      tenant_id,id,party_id,scheme,registration_number,region_code,legal_name,
      trade_name,address_line1,locality,pin
    ) VALUES
      (${TENANT_A}::uuid,${REGISTRATION_A}::uuid,${BUYER_A}::uuid,'in-gstin',${VALID_GSTIN_A},'27','Order 279 Buyer Private Limited','Order 279 Buyer','1 Marine Drive','Mumbai','400001'),
      (${TENANT_A}::uuid,${REGISTRATION_A_OTHER}::uuid,${BUYER_A_OTHER}::uuid,'in-gstin',${VALID_GSTIN_OTHER},'29','Order 279 Other Buyer Private Limited','Order 279 Other Buyer','1 Residency Road','Bengaluru','560001'),
      (${TENANT_B}::uuid,${REGISTRATION_B}::uuid,${BUYER_B}::uuid,'in-gstin',${VALID_GSTIN_OTHER},'29','Order 279 Foreign Buyer Private Limited','Order 279 Foreign Buyer','1 Residency Road','Bengaluru','560001')`;
  });

  afterAll(async () => {
    await cleanup();
    await database?.close();
    await deploy?.close({ timeout: 0 });
  });

  test("P1/P2: two explicit sibling windows produce distinct deterministic frozen associations", async () => {
    const first = await resolve();
    const replay = await resolve();
    const sibling = await resolve({ folioId: FOLIO_A_2 });

    expect(first).toEqual(replay);
    expect(JSON.stringify(first)).toBe(JSON.stringify(replay));
    expect(first.folio).toMatchObject({
      folioId: FOLIO_A_1, accountId: ACCOUNT_A, reservationId: RESERVATION_A,
      windowNo: 1, propertyNode: PROPERTY_A, currency: "INR",
    });
    expect(sibling.folio).toMatchObject({
      folioId: FOLIO_A_2, accountId: ACCOUNT_A, reservationId: RESERVATION_A,
      windowNo: 2, propertyNode: PROPERTY_A, currency: "INR",
    });
    expect(sibling.recipient).toEqual(first.recipient);
    expect(sibling.buyer).toEqual(first.buyer);
    expect(sibling.associationHash).not.toBe(first.associationHash);
    expectDeepFrozen(first);
    expectDeepFrozen(sibling);
  });

  test("P3/P4: explicit buyer never comes from account Party, reservation Parties, role or window labels", async () => {
    const before = await resolve();
    await deploy!`UPDATE account SET party_id=${BOOKER_A_OTHER}::uuid,name='Changed account'
      WHERE tenant_id=${TENANT_A}::uuid AND id=${ACCOUNT_A}::uuid`;
    await deploy!`UPDATE reservation SET primary_party=${BOOKER_A_OTHER}::uuid,booker_party=${BOOKER_A_OTHER}::uuid
      WHERE tenant_id=${TENANT_A}::uuid AND id=${RESERVATION_A}::uuid`;
    await deploy!`UPDATE folio SET name='Changed window',folio_no='CHANGED-279'
      WHERE tenant_id=${TENANT_A}::uuid AND id=${FOLIO_A_1}::uuid`;
    await deploy!`UPDATE party_role SET detail='{"gstin":"29ABCDE1234F1Z5"}'::jsonb
      WHERE tenant_id=${TENANT_A}::uuid AND party_id=${BUYER_A}::uuid`;
    const after = await resolve();
    const explicitlyOther = await resolve({
      recipientPartyId: BUYER_A_OTHER,
      registrationId: REGISTRATION_A_OTHER,
    });

    expect(after).toEqual(before);
    expect(after.recipient.partyId).toBe(BUYER_A);
    expect(after.recipient.registrationId).toBe(REGISTRATION_A);
    expect(JSON.stringify(after)).not.toContain("Changed account");
    expect(JSON.stringify(after)).not.toContain("Changed window");
    expect(explicitlyOther.recipient).toMatchObject({
      partyId: BUYER_A_OTHER,
      registrationId: REGISTRATION_A_OTHER,
    });
    expect(explicitlyOther.associationHash).not.toBe(after.associationHash);
  });

  test("P4: status, role and currency are exact evidence, never an eligibility decision", async () => {
    await deploy!`UPDATE folio SET status='settled' WHERE tenant_id=${TENANT_A}::uuid AND id=${FOLIO_A_1}::uuid`;
    await deploy!`UPDATE account SET role='company',status='frozen' WHERE tenant_id=${TENANT_A}::uuid AND id=${ACCOUNT_A}::uuid`;
    await deploy!`UPDATE reservation SET status='checked_out' WHERE tenant_id=${TENANT_A}::uuid AND id=${RESERVATION_A}::uuid`;
    const evidence = await resolve();
    expect(evidence.folio).toMatchObject({
      folioStatus: "settled",
      accountRole: "company",
      accountStatus: "frozen",
      reservationStatus: "checked_out",
      currency: "INR",
    });

    await deploy!`UPDATE reservation SET currency='USD' WHERE tenant_id=${TENANT_A}::uuid AND id=${RESERVATION_A}::uuid`;
    await expect(resolve()).rejects.toBeInstanceOf(IndiaGstFolioBuyerCandidateConflictError);
    await deploy!`UPDATE reservation SET currency='INR' WHERE tenant_id=${TENANT_A}::uuid AND id=${RESERVATION_A}::uuid`;
  });

  test("P5: foreign property, tenant, folio, Party and registration associations fail closed", async () => {
    await expect(resolve({ propertyNode: PROPERTY_A_OTHER })).rejects
      .toBeInstanceOf(IndiaGstFolioBuyerCandidateNotFoundError);
    await expect(resolve({ folioId: FOLIO_A_OTHER })).rejects
      .toBeInstanceOf(IndiaGstFolioBuyerCandidateNotFoundError);
    await expect(resolve({ recipientPartyId: BUYER_A_OTHER })).rejects.toThrow();
    await expect(resolve({ registrationId: REGISTRATION_A_OTHER })).rejects.toThrow();
    await expect(resolve({ recipientPartyId: BUYER_B, registrationId: REGISTRATION_B })).rejects.toThrow();
    await expect(resolve({ folioId: FOLIO_B })).rejects
      .toBeInstanceOf(IndiaGstFolioBuyerCandidateNotFoundError);
    await expect(resolve({ tenantId: TENANT_B }, TENANT_A)).rejects
      .toBeInstanceOf(IndiaGstFolioBuyerCandidateNotFoundError);
  });

  test("P6: canonical and failed reads leave every source/effect byte and count unchanged", async () => {
    const before = await effects();
    await resolve();
    await resolve({ folioId: FOLIO_A_2 });
    await expect(resolve({ propertyNode: PROPERTY_A_OTHER })).rejects.toThrow();
    await expect(resolve({ registrationId: REGISTRATION_A_OTHER })).rejects.toThrow();
    expect(await effects()).toEqual(before);
  });
});
