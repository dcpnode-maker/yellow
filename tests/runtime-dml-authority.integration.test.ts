import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL, type ReservedSQL } from "bun";

const DEPLOY_URL = process.env.YELLOW_RUNTIME_DML_URL ?? process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RUNTIME_DML === "1";

if (REQUIRE_DATABASE && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("YELLOW_RUNTIME_DML_URL and YELLOW_RUNTIME_DATABASE_URL are required by Order 150 proof");
}

const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
let deploy: SQL | undefined;
let runtime: SQL | undefined;

const INSERT_COLUMNS = Object.freeze({
  account: ["currency", "name", "party_id", "property_node", "role", "status", "tenant_id"],
  api_idempotency: ["created_at", "expires_at", "key_hash", "operation", "request_hash", "tenant_id"],
  approval_request: ["kind", "payload", "requested_by", "subject_id", "subject_type", "tenant_id"],
  availability_projection: ["blocked", "held", "ooo", "physical", "property_node", "sold", "stay_date", "tenant_id", "unit_type_id", "updated_at"],
  contact_point: ["is_primary", "kind", "party_id", "tenant_id", "value", "verified"],
  deposit_application: ["amount_minor", "capture_payment_id", "created_by", "currency", "deposit_account_id", "folio_id", "guest_account_id", "hosted_request_id", "id", "journal_id", "key_hash", "operation_id", "property_node", "request_hash", "tenant_id"],
  extension: ["content", "key", "status", "tenant_id", "type", "version"],
  fact_log: ["actor_id", "business_date", "entity_id", "entity_type", "fact_type", "payload", "supersedes", "tenant_id", "valid_from"],
  folio: ["account_id", "folio_no", "name", "reservation_id", "status", "tenant_id", "window_no"],
  hold: ["expires_at", "holder", "kind", "period", "property_node", "sellable_unit_id", "tenant_id"],
  hosted_payment_request: ["amount_minor", "bearer_hash", "created_by", "currency", "deposit_account_id", "expires_at", "folio_id", "generation", "guest_account_id", "id", "key_hash", "operation_id", "property_node", "request_hash", "tenant_id"],
  journal: ["business_date", "created_by", "currency", "description", "kind", "property_node", "source", "tenant_id"],
  ooo_oos: ["kind", "period", "reason", "space_id", "tenant_id"],
  outbox: ["actor_id", "aggregate_id", "aggregate_type", "business_date", "causation_id", "correlation_id", "event_type", "event_version", "payload", "property_node", "tenant_id"],
  party: ["display_name", "kind", "legal_name", "tenant_id"],
  party_role: ["party_id", "role", "tenant_id"],
  payment: ["amount_minor", "attempt_no", "capture_journal_id", "capture_payment_id", "command_key_hash", "currency", "instrument_id", "journal_id", "method", "operation_id", "phase", "predecessor_payment_id", "psp", "psp_ref", "receipt_id", "request_hash", "result_code", "status", "tenant_id"],
  payment_operation: ["actor_id", "clearing_account_id", "currency", "deposit_account_id", "folio_id", "guest_account_id", "id", "instrument_id", "key_hash", "method", "property_node", "provider", "purpose", "request_hash", "tenant_id", "tx_code"],
  policy: ["content", "kind", "name", "tenant_id"],
  posting_line: ["account_id", "amount_minor", "business_date", "currency", "description", "folio_id", "journal_id", "quantity", "seq", "tenant_id", "tx_code"],
  provider_event_receipt: ["amount_minor", "content_hash", "currency", "event_id", "operation_id", "outcome", "phase", "provider", "provider_reference", "tenant_id"],
  rate_plan: ["cancellation_policy", "code", "currency", "deposit_policy", "guarantee_policy", "market_code", "name", "property_node", "source_code", "tax_inclusive", "tenant_id"],
  rate_price: ["dow_mask", "pricing", "rate_plan_id", "stay_dates", "tenant_id", "unit_type_id"],
  reservation: ["channel_code", "confirmation_no", "currency", "guarantee_policy", "id", "market_code", "primary_party", "property_node", "source_code", "status", "tenant_id"],
  reservation_guest: ["party_id", "reservation_id", "role", "share_pct", "tenant_id"],
  reservation_segment: ["adults", "children", "id", "period", "price_override", "rate_plan_id", "reservation_id", "sellable_unit_id", "seq", "status", "tenant_id", "unit_type_id"],
  restriction: ["channel_code", "kind", "rate_plan_id", "scope_node", "source", "stay_dates", "tenant_id", "unit_type_id", "value"],
  sellable_unit: ["name", "tenant_id", "unit_type_id"],
  sellable_unit_space: ["claim_mode", "sellable_unit_id", "space_id", "tenant_id"],
  space: ["area_sqm", "attrs", "capacity", "code", "floor", "gender_policy", "max_occupancy", "profile_key", "property_node", "tenant_id"],
  unit_type: ["attrs", "base_occupancy", "code", "max_occupancy", "name", "profile_key", "property_node", "sort_order", "tenant_id"],
} as const);

