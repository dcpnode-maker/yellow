import { afterAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

const URL = process.env.YELLOW_SECURITY_DEFINER_URL;
if (process.env.YELLOW_REQUIRE_SECURITY_DEFINER === "1" && !URL) {
  throw new Error("YELLOW_SECURITY_DEFINER_URL is required by the Order 113 proof");
}

const TENANT = "00000000-0000-0000-0000-000000011301";
const PROPERTY = "00000000-0000-0000-0000-000000011311";
const ACTOR = "00000000-0000-0000-0000-000000011321";

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

dbDescribe("Order 113 SECURITY DEFINER shadow-path containment", () => {
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

        SELECT public.prune_outbox(interval '30 days');
        SELECT public.seal_business_day(
          '${TENANT}', '${PROPERTY}', DATE '2026-08-24', '${ACTOR}'
        );
        RESET ROLE;
      `);

      const markers = await connection<Array<{ surface: string; observedRole: string }>>`
        SELECT surface, observed_role AS "observedRole"
        FROM public.order113_owner_probe
        ORDER BY surface
      `;

      expect(markers).toEqual([]);
    } finally {
      if (began) await connection.unsafe("ROLLBACK");
      connection.release();
    }
  });
});
