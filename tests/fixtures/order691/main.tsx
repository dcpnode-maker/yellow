import { useCallback, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FolioWindowComparison } from "../../../frontend/yellow/src/ui/FolioWindowComparison";
import {
  makeOrder691Statement,
  makeOrder691WindowFamily,
  ORDER691_OTHER_RESERVATION,
  ORDER691_PROPERTY_ID,
  ORDER691_RESERVATION_ONE,
  ORDER691_RESERVATION_TWO,
} from "./data";
import type { FolioWindowComparisonWindow } from "../../../frontend/yellow/src/folio-window-comparison";
import type { Order691Statement } from "./data";
import "../../../frontend/yellow/src/styles.css";

const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

function Fixture() {
  const [reservationId, setReservationId] = useState(ORDER691_RESERVATION_ONE);
  const [count, setCount] = useState(2);
  const [family, setFamily] = useState(() => makeOrder691WindowFamily(ORDER691_RESERVATION_ONE, 2));
  const [activeFolioId, setActiveFolioId] = useState(family[0]?.folioId ?? null);
  const [locked, setLocked] = useState(false);
  const [targetWindowNo, setTargetWindowNo] = useState(2);
  const [reads, setReads] = useState(0);
  const [lastRead, setLastRead] = useState("No statement read yet.");
  const failNextRead = useRef<string | null>(null);
  const mismatchNextRead = useRef<string | null>(null);
  const familyById = useMemo(() => new Map(family.map((window) => [window.folioId, window])), [family]);

  const loadStatement = useCallback(async (folioId: string): Promise<Order691Statement> => {
    setReads((value) => value + 1);
    await new Promise((resolve) => setTimeout(resolve, 160));
    const window = familyById.get(folioId);
    if (!window) throw new Error("Synthetic fixture has no such folio window.");
    if (failNextRead.current === folioId) {
      failNextRead.current = null;
      setLastRead(`Synthetic one-time failure for Window ${window.windowNo}; retry will succeed.`);
      throw new Error("Synthetic temporary statement outage for this window. Retry this pane.");
    }
    const statement = makeOrder691Statement(reservationId, window);
    if (mismatchNextRead.current === folioId) {
      mismatchNextRead.current = null;
      setLastRead(`Synthetic wrong-reservation response for Window ${window.windowNo}; the client must reject it.`);
      return { ...statement, reservationId: ORDER691_OTHER_RESERVATION };
    }
    setLastRead(`Read-only statement loaded for Window ${window.windowNo} in ${reservationId}.`);
    return statement;
  }, [familyById, reservationId]);

  const changeFamily = (nextCount: number) => {
    const nextFamily = makeOrder691WindowFamily(reservationId, nextCount);
    setCount(nextCount);
    setFamily(nextFamily);
    setActiveFolioId(nextFamily[0]?.folioId ?? null);
    setTargetWindowNo(Math.min(2, nextCount));
    failNextRead.current = null;
    mismatchNextRead.current = null;
  };
  const switchReservation = () => {
    const nextReservation = reservationId === ORDER691_RESERVATION_ONE ? ORDER691_RESERVATION_TWO : ORDER691_RESERVATION_ONE;
    const nextFamily = makeOrder691WindowFamily(nextReservation, count);
    setReservationId(nextReservation);
    setFamily(nextFamily);
    setActiveFolioId(nextFamily[0]?.folioId ?? null);
    failNextRead.current = null;
    mismatchNextRead.current = null;
    setLastRead("Reservation context switched. Previous pane state is no longer mounted.");
  };
  const targetFolio = family.find((window) => window.windowNo === targetWindowNo)?.folioId ?? null;

  return <main className="order691-fixture">
    <header className="order691-fixture-header">
      <div><p>LOCAL CUA FIXTURE · NO LIVE FINANCE</p><h1>Folio window comparison</h1>
        <p>Property {ORDER691_PROPERTY_ID} · Reservation {reservationId}</p></div>
      <span className="order691-fixture-badge">READ ONLY</span>
    </header>
    <section className="order691-fixture-controls" aria-label="Synthetic comparison scenarios">
      <fieldset><legend>Existing window count</legend><div role="group" aria-label="Choose family size">
        {[1, 2, 9, 20].map((nextCount) => <button type="button" key={nextCount} aria-pressed={count === nextCount} onClick={() => changeFamily(nextCount)}>{nextCount} window{nextCount === 1 ? "" : "s"}</button>)}
      </div></fieldset>
      <button type="button" onClick={switchReservation}>Switch reservation context</button>
      <label className="order691-fixture-lock"><input type="checkbox" checked={locked} onChange={(event) => setLocked(event.target.checked)} /> Lock financial navigation</label>
      <label>Test pane<select aria-label="Test pane" value={targetWindowNo} onChange={(event) => setTargetWindowNo(Number(event.target.value))}>
        {family.map((window) => <option key={window.folioId} value={window.windowNo}>Window {window.windowNo}</option>)}
      </select></label>
      <button type="button" disabled={targetFolio === null} onClick={() => { if (targetFolio) { failNextRead.current = targetFolio; setLastRead(`Next read of Window ${targetWindowNo} will fail once.`); } }}>Fail next read once</button>
      <button type="button" disabled={targetFolio === null} onClick={() => { if (targetFolio) { mismatchNextRead.current = targetFolio; setLastRead(`Next read of Window ${targetWindowNo} will return the wrong reservation once.`); } }}>Return wrong reservation once</button>
    </section>
    <p className="order691-fixture-safety" role="note">Synthetic local statements only. This fixture has no backend, database, journal, charge, transfer, or live reservation connection.</p>
    <p className="order691-fixture-read-log" role="status" aria-live="polite">Fixture reads: {reads} · {lastRead}</p>
    <FolioWindowComparison propertyId={ORDER691_PROPERTY_ID} reservationId={reservationId} family={family as readonly FolioWindowComparisonWindow[]}
      activeFolioId={activeFolioId} financialNavigationLocked={locked}
      onActivate={(folioId) => { if (!locked && familyById.has(folioId)) setActiveFolioId(folioId); }}
      loadStatement={loadStatement} refreshToken={`${reservationId}:${activeFolioId ?? "none"}`} />
  </main>;
}

createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>);