const UPDATE_COLUMNS = Object.freeze({
  api_idempotency: ["completed_at", "created_at", "expires_at", "request_hash", "response_body", "response_status"],
  approval_request: ["decided_at", "decided_by", "status"],
  document_series: ["next_no"],
  extension: ["status"],
  hold: ["status"],
  ooo_oos: ["period"],
  org_node: ["config"],
  rate_price: ["superseded_by"],
  reservation: ["cancel_reason", "cancellation_no", "cancelled_at", "eta", "etd", "market_code", "notes", "origin_code", "source_code", "status"],
  reservation_guest: ["role", "share_pct"],
  reservation_segment: ["period", "status"],
} as const);

const CALLER_SOURCES = Object.freeze<Record<string, string>>({
  "account:INSERT": "src/contexts/financials/folios.ts",
  "api_idempotency:INSERT": "src/kernel/idempotency.ts",
  "api_idempotency:UPDATE": "src/kernel/idempotency.ts",
  "approval_request:INSERT": "src/kernel/approval.ts",
  "approval_request:UPDATE": "src/kernel/approval.ts",
  "availability_projection:DELETE": "src/contexts/inventory/availability-projection.ts",
  "availability_projection:INSERT": "src/contexts/inventory/availability-projection.ts",
  "contact_point:INSERT": "src/contexts/crm/parties.ts",
  "deposit_application:INSERT": "src/contexts/financials/hosted-deposits.ts",
  "document_series:UPDATE": "src/contexts/financials/folios.ts",
  "extension:INSERT": "src/kernel/extension.ts",
  "extension:UPDATE": "src/contexts/rates/publication.ts",
  "fact_log:INSERT": "src/kernel/fact-log.ts",
  "folio:INSERT": "src/contexts/financials/folios.ts",
  "hold:INSERT": "src/contexts/inventory/holds.ts",
  "hold:UPDATE": "src/contexts/inventory/holds.ts",
  "hosted_payment_request:INSERT": "src/contexts/financials/hosted-deposits.ts",
  "journal:INSERT": "src/contexts/financials/postings.ts",
  "ooo_oos:INSERT": "src/contexts/inventory/operational-blocks.ts",
  "ooo_oos:UPDATE": "src/contexts/inventory/operational-blocks.ts",
  "org_node:UPDATE": "src/contexts/inventory/inventory-policy.ts",
  "outbox:INSERT": "src/kernel/outbox.ts",
  "party:INSERT": "src/contexts/crm/parties.ts",
  "party_role:INSERT": "src/contexts/crm/parties.ts",
  "payment:INSERT": "src/contexts/financials/payments.ts",
  "payment_operation:INSERT": "src/contexts/financials/payments.ts",
  "policy:INSERT": "src/contexts/rates/configuration.ts",
  "posting_line:INSERT": "src/contexts/financials/postings.ts",
  "provider_event_receipt:INSERT": "src/contexts/financials/payments.ts",
  "rate_plan:INSERT": "src/contexts/rates/configuration.ts",
  "rate_price:INSERT": "src/contexts/rates/pricing.ts",
  "rate_price:UPDATE": "src/contexts/rates/pricing.ts",
  "reservation:INSERT": "src/contexts/reservations/commit.ts",
  "reservation:UPDATE": "src/contexts/reservations/lifecycle.ts",
  "reservation_guest:DELETE": "src/contexts/reservations/guests.ts",
  "reservation_guest:INSERT": "src/contexts/reservations/commit.ts",
  "reservation_guest:UPDATE": "src/contexts/reservations/guests.ts",
  "reservation_segment:INSERT": "src/contexts/reservations/commit.ts",
  "reservation_segment:UPDATE": "src/contexts/reservations/segments.ts",
  "restriction:INSERT": "src/contexts/inventory/restrictions.ts",
  "sellable_unit:INSERT": "src/contexts/inventory/inventory.ts",
  "sellable_unit_space:INSERT": "src/contexts/inventory/inventory.ts",
  "space:INSERT": "src/contexts/inventory/inventory.ts",
  "unit_type:INSERT": "src/contexts/inventory/inventory.ts",
});

