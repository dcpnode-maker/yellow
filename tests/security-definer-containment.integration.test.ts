import { afterAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

const URL = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.YELLOW_SECURITY_DEFINER_URL;
if (process.env.YELLOW_REQUIRE_SECURITY_DEFINER === "1" && !URL) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL is required by the Order 108 proof");
}

const TENANT = "00000000-0000-0000-0000-000000011301";
const PROPERTY = "00000000-0000-0000-0000-000000011311";
const ACTOR = "00000000-0000-0000-0000-000000011321";
const PARTY = "00000000-0000-0000-0000-000000011322";
const UNIT_TYPE = "00000000-0000-0000-0000-000000011323";
const SELLABLE = "00000000-0000-0000-0000-000000011324";
const RATE_PLAN = "00000000-0000-0000-0000-000000011325";
const RESERVATION = "00000000-0000-0000-0000-000000011326";
const SEGMENT = "00000000-0000-0000-0000-000000011327";

const dbDescribe = URL ? describe.serial : describe.skip;
const admin = URL ? new SQL(URL, { max: 1 }) : undefined;

function sqlState(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { errno?: unknown; code?: unknown };
  if (typeof candidate.errno === "string") return candidate.errno;
  return typeof candidate.code === "string" ? candidate.code : undefined;
}

afterAll(async () => {
  await admin?.close();
});

