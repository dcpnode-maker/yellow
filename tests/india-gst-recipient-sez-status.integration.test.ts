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
  IndiaGstRecipientSezStatusConflictError,
  IndiaGstRecipientSezStatusNotFoundError,
  IndiaGstRecipientSezStatusService,
  IndiaGstRecipientSezStatusValidationError,
} from "../src/contexts/tax-fiscal";
import { Database, type Tx } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ORDER285_DATABASE_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER285_DATABASE === "1" &&
    (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error(
    "Order 285 recipient SEZ-status proof requires deploy and runtime URLs",
  );
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const sha256 = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

const TENANT_A = id(28501);
const TENANT_B = id(28502);
const PARTY_A = id(28511);
const PARTY_A_OTHER = id(28512);
const PARTY_B = id(28513);
const REGISTRATION_A = id(28521);
const REGISTRATION_A_OTHER = id(28522);
const REGISTRATION_B = id(28523);
const STATUS_REGULAR = id(28531);
const STATUS_UNIT = id(28532);
const STATUS_DEVELOPER_B = id(28533);
const STATUS_DEVELOPER_C = id(28534);
const STATUS_B = id(28535);
const STATUS_AS_OF = "2038-05-15";
const VALIDITY_FROM = "2038-01-01";
const VALIDITY_TO = "2039-01-01";
const GSTIN_A = "27AAPFU0939F1ZV";
const GSTIN_OTHER = "29AAPFU0939F1ZR";
const GST_STATUS_HASH = "a".repeat(64);
const APPROVAL_HASH = "b".repeat(64);
const LEGAL_RULE = "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS";

type MutableRecord = Record<PropertyKey, unknown>;

interface StatusRow {
  readonly tenant_id: string;
  readonly id: string;
  readonly recipient_registration_id: string;
  readonly recipient_registration_evidence_hash: string;
  readonly status_as_of: string;
  readonly gst_registration_status: string;
  readonly gst_taxpayer_type: string;
  readonly gst_status_source: string;
  readonly gst_status_evidence_sha256: string;
  readonly approval_form: string | null;
  readonly approval_reference: string | null;
  readonly approval_validity: string | null;
  readonly approval_status: string | null;
  readonly approval_evidence_sha256: string | null;
  readonly legal_rule: string;
}

interface StatusOptions {
  readonly tenantId?: string;
  readonly id?: string;
  readonly registrationId?: string;
  readonly recipientEvidenceHash?: string;
  readonly statusAsOf?: string;
  readonly registrationStatus?: string;
  readonly taxpayerType?: string;
  readonly source?: string;
  readonly statusEvidenceSha256?: string;
  readonly approvalForm?: string | null;
  readonly approvalReference?: string | null;
  readonly approvalValidity?: string | null;
  readonly approvalStatus?: string | null;
  readonly approvalEvidenceSha256?: string | null;
  readonly legalRule?: string;
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as MutableRecord)[key], seen);
  }
  return Object.freeze(value);
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen((value as MutableRecord)[key], seen);
  }
}

function input(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tenantId: TENANT_A,
    recipientPartyId: PARTY_A,
    recipientRegistrationId: REGISTRATION_A,
    recipientSezStatusId: STATUS_REGULAR,
    ...overrides,
  };
}

function recipient(overrides: Record<string, unknown> = {}) {
  const values = {
    registrationId: REGISTRATION_A,
    partyId: PARTY_A,
    scheme: "in-gstin",
    gstin: GSTIN_A,
    stateCode: "27",
    legalName: "Order 285 Recipient Private Limited",
    tradeName: "Order 285 Recipient",
    addressLine1: "1 Marine Drive",
    locality: "Mumbai",
    pin: "400001",
    ...overrides,
  };
  const evidenceHash = typeof overrides.evidenceHash === "string"
    ? overrides.evidenceHash
    : sha256(JSON.stringify({
      registrationId: values.registrationId,
      tenantId: TENANT_A,
      partyId: values.partyId,
      scheme: values.scheme,
      gstin: values.gstin,
      stateCode: values.stateCode,
      legalName: values.legalName,
      tradeName: values.tradeName,
      addressLine1: values.addressLine1,
      locality: values.locality,
      pin: values.pin,
    }));
  return deepFreeze({ ...values, evidenceHash });
}

function statusRow(overrides: Partial<StatusRow> = {}): StatusRow {
  const root = recipient();
  return {
    tenant_id: TENANT_A,
    id: STATUS_REGULAR,
    recipient_registration_id: REGISTRATION_A,
    recipient_registration_evidence_hash: root.evidenceHash,
    status_as_of: STATUS_AS_OF,
    gst_registration_status: "active",
    gst_taxpayer_type: "regular",
    gst_status_source: "gst_common_portal",
    gst_status_evidence_sha256: GST_STATUS_HASH,
    approval_form: null,
    approval_reference: null,
    approval_validity: null,
    approval_status: null,
    approval_evidence_sha256: null,
    legal_rule: LEGAL_RULE,
    ...overrides,
  };
}

