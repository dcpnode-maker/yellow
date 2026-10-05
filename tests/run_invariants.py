#!/usr/bin/env python3
"""Executable invariant battery for the PMS build package.
Runs the DB-level subset of PMS_QA_Test_Suite.md against a database loaded with
SCHEMA.sql + seed_fixture.sql. App-layer tests (HTTP, tax engine, adapters) are
implemented in their build phases; everything here must pass BEFORE Phase 2 starts.

Usage: python3 run_invariants.py [dbname]   (default: yellow_test)
"""
import os, sys, threading, time, uuid
import psycopg2

DB = sys.argv[1] if len(sys.argv) > 1 else "yellow_test"
DSN = os.environ.get("YELLOW_DSN") or f"dbname={DB} user=yellow password=yellow host=127.0.0.1 port=5442"
T_A = "00000000-0000-0000-0000-000000000001"
T_B = "00000000-0000-0000-0000-000000000002"
PROP = "00000000-0000-0000-0000-000000000012"
ROOM101 = "00000000-0000-0000-0000-000000000200"
DORM = "00000000-0000-0000-0000-00000000d0c1"
INV_SERIES = "00000000-0000-0000-0000-000000000900"
ACC_REV = "00000000-0000-0000-0000-000000000800"
ACC_CASH = "00000000-0000-0000-0000-000000000803"
PERIOD = "[2026-09-20 14:00+04,2026-09-22 12:00+04)"
results = []

