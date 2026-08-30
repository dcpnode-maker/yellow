import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { TaxJurisdictionResolutionService } from "../src/contexts/tax-fiscal";
import {
  Database,
  ExtensionRegistry,
  type ExtensionInstance,
  type Tx,
} from "../src/kernel";

const DEPLOY_DATABASE_URL =
  process.env.YELLOW_DEPLOY_DATABASE_URL ??
  process.env.YELLOW_TAX_JURISDICTION_RESOLUTION_URL;
const RUNTIME_DATABASE_URL =
  process.env.YELLOW_RUNTIME_DATABASE_URL ??
  process.env.YELLOW_TAX_JURISDICTION_RESOLUTION_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_TAX_JURISDICTION_RESOLUTION === "1";

if (REQUIRE_DATABASE && (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL)) {
  throw new Error(
    "deploy and runtime database URLs are required by the Order 238 proof",
  );
}

const TENANT_A = "00000000-0000-0000-0000-000000023801";
const TENANT_B = "00000000-0000-0000-0000-000000023802";
const PROPERTY_A = "00000000-0000-0000-0000-000000023811";
const PROPERTY_UNASSIGNED = "00000000-0000-0000-0000-000000023812";
const PROPERTY_FOREIGN = "00000000-0000-0000-0000-000000023813";
const MISSING_PROPERTY = "00000000-0000-0000-0000-000000023819";
const GLOBAL_EXTENSION = "00000000-0000-0000-0000-000000023821";
const TENANT_EXTENSION = "00000000-0000-0000-0000-000000023822";
const FOREIGN_EXTENSION = "00000000-0000-0000-0000-000000023823";

const GLOBAL_KEY = "order238-global";
const TENANT_KEY = "order238-tenant";
const FOREIGN_KEY = "order238-foreign";

type AssignmentRow = {
  readonly jurisdiction_key: unknown;
  readonly effective_from: unknown;
  readonly effective_to: unknown;
};

interface FakeTxOptions {
  readonly propertyRows?: readonly Record<string, unknown>[];
  readonly assignmentRows?: readonly AssignmentRow[];
}

function fakeTx(options: FakeTxOptions = {}) {
  const statements: string[] = [];
  const tx = (async (strings: TemplateStringsArray) => {
    const statement = strings.join("?");
    statements.push(statement);
    if (/FROM\s+org_node/i.test(statement)) {
      return options.propertyRows ?? [{
        tenant_id: TENANT_A,
        property_timezone: "UTC",
        business_day_from_instant: "2026-01-01T00:00:00.000000Z",
        business_day_to_instant: "2026-01-02T00:00:00.000000Z",
      }];
    }
    if (/FROM\s+tax_assignment/i.test(statement)) {
      return options.assignmentRows ?? [];
    }
    throw new Error(`unexpected Order 238 SQL: ${statement}`);
  }) as unknown as Tx;
  return { tx, statements };
}

function extension(
  overrides: Partial<ExtensionInstance> = {},
): ExtensionInstance {
  return {
    id: GLOBAL_EXTENSION,
    tenantId: null,
    type: "tax_jurisdiction",
    key: GLOBAL_KEY,
    version: 1,
    content: { country: "IN", taxes: [] },
    status: "active",
    ...overrides,
  };
}

function serviceWith(
  visible: readonly ExtensionInstance[],
  calls: string[] = [],
): TaxJurisdictionResolutionService {
  const registry = {
    async listVisible(tenantId: string) {
      calls.push(tenantId);
      return visible;
    },
    async readVisibleEffectivePeriod(tenantId: string, extensionId: string) {
      const selected = visible.find((candidate) => candidate.id === extensionId);
      if (!selected || (selected.tenantId !== null && selected.tenantId !== tenantId)) {
        throw new Error("mock effective-period row is not visible");
      }
      return Object.freeze({
        extensionId,
        ownerTenantId: selected.tenantId,
        effectiveFromInstant: "2026-01-01T00:00:00.000000Z",
        effectiveToInstant: null,
      });
    },
  } as unknown as ExtensionRegistry;
  return new TaxJurisdictionResolutionService(registry);
}

function assignment(
  overrides: Partial<AssignmentRow> = {},
): AssignmentRow {
  return {
    jurisdiction_key: GLOBAL_KEY,
    effective_from: "2026-01-01",
    effective_to: null,
    ...overrides,
  };
}

function isDeeplyFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every((child) => isDeeplyFrozen(child, seen));
}

