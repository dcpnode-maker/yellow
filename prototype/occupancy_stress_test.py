#!/usr/bin/env python3
"""
space_occupancy concurrency stress test — the one architectural claim that needed
evidence rather than reasoning.

Proves, under real concurrent load:
  T1  Exclusive integrity: N clients race for the same private room, same dates
      -> exactly 1 wins, N-1 get a clean constraint rejection.
  T2  Composite exclusivity: private-room sale vs dorm-bed sales on the SAME space
      -> whoever commits first blocks the other configuration.
  T3  Capacity integrity: N clients race for beds in a 6-bed dorm, same dates
      -> exactly 6 win.
  T4  Choke point: the app role attempting direct INSERT on space_occupancy
      -> permission denied. Only record_occupancy() works.
  T5  Throughput: sustained non-overlapping bookings/sec through the choke point.

Run:  python3 occupancy_stress_test.py  (expects local PG16 with prototype schema)
"""
import psycopg2, threading, time, uuid, random

DSN = "host=127.0.0.1 dbname=pms_proto user=app_role password=app"
TEN = '00000000-0000-0000-0000-000000000001'
ROOM = '00000000-0000-0000-0000-00000000000a'   # capacity 1, sold exclusive
DORM = '00000000-0000-0000-0000-00000000000b'   # capacity 6, beds non-exclusive

def attempt(space, period, exclusive, results, idx):
    try:
        con = psycopg2.connect(DSN); con.autocommit = False
        cur = con.cursor()
        cur.execute("SELECT record_occupancy(%s,%s,%s::tstzrange,%s,%s)",
                    (TEN, space, period, str(uuid.uuid4()), exclusive))
        con.commit(); results[idx] = 'WIN'
    except psycopg2.Error as e:
        results[idx] = ('REJECT:' + (e.pgcode or '?'))
    finally:
        try: con.close()
        except: pass

def race(n, space, period, exclusive):
    results = [None]*n
    ts = [threading.Thread(target=attempt, args=(space, period, exclusive, results, i)) for i in range(n)]
    t0 = time.perf_counter()
    [t.start() for t in ts]; [t.join() for t in ts]
    dt = time.perf_counter() - t0
    wins = results.count('WIN')
    return wins, n - wins, dt, results

def main():
    print("=" * 64)

    # T1 — exclusive race on the private room
    wins, rej, dt, _ = race(50, ROOM, "[2026-09-01 14:00+00,2026-09-03 12:00+00)", True)
    ok1 = wins == 1
    print(f"T1 exclusive race (50 clients, 1 room):  wins={wins} rejects={rej}  "
          f"{dt*1000:.0f}ms   {'PASS' if ok1 else 'FAIL'}")

    # T2 — composite: 25 clients try DORM as a private room (exclusive),
    #      25 simultaneously try beds in it (non-exclusive), same dates.
    results = [None]*50
    ts = []
    per = "[2026-09-01 14:00+00,2026-09-03 12:00+00)"
    for i in range(50):
        excl = (i % 2 == 0)
        ts.append(threading.Thread(target=attempt, args=(DORM, per, excl, results, i)))
    [t.start() for t in ts]; [t.join() for t in ts]
    excl_wins = sum(1 for i,r in enumerate(results) if r=='WIN' and i%2==0)
    bed_wins  = sum(1 for i,r in enumerate(results) if r=='WIN' and i%2==1)
    # Legal outcomes: private sold (1,0) or beds sold (0,1..6) — never both.
    ok2 = (excl_wins == 1 and bed_wins == 0) or (excl_wins == 0 and 1 <= bed_wins <= 6)
    print(f"T2 composite race (private vs beds):     private={excl_wins} beds={bed_wins}"
          f"            {'PASS' if ok2 else 'FAIL'}  (never both)")

    # T3 — capacity: fresh dates, 40 clients race for 6 beds
    wins, rej, dt, _ = race(40, DORM, "[2026-10-01 14:00+00,2026-10-05 12:00+00)", False)
    ok3 = wins == 6
    print(f"T3 capacity race (40 clients, 6 beds):   wins={wins} rejects={rej}  "
          f"{dt*1000:.0f}ms   {'PASS' if ok3 else 'FAIL'}")

    # T4 — choke point: direct INSERT must be denied
    try:
        con = psycopg2.connect(DSN); cur = con.cursor()
        cur.execute("INSERT INTO space_occupancy (tenant_id,space_id,period,slot_ref,exclusive)"
                    " VALUES (%s,%s,%s::tstzrange,%s,true)",
                    (TEN, ROOM, "[2027-01-01,2027-01-02)", str(uuid.uuid4())))
        con.commit(); ok4 = False; msg = "INSERT SUCCEEDED (bad)"
    except psycopg2.Error as e:
        ok4 = e.pgcode == '42501'; msg = f"denied ({e.pgcode})"
    print(f"T4 choke point (direct INSERT as app):   {msg:>22}            "
          f"{'PASS' if ok4 else 'FAIL'}")

    # T5 — throughput: 500 non-overlapping bookings, 10 threads
    def worker(k, out):
        con = psycopg2.connect(DSN); cur = con.cursor(); n=0
        for j in range(50):
            d = k*50 + j
            cur.execute("SELECT record_occupancy(%s,%s,%s::tstzrange,%s,true)",
                (TEN, ROOM, f"[2028-01-01 {d//60:02d}:{d%60:02d}+00,2028-01-01 {d//60:02d}:{d%60:02d}:30+00)",
                 str(uuid.uuid4())))
            con.commit(); n+=1
        out[k]=n; con.close()
    out=[0]*10; t0=time.perf_counter()
    ths=[threading.Thread(target=worker,args=(k,out)) for k in range(10)]
    [t.start() for t in ths]; [t.join() for t in ths]
    dt=time.perf_counter()-t0; total=sum(out)
    print(f"T5 throughput:                           {total} bookings / {dt:.2f}s = "
          f"{total/dt:,.0f} commits/sec")
    print("=" * 64)
    allok = ok1 and ok2 and ok3 and ok4
    print("VERDICT:", "ALL PASS — the composite-slot constraint holds under concurrency."
          if allok else "FAILURES — investigate before ERD hardens.")
    return 0 if allok else 1

if __name__ == "__main__":
    raise SystemExit(main())