function approvalRow(
  type: "sez_unit" | "sez_developer",
  form: "sez_rules_form_g" | "sez_rules_form_b" | "sez_rules_form_c",
  statusId: string,
): StatusRow {
  return statusRow({
    id: statusId,
    gst_taxpayer_type: type,
    approval_form: form,
    approval_reference: `LOA/${statusId.slice(-2)}/2038`,
    approval_validity: `[${VALIDITY_FROM},${VALIDITY_TO})`,
    approval_status: "in_force",
    approval_evidence_sha256: APPROVAL_HASH,
  });
}

function fakeTx(rows: readonly StatusRow[], statements: string[] = []): Tx {
  return (async (strings: TemplateStringsArray) => {
    statements.push(strings.join("?"));
    return rows;
  }) as unknown as Tx;
}

function harness(
  recipientRoot: unknown = recipient(),
  rows: readonly StatusRow[] = [statusRow()],
  statements: string[] = [],
) {
  const calls: unknown[] = [];
  const service = new IndiaGstRecipientSezStatusService({
    async resolve(_tx: Tx, selected: unknown) {
      calls.push(selected);
      return recipientRoot as never;
    },
  });
  return { service, tx: fakeTx(rows, statements), calls, statements };
}

function expectedBody(
  row: StatusRow,
  root = recipient(),
): Record<string, unknown> {
  const approval = row.approval_form === null ? null : {
    form: row.approval_form,
    reference: row.approval_reference,
    validity: {
      fromInclusive: VALIDITY_FROM,
      toExclusive: VALIDITY_TO,
    },
    status: "in_force",
    evidenceSha256: row.approval_evidence_sha256,
  };
  return {
    recipientSezStatusId: row.id,
    recipient: {
      partyId: root.partyId,
      registrationId: root.registrationId,
      evidenceHash: root.evidenceHash,
    },
    statusAsOf: row.status_as_of,
    gstRegistration: {
      status: "active",
      taxpayerType: row.gst_taxpayer_type,
      source: "gst_common_portal",
      evidenceSha256: row.gst_status_evidence_sha256,
    },
    sezStatus: row.gst_taxpayer_type === "regular"
      ? "affirmatively_non_sez_regular"
      : row.gst_taxpayer_type,
    approval,
    legalRule: LEGAL_RULE,
  };
}

function sqlState(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const postgres = error as { errno?: unknown; code?: unknown };
  if (typeof postgres.errno === "string") return postgres.errno;
  return typeof postgres.code === "string" ? postgres.code : undefined;
}

async function expectSqlState(operation: Promise<unknown>, expected: string): Promise<void> {
  try {
    await operation;
    throw new Error(`expected PostgreSQL SQLSTATE ${expected}`);
  } catch (error) {
    expect(sqlState(error)).toBe(expected);
  }
}

test("Order 285 P0: exact migration and bounded-context resolver exist", async () => {
  expect(typeof IndiaGstRecipientSezStatusService).toBe("function");
  const sql = await Bun.file(new URL(
    "../migrations/0052_india_gst_recipient_sez_status.sql",
    import.meta.url,
  )).text();
  expect(sql).toContain("CREATE TABLE public.india_gst_recipient_sez_status");
  expect(sql).toContain("FOREIGN KEY (tenant_id, recipient_registration_id)");
  expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  expect(sql).toContain("FORCE ROW LEVEL SECURITY");
  expect(sql).toContain(
    "GRANT SELECT ON TABLE public.india_gst_recipient_sez_status TO app_role",
  );
});

test("Order 285 P1: regular, unit, developer B/C map to exact frozen tenant-bound evidence", async () => {
  for (const row of [
    statusRow(),
    approvalRow("sez_unit", "sez_rules_form_g", STATUS_UNIT),
    approvalRow("sez_developer", "sez_rules_form_b", STATUS_DEVELOPER_B),
    approvalRow("sez_developer", "sez_rules_form_c", STATUS_DEVELOPER_C),
  ]) {
    const selected = input({ recipientSezStatusId: row.id });
    const selectedBefore = JSON.stringify(selected);
    const target = harness(recipient(), [row]);
    const first = await target.service.resolve(target.tx, selected as never);
    const replay = await target.service.resolve(target.tx, selected as never);
    const body = expectedBody(row);
    expect(first).toEqual(replay);
    expect(first).toEqual({
      ...body,
      evidenceHash: sha256(JSON.stringify({ tenantId: TENANT_A, ...body })),
    } as typeof first);
    expect(Object.keys(first)).toEqual([
      "recipientSezStatusId", "recipient", "statusAsOf", "gstRegistration",
      "sezStatus", "approval", "legalRule", "evidenceHash",
    ]);
    expect(first).not.toHaveProperty("tenantId");
    expectDeepFrozen(first);
    expect(JSON.stringify(selected)).toBe(selectedBefore);
  }
});