describe("Order 238 effective tax-jurisdiction resolver pure contract", () => {
  test("P1/P2: no assignment returns explicit frozen unassigned truth without reading extensions", async () => {
    const registryCalls: string[] = [];
    const service = serviceWith([], registryCalls);
    const { tx, statements } = fakeTx();

    const result = await service.resolve(tx, {
      propertyNode: PROPERTY_A,
      businessDate: "2026-01-01",
    });

    expect(result).toEqual({
      state: "unassigned",
      tenantId: TENANT_A,
      propertyNode: PROPERTY_A,
      businessDate: "2026-01-01",
      propertyTimezone: "UTC",
      businessDayFromInstant: "2026-01-01T00:00:00.000000Z",
      businessDayToInstant: "2026-01-02T00:00:00.000000Z",
    });
    expect(isDeeplyFrozen(result)).toBe(true);
    expect(registryCalls).toEqual([]);
    expect(statements).toHaveLength(2);
  });

  test("P3/P5: exactly one matching active visible version resolves through one derived-tenant adapter read", async () => {
    const registryCalls: string[] = [];
    const visible = [
      extension({ id: "00000000-0000-0000-0000-000000023831", key: "wrong-key" }),
      extension({ id: "00000000-0000-0000-0000-000000023832", type: "policy" }),
      extension({ id: "00000000-0000-0000-0000-000000023833", status: "draft" }),
      extension({ id: "00000000-0000-0000-0000-000000023834", status: "retired" }),
      extension(),
    ];
    const service = serviceWith(visible, registryCalls);
    const { tx } = fakeTx({ assignmentRows: [assignment()] });

    const result = await service.resolve(tx, {
      propertyNode: PROPERTY_A,
      businessDate: "2026-06-30",
    });

    expect(result.state).toBe("resolved");
    if (result.state !== "resolved") throw new Error("expected resolved jurisdiction");
    expect(result.tenantId).toBe(TENANT_A);
    expect(result.assignment).toMatchObject({
      jurisdictionKey: GLOBAL_KEY,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
    });
    expect(result.jurisdiction).toMatchObject({
      extensionId: GLOBAL_EXTENSION,
      ownerTenantId: null,
      key: GLOBAL_KEY,
      version: 1,
      effectiveFromInstant: "2026-01-01T00:00:00.000000Z",
      effectiveToInstant: null,
    });
    expect(registryCalls).toEqual([TENANT_A]);
  });

  test("P3: tenant-owned versions resolve without inventing global precedence", async () => {
    const service = serviceWith([
      extension({
        id: TENANT_EXTENSION,
        tenantId: TENANT_A,
        key: TENANT_KEY,
        version: 7,
        content: { country: "AE", taxes: [] },
      }),
    ]);
    const { tx } = fakeTx({
      assignmentRows: [assignment({ jurisdiction_key: TENANT_KEY })],
    });

    const result = await service.resolve(tx, {
      propertyNode: PROPERTY_A,
      businessDate: "2026-07-01",
    });

    expect(result.state).toBe("resolved");
    if (result.state !== "resolved") throw new Error("expected resolved jurisdiction");
    expect(result.jurisdiction).toMatchObject({
      extensionId: TENANT_EXTENSION,
      ownerTenantId: TENANT_A,
      key: TENANT_KEY,
      version: 7,
      effectiveFromInstant: "2026-01-01T00:00:00.000000Z",
      effectiveToInstant: null,
    });
  });

  test("P3: missing or multiple matching active versions fail closed", async () => {
    const input = { propertyNode: PROPERTY_A, businessDate: "2026-01-01" };
    const missing = serviceWith([
      extension({ key: "wrong-key" }),
      extension({ status: "draft" }),
      extension({ status: "retired" }),
    ]);
    const missingTx = fakeTx({ assignmentRows: [assignment()] }).tx;
    await expect(missing.resolve(missingTx, input)).rejects.toThrow();

    const multiple = serviceWith([
      extension(),
      extension({
        id: TENANT_EXTENSION,
        tenantId: TENANT_A,
        version: 2,
      }),
    ]);
    const multipleTx = fakeTx({ assignmentRows: [assignment()] }).tx;
    await expect(multiple.resolve(multipleTx, input)).rejects.toThrow();
  });

  test("P4: canonical content hash, evidence and recursively copied frozen content are stable", async () => {
    const sourceContent = {
      taxes: [{ z: 2, a: 1 }],
      country: "IN",
      nested: { z: true, a: [3, 2, 1] },
    };
    const service = serviceWith([extension({ content: sourceContent })]);
    const input = { propertyNode: PROPERTY_A, businessDate: "2026-01-01" };
    const first = await service.resolve(
      fakeTx({ assignmentRows: [assignment()] }).tx,
      input,
    );
    const second = await service.resolve(
      fakeTx({ assignmentRows: [assignment()] }).tx,
      input,
    );

    expect(first).toEqual(second);
    expect(first.state).toBe("resolved");
    if (first.state !== "resolved") throw new Error("expected resolved jurisdiction");
    const canonical =
      '{"country":"IN","nested":{"a":[3,2,1],"z":true},"taxes":[{"a":1,"z":2}]}';
    const expectedHash = createHash("sha256").update(canonical).digest("hex");
    expect(first.jurisdiction.contentHash).toBe(expectedHash);
    expect(first.assignment.evidenceRef).toBeDefined();
    expect(first.assignment.evidenceRef).toBe(second.state === "resolved"
      ? second.assignment.evidenceRef
      : "");
    expect(first.jurisdiction.evidenceRef).toBe(second.state === "resolved"
      ? second.jurisdiction.evidenceRef
      : "");
    expect(first.jurisdiction.content).not.toBe(sourceContent);
    expect(isDeeplyFrozen(first)).toBe(true);

    sourceContent.nested.a[0] = 99;
    sourceContent.taxes[0]!.a = 99;
    expect(first.jurisdiction.content).toEqual({
      country: "IN",
      nested: { a: [3, 2, 1], z: true },
      taxes: [{ a: 1, z: 2 }],
    });
  });

  test("P6: malformed targets fail before SQL or registry access", async () => {
    const registryCalls: string[] = [];
    const service = serviceWith([], registryCalls);
    const hostile = [
      { propertyNode: "not-a-uuid", businessDate: "2026-01-01" },
      { propertyNode: PROPERTY_A, businessDate: "2026-02-29" },
      { propertyNode: PROPERTY_A, businessDate: "2026-00-10" },
      { propertyNode: PROPERTY_A, businessDate: "2026-01-01T00:00:00Z" },
      { propertyNode: PROPERTY_A, businessDate: "2026-01-01", unexpected: true },
    ];

    for (const input of hostile) {
      const { tx, statements } = fakeTx();
      await expect(service.resolve(tx, input as never)).rejects.toThrow();
      expect(statements).toEqual([]);
    }
    expect(registryCalls).toEqual([]);
  });

  test("P6: hostile stored assignment and visible-extension shapes never return partial evidence", async () => {
    const badAssignments = [
      assignment({ jurisdiction_key: "" }),
      assignment({ effective_from: "not-a-date" }),
      assignment({ effective_to: "2026-02-30" }),
    ];
    for (const row of badAssignments) {
      const service = serviceWith([extension()]);
      await expect(service.resolve(
        fakeTx({ assignmentRows: [row] }).tx,
        { propertyNode: PROPERTY_A, businessDate: "2026-01-01" },
      )).rejects.toThrow();
    }

    const badVisible = [
      extension({ id: "not-a-uuid" }),
      extension({ version: 0 }),
      extension({ content: { country: undefined } }),
    ];
    for (const stored of badVisible) {
      const service = serviceWith([stored]);
      await expect(service.resolve(
        fakeTx({ assignmentRows: [assignment()] }).tx,
        { propertyNode: PROPERTY_A, businessDate: "2026-01-01" },
      )).rejects.toThrow();
    }
  });

  test("Order300 P3/P4: malformed property-day rows fail closed and the envelope changes evidence", async () => {
    const badRows = [
      { tenant_id: TENANT_A, property_timezone: "", business_day_from_instant: "2026-01-01T00:00:00.000000Z", business_day_to_instant: "2026-01-02T00:00:00.000000Z" },
      { tenant_id: TENANT_A, property_timezone: " UTC", business_day_from_instant: "2026-01-01T00:00:00.000000Z", business_day_to_instant: "2026-01-02T00:00:00.000000Z" },
      { tenant_id: TENANT_A, property_timezone: "UTC", business_day_from_instant: "2026-01-01T00:00:00Z", business_day_to_instant: "2026-01-02T00:00:00.000000Z" },
      { tenant_id: TENANT_A, property_timezone: "UTC", business_day_from_instant: "2026-01-02T00:00:00.000000Z", business_day_to_instant: "2026-01-01T00:00:00.000000Z" },
    ];
    for (const row of badRows) {
      await expect(serviceWith([]).resolve(fakeTx({ propertyRows: [row] }).tx,
        { propertyNode: PROPERTY_A, businessDate: "2026-01-01" })).rejects.toThrow();
    }

    const resolveWith = (
      property_timezone: string,
      business_day_from_instant: string,
      business_day_to_instant: string,
    ) =>
      serviceWith([extension()]).resolve(fakeTx({
        propertyRows: [{ tenant_id: TENANT_A, property_timezone,
          business_day_from_instant, business_day_to_instant }],
        assignmentRows: [assignment()],
      }).tx, { propertyNode: PROPERTY_A, businessDate: "2026-01-01" });
    const baseline = await resolveWith(
      "UTC", "2026-01-01T00:00:00.000000Z", "2026-01-02T00:00:00.000000Z",
    );
    const changedTimezoneOnly = await resolveWith(
      "Etc/UTC", "2026-01-01T00:00:00.000000Z", "2026-01-02T00:00:00.000000Z",
    );
    const changedLowerOnly = await resolveWith(
      "UTC", "2026-01-01T00:00:01.000000Z", "2026-01-02T00:00:00.000000Z",
    );
    const changedUpperOnly = await resolveWith(
      "UTC", "2026-01-01T00:00:00.000000Z", "2026-01-02T00:00:01.000000Z",
    );
    if (baseline.state !== "resolved" || changedTimezoneOnly.state !== "resolved"
        || changedLowerOnly.state !== "resolved" || changedUpperOnly.state !== "resolved") {
      throw new Error("expected resolved");
    }
    for (const changed of [changedTimezoneOnly, changedLowerOnly, changedUpperOnly]) {
      expect(baseline.assignment.evidenceRef).not.toBe(changed.assignment.evidenceRef);
      expect(baseline.jurisdiction.evidenceRef).not.toBe(changed.jurisdiction.evidenceRef);
      expect(isDeeplyFrozen(changed)).toBe(true);
    }
  });
});