const RESIDUAL_CAPABILITY_OWNERS = Object.freeze({
  approval_decision: ["approval_request:UPDATE"],
  extension_lifecycle: ["extension:UPDATE"],
  financial_folio_opening: ["account:INSERT", "document_series:UPDATE", "folio:INSERT"],
  financial_posting: ["journal:INSERT", "posting_line:INSERT"],
  hold_lifecycle: ["hold:UPDATE"],
  inventory_policy_and_projection: ["availability_projection:DELETE", "availability_projection:INSERT", "org_node:UPDATE"],
  operational_block_lifecycle: ["ooo_oos:INSERT", "ooo_oos:UPDATE"],
  reservation_guest_replacement: ["reservation_guest:DELETE", "reservation_guest:INSERT", "reservation_guest:UPDATE"],
  reservation_lifecycle: ["reservation:UPDATE", "reservation_segment:INSERT", "reservation_segment:UPDATE"],
} as const);

const expectedColumnPrivileges = (): string[] => [
  ...Object.entries(INSERT_COLUMNS).flatMap(([table, columns]) => columns.map((column) => `${table}.${column}:INSERT`)),
  ...Object.entries(UPDATE_COLUMNS).flatMap(([table, columns]) => columns.map((column) => `${table}.${column}:UPDATE`)),
].sort();

async function actualColumnPrivileges(sql: SQL | ReservedSQL): Promise<string[]> {
  const rows = await sql<Array<{ table_name: string; column_name: string; privilege_type: string }>>`
    SELECT table_name, column_name, privilege_type
      FROM information_schema.column_privileges
     WHERE table_schema = 'public'
       AND grantee = 'app_role'
       AND privilege_type IN ('INSERT', 'UPDATE')
     ORDER BY table_name, column_name, privilege_type
  `;
  return rows.map(({ table_name, column_name, privilege_type }) => `${table_name}.${column_name}:${privilege_type}`).sort();
}

async function expectAppRoleDenied(statement: string): Promise<void> {
  try {
    await runtime!.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000000001', true)`;
      await tx.unsafe("SET LOCAL ROLE app_role");
      await tx.unsafe(statement);
    });
  } catch (error) {
    expect((error as { errno?: string }).errno).toBe("42501");
    return;
  }
  throw new Error(`Expected app_role privilege denial for: ${statement}`);
}