test("Order 285 P2: dependency is exact and resolver performs one equality SELECT only", async () => {
  const statements: string[] = [];
  const target = harness(recipient(), [statusRow()], statements);
  await target.service.resolve(target.tx, input() as never);
  expect(target.calls).toEqual([{
    tenantId: TENANT_A,
    recipientPartyId: PARTY_A,
    registrationId: REGISTRATION_A,
  }]);
  expect(statements).toHaveLength(1);
  const sql = statements[0]!;
  expect(sql).toContain("public.india_gst_recipient_sez_status");
  expect(sql).toContain("current_setting('app.tenant_id', true)");
  expect(sql).toContain("recipient_registration_id");
  expect(sql).toContain("recipient_registration_evidence_hash");
  expect(sql).toContain("status_as_of");
  expect(sql).not.toMatch(
    /party_role|address|account|reservation|folio|BuyerDtls|property_fiscal_location|registered_state|org_node|extension|tax_code|classification/i,
  );
  expect(sql).not.toMatch(
    /\b(?:INSERT|UPDATE|DELETE|FOR\s+UPDATE|FOR\s+SHARE|pg_advisory)\b/i,
  );
});

test("Order 285 P3: exact accessor/proxy/symbol-free four-UUID input is mandatory", async () => {
  const exact = input();
  const hostile: unknown[] = [
    null,
    [],
    Object.assign(Object.create({ inherited: true }), exact),
    { ...exact, extra: true },
    { ...exact, tenantId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" },
    { ...exact, recipientPartyId: "not-a-uuid" },
    { ...exact, recipientRegistrationId: "not-a-uuid" },
    { ...exact, recipientSezStatusId: "not-a-uuid" },
    new Proxy({ ...exact }, {}),
  ];
  for (const key of Object.keys(exact)) {
    const missing = { ...exact } as MutableRecord;
    delete missing[key];
    hostile.push(missing);
  }
  const accessor = { ...exact } as MutableRecord;
  Object.defineProperty(accessor, "recipientSezStatusId", {
    enumerable: true,
    get: () => STATUS_REGULAR,
  });
  hostile.push(accessor);
  const symbolic = { ...exact } as MutableRecord;
  symbolic[Symbol("hostile")] = true;
  hostile.push(symbolic);

  for (const candidate of hostile) {
    const target = harness();
    await expect(target.service.resolve(target.tx, candidate as never)).rejects
      .toBeInstanceOf(IndiaGstRecipientSezStatusValidationError);
    expect(target.calls).toHaveLength(0);
    expect(target.statements).toHaveLength(0);
  }
  const target = harness();
  await expect(target.service.resolve(undefined as unknown as Tx, exact as never)).rejects
    .toBeInstanceOf(IndiaGstRecipientSezStatusValidationError);
  expect(target.calls).toHaveLength(0);
});

test("Order 285 P4: complete frozen current Order276 evidence is independently revalidated", async () => {
  const pristine = recipient();
  const hostile: unknown[] = [
    null,
    [],
    deepFreeze({ ...pristine, extra: true }),
    new Proxy(structuredClone(pristine), {}),
    structuredClone(pristine),
  ];
  for (const key of Object.keys(pristine)) {
    const missing = structuredClone(pristine) as MutableRecord;
    delete missing[key];
    hostile.push(deepFreeze(missing));
  }
  const accessor = structuredClone(pristine) as MutableRecord;
  Object.defineProperty(accessor, "evidenceHash", {
    enumerable: true,
    get: () => pristine.evidenceHash,
  });
  hostile.push(Object.freeze(accessor));
  const symbolic = structuredClone(pristine) as MutableRecord;
  symbolic[Symbol("hostile")] = true;
  hostile.push(deepFreeze(symbolic));

  for (const root of hostile) {
    const target = harness(root);
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaGstRecipientSezStatusConflictError);
    expect(target.statements).toHaveLength(0);
  }

  for (const defect of [
    { registrationId: REGISTRATION_A_OTHER },
    { partyId: PARTY_A_OTHER },
    { scheme: "gstin" },
    { gstin: GSTIN_OTHER },
    { stateCode: "29" },
    { legalName: "Changed recipient" },
    { tradeName: "Changed trade" },
    { addressLine1: "2 Changed Road" },
    { locality: "Bengaluru" },
    { pin: "560001" },
    { evidenceHash: "f".repeat(64) },
  ]) {
    const target = harness(recipient(defect));
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaGstRecipientSezStatusConflictError);
  }
});