const databaseDescribe = DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL
  ? describe.serial
  : describe.skip;
let admin: SQL | undefined;
let runtimePool: SQL | undefined;
let database: Database | undefined;
let databaseService: TaxJurisdictionResolutionService | undefined;

async function cleanDatabaseFixture(): Promise<void> {
  if (!admin) return;
  await admin`
    DELETE FROM tax_assignment
    WHERE property_node IN (
      ${PROPERTY_A}::uuid,
      ${PROPERTY_UNASSIGNED}::uuid,
      ${PROPERTY_FOREIGN}::uuid
    )
  `;
  await admin`
    DELETE FROM extension
    WHERE id IN (
      ${GLOBAL_EXTENSION}::uuid,
      ${TENANT_EXTENSION}::uuid,
      ${FOREIGN_EXTENSION}::uuid
    )
  `;
  await admin`
    DELETE FROM org_node
    WHERE id IN (
      ${PROPERTY_A}::uuid,
      ${PROPERTY_UNASSIGNED}::uuid,
      ${PROPERTY_FOREIGN}::uuid
    )
  `;
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
}

async function resolveDatabase(
  tenantId: string,
  propertyNode: string,
  businessDate: string,
) {
  return database!.withTenantTransaction(tenantId, (tx) =>
    databaseService!.resolve(tx, { propertyNode, businessDate })
  );
}