describe("Order 150 committed production caller map", () => {
  test("P3: every retained mutation has source evidence and protected transitions have named owners", async () => {
    const expectedCallerKeys = [
      ...Object.keys(INSERT_COLUMNS).map((table) => `${table}:INSERT`),
      ...Object.keys(UPDATE_COLUMNS).map((table) => `${table}:UPDATE`),
      "availability_projection:DELETE",
      "reservation_guest:DELETE",
    ].sort();
    expect(Object.keys(CALLER_SOURCES).sort()).toEqual(expectedCallerKeys);

    for (const [key, source] of Object.entries(CALLER_SOURCES)) {
      const [table, operation] = key.split(":") as [string, "INSERT" | "UPDATE" | "DELETE"];
      const verb = operation === "INSERT" ? "INSERT\\s+INTO" : operation === "DELETE" ? "DELETE\\s+FROM" : "UPDATE";
      const content = await Bun.file(new URL(`../${source}`, import.meta.url)).text();
      expect(new RegExp(`\\b${verb}\\s+${table}\\b`, "m").test(content)).toBe(true);
    }

    const namedResiduals = Object.values(RESIDUAL_CAPABILITY_OWNERS).flat().sort();
    expect(new Set(namedResiduals).size).toBe(namedResiduals.length);
    expect(namedResiduals).toEqual([
      "account:INSERT",
      "approval_request:UPDATE",
      "availability_projection:DELETE",
      "availability_projection:INSERT",
      "document_series:UPDATE",
      "extension:UPDATE",
      "folio:INSERT",
      "hold:UPDATE",
      "journal:INSERT",
      "ooo_oos:INSERT",
      "ooo_oos:UPDATE",
      "org_node:UPDATE",
      "posting_line:INSERT",
      "reservation:UPDATE",
      "reservation_guest:DELETE",
      "reservation_guest:INSERT",
      "reservation_guest:UPDATE",
      "reservation_segment:INSERT",
      "reservation_segment:UPDATE",
    ]);
  });
});