test("Order 285 P5: missing, duplicate, hostile and incoherent stored status rows fail closed", async () => {
  await expect(harness(recipient(), []).service.resolve(fakeTx([]), input() as never))
    .rejects.toBeInstanceOf(IndiaGstRecipientSezStatusNotFoundError);
  const duplicate = harness(recipient(), [statusRow(), statusRow()]);
  await expect(duplicate.service.resolve(duplicate.tx, input() as never)).rejects
    .toBeInstanceOf(IndiaGstRecipientSezStatusConflictError);

  const pristine = statusRow();
  const hostile: unknown[] = [{ ...pristine, surplus: true }, new Proxy({ ...pristine }, {})];
  for (const key of Object.keys(pristine)) {
    const missing = { ...pristine } as MutableRecord;
    delete missing[key];
    hostile.push(missing);
  }
  const accessor = { ...pristine } as MutableRecord;
  Object.defineProperty(accessor, "gst_taxpayer_type", {
    enumerable: true,
    get: () => "regular",
  });
  hostile.push(accessor);
  const symbolic = { ...pristine } as MutableRecord;
  symbolic[Symbol("hostile")] = true;
  hostile.push(symbolic);
  for (const candidate of hostile) {
    const target = harness(recipient(), [candidate as StatusRow]);
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaGstRecipientSezStatusConflictError);
  }

  const defects: readonly Partial<StatusRow>[] = [
    { tenant_id: TENANT_B },
    { id: STATUS_UNIT },
    { recipient_registration_id: REGISTRATION_A_OTHER },
    { recipient_registration_evidence_hash: "f".repeat(64) },
    { status_as_of: "2038-5-15" },
    { gst_registration_status: "suspended" },
    { gst_registration_status: "cancelled" },
    { gst_taxpayer_type: "composition" },
    { gst_status_source: "party_profile" },
    { gst_status_evidence_sha256: "A".repeat(64) },
    { gst_status_evidence_sha256: "x".repeat(64) },
    { approval_form: "sez_rules_form_g" },
    { legal_rule: "IGST_ACT_7_5_B" },
  ];
  for (const defect of defects) {
    const target = harness(recipient(), [statusRow(defect)]);
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaGstRecipientSezStatusConflictError);
  }
  const controlReference = harness(recipient(), [{
    ...approvalRow("sez_unit", "sez_rules_form_g", STATUS_REGULAR),
    approval_reference: "LOA/285\n2038",
  }]);
  await expect(controlReference.service.resolve(controlReference.tx, input() as never))
    .rejects.toBeInstanceOf(IndiaGstRecipientSezStatusConflictError);
});

test("Order 285 P6: replay and rejection preserve caller, dependency and row bytes", async () => {
  const selected = input();
  const root = recipient();
  const row = statusRow();
  const before = JSON.stringify({ selected, root, row });
  const target = harness(root, [row]);
  await target.service.resolve(target.tx, selected as never);
  await target.service.resolve(target.tx, selected as never);
  const rejected = harness(root, [statusRow({ gst_registration_status: "cancelled" })]);
  await expect(rejected.service.resolve(rejected.tx, selected as never)).rejects.toThrow();
  expect(JSON.stringify({ selected, root, row })).toBe(before);
});

let deploy: SQL | undefined;
let database: Database | undefined;