interface WriteSnapshot {
  readonly assignments: number;
  readonly extensions: number;
  readonly facts: number;
  readonly outbox: number;
  readonly journals: number;
  readonly postings: number;
  readonly series: number;
  readonly documents: number;
  readonly submissions: number;
}

async function writeSnapshot(): Promise<WriteSnapshot> {
  const rows = await admin!<WriteSnapshot[]>`
    SELECT
      (SELECT count(*)::int FROM tax_assignment
        WHERE property_node IN (${PROPERTY_A}::uuid, ${PROPERTY_UNASSIGNED}::uuid)) AS assignments,
      (SELECT count(*)::int FROM extension
        WHERE id IN (${GLOBAL_EXTENSION}::uuid, ${TENANT_EXTENSION}::uuid)) AS extensions,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id = ${TENANT_A}::uuid) AS facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id = ${TENANT_A}::uuid) AS outbox,
      (SELECT count(*)::int FROM journal WHERE tenant_id = ${TENANT_A}::uuid) AS journals,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id = ${TENANT_A}::uuid) AS postings,
      (SELECT count(*)::int FROM document_series WHERE tenant_id = ${TENANT_A}::uuid) AS series,
      (SELECT count(*)::int FROM document WHERE tenant_id = ${TENANT_A}::uuid) AS documents,
      (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id = ${TENANT_A}::uuid) AS submissions
  `;
  return rows[0]!;
}