dbDescribe("Order 108 SECURITY DEFINER shadow-path containment", () => {
  test("P0: app-owned pg_temp shadows cannot execute with deployment-owner authority", async () => {
    const connection = await admin!.reserve();
    let began = false;
    try {
      await connection.unsafe("BEGIN");
      began = true;
      await connection.unsafe(`
        CREATE TABLE public.order113_owner_probe (
          surface text NOT NULL,
          observed_role text NOT NULL
        );
        REVOKE ALL ON TABLE public.order113_owner_probe FROM PUBLIC, app_role;
        SET LOCAL ROLE app_role;
        SELECT set_config('app.tenant_id', '${TENANT}', true);
        SAVEPOINT direct_probe;
      `);

      let directState: string | undefined;
      try {
        await connection.unsafe(`
          INSERT INTO public.order113_owner_probe(surface, observed_role)
          VALUES ('direct', current_user)
        `);
      } catch (error) {
        directState = sqlState(error);
        await connection.unsafe("ROLLBACK TO SAVEPOINT direct_probe");
      }
      expect(directState).toBe("42501");

      await connection.unsafe(`
        CREATE TEMP TABLE outbox (published_at timestamptz);
        INSERT INTO pg_temp.outbox(published_at) VALUES (now() - interval '60 days');

        CREATE TEMP TABLE business_day (
          tenant_id uuid NOT NULL,
          property_node uuid NOT NULL,
          business_date date NOT NULL,
          sealed_at timestamptz,
          sealed_by uuid
        );
        INSERT INTO pg_temp.business_day(tenant_id, property_node, business_date)
        VALUES ('${TENANT}', '${PROPERTY}', DATE '2026-08-24');

        CREATE OR REPLACE FUNCTION pg_temp.order113_hostile_trigger()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          INSERT INTO public.order113_owner_probe(surface, observed_role)
          VALUES (TG_TABLE_NAME, current_user);
          RETURN OLD;
        END $$;

        CREATE TRIGGER hostile_outbox
          BEFORE DELETE ON pg_temp.outbox
          FOR EACH ROW EXECUTE FUNCTION pg_temp.order113_hostile_trigger();
        CREATE TRIGGER hostile_business_day
          BEFORE UPDATE ON pg_temp.business_day
          FOR EACH ROW EXECUTE FUNCTION pg_temp.order113_hostile_trigger();
      `);

      await connection.unsafe("SAVEPOINT hostile_prune");
      let pruneState: string | undefined;
      try {
        await connection`SELECT public.prune_outbox(interval '30 days')`;
        await connection.unsafe("RELEASE SAVEPOINT hostile_prune");
      } catch (error) {
        pruneState = sqlState(error);
        await connection.unsafe("ROLLBACK TO SAVEPOINT hostile_prune");
        await connection.unsafe("RELEASE SAVEPOINT hostile_prune");
      }
      await connection.unsafe("SAVEPOINT hostile_seal");
      let sealState: string | undefined;
      try {
        await connection`
          SELECT public.seal_business_day(
            ${TENANT}::uuid, ${PROPERTY}::uuid, DATE '2026-08-24', ${ACTOR}::uuid
          )
        `;
        await connection.unsafe("RELEASE SAVEPOINT hostile_seal");
      } catch (error) {
        sealState = sqlState(error);
        await connection.unsafe("ROLLBACK TO SAVEPOINT hostile_seal");
        await connection.unsafe("RELEASE SAVEPOINT hostile_seal");
      }
      await connection.unsafe("RESET ROLE");

      const markers = await connection<Array<{ surface: string; observedRole: string }>>`
        SELECT surface, observed_role AS "observedRole"
        FROM public.order113_owner_probe
        ORDER BY surface
      `;
      const shadowState = await connection<Array<{ outboxRows: number; daySealed: boolean }>>`
        SELECT
          (SELECT count(*)::int FROM pg_temp.outbox) AS "outboxRows",
          (SELECT sealed_at IS NOT NULL FROM pg_temp.business_day) AS "daySealed"
      `;

      expect(pruneState).toBe("42501");
      expect(sealState).toBe("42501");
      expect(markers).toEqual([]);
      expect(shadowState).toEqual([{ outboxRows: 1, daySealed: false }]);
    } finally {
      if (began) await connection.unsafe("ROLLBACK");
      connection.release();
    }
  });

  test("P1/P2: every definer has safe resolution and exact least execution authority", async () => {
    const functions = await admin!<Array<{
      signature: string;
      securityDefiner: boolean;
      config: string[];
      source: string;
      appExecute: boolean;
      publicDenied: boolean;
    }>>`
      SELECT p.oid::regprocedure::text AS signature,
             p.prosecdef AS "securityDefiner",
             p.proconfig AS config,
             p.prosrc AS source,
             has_function_privilege('app_role', p.oid, 'EXECUTE') AS "appExecute",
             NOT EXISTS (
               SELECT 1
                 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
                WHERE acl.grantee = 0
                  AND acl.privilege_type = 'EXECUTE'
             ) AS "publicDenied"
        FROM pg_proc AS p
        JOIN pg_namespace AS n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname = ANY(ARRAY[
           'record_occupancy', 'release_occupancy', 'expire_holds',
           'prune_outbox', 'assert_day_open', 'seal_business_day', 'lock_financial_rows',
           'lock_financial_business_days',
           'create_charge_correction_header',
           'create_folio_transfer', 'create_receivable_transfer',
           'open_cashier_session', 'append_cashier_count', 'close_cashier_session',
           'register_extension_type', 'transition_housekeeping_task'
         ]::name[])
       ORDER BY signature
    `;

    expect(functions.map(({ signature, securityDefiner, config, appExecute, publicDenied }) => ({
      signature, securityDefiner, config, appExecute, publicDenied,
    }))).toEqual([
      { signature: "append_cashier_count(uuid,uuid,uuid,uuid,bigint[],bigint[])", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"], appExecute: true, publicDenied: true },
      { signature: "assert_day_open()", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"], appExecute: false, publicDenied: true },
      { signature: "close_cashier_session(uuid,uuid,uuid,uuid,uuid,uuid,text,boolean)", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"], appExecute: true, publicDenied: true },
      { signature: "create_charge_correction_header(uuid,uuid,uuid,character,text,uuid)", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"], appExecute: true, publicDenied: true },
      { signature: "create_folio_transfer(uuid,uuid,uuid,uuid[],uuid,text)", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"], appExecute: true, publicDenied: true },
      { signature: "create_receivable_transfer(uuid,uuid,uuid,uuid,uuid,uuid,text)", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"], appExecute: true, publicDenied: true },
      { signature: "expire_holds()", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"], appExecute: false, publicDenied: true },
      { signature: "lock_financial_business_days(uuid,uuid,date[])", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"], appExecute: true, publicDenied: true },
      { signature: "lock_financial_rows(uuid,uuid[],uuid)", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"], appExecute: true, publicDenied: true },
      { signature: "open_cashier_session(uuid,uuid,uuid,uuid,bigint[],bigint[])", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"], appExecute: true, publicDenied: true },
      { signature: "prune_outbox(interval)", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"], appExecute: false, publicDenied: true },
      { signature: "record_occupancy(uuid,uuid,tstzrange,uuid,text,boolean)", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"], appExecute: true, publicDenied: true },
      { signature: "register_extension_type(uuid,text,jsonb,uuid,uuid,uuid)", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"], appExecute: false, publicDenied: true },
      { signature: "release_occupancy(uuid,uuid)", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"], appExecute: true, publicDenied: true },
      { signature: "seal_business_day(uuid,uuid,date,uuid)", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"], appExecute: false, publicDenied: true },
      { signature: "transition_housekeeping_task(uuid,uuid,uuid,text,text,text,timestamp with time zone,uuid)", securityDefiner: true,
        config: ["search_path=pg_catalog, public, pg_temp"], appExecute: true, publicDenied: true },
    ]);

    const expectedQualifiedObjects = new Map<string, readonly string[]>([
      ["append_cashier_count(uuid,uuid,uuid,uuid,bigint[],bigint[])",
        ["public.org_node", "public.cashier_session", "public.business_day", "public.cash_drawer",
          "public.app_user", "public.cash_drawer_denomination", "public.cashier_count",
          "public.cashier_count_line"]],
      ["assert_day_open()", ["public.business_day"]],
      ["close_cashier_session(uuid,uuid,uuid,uuid,uuid,uuid,text,boolean)",
        ["public.org_node", "public.cashier_session", "public.business_day", "public.cash_drawer",
          "public.app_user", "public.cashier_count", "public.approval_request"]],
      ["create_charge_correction_header(uuid,uuid,uuid,character,text,uuid)",
        ["public.org_node", "public.app_user", "public.journal"]],
      ["create_folio_transfer(uuid,uuid,uuid,uuid[],uuid,text)",
        ["public.account", "public.folio", "public.reservation", "public.org_node",
          "public.app_user", "public.posting_line", "public.journal", "public.business_day"]],
      ["create_receivable_transfer(uuid,uuid,uuid,uuid,uuid,uuid,text)",
        ["public.app_user", "public.folio", "public.lock_financial_rows", "public.account",
          "public.org_node", "public.party", "public.party_role", "public.folio_balance",
          "public.posting_line", "public.approval_request", "public.journal", "public.business_day"]],
      ["expire_holds()", ["public.hold", "public.release_occupancy"]],
      ["lock_financial_rows(uuid,uuid[],uuid)", ["public.account", "public.folio"]],
      ["lock_financial_business_days(uuid,uuid,date[])", ["public.business_day"]],
      ["open_cashier_session(uuid,uuid,uuid,uuid,bigint[],bigint[])",
        ["public.org_node", "public.business_day", "public.cash_drawer", "public.account",
          "public.app_user", "public.cash_drawer_denomination", "public.cashier_session",
          "public.cashier_count", "public.cashier_count_line"]],
      ["prune_outbox(interval)", ["public.outbox"]],
      ["record_occupancy(uuid,uuid,tstzrange,uuid,text,boolean)",
        ["public.space_occupancy", "public.space"]],
      ["register_extension_type(uuid,text,jsonb,uuid,uuid,uuid)",
        ["public.tenant", "public.org_node", "public.app_user", "public.extension_type", "public.fact_log"]],
      ["release_occupancy(uuid,uuid)", ["public.space_occupancy"]],
      ["seal_business_day(uuid,uuid,date,uuid)", ["public.business_day"]],
      ["transition_housekeeping_task(uuid,uuid,uuid,text,text,text,timestamp with time zone,uuid)",
        ["public.app_user", "public.org_node", "public.task", "public.space", "public.unit_condition"]],
    ]);
    for (const definition of functions) {
      for (const object of expectedQualifiedObjects.get(definition.signature) ?? []) {
        expect(definition.source).toContain(object);
      }
    }

    const headerAuthority = await admin!<Array<{
      owner: string; runtimeExecute: boolean; volatility: string;
    }>>`
      SELECT pg_get_userbyid(p.proowner) AS owner,
             has_function_privilege('yellow_runtime',p.oid,'EXECUTE') AS "runtimeExecute",
             p.provolatile::text AS volatility
        FROM pg_proc p
       WHERE p.oid = 'public.create_charge_correction_header(uuid,uuid,uuid,character,text,uuid)'::regprocedure
    `;
    expect(headerAuthority).toEqual([{
      owner: "yellow_owner", runtimeExecute: false, volatility: "v",
    }]);

    const transferAuthority = await admin!<Array<{
      owner: string; runtimeExecute: boolean; volatility: string;
    }>>`
      SELECT pg_get_userbyid(p.proowner) AS owner,
             has_function_privilege('yellow_runtime',p.oid,'EXECUTE') AS "runtimeExecute",
             p.provolatile::text AS volatility
        FROM pg_proc p
       WHERE p.oid = 'public.create_folio_transfer(uuid,uuid,uuid,uuid[],uuid,text)'::regprocedure
    `;
    expect(transferAuthority).toEqual([{
      owner: "yellow_owner", runtimeExecute: false, volatility: "v",
    }]);

    const receivableAuthority = await admin!<Array<{
      owner: string; runtimeExecute: boolean; volatility: string;
    }>>`
      SELECT pg_get_userbyid(p.proowner) AS owner,
             has_function_privilege('yellow_runtime',p.oid,'EXECUTE') AS "runtimeExecute",
             p.provolatile::text AS volatility
        FROM pg_proc p
       WHERE p.oid =
         'public.create_receivable_transfer(uuid,uuid,uuid,uuid,uuid,uuid,text)'::regprocedure
    `;
    expect(receivableAuthority).toEqual([{
      owner: "yellow_owner", runtimeExecute: false, volatility: "v",
    }]);

    const cashierAuthority = await admin!<Array<{
      signature: string; owner: string; runtimeExecute: boolean; volatility: string;
    }>>`
      SELECT p.oid::regprocedure::text AS signature,
             pg_get_userbyid(p.proowner) AS owner,
             has_function_privilege('yellow_runtime',p.oid,'EXECUTE') AS "runtimeExecute",
             p.provolatile::text AS volatility
        FROM pg_proc p
       WHERE p.oid = ANY(ARRAY[
         'public.open_cashier_session(uuid,uuid,uuid,uuid,bigint[],bigint[])'::regprocedure,
         'public.append_cashier_count(uuid,uuid,uuid,uuid,bigint[],bigint[])'::regprocedure,
         'public.close_cashier_session(uuid,uuid,uuid,uuid,uuid,uuid,text,boolean)'::regprocedure
       ])
       ORDER BY signature
    `;
    expect(cashierAuthority).toEqual([
      { signature: "append_cashier_count(uuid,uuid,uuid,uuid,bigint[],bigint[])",
        owner: "yellow_owner", runtimeExecute: false, volatility: "v" },
      { signature: "close_cashier_session(uuid,uuid,uuid,uuid,uuid,uuid,text,boolean)",
        owner: "yellow_owner", runtimeExecute: false, volatility: "v" },
      { signature: "open_cashier_session(uuid,uuid,uuid,uuid,bigint[],bigint[])",
        owner: "yellow_owner", runtimeExecute: false, volatility: "v" },
    ]);

    const connection = await admin!.reserve();
    let began = false;
    try {
      await connection.unsafe("BEGIN; SET LOCAL ROLE app_role");
      began = true;
      for (const statement of [
        "SELECT public.prune_outbox(interval '30 days')",
        "SELECT public.expire_holds()",
        `SELECT public.seal_business_day(
          '${TENANT}'::uuid, '${PROPERTY}'::uuid, DATE '2026-08-24', '${ACTOR}'::uuid
        )`,
        `SELECT * FROM public.create_folio_transfer(
          '${TENANT}'::uuid,
          '00000000-0000-0000-0000-000000011351'::uuid,
          '00000000-0000-0000-0000-000000011352'::uuid,
          ARRAY['00000000-0000-0000-0000-000000011353'::uuid],
          '${ACTOR}'::uuid,
          'hostile direct app-role call'
        )`,
        `SELECT * FROM public.create_receivable_transfer(
          '${TENANT}'::uuid, '${PROPERTY}'::uuid,
          '00000000-0000-0000-0000-000000011354'::uuid,
          '00000000-0000-0000-0000-000000011355'::uuid,
          '${ACTOR}'::uuid, NULL, 'hostile direct app-role call'
        )`,
        `SELECT * FROM public.open_cashier_session(
          '${TENANT}'::uuid, '${PROPERTY}'::uuid,
          '00000000-0000-0000-0000-000000011361'::uuid, '${ACTOR}'::uuid,
          ARRAY[1]::bigint[], ARRAY[0]::bigint[]
        )`,
        `SELECT * FROM public.append_cashier_count(
          '${TENANT}'::uuid, '${PROPERTY}'::uuid,
          '00000000-0000-0000-0000-000000011362'::uuid, '${ACTOR}'::uuid,
          ARRAY[1]::bigint[], ARRAY[0]::bigint[]
        )`,
        `SELECT * FROM public.close_cashier_session(
          '${TENANT}'::uuid, '${PROPERTY}'::uuid,
          '00000000-0000-0000-0000-000000011362'::uuid, '${ACTOR}'::uuid,
          '00000000-0000-0000-0000-000000011363'::uuid, NULL, NULL, false
        )`,
        `SELECT * FROM public.transition_housekeeping_task(
          '${TENANT}'::uuid, '${PROPERTY}'::uuid,
          '00000000-0000-0000-0000-000000011364'::uuid,
          'start', 'assigned', 'dirty', now(), '${ACTOR}'::uuid
        )`,
      ]) {
        await connection.unsafe("SAVEPOINT denied_call");
        let state: string | undefined;
        try {
          await connection.unsafe(statement);
        } catch (error) {
          state = sqlState(error);
          await connection.unsafe("ROLLBACK TO SAVEPOINT denied_call");
        }
        await connection.unsafe("RELEASE SAVEPOINT denied_call");
        expect(state).toBe("42501");
      }
    } finally {
      if (began) await connection.unsafe("ROLLBACK");
      connection.release();
    }
  });

  test("P3/P4: owner prune validation and app occupancy behavior remain exact", async () => {
    const connection = await admin!.reserve();
    let began = false;
    try {
      await connection.unsafe("BEGIN");
      began = true;

      await connection.unsafe("SAVEPOINT negative_prune");
      let negativeState: string | undefined;
      try {
        await connection`SELECT public.prune_outbox(interval '-1 second')`;
      } catch (error) {
        negativeState = sqlState(error);
        await connection.unsafe("ROLLBACK TO SAVEPOINT negative_prune");
      }
      await connection.unsafe("RELEASE SAVEPOINT negative_prune");
      expect(negativeState).toBe("22023");

      await connection.unsafe(`
        INSERT INTO public.outbox
          (tenant_id, business_date, aggregate_type, aggregate_id, event_type,
           correlation_id, payload, published_at)
        VALUES
          ('${TENANT}', DATE '2026-08-24', 'order113', gen_random_uuid(),
           'order113.old', gen_random_uuid(), '{}'::jsonb, now() - interval '60 days'),
          ('${TENANT}', DATE '2026-08-24', 'order113', gen_random_uuid(),
           'order113.recent', gen_random_uuid(), '{}'::jsonb, now()),
          ('${TENANT}', DATE '2026-08-24', 'order113', gen_random_uuid(),
           'order113.unpublished', gen_random_uuid(), '{}'::jsonb, NULL)
      `);
      const pruned = await connection<Array<{ count: number | bigint }>>`
        SELECT public.prune_outbox(interval '30 days') AS count
      `;
      const remaining = await connection<Array<{ eventType: string }>>`
        SELECT event_type AS "eventType"
          FROM public.outbox
         WHERE aggregate_type = 'order113'
         ORDER BY event_type
      `;
      expect(pruned.map(({ count }) => Number(count))).toEqual([1]);
      expect(remaining).toEqual([
        { eventType: "order113.recent" },
        { eventType: "order113.unpublished" },
      ]);

      await connection.unsafe(`
        INSERT INTO public.tenant(id, slug, name)
        VALUES ('${TENANT}', 'order108', 'Order 108');
        INSERT INTO public.org_node
          (id, tenant_id, path, kind, name, timezone, currency)
        VALUES
          ('${PROPERTY}', '${TENANT}', 'order113.property', 'property',
           'Order 108 property', 'UTC', 'USD');
        INSERT INTO public.space
          (id, tenant_id, property_node, code, profile_key, capacity)
        VALUES
          ('00000000-0000-0000-0000-000000011331', '${TENANT}', '${PROPERTY}',
           'SEC-1', 'room', 1);
        INSERT INTO public.party(id, tenant_id, kind, display_name, status)
          VALUES ('${PARTY}', '${TENANT}', 'person', 'Order 108 Guest', 'active');
        INSERT INTO public.unit_type(id, tenant_id, property_node, code, name, profile_key)
          VALUES ('${UNIT_TYPE}', '${TENANT}', '${PROPERTY}', 'SEC', 'Security Room', 'room');
        INSERT INTO public.sellable_unit(id, tenant_id, unit_type_id, name)
          VALUES ('${SELLABLE}', '${TENANT}', '${UNIT_TYPE}', 'Security Sellable');
        INSERT INTO public.sellable_unit_space(tenant_id, sellable_unit_id, space_id, claim_mode)
          VALUES ('${TENANT}', '${SELLABLE}', '00000000-0000-0000-0000-000000011331', 'exclusive');
        INSERT INTO public.rate_plan(id, tenant_id, property_node, code, name, currency, status)
          VALUES ('${RATE_PLAN}', '${TENANT}', '${PROPERTY}', 'SEC', 'Security Rate', 'USD', 'active');
        INSERT INTO public.reservation(
          id, tenant_id, property_node, confirmation_no, status, primary_party, channel_code, currency
        ) VALUES (
          '${RESERVATION}', '${TENANT}', '${PROPERTY}', 'SEC-EXACT', 'reserved', '${PARTY}', 'direct', 'USD'
        );
        INSERT INTO public.reservation_segment(
          id, tenant_id, reservation_id, seq, unit_type_id, sellable_unit_id, period,
          adults, children, rate_plan_id, status
        ) VALUES (
          '${SEGMENT}', '${TENANT}', '${RESERVATION}', 1, '${UNIT_TYPE}', '${SELLABLE}',
          tstzrange('2026-08-24T12:00:00Z', '2026-08-25T12:00:00Z', '[)'),
          1, '[]'::jsonb, '${RATE_PLAN}', 'booked'
        );
        SET LOCAL ROLE app_role;
        SELECT set_config('app.tenant_id', '${TENANT}', true);
      `);
      const slot = SEGMENT;
      const claims = await connection<Array<{ id: string }>>`
        SELECT public.record_occupancy(
          ${TENANT}::uuid,
          '00000000-0000-0000-0000-000000011331'::uuid,
          tstzrange('2026-08-24T12:00:00Z', '2026-08-25T12:00:00Z', '[)'),
          ${slot}::uuid,
          'segment',
          true
        )::text AS id
      `;
      const released = await connection<Array<{ count: number }>>`
        SELECT public.release_occupancy(${TENANT}::uuid, ${slot}::uuid) AS count
      `;
      expect(claims[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(released).toEqual([{ count: 1 }]);
    } finally {
      if (began) await connection.unsafe("ROLLBACK");
      connection.release();
    }
  });
});