async function clearStatuses(): Promise<void> {
  await deploy!`DELETE FROM india_gst_recipient_sez_status
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

async function seedStatus(options: StatusOptions = {}): Promise<string> {
  const statusId = options.id ?? crypto.randomUUID();
  const type = options.taxpayerType ?? "regular";
  const isRegular = type === "regular";
  const selectedRoot = options.tenantId === TENANT_B
    ? recipient({
      registrationId: REGISTRATION_B,
      partyId: PARTY_B,
      gstin: GSTIN_OTHER,
      stateCode: "29",
      legalName: "Order 285 Foreign Recipient Private Limited",
      tradeName: "Order 285 Foreign Recipient",
      addressLine1: "1 Residency Road",
      locality: "Bengaluru",
      pin: "560001",
    })
    : recipient();
  await deploy!`INSERT INTO india_gst_recipient_sez_status(
      tenant_id,id,recipient_registration_id,recipient_registration_evidence_hash,
      status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,
      gst_status_evidence_sha256,approval_form,approval_reference,
      approval_validity,approval_status,approval_evidence_sha256,legal_rule
    ) VALUES (
      ${options.tenantId ?? TENANT_A}::uuid,${statusId}::uuid,
      ${options.registrationId ?? (options.tenantId === TENANT_B ? REGISTRATION_B : REGISTRATION_A)}::uuid,
      ${options.recipientEvidenceHash ?? selectedRoot.evidenceHash},
      ${options.statusAsOf ?? STATUS_AS_OF}::date,
      ${options.registrationStatus ?? "active"},${type},
      ${options.source ?? "gst_common_portal"},
      ${options.statusEvidenceSha256 ?? GST_STATUS_HASH},
      ${options.approvalForm === undefined
        ? (isRegular ? null : type === "sez_unit" ? "sez_rules_form_g" : "sez_rules_form_b")
        : options.approvalForm},
      ${options.approvalReference === undefined ? (isRegular ? null : "LOA/285/2038") : options.approvalReference},
      ${options.approvalValidity === undefined ? (isRegular ? null : `[${VALIDITY_FROM},${VALIDITY_TO})`) : options.approvalValidity}::daterange,
      ${options.approvalStatus === undefined ? (isRegular ? null : "in_force") : options.approvalStatus},
      ${options.approvalEvidenceSha256 === undefined ? (isRegular ? null : APPROVAL_HASH) : options.approvalEvidenceSha256},
      ${options.legalRule ?? LEGAL_RULE}
    )`;
  return statusId;
}

async function cleanupDatabaseFixture(): Promise<void> {
  if (!deploy) return;
  await clearStatuses();
  await deploy`DELETE FROM fiscal_submission WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM posting_line WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM journal WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM document WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM api_idempotency WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM outbox WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM fact_log WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM address WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM party_role WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM party_fiscal_registration WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM party WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

async function seedDatabaseFixture(): Promise<void> {
  await deploy!`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT_A}::uuid,'order285-a','Order 285 A','shared','active'),
    (${TENANT_B}::uuid,'order285-b','Order 285 B','shared','active')`;
  await deploy!`INSERT INTO party(
      id,tenant_id,kind,display_name,legal_name,attrs,vip_code,status
    ) VALUES
    (${PARTY_A}::uuid,${TENANT_A}::uuid,'org','Misleading SEZ Developer',
     'Mutable SEZ Unit','{"sez":true,"gst_status":"cancelled","Pos":"29"}'::jsonb,
     'SEZ','active'),
    (${PARTY_A_OTHER}::uuid,${TENANT_A}::uuid,'org','Other Recipient',
     'Other Recipient','{"sez":false}'::jsonb,NULL,'active'),
    (${PARTY_B}::uuid,${TENANT_B}::uuid,'org','Foreign Recipient',
     'Foreign Recipient','{"sez":true}'::jsonb,NULL,'active')`;
  await deploy!`INSERT INTO party_role(tenant_id,party_id,role,detail) VALUES
    (${TENANT_A}::uuid,${PARTY_A}::uuid,'company',
     '{"sez_status":"developer","authorized_operations":true}'::jsonb),
    (${TENANT_A}::uuid,${PARTY_A_OTHER}::uuid,'company','{"sez_status":"regular"}'::jsonb),
    (${TENANT_B}::uuid,${PARTY_B}::uuid,'company','{"sez_status":"unit"}'::jsonb)`;
  await deploy!`INSERT INTO address(
      tenant_id,party_id,kind,lines,city,region,postal_code,country
    ) VALUES
    (${TENANT_A}::uuid,${PARTY_A}::uuid,'registered',ARRAY['SEZ Campus'],
     'Mumbai','27','400001','IN'),
    (${TENANT_B}::uuid,${PARTY_B}::uuid,'registered',ARRAY['Foreign SEZ Campus'],
     'Bengaluru','29','560001','IN')`;
  await deploy!`INSERT INTO party_fiscal_registration(
      tenant_id,id,party_id,scheme,registration_number,region_code,legal_name,
      trade_name,address_line1,locality,pin
    ) VALUES
    (${TENANT_A}::uuid,${REGISTRATION_A}::uuid,${PARTY_A}::uuid,'in-gstin',
     ${GSTIN_A},'27','Order 285 Recipient Private Limited','Order 285 Recipient',
     '1 Marine Drive','Mumbai','400001'),
    (${TENANT_A}::uuid,${REGISTRATION_A_OTHER}::uuid,${PARTY_A_OTHER}::uuid,'in-gstin',
     ${GSTIN_OTHER},'29','Order 285 Other Private Limited','Order 285 Other',
     '1 Residency Road','Bengaluru','560001'),
    (${TENANT_B}::uuid,${REGISTRATION_B}::uuid,${PARTY_B}::uuid,'in-gstin',
     ${GSTIN_OTHER},'29','Order 285 Foreign Recipient Private Limited',
     'Order 285 Foreign Recipient','1 Residency Road','Bengaluru','560001')`;
}

async function effects(): Promise<Record<string, number | string>> {
  const rows = await deploy!<Array<Record<string, number | string>>>`SELECT
    (SELECT count(*)::int FROM india_gst_recipient_sez_status
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) statuses,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5(''))
      FROM india_gst_recipient_sez_status subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) status_digest,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5(''))
      FROM party_fiscal_registration subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) registration_digest,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5(''))
      FROM party subject WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) party_digest,
    (SELECT count(*)::int FROM fact_log
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) facts,
    (SELECT count(*)::int FROM outbox
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) events,
    (SELECT count(*)::int FROM api_idempotency
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) idempotency,
    (SELECT count(*)::int FROM journal
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) journals,
    (SELECT count(*)::int FROM posting_line
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) postings,
    (SELECT count(*)::int FROM document
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) documents,
    (SELECT count(*)::int FROM fiscal_submission
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) submissions`;
  return rows[0]!;
}

async function resolveDatabase(
  selected = input(),
  transactionTenant = TENANT_A,
) {
  const service = new IndiaGstRecipientSezStatusService();
  return database!.withTenantTransaction(transactionTenant, (tx) =>
    service.resolve(tx, selected as never),
  );
}

databaseDescribe("Order 285 exact PostgreSQL recipient SEZ-status evidence", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 16, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 16, prepare: false });
    await cleanupDatabaseFixture();
    await seedDatabaseFixture();
  });

  afterAll(async () => {
    await cleanupDatabaseFixture();
    await database?.close();
    await deploy?.close({ timeout: 0 });
  });

  test("P7: schema is exact52/104/94/94/4 with composite FK, identity, forced RLS and SELECT-only ACL", async () => {
    const counts = await deploy!<Array<{
      migrations: number;
      tables: number;
      rls_tables: number;
      policies: number;
      forced_rls: number;
    }>>`SELECT
      (SELECT count(*)::int FROM schema_migration) migrations,
      (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') tables,
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity) rls_tables,
      (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') policies,
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND c.relforcerowsecurity) forced_rls`;
    expect(counts[0]).toEqual({
      migrations: 52, tables: 104, rls_tables: 94, policies: 94, forced_rls: 4,
    });

    const relation = await deploy!<Array<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>>`SELECT relrowsecurity,relforcerowsecurity FROM pg_class
      WHERE oid='public.india_gst_recipient_sez_status'::regclass`;
    expect(relation).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }]);

    const constraints = await deploy!<Array<{
      name: string;
      type: string;
      definition: string;
    }>>`SELECT conname name,contype::text type,pg_get_constraintdef(oid) definition
      FROM pg_constraint
      WHERE conrelid='public.india_gst_recipient_sez_status'::regclass`;
    expect(constraints.map(({ name }) => name).sort()).toEqual([
      "india_gst_recipient_sez_status_approval_shape_ck",
      "india_gst_recipient_sez_status_identity_uq",
      "india_gst_recipient_sez_status_legal_rule_ck",
      "india_gst_recipient_sez_status_pk",
      "india_gst_recipient_sez_status_recipient_hash_ck",
      "india_gst_recipient_sez_status_registration_fk",
      "india_gst_recipient_sez_status_registration_status_ck",
      "india_gst_recipient_sez_status_source_ck",
      "india_gst_recipient_sez_status_status_hash_ck",
      "india_gst_recipient_sez_status_taxpayer_type_ck",
    ].sort());
    expect(constraints.some(({ type, definition }) =>
      type === "f" &&
      /FOREIGN KEY \(tenant_id, recipient_registration_id\) REFERENCES party_fiscal_registration\(tenant_id, id\)/i.test(definition)
    )).toBeTrue();
    expect(constraints.some(({ type, definition }) =>
      type === "u" &&
      /tenant_id.+recipient_registration_id.+recipient_registration_evidence_hash.+status_as_of/i.test(definition)
    )).toBeTrue();

    const grants = await deploy!<Array<{
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
      can_truncate: boolean;
    }>>`SELECT
      has_table_privilege('app_role','public.india_gst_recipient_sez_status','SELECT') can_select,
      has_table_privilege('app_role','public.india_gst_recipient_sez_status','INSERT') can_insert,
      has_table_privilege('app_role','public.india_gst_recipient_sez_status','UPDATE') can_update,
      has_table_privilege('app_role','public.india_gst_recipient_sez_status','DELETE') can_delete,
      has_table_privilege('app_role','public.india_gst_recipient_sez_status','TRUNCATE') can_truncate`;
    expect(grants[0]).toEqual({
      can_select: true, can_insert: false, can_update: false,
      can_delete: false, can_truncate: false,
    });
  });

  test("P8: exact regular, Form G, Form B and Form C evidence resolves with byte-identical replay", async () => {
    for (const [statusId, type, form, expectedStatus] of [
      [STATUS_REGULAR, "regular", null, "affirmatively_non_sez_regular"],
      [STATUS_UNIT, "sez_unit", "sez_rules_form_g", "sez_unit"],
      [STATUS_DEVELOPER_B, "sez_developer", "sez_rules_form_b", "sez_developer"],
      [STATUS_DEVELOPER_C, "sez_developer", "sez_rules_form_c", "sez_developer"],
    ] as const) {
      await clearStatuses();
      await seedStatus({ id: statusId, taxpayerType: type, approvalForm: form });
      const selected = input({ recipientSezStatusId: statusId });
      const first = await resolveDatabase(selected);
      const replay = await resolveDatabase(selected);
      expect(first).toEqual(replay);
      expect(JSON.stringify(first)).toBe(JSON.stringify(replay));
      expect(first.statusAsOf).toBe(STATUS_AS_OF);
      expect(first.sezStatus).toBe(expectedStatus);
      expect(first.gstRegistration).toEqual({
        status: "active", taxpayerType: type, source: "gst_common_portal",
        evidenceSha256: GST_STATUS_HASH,
      });
      if (form === null) {
        expect(first.approval).toBeNull();
      } else {
        expect(first.approval).toMatchObject({
          form,
          validity: { fromInclusive: VALIDITY_FROM, toExclusive: VALIDITY_TO },
          status: "in_force",
          evidenceSha256: APPROVAL_HASH,
        });
      }
      expectDeepFrozen(first);
    }
  });

  test("P9: exact identity, absence, stale registration bytes and cross-tenant associations fail closed", async () => {
    await clearStatuses();
    await expect(resolveDatabase()).rejects
      .toBeInstanceOf(IndiaGstRecipientSezStatusNotFoundError);
    await seedStatus({ id: STATUS_REGULAR });
    for (const unavailable of [
      input({ recipientSezStatusId: STATUS_UNIT }),
      input({ recipientRegistrationId: REGISTRATION_A_OTHER }),
      input({ recipientPartyId: PARTY_A_OTHER }),
    ]) {
      await expect(resolveDatabase(unavailable)).rejects.toThrow();
    }
    await expect(resolveDatabase(input(), TENANT_B)).rejects.toThrow();

    await deploy!`UPDATE party_fiscal_registration SET legal_name='Changed current bytes'
      WHERE tenant_id=${TENANT_A}::uuid AND id=${REGISTRATION_A}::uuid`;
    await expect(resolveDatabase()).rejects
      .toBeInstanceOf(IndiaGstRecipientSezStatusNotFoundError);
    await deploy!`UPDATE party_fiscal_registration
      SET legal_name='Order 285 Recipient Private Limited'
      WHERE tenant_id=${TENANT_A}::uuid AND id=${REGISTRATION_A}::uuid`;

    await clearStatuses();
    await seedStatus({ tenantId: TENANT_B, id: STATUS_B });
    await expect(resolveDatabase(input({ recipientSezStatusId: STATUS_B }))).rejects
      .toBeInstanceOf(IndiaGstRecipientSezStatusNotFoundError);
  });

  test("P10: unique/FK and every official-status/approval/date/hash rule reject defects", async () => {
    await clearStatuses();
    await seedStatus({ id: STATUS_REGULAR });
    await expectSqlState(seedStatus({ id: STATUS_UNIT }), "23505");
    await clearStatuses();

    const rejected: readonly StatusOptions[] = [
      { id: id(28571), registrationStatus: "suspended" },
      { id: id(28572), registrationStatus: "cancelled" },
      { id: id(28573), taxpayerType: "composition" },
      { id: id(28574), source: "party_profile" },
      { id: id(28575), statusEvidenceSha256: "A".repeat(64) },
      { id: id(28576), statusEvidenceSha256: "x".repeat(64) },
      { id: id(28577), recipientEvidenceHash: "A".repeat(64) },
      { id: id(28578), recipientEvidenceHash: "x".repeat(64) },
      { id: id(28579), taxpayerType: "regular", approvalForm: "sez_rules_form_g" },
      { id: id(28580), taxpayerType: "sez_unit", approvalForm: "sez_rules_form_b" },
      { id: id(28581), taxpayerType: "sez_unit", approvalForm: "sez_rules_form_c" },
      { id: id(28582), taxpayerType: "sez_developer", approvalForm: "sez_rules_form_g" },
      { id: id(28583), taxpayerType: "sez_unit", approvalReference: "" },
      { id: id(28584), taxpayerType: "sez_unit", approvalReference: " leading" },
      { id: id(28595), taxpayerType: "sez_unit", approvalReference: "LOA/285\n2038" },
      { id: id(28585), taxpayerType: "sez_unit", approvalValidity: "empty" },
      { id: id(28586), taxpayerType: "sez_unit", approvalValidity: "[,2039-01-01)" },
      { id: id(28587), taxpayerType: "sez_unit", approvalValidity: "[2038-01-01,)" },
      { id: id(28588), taxpayerType: "sez_unit", statusAsOf: "2039-01-01" },
      { id: id(28589), taxpayerType: "sez_unit", statusAsOf: "2037-12-31" },
      { id: id(28590), taxpayerType: "sez_unit", approvalStatus: "expired" },
      { id: id(28591), taxpayerType: "sez_unit", approvalEvidenceSha256: "A".repeat(64) },
      { id: id(28592), taxpayerType: "sez_unit", approvalEvidenceSha256: "x".repeat(64) },
      { id: id(28593), legalRule: "IGST_ACT_7_5_B" },
    ];
    for (const defect of rejected) {
      await expectSqlState(seedStatus(defect), "23514");
    }
    await expectSqlState(seedStatus({ id: id(28594), registrationId: id(28599) }), "23503");

    await seedStatus({
      id: STATUS_UNIT,
      taxpayerType: "sez_unit",
      statusAsOf: VALIDITY_FROM,
    });
    const lowerBoundary = await resolveDatabase(input({ recipientSezStatusId: STATUS_UNIT }));
    expect(lowerBoundary.statusAsOf).toBe(VALIDITY_FROM);
  });

  test("P11: forced RLS reveals only own tenant and app_role DML stays denied", async () => {
    await clearStatuses();
    const ownId = await seedStatus({ id: STATUS_REGULAR });
    const foreignId = await seedStatus({ tenantId: TENANT_B, id: STATUS_B });
    const visible = await database!.withTenantTransaction(TENANT_A, (tx) =>
      tx<Array<{ id: string }>>`
        SELECT id::text FROM india_gst_recipient_sez_status ORDER BY id`
    );
    expect(visible).toEqual([{ id: ownId }]);
    expect(visible.some(({ id }) => id === foreignId)).toBeFalse();

    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`INSERT INTO india_gst_recipient_sez_status(
        tenant_id,id,recipient_registration_id,recipient_registration_evidence_hash,
        status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,
        gst_status_evidence_sha256,legal_rule
      ) VALUES (
        ${TENANT_A}::uuid,${STATUS_UNIT}::uuid,${REGISTRATION_A}::uuid,
        ${recipient().evidenceHash},${STATUS_AS_OF}::date,'active','regular',
        'gst_common_portal',${GST_STATUS_HASH},${LEGAL_RULE}
      )`
    ), "42501");
    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`UPDATE india_gst_recipient_sez_status SET status_as_of='2038-05-16'
        WHERE tenant_id=${TENANT_A}::uuid AND id=${ownId}::uuid`
    ), "42501");
    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`DELETE FROM india_gst_recipient_sez_status
        WHERE tenant_id=${TENANT_A}::uuid AND id=${ownId}::uuid`
    ), "42501");
  });

  test("P12: Party/profile/address/role and misleading absence never substitute for official status", async () => {
    await clearStatuses();
    await expect(resolveDatabase()).rejects
      .toBeInstanceOf(IndiaGstRecipientSezStatusNotFoundError);
    await seedStatus({ id: STATUS_REGULAR });
    const before = await resolveDatabase();
    await deploy!`UPDATE party SET display_name='SEZ Unit Changed',
      legal_name='SEZ Developer Changed',attrs='{"sez":false,"SupTyp":"SEZWP","Pos":"29"}'::jsonb,
      vip_code='REGULAR'
      WHERE tenant_id=${TENANT_A}::uuid AND id=${PARTY_A}::uuid`;
    await deploy!`UPDATE party_role SET
      detail='{"sez_status":"developer","authorized_operations":false}'::jsonb
      WHERE tenant_id=${TENANT_A}::uuid AND party_id=${PARTY_A}::uuid`;
    await deploy!`UPDATE address SET lines=ARRAY['Changed non-SEZ address'],
      city='Bengaluru',region='29',postal_code='560001'
      WHERE tenant_id=${TENANT_A}::uuid AND party_id=${PARTY_A}::uuid`;
    const after = await resolveDatabase();
    expect(after).toEqual(before);
    expect(after.sezStatus).toBe("affirmatively_non_sez_regular");
  });

  test("P13: happy/replay/hostile failures preserve this root, Order276 and all protected effects", async () => {
    await clearStatuses();
    await seedStatus({ id: STATUS_UNIT, taxpayerType: "sez_unit" });
    const selected = input({ recipientSezStatusId: STATUS_UNIT });
    const before = await effects();
    await resolveDatabase(selected);
    await resolveDatabase(selected);
    await expect(resolveDatabase(input({ recipientSezStatusId: STATUS_REGULAR }))).rejects.toThrow();
    await expect(resolveDatabase(input({ recipientRegistrationId: REGISTRATION_A_OTHER }))).rejects.toThrow();
    await expect(resolveDatabase(input({ recipientPartyId: PARTY_A_OTHER }))).rejects.toThrow();
    expect(await effects()).toEqual(before);
  });
});