databaseDescribe("Order 150 positive runtime DML authority", () => {
  beforeAll(() => {
    deploy = new SQL(DEPLOY_URL!);
    runtime = new SQL(RUNTIME_URL!);
  });

  afterAll(async () => {
    await deploy?.close();
    await runtime?.close();
  });

  test("P1: effective table and column mutation catalogue is exact", async () => {
    const tableRows = await deploy!<Array<{ table_name: string; privilege_type: string }>>`
      SELECT table_name, privilege_type
        FROM information_schema.role_table_grants
       WHERE table_schema = 'public'
         AND grantee = 'app_role'
         AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
       ORDER BY table_name, privilege_type
    `;
    expect(tableRows.map(({ table_name, privilege_type }) => `${table_name}:${privilege_type}`)).toEqual([
      "availability_projection:DELETE",
      "reservation_guest:DELETE",
    ]);
    expect(await actualColumnPrivileges(deploy!)).toEqual(expectedColumnPrivileges());
    expect((await deploy!<Array<{ allowed: boolean }>>`
      SELECT has_column_privilege('app_role','public.journal','reverses','INSERT') AS allowed
    `)[0]).toEqual({ allowed: false });
    expect((await deploy!<Array<{ insertAllowed: boolean; updateAllowed: boolean }>>`
      SELECT has_column_privilege(
               'app_role','public.journal','approval_request_id','INSERT'
             ) AS "insertAllowed",
             has_column_privilege(
               'app_role','public.journal','approval_request_id','UPDATE'
             ) AS "updateAllowed"
    `)[0]).toEqual({ insertAllowed: false, updateAllowed: false });
    expect((await deploy!<Array<{ insertAllowed: boolean; updateAllowed: boolean }>>`
      SELECT has_column_privilege(
               'app_role','public.posting_line','folio_transfer_root_line_id','INSERT'
             ) AS "insertAllowed",
             has_column_privilege(
               'app_role','public.posting_line','folio_transfer_root_line_id','UPDATE'
             ) AS "updateAllowed"
    `)[0]).toEqual({ insertAllowed: false, updateAllowed: false });
  });

  test("P1: sequences, views, default ACLs and protected functions remain bounded", async () => {
    const sequenceMutation = await deploy!<Array<{ sequence_name: string }>>`
      SELECT c.relname AS sequence_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'S'
         AND (has_sequence_privilege('app_role', c.oid, 'USAGE')
           OR has_sequence_privilege('app_role', c.oid, 'UPDATE'))
    `;
    expect(sequenceMutation).toEqual([]);

    const viewMutation = await deploy!<Array<{ view_name: string }>>`
      SELECT c.relname AS view_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
         AND (has_table_privilege('app_role', c.oid, 'INSERT')
           OR has_table_privilege('app_role', c.oid, 'UPDATE')
           OR has_table_privilege('app_role', c.oid, 'DELETE')
           OR has_table_privilege('app_role', c.oid, 'TRUNCATE'))
    `;
    expect(viewMutation).toEqual([]);

    const defaultMutation = await deploy!<Array<{ owner: string; object_type: string; privilege_type: string }>>`
      SELECT owner.rolname AS owner, defaults.defaclobjtype::text AS object_type,
             privilege.privilege_type
        FROM pg_default_acl defaults
        JOIN pg_roles owner ON owner.oid = defaults.defaclrole
        CROSS JOIN LATERAL aclexplode(COALESCE(defaults.defaclacl, acldefault(defaults.defaclobjtype, defaults.defaclrole))) privilege
        JOIN pg_roles grantee ON grantee.oid = privilege.grantee
       WHERE grantee.rolname = 'app_role'
         AND privilege.privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    `;
    expect(defaultMutation).toEqual([]);

    const functions = await deploy!<Array<{ signature: string; app: boolean; runtime: boolean; registrar: boolean }>>`
      SELECT p.oid::regprocedure::text AS signature,
             has_function_privilege('app_role', p.oid, 'EXECUTE') AS app,
             has_function_privilege('yellow_runtime', p.oid, 'EXECUTE') AS runtime,
             has_function_privilege('yellow_extension_registrar', p.oid, 'EXECUTE') AS registrar
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
          AND p.proname IN ('record_occupancy', 'release_occupancy', 'seal_business_day',
            'lock_financial_rows', 'lock_financial_business_days', 'create_charge_correction_header',
            'create_positive_tax_correction_header', 'record_positive_tax_correction_root',
            'create_folio_transfer', 'create_receivable_transfer',
            'govern_housekeeping_task_sheet', 'initialize_unit_condition',
            'report_room_discrepancy',
            'transition_arrival_pickup_task', 'create_arrival_room_cleaning_task',
            'assign_due_in_room',
            'open_cashier_session', 'append_cashier_count', 'close_cashier_session',
           'runtime_resolve_active_tenant', 'runtime_due_arrival_scopes', 'runtime_due_departure_scopes',
           'runtime_due_hold_scopes',
           'runtime_consumer_begin',
           'runtime_consumer_read', 'runtime_consumer_mark', 'runtime_consumer_advance',
           'runtime_mark_outbox_published', 'runtime_prune_outbox', 'runtime_visible_extensions',
           'runtime_extension_compatibility_inputs', 'assert_journal_balanced',
           'derive_posting_line_currency', 'register_extension_type')
       ORDER BY signature
    `;
    const occupancyFunctions = functions.filter(({ signature }) =>
      signature.startsWith("record_occupancy(") || signature.startsWith("release_occupancy(")
    );
    const privateParkingChoke = occupancyFunctions.find(({ signature }) =>
      signature === "record_occupancy(uuid,uuid,tstzrange,uuid,text,boolean,uuid)"
    );
    expect(privateParkingChoke).toEqual(expect.objectContaining({ app: false, runtime: false }));
    expect(occupancyFunctions.filter((entry) => entry !== privateParkingChoke)
      .every(({ app, runtime }) => app && !runtime)).toBe(true);
    expect(functions.find(({ signature }) => signature.startsWith("lock_financial_rows(")))
      .toEqual(expect.objectContaining({ app: true, runtime: false }));
    expect(functions.find(({ signature }) => signature.startsWith("lock_financial_business_days(")))
      .toEqual(expect.objectContaining({ app: true, runtime: false }));
    expect(functions.find(({ signature }) => signature.startsWith("create_charge_correction_header(")))
      .toEqual(expect.objectContaining({ app: true, runtime: false }));
    for (const capability of [
      "create_positive_tax_correction_header(", "record_positive_tax_correction_root(",
    ]) {
      expect(functions.find(({ signature }) => signature.startsWith(capability)))
        .toEqual(expect.objectContaining({ app: true, runtime: false }));
    }
    expect(functions.find(({ signature }) => signature.startsWith("create_folio_transfer(")))
      .toEqual(expect.objectContaining({ app: true, runtime: false }));
    expect(functions.find(({ signature }) => signature.startsWith("create_receivable_transfer(")))
      .toEqual(expect.objectContaining({ app: true, runtime: false }));
    expect(functions.find(({ signature }) => signature.startsWith("initialize_unit_condition(")))
      .toEqual(expect.objectContaining({ app: true, runtime: false }));
    expect(functions.find(({ signature }) => signature.startsWith("transition_arrival_pickup_task(")))
      .toEqual(expect.objectContaining({ app: true, runtime: false }));
    expect(functions.find(({ signature }) => signature.startsWith("create_arrival_room_cleaning_task(")))
      .toEqual(expect.objectContaining({ app: true, runtime: false }));
    expect(functions.find(({ signature }) => signature.startsWith("assign_due_in_room(")))
      .toEqual(expect.objectContaining({ app: true, runtime: false }));
    expect(functions.find(({ signature }) => signature.startsWith("govern_housekeeping_task_sheet(")))
      .toEqual(expect.objectContaining({ app: true, runtime: false }));
    expect(functions.find(({ signature }) => signature.startsWith("report_room_discrepancy(")))
      .toEqual(expect.objectContaining({ app: true, runtime: false }));
    for (const capability of [
      "open_cashier_session(", "append_cashier_count(", "close_cashier_session(",
    ]) {
      expect(functions.find(({ signature }) => signature.startsWith(capability)))
        .toEqual(expect.objectContaining({ app: true, runtime: false }));
    }
    const runtimeFunctions = functions.filter(({ signature }) => signature.startsWith("runtime_"));
    expect(runtimeFunctions).toHaveLength(12);
    expect(runtimeFunctions.every(({ app, runtime }) => !app && runtime)).toBe(true);
    expect(functions.find(({ signature }) => signature.startsWith("register_extension_type(")))
      .toEqual(expect.objectContaining({ app: false, runtime: false, registrar: true }));
    expect(functions.find(({ signature }) => signature.startsWith("seal_business_day("))).toEqual(expect.objectContaining({ app: false }));
    const triggerFunctions = functions.filter(({ signature }) =>
      signature.startsWith("assert_journal_balanced(") || signature.startsWith("derive_posting_line_currency(")
    );
    expect(triggerFunctions.every(({ app, runtime }) => !app && !runtime)).toBe(true);
  });

  test("P0/P1: global, identity, immutable, broad-price, relay and occupancy attacks fail closed", async () => {
    await expectAppRoleDenied("UPDATE public.tenant SET name = name WHERE false");
    await expectAppRoleDenied("INSERT INTO public.tenant (id, slug, name) VALUES ('00000000-0000-0000-0000-000000000901', 'order150-hostile', 'Hostile')");
    await expectAppRoleDenied("INSERT INTO public.org_node (id, tenant_id, path, kind, name) VALUES ('00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000001', 'order150.hostile', 'property', 'Hostile')");
    await expectAppRoleDenied("INSERT INTO public.permission (code, description) VALUES ('identity.order150:hostile', 'Hostile')");
    await expectAppRoleDenied("UPDATE public.document SET content = '{}'::jsonb WHERE false");
    await expectAppRoleDenied("INSERT INTO public.property_fiscal_registration DEFAULT VALUES");
    await expectAppRoleDenied("INSERT INTO public.property_fiscal_location DEFAULT VALUES");
    await expectAppRoleDenied("INSERT INTO public.india_gst_item_classification DEFAULT VALUES");
    await expectAppRoleDenied("INSERT INTO public.india_gst_supplier_service_location DEFAULT VALUES");
    await expectAppRoleDenied("INSERT INTO public.india_gst_recipient_sez_status DEFAULT VALUES");
    await expectAppRoleDenied("INSERT INTO public.india_gst_supplier_sez_status DEFAULT VALUES");
    await expectAppRoleDenied("INSERT INTO public.india_sez_unit_loa_renewal DEFAULT VALUES");
    await expectAppRoleDenied("INSERT INTO public.india_gst_supplier_registration_status_snapshot DEFAULT VALUES");
    await expectAppRoleDenied("INSERT INTO public.party_fiscal_registration DEFAULT VALUES");
    await expectAppRoleDenied("UPDATE public.rate_price SET pricing = '{}'::jsonb WHERE false");
    await expectAppRoleDenied("INSERT INTO public.channel (code, name) VALUES ('order150-hostile', 'Hostile')");
    await expectAppRoleDenied("UPDATE public.outbox SET published_at = now() WHERE false");
    await expectAppRoleDenied("UPDATE public.posting_line SET folio_transfer_root_line_id = id WHERE false");
    await expectAppRoleDenied("UPDATE public.journal SET approval_request_id = NULL WHERE false");
    await expectAppRoleDenied("INSERT INTO public.journal (tenant_id, property_node, business_date, kind, description, currency, source, created_by, approval_request_id) SELECT tenant_id, property_node, business_date, kind, description, currency, source, created_by, NULL FROM public.journal WHERE false");
    await expectAppRoleDenied("INSERT INTO public.posting_line (tenant_id, journal_id, seq, account_id, folio_id, tx_code, description, amount_minor, quantity, business_date, currency, folio_transfer_root_line_id) SELECT tenant_id, journal_id, seq, account_id, folio_id, tx_code, description, amount_minor, quantity, business_date, currency, id FROM public.posting_line WHERE false");
    await expectAppRoleDenied("INSERT INTO public.space_occupancy (tenant_id, space_id, period, slot_ref, slot_kind, exclusive, claim) VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', tstzrange(now(), now() + interval '1 hour', '[)'), '00000000-0000-0000-0000-000000000003', 'segment', true, int4range(0, NULL))");
    await expectAppRoleDenied("INSERT INTO public.cash_drawer (tenant_id, property_node, account_id, code, name, currency) VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'HOSTILE', 'Hostile', 'USD')");
    await expectAppRoleDenied("UPDATE public.cashier_session SET closed_at = now() WHERE false");
    await expectAppRoleDenied("INSERT INTO public.cashier_count (tenant_id, session_id, drawer_id, kind, attempt_no, counted_by, total_minor) VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'closing', 1, '00000000-0000-0000-0000-000000000004', 0)");
    await expectAppRoleDenied("DELETE FROM public.cashier_count_line WHERE false");
    await expectAppRoleDenied("UPDATE public.task SET status = status WHERE false");
    await expectAppRoleDenied("UPDATE public.unit_condition SET condition = condition WHERE false");
    await expectAppRoleDenied("INSERT INTO public.task_sheet (tenant_id, property_node, sheet_date) VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', DATE '2026-08-28')");
    await expectAppRoleDenied("INSERT INTO public.task (tenant_id, property_node, kind, status) VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'housekeeping', 'assigned')");
    await expectAppRoleDenied("INSERT INTO public.discrepancy (tenant_id, space_id, reported, system_state, reported_by) VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'occupied', 'vacant', '00000000-0000-0000-0000-000000000003')");
    await expectAppRoleDenied("UPDATE public.discrepancy SET resolved_at = now() WHERE false");
    await expectAppRoleDenied("DELETE FROM public.discrepancy WHERE false");
  });

  test("P3: new tables receive no mutation and an unauthorized grant is detected", async () => {
    const connection = await deploy!.reserve();
    try {
      await connection.unsafe("BEGIN");
      await connection.unsafe("CREATE TABLE public.order150_privilege_canary (id uuid PRIMARY KEY)");
      const initial = await connection<Array<{ insert_allowed: boolean }>>`
        SELECT has_table_privilege('app_role', 'public.order150_privilege_canary', 'INSERT') AS insert_allowed
      `;
      expect(initial).toEqual([{ insert_allowed: false }]);
      await connection.unsafe("GRANT INSERT ON public.order150_privilege_canary TO app_role");
      const drift = await connection<Array<{ privilege_type: string }>>`
        SELECT privilege_type FROM information_schema.role_table_grants
         WHERE table_schema = 'public' AND table_name = 'order150_privilege_canary'
           AND grantee = 'app_role' AND privilege_type = 'INSERT'
      `;
      expect(drift).toEqual([{ privilege_type: "INSERT" }]);
      expect(await actualColumnPrivileges(connection)).not.toEqual(expectedColumnPrivileges());
      await connection.unsafe("ROLLBACK");
    } finally {
      await connection.release();
    }
  });
});
