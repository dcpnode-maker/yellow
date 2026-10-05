import { createElement, useEffect, useRef, useState } from "react";
import { reactAuthSession, type AuthSnapshot } from "../auth-session";
import { createStaffGroupBlockClient } from "./staff-group-block-client";
import { createStaffGroupBlockEvidenceCard } from "./StaffGroupBlockEvidenceCard.mjs";
import "./group-block-evidence.css";

const StaffGroupBlockEvidenceCard = createStaffGroupBlockEvidenceCard(createElement);
type Evidence = Awaited<ReturnType<ReturnType<typeof createStaffGroupBlockClient>["read"]>>;
type ReadState = Readonly<{ propertyId: string; snapshot: AuthSnapshot; generation: number; loading: boolean; evidence: Evidence | null; error: string }>;

/** Read-only composition in the reservation board; existing server reads remain authoritative. */
export function StaffGroupBlockWorkbench({ propertyId }: Readonly<{ propertyId: string }>) {
  const client = useRef(createStaffGroupBlockClient()).current;
  const generation = useRef(0), active = useRef<AbortController | null>(null);
  const [state, setState] = useState<ReadState>(() => ({ propertyId, snapshot: reactAuthSession.getSnapshot(), generation: 0,
    loading: true, evidence: null, error: "" }));
  const read = async () => {
    const attempt = ++generation.current, snapshot = reactAuthSession.getSnapshot();
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    const context = { propertyId, snapshot, generation: attempt };
    setState({ ...context, loading: true, evidence: null, error: "" });
    try {
      const evidence = await client.read(propertyId, controller.signal);
      if (attempt === generation.current && !controller.signal.aborted && snapshot === reactAuthSession.getSnapshot()) {
        setState({ ...context, loading: false, evidence, error: "" });
      }
    } catch (reason) {
      if (attempt === generation.current && !controller.signal.aborted && snapshot === reactAuthSession.getSnapshot()) {
        setState({ ...context, loading: false, evidence: null, error: reason instanceof Error ? reason.message : "Group blocks are unavailable." });
      }
    }
  };
  useEffect(() => {
    void read(); const unsubscribe = reactAuthSession.subscribe(() => { void read(); });
    return () => { ++generation.current; active.current?.abort(); unsubscribe(); };
  }, [propertyId, client]);
  const sameContext = state.propertyId === propertyId && state.snapshot === reactAuthSession.getSnapshot();
  const evidence = sameContext && !state.loading && !state.error ? state.evidence : null;
  const loading = sameContext && state.loading;
  return <section className="group-block-workbench" aria-labelledby="group-block-workbench-title">
    <header><div><span className="state">GROUP RESERVATIONS · BLOCK MANAGEMENT</span><h2 id="group-block-workbench-title">Group blocks and pickup</h2>
      <p>Dated allotment and pickup evidence. Open a block’s details to see all rooming rows.</p></div></header>
    <div className="reservation-board-actions"><button type="button" disabled={loading || reactAuthSession.getSnapshot().status !== "authenticated"} onClick={() => void read()}>
      {loading ? "Reading group blocks…" : "Refresh group blocks"}</button></div>
    {sameContext && state.error ? <p className="error" role="alert">{state.error}</p> : null}
    {!loading && !evidence && !(sameContext && state.error) ? <p className="empty">Group block evidence is unavailable.</p> : null}
    {evidence && evidence.groups.length === 0 ? <p className="empty">No group blocks returned for {evidence.property.name}.</p> : null}
    <div className="group-block-list">{evidence?.groups.map(group => <StaffGroupBlockEvidenceCard
      key={`${group.groupId}:${state.generation}`} group={group} evidenceState="current"
      contextLabel={evidence.property.name}
      reservationLinks={Object.fromEntries(group.roomingList.map(row => [row.reservationId,
        <a href={`/p/${propertyId}/res/${row.reservationId}`} aria-label={`Open reservation ${row.confirmationNo} for ${row.primaryGuestDisplayName}`}>
          Open reservation {row.confirmationNo}</a>]))} />)}</div>
  </section>;
}