test("Order 285 P14: source is SELECT-only recipient-status evidence with forbidden canaries absent", async () => {
  const source = await Bun.file(new URL(
    "../src/contexts/tax-fiscal/india-gst-recipient-sez-status.ts",
    import.meta.url,
  )).text();
  expect(source).toContain("IndiaGstRecipientRegistrationService");
  expect(source).toContain(LEGAL_RULE);
  expect(source).toContain("gst_common_portal");
  expect(source).toContain("affirmatively_non_sez_regular");
  expect(source).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z_]|DELETE\s+FROM)\b/i);
  expect(source).not.toMatch(/\b(?:FOR\s+UPDATE|FOR\s+SHARE|pg_advisory|lock_financial_rows)\b/i);
  expect(source).not.toMatch(/\b(?:recordFact|publish|emit|idempotency|document_series)\b/i);
  expect(source).not.toMatch(/\b(?:journal|posting_line|fiscal_submission|outbox)\b/i);
  expect(source).not.toMatch(/\b(?:property_fiscal_registration|property_fiscal_location|registered_state|india_gst_item_classification)\b/i);
  expect(source).not.toMatch(/\b(?:authorized_operations|zero_rating|refund|SEZWP|SEZWOP|IgstOnIntra|reverse_charge)\b/i);
  expect(source).not.toMatch(/\b(?:intraState|interState|supplyNature|CGST|SGST|UTGST|levy)\b/);
  expect(source).not.toMatch(/\b(?:SupTyp|ItemList|SlNo|Qty|UnitPrice|GstRt|CgstAmt|SgstAmt|IgstAmt)\b/);
  expect(source).not.toMatch(/\b(?:account|reservation|folio|BuyerDtls|Pos|party_role|profile|config|SAC|tax_code)\b/);
});
