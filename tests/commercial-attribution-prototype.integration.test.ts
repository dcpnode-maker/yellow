import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL, type ReservedSQL } from "bun";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const URL = process.env.YELLOW_COMMERCIAL_PROTO_URL;
if (process.env.YELLOW_REQUIRE_COMMERCIAL_PROTO === "1" && !URL)
  throw new Error("YELLOW_COMMERCIAL_PROTO_URL is required");
const suite = URL ? describe.serial : describe.skip,
  root = resolve(import.meta.dir, "..");
const T1 = "11111111-1111-4111-8111-111111111111",
  T2 = "22222222-2222-4222-8222-222222222222";
const P1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  P2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  A1 = "90000000-0000-4000-8000-000000000001",
  A2 = "90000000-0000-4000-8000-000000000002";
let sql: SQL, expected: any, beforePublic: any[];
const qi = (v: string) => `"${v.replaceAll('"', '""')}"`;
async function publicFingerprint() {
  const tables = await sql.unsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
  );
  const out = [];
  for (const { x } of tables.map((r: any) => ({ x: r.tablename }))) {
    const q = `SELECT count(*)::text n,md5(COALESCE(string_agg(md5(row_to_json(t)::text),',' ORDER BY md5(row_to_json(t)::text)),'')) digest FROM public.${qi(x)} t`;
    out.push({ table: x, ...(await sql.unsafe(q))[0] });
  }
  return out;
}
async function asActor<T>(
  tenant: string,
  actor: string,
  fn: (c: ReservedSQL) => Promise<T>,
): Promise<T> {
  const property =
    actor === A1
      ? P1
      : actor === A2
        ? P2
        : "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
  const c = await sql.reserve();
  try {
    await c.unsafe("BEGIN READ ONLY");
    await c.unsafe(
      "SET LOCAL ROLE app_role;SET LOCAL max_parallel_workers_per_gather=4;SET LOCAL min_parallel_table_scan_size='1MB';SET LOCAL parallel_setup_cost=0;SET LOCAL parallel_tuple_cost=0.01",
    );
    await c`SELECT set_config('app.tenant_id',${tenant},true),set_config('app.actor_id',${actor},true),set_config('app.property_id',${property},true)`;
    const result = await fn(c);
    await c.unsafe("ROLLBACK");
    return result;
  } catch (e) {
    await c.unsafe("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}
suite("Order 567 commercial attribution prototype R3", () => {
  beforeAll(async () => {
    sql = new SQL(URL!);
    expected = JSON.parse(
      await readFile(
        resolve(root, "prototypes/commercial-attribution/expected.json"),
        "utf8",
      ),
    );
    beforePublic = await publicFingerprint();
    for (const f of ["schema.sql", "fixture.sql", "report.sql"])
      await sql.unsafe(
        await readFile(
          resolve(root, "prototypes/commercial-attribution", f),
          "utf8",
        ),
      );
  });
  afterAll(async () => {
    if (sql) {
      await sql.unsafe("DROP SCHEMA IF EXISTS commercial_proto CASCADE");
      await sql.close();
    }
  });

  test("uses PostgreSQL16 and every view is security-invoker", async () => {
    expect(
      Math.trunc(
        Number(
          (await sql`SELECT current_setting('server_version_num')::int n`)[0]
            ?.n,
        ) / 10000,
      ),
    ).toBe(16);
    const v = await sql.unsafe(
      `SELECT c.relname,COALESCE(array_to_string(c.reloptions,','),'')o FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='commercial_proto'AND c.relkind='v'ORDER BY 1`,
    );
    expect(v).toHaveLength(6);
    expect(v.every((r: any) => r.o.includes("security_invoker=true"))).toBe(
      true,
    );
  });

  test("app_role sees one tenant and only its granted property across every readable surface", async () => {
    const r = await asActor(T1, A1, async (c) => ({
      tenants: await c.unsafe(
        "SELECT code FROM commercial_proto.tenant_scope ORDER BY code",
      ),
      properties: await c.unsafe(
        "SELECT code FROM commercial_proto.org_node WHERE kind='property'ORDER BY code",
      ),
      grants: await c.unsafe(
        "SELECT property_id::text FROM commercial_proto.property_grant",
      ),
      inventory: await c.unsafe(
        "SELECT DISTINCT property_id::text FROM commercial_proto.inventory_date",
      ),
      actual: await c.unsafe(
        "SELECT count(*)::text n FROM commercial_proto.actual_night_leaf",
      ),
      planned: await c.unsafe(
        "SELECT count(*)::text n FROM commercial_proto.planned_night_leaf",
      ),
      revenue: await c.unsafe(
        "SELECT count(*)::text n FROM commercial_proto.revenue_leaf",
      ),
      sets: await c.unsafe(
        "SELECT count(*)::text n FROM commercial_proto.alternate_set_membership",
      ),
      sibling: await c.unsafe(
        `SELECT count(*)::text n FROM commercial_proto.inventory_date WHERE property_id='${P2}'`,
      ),
      hostile: await c.unsafe(
        `SELECT count(*)::text n FROM commercial_proto.tenant_scope WHERE tenant_id='${T2}'`,
      ),
      forged: await c.unsafe(
        `SELECT count(*)::text n FROM commercial_proto.property_day_metric_range('${P2}','2026-09-20','2026-09-21')`,
      ),
    }));
    expect(r.tenants).toEqual([{ code: "ALPHA" }]);
    expect(r.properties).toEqual([{ code: "RUH1" }]);
    expect(r.grants).toEqual([{ property_id: P1 }]);
    expect(r.inventory).toEqual([{ property_id: P1 }]);
    expect(r.actual[0]?.n).toBe("5");
    expect(r.planned[0]?.n).toBe("1");
    expect(Number(r.revenue[0]?.n)).toBeGreaterThan(0);
    expect(r.sets[0]?.n).toBe("2");
    expect(r.sibling[0]?.n).toBe("0");
    expect(r.hostile[0]?.n).toBe("0");
    expect(r.forged[0]?.n).toBe("0");
  });

  test("enumerates every granted table and view with zero hostile-tenant rows", async () => {
    const relations = await sql.unsafe(
      `SELECT DISTINCT table_name relname FROM information_schema.columns WHERE table_schema='commercial_proto'AND column_name='tenant_id'AND has_table_privilege('app_role',format('%I.%I',table_schema,table_name),'SELECT')ORDER BY 1`,
    );
    const result = await asActor(T1, A1, async (c) => {
      const out = [];
      for (const r of relations) {
        const q = `SELECT count(*)FILTER(WHERE tenant_id='${T2}')::text hostile FROM commercial_proto.${qi(String(r.relname))}`;
        out.push({ relation: r.relname, ...(await c.unsafe(q))[0] });
      }
      return out;
    });
    expect(result.length).toBeGreaterThan(10);
    expect(result.every((r: any) => r.hostile === "0")).toBe(true);
  });

  test("derives actual and planned nights from evidence, conserves moves and never multiplies sharers", async () => {
    const actual = await sql.unsafe(
      `SELECT count(DISTINCT reservation_id)::text reservations,sum(room_nights)::text nights,count(*)::text legs FROM commercial_proto.actual_night_leaf WHERE tenant_id='${T1}'AND property_id='${P1}'AND business_date='2026-09-20'`,
    );
    expect(actual[0]).toEqual({
      reservations: "4",
      nights: "4.000000000",
      legs: "5",
    });
    const planned = await sql.unsafe(
      `SELECT sum(room_nights)::text nights FROM commercial_proto.planned_night_leaf WHERE tenant_id='${T1}'AND property_id='${P1}'AND business_date='2026-09-21'`,
    );
    expect(planned[0]?.nights).toBe("1.000000000");
    const shares = await sql.unsafe(
      `SELECT count(*)::text sharers,(SELECT sum(room_nights)::text FROM commercial_proto.actual_night_leaf WHERE reservation_id='30000000-0000-4000-8000-000000000002')nights FROM commercial_proto.reservation_sharer WHERE reservation_id='30000000-0000-4000-8000-000000000002'`,
    );
    expect(shares[0]).toEqual({ sharers: "2", nights: "1.000000000" });
  });

  test("rolls MSG/MS and independent intersections without duplicating the house", async () => {
    const d = await sql.unsafe(
      `SELECT msg_code,sum(room_nights)::text nights FROM commercial_proto.actual_night_leaf WHERE tenant_id='${T1}'AND property_id='${P1}'AND business_date='2026-09-20'GROUP BY 1 ORDER BY 1`,
    );
    expect(
      Object.fromEntries(d.map((r: any) => [r.msg_code, r.nights])),
    ).toEqual(expected.demand);
    const x = await sql.unsafe(
      `SELECT msg_code,ms_code,channel_code,source_code,company_key,company_null_reason,sum(room_nights)::text nights FROM commercial_proto.actual_night_leaf WHERE tenant_id='${T1}'AND property_id='${P1}'AND business_date='2026-09-20'GROUP BY 1,2,3,4,5,6 ORDER BY 1`,
    );
    expect(x).toHaveLength(4);
    expect(x.find((r: any) => r.msg_code === "OTA")).toMatchObject({
      company_key: "UNMAPPED",
      company_null_reason: "AMBIGUOUS",
    });
  });

  test("composes every report amount from signed revenue lines and never multiplies quantity", async () => {
    const s = await sql.unsafe(
      `SELECT account_class,sum(signed_revenue_minor)FILTER(WHERE signed_revenue_minor>0)::text gross,sum(signed_revenue_minor)FILTER(WHERE signed_revenue_minor<0)::text reversals,sum(signed_revenue_minor)::text net FROM commercial_proto.signed_revenue_source WHERE tenant_id='${T1}'AND business_date='2026-09-20'GROUP BY 1 ORDER BY 1`,
    );
    expect(s).toEqual([
      {
        account_class: "fnb_revenue",
        gross: "25000",
        reversals: null,
        net: "25000",
      },
      {
        account_class: "room_revenue",
        gross: expected.revenue.grossRoom,
        reversals: expected.revenue.reversal,
        net: expected.revenue.netRoom,
      },
    ]);
    const composed = await sql.unsafe(
      `SELECT sum(signed_revenue_minor)::text net,max(quantity)::text max_quantity FROM commercial_proto.revenue_leaf WHERE tenant_id='${T1}'AND business_date='2026-09-20'AND account_class='fnb_revenue'`,
    );
    expect(composed[0]).toEqual({ net: "25000", max_quantity: "7.000" });
    const cols = await sql.unsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='commercial_proto'AND table_name='revenue_attribution'AND column_name IN('amount_minor','currency','business_date','property_id')`,
    );
    expect(cols).toHaveLength(0);
  });

  test("recomputes property KPIs on base currency and keeps demand ratios unsupported", async () => {
    const rows = await sql.unsafe(
      `SELECT business_date::text date,currency::text,"rooms_available"::text "roomsAvailable","room_nights"::text "roomNights",revenue_minor::text "revenueMinor",occupancy_pct::text "occupancyPct",adr_minor::text "adrMinor",revpar_minor::text "revparMinor" FROM commercial_proto.property_day_metric_range('${P1}','2026-09-20','2026-09-21')`,
    );
    expect(rows).toEqual(
      expected.propertyDay.map((r: any) => {
        const { property, ...rest } = r;
        return rest;
      }),
    );
    const dm = await sql.unsafe(
      `SELECT bool_and(occupancy_pct IS NULL AND revpar_minor IS NULL)::text safe,count(*)FILTER(WHERE null_reason='DEMAND_SCOPE_HAS_NO_INVENTORY_DENOMINATOR')::text supported FROM commercial_proto.demand_metric WHERE tenant_id='${T1}'AND property_id='${P1}'`,
    );
    expect(dm[0]).toEqual({ safe: "true", supported: "4" });
    const revenueOnly = await sql.unsafe(
      `SELECT currency::text,room_nights::text,room_revenue_minor::text,adr_minor,null_reason FROM commercial_proto.demand_metric WHERE tenant_id='${T1}'AND property_id='${P1}'AND business_date='2026-09-21'`,
    );
    expect(revenueOnly).toEqual([
      {
        currency: "SAR",
        room_nights: "0",
        room_revenue_minor: "1000",
        adr_minor: null,
        null_reason: "ADR_NO_ACTUAL_NIGHTS",
      },
    ]);
    const ratios = await sql.unsafe(
      `WITH c(n,r)AS(VALUES(1::numeric,10000::numeric),(9::numeric,180000::numeric))SELECT round(sum(r)/sum(n),4)::text recomputed,round(avg(r/n),4)::text forbidden FROM c`,
    );
    expect(ratios[0]).toEqual({
      recomputed: "19000.0000",
      forbidden: "15000.0000",
    });
  });

  test("date spine emits unavailable for absent history and planned demand does not become occupancy", async () => {
    const r = await sql.unsafe(
      `SELECT rooms_available,room_nights,revenue_minor::text,occupancy_pct,adr_minor,revpar_minor,null_reason FROM commercial_proto.property_day_metric_range('${P1}','2026-09-21','2026-09-22')`,
    );
    expect(r).toEqual([
      {
        rooms_available: null,
        room_nights: null,
        revenue_minor: "1000",
        occupancy_pct: null,
        adr_minor: null,
        revpar_minor: null,
        null_reason: "INVENTORY_HISTORY_UNAVAILABLE",
      },
    ]);
  });

  test("mixed counting bases and foreign currencies fail closed without repeating denominators", async () => {
    const c = await sql.reserve();
    try {
      await c.unsafe("BEGIN");
      await c.unsafe(
        `INSERT INTO commercial_proto.inventory_date VALUES('${T1}','${P1}','2026-09-20','bed',10,'known')`,
      );
      let r = await c.unsafe(
        `SELECT currency::text,rooms_available,room_nights,revenue_minor::text,null_reason FROM commercial_proto.property_day_metric_range('${P1}','2026-09-20','2026-09-21')`,
      );
      expect(r).toEqual([
        {
          currency: "SAR",
          rooms_available: null,
          room_nights: null,
          revenue_minor: "240000",
          null_reason: "MIXED_COUNTING_BASES_UNSUPPORTED",
        },
      ]);
      await c.unsafe("ROLLBACK");
      await c.unsafe("BEGIN");
      await c.unsafe(
        `INSERT INTO commercial_proto.raw_posting_line VALUES('${T1}','82000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000002','${P1}','2026-09-20','revenue','room_revenue',-2500,'USD',1,NULL,NULL);INSERT INTO commercial_proto.revenue_attribution VALUES('${T1}','82000000-0000-4000-8000-000000000001',NULL,'unallocated',NULL,NULL,NULL,NULL,NULL,NULL,'unmapped',NULL,NULL);SET CONSTRAINTS ALL IMMEDIATE`,
      );
      r = await c.unsafe(
        `SELECT currency::text,rooms_available::text,room_nights::text,revenue_minor::text,null_reason FROM commercial_proto.property_day_metric_range('${P1}','2026-09-20','2026-09-21')ORDER BY currency`,
      );
      expect(r).toEqual([
        {
          currency: "SAR",
          rooms_available: "100",
          room_nights: "4.000000000",
          revenue_minor: "240000",
          null_reason: null,
        },
        {
          currency: "USD",
          rooms_available: null,
          room_nights: null,
          revenue_minor: "2500",
          null_reason: "CURRENCY_PROPERTY_MISMATCH",
        },
      ]);
      const demand = await c.unsafe(
        `SELECT currency::text,room_nights,room_revenue_minor::text,adr_minor,null_reason FROM commercial_proto.demand_metric WHERE tenant_id='${T1}'AND property_id='${P1}'AND business_date='2026-09-20'AND currency='USD'`,
      );
      expect(demand).toEqual([
        {
          currency: "USD",
          room_nights: null,
          room_revenue_minor: "2500",
          adr_minor: null,
          null_reason: "CURRENCY_PROPERTY_MISMATCH",
        },
      ]);
      await c.unsafe("ROLLBACK");
    } finally {
      c.release();
    }
  });

  test("zero capacity and overlapping physical bases produce named unavailable states", async () => {
    const c = await sql.reserve();
    try {
      await c.unsafe("BEGIN");
      await c.unsafe(
        `UPDATE commercial_proto.inventory_date SET rooms_available=0 WHERE tenant_id='${T1}'AND property_id='${P1}'AND business_date='2026-09-20'`,
      );
      let r = await c.unsafe(
        `SELECT occupancy_pct,adr_minor,revpar_minor,null_reason FROM commercial_proto.property_day_metric_range('${P1}','2026-09-20','2026-09-21')`,
      );
      expect(r).toEqual([
        {
          occupancy_pct: null,
          adr_minor: "60000.0000",
          revpar_minor: null,
          null_reason: "ZERO_INVENTORY_DENOMINATOR",
        },
      ]);
      await c.unsafe("ROLLBACK");
      await c.unsafe("BEGIN");
      await c.unsafe(
        `UPDATE commercial_proto.inventory_date SET rooms_available=NULL,history_status='overlap_unsupported'WHERE tenant_id='${T1}'AND property_id='${P1}'AND business_date='2026-09-20'`,
      );
      r = await c.unsafe(
        `SELECT rooms_available,room_nights,occupancy_pct,revpar_minor,null_reason FROM commercial_proto.property_day_metric_range('${P1}','2026-09-20','2026-09-21')`,
      );
      expect(r).toEqual([
        {
          rooms_available: null,
          room_nights: null,
          occupancy_pct: null,
          revpar_minor: null,
          null_reason: "PHYSICAL_OVERLAP_UNSUPPORTED",
        },
      ]);
      await c.unsafe("ROLLBACK");
    } finally {
      c.release();
    }
  });

  test("retains all-Unmapped actual and revenue leaves instead of dropping them", async () => {
    const n = await sql.unsafe(
      `SELECT msg_code,ms_code,company_key,room_class_code,unit_type_code,sum(room_nights)::text nights FROM commercial_proto.actual_night_leaf WHERE reservation_id='30000000-0000-4000-8000-000000000004'GROUP BY 1,2,3,4,5`,
    );
    expect(n).toEqual([
      {
        msg_code: "UNMAPPED",
        ms_code: "UNMAPPED",
        company_key: "UNMAPPED",
        room_class_code: "UNMAPPED",
        unit_type_code: "UNMAPPED",
        nights: "1.000000000",
      },
    ]);
    const r = await sql.unsafe(
      `SELECT msg_code,ms_code,company_key,room_class_code,unit_type_code,sum(signed_revenue_minor)::text revenue FROM commercial_proto.revenue_leaf WHERE posting_line_id='50000000-0000-4000-8000-000000000009'GROUP BY 1,2,3,4,5`,
    );
    expect(r).toEqual([
      {
        msg_code: "UNMAPPED",
        ms_code: "UNMAPPED",
        company_key: "UNMAPPED",
        room_class_code: "UNMAPPED",
        unit_type_code: "UNMAPPED",
        revenue: "60000",
      },
    ]);
  });

  test("pins an as-booked taxonomy across an effective boundary while restatement authority stays deferred", async () => {
    const r = await sql.unsafe(
      `SELECT business_date::text,taxonomy_version_id::text FROM commercial_proto.stay_attribution WHERE reservation_id='30000000-0000-4000-8000-000000000008'ORDER BY business_date`,
    );
    expect(r).toEqual([
      {
        business_date: "2026-09-20",
        taxonomy_version_id: "10000000-0000-4000-8000-000000000001",
      },
      {
        business_date: "2026-09-21",
        taxonomy_version_id: "10000000-0000-4000-8000-000000000001",
      },
    ]);
  });

  test("deduplicates overlapping alternate sets and never treats membership as a grant", async () => {
    const r = await sql.unsafe(
      `SELECT count(*)::text memberships,count(DISTINCT property_id)::text properties FROM commercial_proto.alternate_set_membership WHERE tenant_id='${T1}'AND set_code IN('EMEA','LUXURY')`,
    );
    expect(r[0]).toEqual({ memberships: "3", properties: "2" });
    const scoped = await asActor(T1, A1, (c) =>
      c.unsafe(
        "SELECT count(DISTINCT property_id)::text properties FROM commercial_proto.alternate_set_membership WHERE set_code IN('EMEA','LUXURY')",
      ),
    );
    expect(scoped[0]?.properties).toBe("1");
  });

  test("keeps huge money exact and separated by currency", async () => {
    const r = await sql.unsafe(
      `SELECT currency::text,sum(signed_revenue_minor)::text amount FROM commercial_proto.revenue_leaf WHERE tenant_id='${T1}'AND property_id='${P2}'AND business_date='2026-09-22'GROUP BY 1 ORDER BY 1`,
    );
    expect(r).toEqual([
      { currency: "SAR", amount: "500" },
      { currency: "USD", amount: "9223372036854775809" },
    ]);
  });

  test("rejects mismatched MSG/MS, missing allocation, missing revenue mapping and leg key changes", async () => {
    await sql.unsafe(
      `DO $$DECLARE ok boolean:=false;BEGIN BEGIN INSERT INTO commercial_proto.stay_attribution VALUES('${T1}','${P1}','35000000-0000-4000-8000-000000000001','2026-09-20','10000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000003','11000000-0000-4000-8000-000000000002','x','x',NULL,'unmapped',NULL,'SAR');EXCEPTION WHEN raise_exception THEN ok:=SQLERRM='MS does not belong to MSG';END;IF NOT ok THEN RAISE EXCEPTION'mismatch accepted';END IF;END $$`,
    );
    await sql.unsafe(
      `DO $$DECLARE ok boolean:=false;BEGIN BEGIN INSERT INTO commercial_proto.stay_attribution VALUES('${T1}','${P1}','35000000-0000-4000-8000-000000000002','2026-09-20',NULL,NULL,NULL,NULL,NULL,NULL,'unmapped',NULL,'SAR');INSERT INTO commercial_proto.stay_leg_source VALUES('${T1}','${P1}','35000000-0000-4000-8000-000000000002','2026-09-20',1,'in_house',true,false,'STD','STD',.5);SET CONSTRAINTS ALL IMMEDIATE;EXCEPTION WHEN raise_exception THEN ok:=SQLERRM LIKE'actual allocation weights%';END;IF NOT ok THEN RAISE EXCEPTION'bad allocation accepted';END IF;END $$`,
    );
    await sql.unsafe(
      `DO $$DECLARE ok boolean:=false;BEGIN BEGIN INSERT INTO commercial_proto.raw_posting_line VALUES('${T1}','83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002','${P1}','2026-09-20','revenue','room_revenue',-1,'SAR',1,NULL,NULL);SET CONSTRAINTS ALL IMMEDIATE;EXCEPTION WHEN raise_exception THEN ok:=SQLERRM LIKE'eligible revenue line%';END;IF NOT ok THEN RAISE EXCEPTION'missing mapping accepted';END IF;END $$`,
    );
    await sql.unsafe(
      `DO $$DECLARE ok boolean:=false;BEGIN BEGIN UPDATE commercial_proto.stay_leg_source SET leg_no=9 WHERE reservation_id='30000000-0000-4000-8000-000000000001';EXCEPTION WHEN raise_exception THEN ok:=SQLERRM='stay leg identity is immutable';END;IF NOT ok THEN RAISE EXCEPTION'key change accepted';END IF;END $$`,
    );
    await sql.unsafe(
      `DO $$DECLARE ok boolean:=false;BEGIN BEGIN INSERT INTO commercial_proto.raw_posting_line VALUES('${T1}','83000000-0000-4000-8000-000000000003','83000000-0000-4000-8000-000000000004','${P1}','2026-09-20','revenue','room_revenue',-1,'SAR',1,NULL,NULL);UPDATE commercial_proto.revenue_attribution SET posting_line_id='83000000-0000-4000-8000-000000000003'WHERE posting_line_id='50000000-0000-4000-8000-000000000002';SET CONSTRAINTS ALL IMMEDIATE;EXCEPTION WHEN raise_exception THEN ok:=SQLERRM='revenue attribution identity is immutable';END;IF NOT ok THEN RAISE EXCEPTION'revenue mapping key move accepted';END IF;END $$`,
    );
  });

  test("meets scope-matrix and leaf targets on 100-room and 1,000-room two-year shapes under app_role", async () => {
    await sql.unsafe(
      `INSERT INTO commercial_proto.benchmark_night SELECT '${T1}','${P1}',d::date,((d::date-date'2024-01-01')::int*100+r)::bigint,(r%5)::smallint,(r%20)::smallint,(r%6)::smallint,(r%8)::smallint,(r%100)::smallint,(r%4)::smallint,(r%12)::smallint,1 FROM generate_series(date'2024-01-01',date'2025-12-30',interval'1 day')d CROSS JOIN generate_series(1,100)r;INSERT INTO commercial_proto.benchmark_night SELECT '${T1}','${P2}',d::date,100000000+((d::date-date'2024-01-01')::int*1000+r)::bigint,(r%5)::smallint,(r%20)::smallint,(r%6)::smallint,(r%8)::smallint,(r%200)::smallint,(r%4)::smallint,(r%12)::smallint,1 FROM generate_series(date'2024-01-01',date'2025-12-30',interval'1 day')d CROSS JOIN generate_series(1,1000)r;ANALYZE commercial_proto.benchmark_night`,
    );
    await sql.unsafe(`INSERT INTO commercial_proto.benchmark_rollup
      SELECT tenant_id,property_id,business_date,scope,dimension_key,sum(room_nights)::bigint
      FROM commercial_proto.benchmark_night b CROSS JOIN LATERAL(VALUES
        ('hotel','ALL'),('organization','PROPERTY'),('chain','ALPHA'),('brand','LUX'),('region','KSA'),
        ('msg',b.msg_key::text),('ms',b.ms_key::text),
        ('channel',b.channel_key::text),('source',b.source_key::text),('company',b.company_key::text),
        ('room_class',b.room_class_key::text),('unit_type',b.unit_type_key::text)
      )d(scope,dimension_key) GROUP BY 1,2,3,4,5;
      ANALYZE commercial_proto.benchmark_rollup`);
    const small = await asActor(T1, A1, (c) =>
      c.unsafe(
        `SELECT count(*)::text n,sum(room_nights)::text nights FROM commercial_proto.benchmark_night WHERE property_id='${P1}'`,
      ),
    );
    expect(small[0]).toEqual({ n: "73000", nights: "73000" });
    const projectedSmall = await asActor(T1, A1, (c) =>
      c.unsafe(`SELECT sum(room_nights)::text nights FROM commercial_proto.benchmark_rollup
        WHERE property_id='${P1}'AND scope='hotel'AND business_date>=date'2024-01-01'AND business_date<date'2026-01-01'`),
    );
    expect(projectedSmall[0]?.nights).toBe("73000");
    const evidence = await asActor(T1, A2, async (c) => {
      const scopes = [
          "hotel",
          "organization",
          "chain",
          "brand",
          "region",
          "msg",
          "ms",
          "channel",
          "source",
          "company",
          "room_class",
          "unit_type",
        ],
        samples: Record<string, number[]> = {},
        firstRun: Record<string, number> = {};
      for (const scope of scopes) samples[scope] = [];
      const run = async (scope: string) => {
        const start = performance.now();
        await c.unsafe(`SELECT dimension_key,sum(room_nights)FROM commercial_proto.benchmark_rollup
          WHERE property_id='${P2}'AND scope='${scope}'AND business_date>=date'2024-01-01'AND business_date<date'2026-01-01'
          GROUP BY dimension_key ORDER BY dimension_key`);
        return performance.now() - start;
      };
      for (const scope of scopes) firstRun[scope] = await run(scope);
      for (let i = 0; i < 5; i++)
        for (const scope of scopes) samples[scope]!.push(await run(scope));
      const concurrentStart = performance.now();
      await Promise.all(scopes.map((scope) => run(scope)));
      const concurrentMatrix = performance.now() - concurrentStart;
      const conserved = await Promise.all(
        scopes.map(async (scope) => ({
          scope,
          nights: String(
            (
              await c.unsafe(`SELECT sum(room_nights)::text nights FROM commercial_proto.benchmark_rollup
                WHERE property_id='${P2}'AND scope='${scope}'AND business_date>=date'2024-01-01'AND business_date<date'2026-01-01'`)
            )[0]?.nights,
          ),
        })),
      );
      const plans = {
        company: (
          await c.unsafe(`EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON)
            SELECT dimension_key,sum(room_nights)FROM commercial_proto.benchmark_rollup
            WHERE property_id='${P2}'AND scope='company'AND business_date>=date'2024-01-01'AND business_date<date'2026-01-01'
            GROUP BY dimension_key ORDER BY dimension_key`)
        )[0]?.["QUERY PLAN"],
        organization: (
          await c.unsafe(`EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON)
            SELECT dimension_key,sum(room_nights)FROM commercial_proto.benchmark_rollup
            WHERE property_id='${P2}'AND scope='organization'AND business_date>=date'2024-01-01'AND business_date<date'2026-01-01'
            GROUP BY dimension_key ORDER BY dimension_key`)
        )[0]?.["QUERY PLAN"],
        leaf: (
          await c.unsafe(`EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON)
            SELECT reservation_id,msg_key,ms_key,channel_key,company_key FROM commercial_proto.benchmark_night
            WHERE property_id='${P2}'AND business_date=date'2025-12-30'AND reservation_id>100000000 ORDER BY reservation_id LIMIT 50`)
        )[0]?.["QUERY PLAN"],
      };
      const leaf: number[] = [];
      for (let i = 0; i < 6; i++) {
        const s = performance.now();
        await c.unsafe(
          `SELECT reservation_id,msg_key,ms_key,channel_key,company_key FROM commercial_proto.benchmark_night WHERE property_id='${P2}'AND business_date=date'2025-12-30'AND reservation_id>100000000 ORDER BY reservation_id LIMIT 50`,
        );
        if (i) leaf.push(performance.now() - s);
      }
      const pct = (a: number[], p: number) =>
        [...a].sort((x, y) => x - y)[Math.ceil(a.length * p) - 1]!;
      const distribution = (v: number[]) => ({
        p50: pct(v, 0.5),
        p95: pct(v, 0.95),
        p99: pct(v, 0.99),
      });
      return {
        rows: Number(
          (
            await c.unsafe(
              `SELECT count(*)::text n FROM commercial_proto.benchmark_night WHERE property_id='${P2}'`,
            )
          )[0]?.n,
        ),
        firstRun,
        concurrentMatrix,
        conserved,
        plans,
        scope: Object.fromEntries(
          Object.entries(samples).map(([k, v]) => [k, distribution(v)]),
        ),
        leaf: distribution(leaf),
      };
    });
    console.log("ORDER567_R3_PERFORMANCE", JSON.stringify(evidence));
    expect(evidence.rows).toBe(730000);
    expect(evidence.conserved.every((row) => row.nights === "730000")).toBe(
      true,
    );
    expect(
      Math.max(...Object.values(evidence.scope).map((v) => v.p95)),
    ).toBeLessThan(300);
    expect(evidence.concurrentMatrix).toBeLessThan(300);
    expect(evidence.leaf.p95).toBeLessThan(150);
  }, 90_000);

  test("all report work leaves exact content fingerprints of all81 canonical public tables unchanged", async () => {
    expect(await publicFingerprint()).toEqual(beforePublic);
  });
});