beforeAll(async () => {
  if (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL) return;
  admin = new SQL(DEPLOY_DATABASE_URL, { max: 4, prepare: false });
  runtimePool = new SQL(RUNTIME_DATABASE_URL, { max: 6, prepare: false });
  database = Database.connect(RUNTIME_DATABASE_URL, { maxConnections: 8, prepare: false });
  databaseService = new TaxJurisdictionResolutionService(
    new ExtensionRegistry(runtimePool),
  );

  await cleanDatabaseFixture();
  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES
      (${TENANT_A}::uuid, 'order238-a', 'Order 238 A', 'shared', 'active'),
      (${TENANT_B}::uuid, 'order238-b', 'Order 238 B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order238_a.property', 'property', 'Order 238 A', 'UTC', 'INR'),
      (${PROPERTY_UNASSIGNED}::uuid, ${TENANT_A}::uuid, 'order238_a.unassigned', 'property', 'Order 238 Unassigned', 'UTC', 'INR'),
      (${PROPERTY_FOREIGN}::uuid, ${TENANT_B}::uuid, 'order238_b.property', 'property', 'Order 238 Foreign', 'UTC', 'AED')
  `;
  await admin`
    INSERT INTO extension (id, tenant_id, type, key, version, content, status)
    VALUES
      (${GLOBAL_EXTENSION}::uuid, NULL, 'tax_jurisdiction', ${GLOBAL_KEY}, 1,
        '{"country":"IN","price_display":"tax_exclusive","rounding":"document","taxes":[]}'::jsonb, 'active'),
      (${TENANT_EXTENSION}::uuid, ${TENANT_A}::uuid, 'tax_jurisdiction', ${TENANT_KEY}, 7,
        '{"country":"IN","price_display":"tax_exclusive","rounding":"line","taxes":[]}'::jsonb, 'active'),
      (${FOREIGN_EXTENSION}::uuid, ${TENANT_B}::uuid, 'tax_jurisdiction', ${FOREIGN_KEY}, 1,
        '{"country":"AE","price_display":"tax_inclusive","rounding":"line","taxes":[]}'::jsonb, 'active')
  `;
  await admin`
    INSERT INTO tax_assignment (tenant_id, property_node, jurisdiction_key, effective)
    VALUES
      (${TENANT_A}::uuid, ${PROPERTY_A}::uuid, ${GLOBAL_KEY}, daterange('2026-01-01', '2026-02-01', '[)')),
      (${TENANT_A}::uuid, ${PROPERTY_A}::uuid, ${TENANT_KEY}, daterange('2026-02-01', NULL, '[)')),
      (${TENANT_B}::uuid, ${PROPERTY_FOREIGN}::uuid, ${FOREIGN_KEY}, daterange('2026-01-01', NULL, '[)'))
  `;
});

afterAll(async () => {
  await cleanDatabaseFixture();
  await database?.close();
  await runtimePool?.close();
  await admin?.close();
});

databaseDescribe("Order 238 PostgreSQL assignment and containment proof", () => {
  test("Order300 P1: PostgreSQL derives exact UTC, Kolkata, DST and Kathmandu local-day bounds", async () => {
    const cases = [
      ["UTC", "2026-01-01", "2026-01-01T00:00:00.000000Z", "2026-01-02T00:00:00.000000Z"],
      ["Asia/Kolkata", "2026-01-01", "2025-12-31T18:30:00.000000Z", "2026-01-01T18:30:00.000000Z"],
      ["America/New_York", "2026-03-08", "2026-03-08T05:00:00.000000Z", "2026-03-09T04:00:00.000000Z"],
      ["America/New_York", "2026-11-01", "2026-11-01T04:00:00.000000Z", "2026-11-02T05:00:00.000000Z"],
      ["Asia/Kathmandu", "2026-01-01", "2025-12-31T18:15:00.000000Z", "2026-01-01T18:15:00.000000Z"],
    ] as const;
    try {
      for (const [timezone, businessDate, from, to] of cases) {
        await admin!`UPDATE org_node SET timezone = ${timezone} WHERE id = ${PROPERTY_UNASSIGNED}::uuid`;
        const result = await resolveDatabase(TENANT_A, PROPERTY_UNASSIGNED, businessDate);
        expect(result).toMatchObject({ state: "unassigned", propertyTimezone: timezone,
          businessDayFromInstant: from, businessDayToInstant: to });
      }
    } finally {
      await admin!`UPDATE org_node SET timezone = 'UTC' WHERE id = ${PROPERTY_UNASSIGNED}::uuid`;
    }
  });

  test("P1: lower-inclusive, upper-exclusive adjacent bounded/unbounded ranges resolve exactly", async () => {
    const lower = await resolveDatabase(TENANT_A, PROPERTY_A, "2026-01-01");
    const boundedLast = await resolveDatabase(TENANT_A, PROPERTY_A, "2026-01-31");
    const adjacentLower = await resolveDatabase(TENANT_A, PROPERTY_A, "2026-02-01");
    const unbounded = await resolveDatabase(TENANT_A, PROPERTY_A, "2099-12-31");

    expect(lower.state).toBe("resolved");
    expect(boundedLast.state).toBe("resolved");
    expect(adjacentLower.state).toBe("resolved");
    expect(unbounded.state).toBe("resolved");
    if (lower.state !== "resolved" || boundedLast.state !== "resolved" ||
        adjacentLower.state !== "resolved" || unbounded.state !== "resolved") {
      throw new Error("expected all boundary assignments to resolve");
    }
    expect(lower.assignment).toMatchObject({
      jurisdictionKey: GLOBAL_KEY,
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-02-01",
    });
    expect(boundedLast.assignment.jurisdictionKey).toBe(GLOBAL_KEY);
    expect(adjacentLower.assignment).toMatchObject({
      jurisdictionKey: TENANT_KEY,
      effectiveFrom: "2026-02-01",
      effectiveTo: null,
    });
    expect(unbounded.assignment.jurisdictionKey).toBe(TENANT_KEY);

    const before = await resolveDatabase(TENANT_A, PROPERTY_A, "2025-12-31");
    expect(before.state).toBe("unassigned");
  });

  test("P1: overlapping assignments fail closed", async () => {
    await admin!`
      INSERT INTO tax_assignment (tenant_id, property_node, jurisdiction_key, effective)
      VALUES (${TENANT_A}::uuid, ${PROPERTY_A}::uuid, ${GLOBAL_KEY}, daterange('2026-01-15', '2026-03-01', '[)'))
    `;
    try {
      await expect(resolveDatabase(TENANT_A, PROPERTY_A, "2026-01-20"))
        .rejects.toThrow();
    } finally {
      await admin!`
        DELETE FROM tax_assignment
        WHERE property_node = ${PROPERTY_A}::uuid
          AND effective = daterange('2026-01-15', '2026-03-01', '[)')
      `;
    }
  });

  test("P2: missing and foreign properties reveal no assignment or extension truth", async () => {
    await expect(resolveDatabase(TENANT_A, MISSING_PROPERTY, "2026-01-01"))
      .rejects.toThrow();
    await expect(resolveDatabase(TENANT_A, PROPERTY_FOREIGN, "2026-01-01"))
      .rejects.toThrow();

    const own = await resolveDatabase(TENANT_B, PROPERTY_FOREIGN, "2026-01-01");
    expect(own.state).toBe("resolved");
    if (own.state !== "resolved") throw new Error("expected foreign tenant's own resolution");
    expect(own.tenantId).toBe(TENANT_B);
    expect(own.assignment.jurisdictionKey).toBe(FOREIGN_KEY);
  });

  test("P4/P5/P7: evidence is stable, adapter authority is contained and reads write nothing", async () => {
    const capabilities = await admin!<Array<{
      public_execute: boolean;
      app_execute: boolean;
      runtime_execute: boolean;
    }>>`
      SELECT
        has_function_privilege('public', 'public.runtime_visible_extensions(uuid)', 'EXECUTE') AS public_execute,
        has_function_privilege('app_role', 'public.runtime_visible_extensions(uuid)', 'EXECUTE') AS app_execute,
        has_function_privilege('yellow_runtime', 'public.runtime_visible_extensions(uuid)', 'EXECUTE') AS runtime_execute
    `;
    expect(capabilities).toEqual([{
      public_execute: false,
      app_execute: false,
      runtime_execute: true,
    }]);

    const before = await writeSnapshot();
    const first = await resolveDatabase(TENANT_A, PROPERTY_A, "2026-02-01");
    const second = await resolveDatabase(TENANT_A, PROPERTY_A, "2026-02-01");
    const after = await writeSnapshot();

    expect(first).toEqual(second);
    expect(isDeeplyFrozen(first)).toBe(true);
    expect(after).toEqual(before);
  });
});