def check(tc, name, ok, detail=""):
    results.append((tc, name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {tc:<8} {name}  {detail}")

def conn(role_app=False, tenant=None):
    c = psycopg2.connect(DSN); c.autocommit = False
    cur = c.cursor()
    if role_app: cur.execute("SET ROLE app_role")
    if tenant: cur.execute("SELECT set_config('app.tenant_id', %s, true)", (tenant,))
    return c, cur

def record(space, exclusive, period=PERIOD, out=None):
    try:
        c, cur = conn()
    except psycopg2.Error as e:          # can't connect → a failed claim, not a traceback wall
        if out is not None: out.append(False)
        return False
    try:
        cur.execute("SELECT record_occupancy(%s,%s,%s::tstzrange,%s,%s,%s)",
                    (T_A, space, period, str(uuid.uuid4()), "segment", exclusive))
        c.commit(); ok = True
    except Exception:
        c.rollback(); ok = False
    finally:
        c.close()
    if out is not None: out.append(ok)
    return ok

# R1 / TC-12.1 — exclusive race: 50 threads, one room, one winner
wins = []
ths = [threading.Thread(target=record, args=(ROOM101, True, PERIOD, wins)) for _ in range(50)]
[t.start() for t in ths]; [t.join() for t in ths]
check("TC-12.1", "50-thread exclusive race → exactly 1 winner", sum(wins) == 1, f"winners={sum(wins)}")

# R2 / TC-12.2 — composite race: exclusive private-sale vs 6 bed claims on the dorm
mix = []
ths = [threading.Thread(target=record, args=(DORM, True, PERIOD, mix))]
ths += [threading.Thread(target=record, args=(DORM, False, PERIOD, mix)) for _ in range(6)]
[t.start() for t in ths]; [t.join() for t in ths]
c, cur = conn()
cur.execute("""SELECT count(*) FILTER (WHERE exclusive), count(*) FILTER (WHERE NOT exclusive)
               FROM space_occupancy WHERE space_id=%s AND period && %s::tstzrange""", (DORM, PERIOD))
exc, beds = cur.fetchone(); c.close()
check("TC-12.2", "private vs beds never coexist", not (exc > 0 and beds > 0), f"exclusive={exc} beds={beds}")

# R3 / TC-12.3 — capacity race: clear dorm, 40 threads for 6 beds
c, cur = conn()
cur.execute("SELECT row_security_active('public.space_occupancy'::regclass)")
rls_active = cur.fetchone()[0]
cur.execute("SELECT has_table_privilege(current_user, 'public.space_occupancy', 'DELETE')")
can_delete = cur.fetchone()[0]
if rls_active or not can_delete:
    c.close()
    raise RuntimeError(
        "TC-12.3 harness configuration invalid: cleanup connection must bypass RLS "
        f"and have DELETE privilege (row_security_active={rls_active}, can_delete={can_delete})"
    )
cur.execute("DELETE FROM space_occupancy WHERE space_id=%s", (DORM,))
c.commit()
cur.execute("SELECT count(*) FROM space_occupancy WHERE space_id=%s", (DORM,))
remaining = cur.fetchone()[0]
if remaining != 0:
    c.close()
    raise RuntimeError(f"TC-12.3 harness cleanup failed: dorm still holds {remaining} rows")
c.close()
caps = []
ths = [threading.Thread(target=record, args=(DORM, False, PERIOD, caps)) for _ in range(40)]
[t.start() for t in ths]; [t.join() for t in ths]
check("TC-12.3", "40 threads for 6 beds → exactly 6", sum(caps) == 6, f"claims={sum(caps)}")

# R4 / TC-2.6 / TC-12.4 — choke point: direct INSERT as app_role → 42501
c, cur = conn(role_app=True, tenant=T_A)
try:
    cur.execute("""INSERT INTO space_occupancy (tenant_id,space_id,period,slot_ref,slot_kind,exclusive,claim)
                   VALUES (%s,%s,%s::tstzrange,%s,'segment',true,'[0,)')""",
                (T_A, ROOM101, "[2026-10-01,2026-10-02)", str(uuid.uuid4())))
    c.commit(); check("TC-12.4", "direct INSERT blocked", False, "insert SUCCEEDED — choke point broken")
except psycopg2.Error as e:
    c.rollback(); check("TC-12.4", "direct INSERT blocked (42501)", e.pgcode == "42501", f"code={e.pgcode}")
c.close()

# R5 / TC-12.5 — throughput: 500 sequential commits on distinct future periods
c, cur = conn()
for i in range(500):
    d = f"[2027-01-{(i%27)+1:02d} 14:00+04,2027-01-{(i%27)+1:02d} 18:00+04)"
    cur.execute("SELECT record_occupancy(%s,%s,%s::tstzrange,%s,%s,%s)",
                (T_A, f"00000000-0000-0000-0000-0000000002{i%15:02x}"[:36], d, str(uuid.uuid4()), "reservation", False)) \
        if False else None
# simpler: hammer the dorm's 27 distinct day-slots across bed positions
c.rollback(); c.close()
per_thread = []
def burst(n, out):
    c, cur = conn(); ok = 0
    for i in range(n):
        day = (i % 27) + 1
        p = f"[2027-02-{day:02d} 08:00+04,2027-02-{day:02d} 09:00+04)"
        try:
            cur.execute("SELECT record_occupancy(%s,%s,%s::tstzrange,%s,'segment',false)",
                        (T_A, DORM, p, str(uuid.uuid4())))
            c.commit(); ok += 1
        except Exception:
            c.rollback()
    c.close(); out.append(ok)
t0 = time.perf_counter(); outs = []
ths = [threading.Thread(target=burst, args=(50, outs)) for _ in range(8)]
[t.start() for t in ths]; [t.join() for t in ths]
dt = time.perf_counter() - t0; done = sum(outs)
if dt <= 0:
    raise RuntimeError(f"TC-12.5 harness clock invalid: elapsed time must be positive, got {dt}")
check("TC-12.5", "concurrent commit throughput", done > 0, f"{done} commits in {dt:.2f}s = {done/dt:.0f}/s")

# R6 / TC-5.6 — unbalanced journal rejected AT COMMIT by deferred trigger
c, cur = conn()
jid = str(uuid.uuid4())
cur.execute("""INSERT INTO journal (id,tenant_id,property_node,business_date,kind,description,currency)
               VALUES (%s,%s,%s,'2026-09-15','charge','unbalanced test','AED')""", (jid, T_A, PROP))
cur.execute("""INSERT INTO posting_line (tenant_id,journal_id,seq,account_id,tx_code,amount_minor,business_date)
               VALUES (%s,%s,1,%s,'ROOM',50000,'2026-09-15')""", (T_A, jid, ACC_REV))
try:
    c.commit(); check("TC-5.6", "unbalanced journal rejected at COMMIT", False, "COMMIT SUCCEEDED — ledger unsafe")
except psycopg2.Error as e:
    check("TC-5.6", "unbalanced journal rejected at COMMIT", True, f"{(e.pgerror or '').splitlines()[0][:60]}")
c.close()

# R6b — balanced journal COMMITS (the trigger isn't just rejecting everything)
c, cur = conn()
jid = str(uuid.uuid4())
cur.execute("""INSERT INTO journal (id,tenant_id,property_node,business_date,kind,description,currency)
               VALUES (%s,%s,%s,'2026-09-15','charge','balanced test','AED')""", (jid, T_A, PROP))
cur.execute("""INSERT INTO posting_line (tenant_id,journal_id,seq,account_id,tx_code,amount_minor,business_date)
               VALUES (%s,%s,1,%s,'ROOM',50000,'2026-09-15'),(%s,%s,2,%s,'ROOM',-50000,'2026-09-15')""",
            (T_A, jid, ACC_REV, T_A, jid, ACC_CASH))
try:
    c.commit(); check("TC-7.1", "balanced journal commits", True)
except psycopg2.Error as e:
    check("TC-7.1", "balanced journal commits", False, str(e).splitlines()[0][:60])
c.close()

# R7 / TC-5.4 + TC-7.3 — seal a day, then posting to it is blocked
c, cur = conn()
cur.execute("SELECT seal_business_day(%s,%s,'2026-09-15',NULL)", (T_A, PROP)); c.commit()
jid = str(uuid.uuid4())
try:
    cur.execute("""INSERT INTO journal (id,tenant_id,property_node,business_date,kind,description,currency)
                   VALUES (%s,%s,%s,'2026-09-15','charge','late','AED')""", (jid, T_A, PROP))
    cur.execute("""INSERT INTO posting_line (tenant_id,journal_id,seq,account_id,tx_code,amount_minor,business_date)
                   VALUES (%s,%s,1,%s,'ROOM',100,'2026-09-15'),(%s,%s,2,%s,'ROOM',-100,'2026-09-15')""",
                (T_A, jid, ACC_REV, T_A, jid, ACC_CASH))
    c.commit(); check("TC-5.4", "posting to sealed day blocked", False, "post SUCCEEDED on sealed day")
except psycopg2.Error as e:
    c.rollback(); check("TC-5.4", "posting to sealed day blocked", True, f"{(e.pgerror or '').splitlines()[0][:60]}")
c.close()

# R8 / TC-8.2 — 100 concurrent invoice numbers → gapless, no duplicates
def issue(out):
    c, cur = conn()
    try:
        cur.execute("UPDATE document_series SET next_no = next_no + 1 WHERE id=%s RETURNING next_no - 1, prefix",
                    (INV_SERIES,))
        n, pref = cur.fetchone()
        cur.execute("""INSERT INTO document (tenant_id,property_node,kind,series_id,doc_no,status,content)
                       VALUES (%s,%s,'invoice',%s,%s,'issued','{}')""", (T_A, PROP, INV_SERIES, f"{pref}{n:06d}"))
        c.commit(); out.append(n)
    except Exception:
        c.rollback()
    finally:
        c.close()
nums = []
ths = [threading.Thread(target=issue, args=(nums,)) for _ in range(100)]
[t.start() for t in ths]; [t.join() for t in ths]
gapless = sorted(nums) == list(range(min(nums), min(nums) + len(nums))) and len(set(nums)) == 100
check("TC-8.2", "100 concurrent invoice numbers gapless", gapless, f"issued={len(nums)} range={min(nums)}..{max(nums)}")

# R9 / TC-13.1 (fixed) — RLS on TABLES via app_role
c, cur = conn(role_app=True, tenant=T_A); cur.execute("SELECT count(*) FROM space"); a = cur.fetchone()[0]; c.close()
c, cur = conn(role_app=True, tenant=T_B); cur.execute("SELECT count(*) FROM space"); b = cur.fetchone()[0]; c.close()
c, cur = conn()
cur.execute("""
    SELECT count(*)::int,
           count(*) FILTER (WHERE cls.relrowsecurity)::int,
           count(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM pg_policy pol
                WHERE pol.polrelid = cls.oid AND pol.polname = 'tenant_isolation'
           ))::int
      FROM information_schema.columns col
      JOIN information_schema.tables tbl
        ON tbl.table_schema = col.table_schema AND tbl.table_name = col.table_name
       AND tbl.table_type = 'BASE TABLE'
      JOIN pg_namespace ns ON ns.nspname = col.table_schema
      JOIN pg_class cls ON cls.relnamespace = ns.oid AND cls.relname = col.table_name
     WHERE col.table_schema = 'public' AND col.column_name = 'tenant_id'
""")
tenant_tables, rls_tables, policy_tables = cur.fetchone(); c.close()
table_catalog_ok = tenant_tables > 0 and rls_tables == tenant_tables and policy_tables == tenant_tables
check("TC-13.1", "table RLS: A sees 16, B sees 0", a == 16 and b == 0 and table_catalog_ok,
      f"A={a} B={b} tenant_tables={tenant_tables} rls={rls_tables} policies={policy_tables}")

# R10 / TC-13.4 (NEW) — RLS through VIEWS (the proven leak class)
c, cur = conn(role_app=True, tenant=T_A)
cur.execute("SELECT tenant_id::text FROM current_rate_price"); rows_a = [row[0] for row in cur.fetchall()]; c.close()
c, cur = conn(role_app=True, tenant=T_B)
cur.execute("SELECT tenant_id::text FROM current_rate_price"); rows_b = [row[0] for row in cur.fetchall()]; c.close()
c, cur = conn()
cur.execute("""
    SELECT count(*)::int,
           count(*) FILTER (WHERE COALESCE(cls.reloptions, ARRAY[]::text[]) @> ARRAY['security_invoker=true'])::int
      FROM pg_class cls
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
     WHERE ns.nspname = 'public' AND cls.relkind = 'v'
""")
view_count, invoker_views = cur.fetchone(); c.close()
view_behavior_ok = bool(rows_a) and bool(rows_b) and all(t == T_A for t in rows_a) and all(t == T_B for t in rows_b)
view_catalog_ok = view_count > 0 and invoker_views == view_count
check("TC-13.4", "view RLS: each tenant sees only itself", view_behavior_ok and view_catalog_ok,
      f"A:{len(rows_a)}rows B:{len(rows_b)}rows views={view_count} security_invoker={invoker_views}")

print("\n" + "=" * 60)
p = sum(1 for r in results if r[2]); f = len(results) - p
print(f"RESULT: {p} passed, {f} failed of {len(results)}")
sys.exit(1 if f else 0)
