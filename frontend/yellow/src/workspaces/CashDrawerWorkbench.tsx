import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { VoiceTextarea } from "../ui/VoiceField";
import { createCashDrawerController, type CashAction, type CashDrawerController, type CashDrawerSnapshot, type CashDrawerState } from "./cash-drawer-client";
import "./cash-drawer-workbench.css";

export type CashDrawerWorkbenchProps = Readonly<{
  propertyId: string;
  getToken: () => Promise<string>;
  loadSnapshot: () => Promise<CashDrawerSnapshot>;
  acquireMutationLease: (attemptId: string) => boolean;
  releaseMutationLease: (attemptId: string) => void;
  onSnapshot?: (fresh: CashDrawerSnapshot) => void;
  disabled?: boolean;
}>;

const LABEL: Record<CashAction, string> = {
  open: "Open drawer", count: "Record blind count", "request-approval": "Request over/short approval",
  "supervised-request": "Supervisor: request approval", approve: "Approve request", reject: "Reject request",
  close: "Close drawer", "supervised-close": "Supervisor: close drawer",
};

/** Cashier custody UI. No client-calculated totals or expected cash are presented. */
export function CashDrawerWorkbench(props: CashDrawerWorkbenchProps) {
  // Each property gets its own callback binding. An old in-flight controller
  // must never pick up callbacks from a newly selected property during render.
  const scoped = useMemo(() => {
    const binding = { current: props };
    const controller = createCashDrawerController({
      propertyId: props.propertyId,
      getToken: () => binding.current.getToken(),
      loadSnapshot: () => binding.current.loadSnapshot(),
      acquireMutationLease: id => binding.current.acquireMutationLease(id),
      releaseMutationLease: id => binding.current.releaseMutationLease(id),
      onSnapshot: fresh => binding.current.onSnapshot?.(fresh),
    });
    return { controller, binding };
  }, [props.propertyId]);
  scoped.binding.current = props;
  const controller = scoped.controller;
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    controller.activate();
    void controller.refresh();
    return () => controller.dispose();
  }, [controller]);
  useEffect(() => { setConfirmed(false); }, [state.status, state.reviewed]);
  const ownsLease = state.status === "editing" || state.status === "review" || state.status === "posting" || state.status === "uncertain";
  useEffect(() => {
    if (!ownsLease) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [ownsLease]);

  return <CashDrawerPanel state={state} controller={controller} disabled={props.disabled} confirmed={confirmed} onConfirmed={setConfirmed} />;
}

/** Pure renderer so the exact locked/review/empty states can be exercised without browser mutation. */
export function CashDrawerPanel({ state, controller, disabled, confirmed, onConfirmed }: Readonly<{
  state: CashDrawerState; controller: CashDrawerController; disabled?: boolean; confirmed: boolean;
  onConfirmed: (value: boolean) => void;
}>) {

  const drawers = state.readError ? [] : state.snapshot?.drawers ?? [];
  const drawer = drawers.find(row => row.drawerId === state.selectedDrawerId) ?? null;
  const command = state.reviewed;
  const blocked = Boolean(disabled) || state.readError !== null || state.loading;
  const canEdit = state.status === "editing";
  const active = state.status === "editing" || state.status === "review" || state.status === "posting" || state.status === "uncertain";

  return <section className="cash-drawer-workbench" aria-label="Cash drawer custody" data-lifecycle-recovery={active ? "true" : undefined}>
    <header className="cash-drawer-heading">
      <div><h3>Cash drawer</h3><p>Count physical cash by configured denomination. The server determines custody and any variance.</p></div>
      <button type="button" onClick={() => void controller.refresh()} disabled={state.loading || state.status === "posting"}>Refresh drawers</button>
    </header>
    {state.readError && <p className="cash-drawer-error" role="alert">{state.readError}</p>}
    {state.loading && !state.snapshot && <p role="status">Loading configured drawers…</p>}
    {!state.loading && !state.readError && drawers.length === 0 && <p className="cash-drawer-empty">No cash drawer is configured for this property. Ask an authorized administrator to configure one before accepting cash.</p>}
    {drawers.length > 0 && <div className="cash-drawer-picker" role="group" aria-label="Configured cash drawers">
      {drawers.map(item => <button type="button" key={item.drawerId} className={item.drawerId === drawer?.drawerId ? "selected" : ""}
        aria-pressed={item.drawerId === drawer?.drawerId} disabled={active || blocked}
        onClick={() => controller.selectDrawer(item.drawerId)}>{item.name} <small>{item.code} · {item.currency}</small></button>)}
    </div>}
    {drawer && <div className="cash-drawer-detail">
      <p className="cash-drawer-meta"><strong>{drawer.name}</strong> · {drawer.code} · {drawer.currency} · {drawer.session ? `Open session ${drawer.session.sessionId}` : "No open session"}</p>
      {drawer.session && <p className="cash-drawer-meta">Business date {drawer.session.businessDate} · {drawer.session.latestCount ? `Latest count ${drawer.session.latestCount.countId}` : "No closing count yet"}</p>}
      {state.status === "idle" && <div className="cash-drawer-actions">
        {!drawer.session && drawer.canOpen && <Action action="open" blocked={blocked} start={controller.start} />}
        {drawer.session && drawer.canCount && <Action action="count" blocked={blocked} start={controller.start} />}
        {drawer.session?.latestCount && <>
          {drawer.canCount && <Action action="request-approval" blocked={blocked} start={controller.start} />}
          {drawer.supervised && <><Action action="supervised-request" blocked={blocked} start={controller.start} /><Action action="approve" blocked={blocked} start={controller.start} /><Action action="reject" blocked={blocked} start={controller.start} /></>}
          {drawer.canCount && drawer.canClose && <Action action="close" blocked={blocked} start={controller.start} />}
          {drawer.supervised && drawer.canClose && <Action action="supervised-close" blocked={blocked} start={controller.start} />}
        </>}
        {!drawer.canOpen && !drawer.canCount && !drawer.supervised && <p>Cashier operation access is not granted for this property.</p>}
      </div>}
      {canEdit && state.action && <div className="cash-drawer-form">
        <h4>{LABEL[state.action]}</h4>
        {(state.action === "open" || state.action === "count") && <>
          <p>Enter the physical quantity for every configured denomination. No expected amount or calculated total is shown during a blind count.</p>
          <div className="cash-drawer-denominations">{drawer.denominations.map(row => <label key={row.denominationMinor}>
            <span>{row.denominationMinor} minor units</span>
            <input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={19}
              value={state.quantities[row.denominationMinor] ?? "0"} onChange={event => controller.setQuantity(row.denominationMinor, event.target.value)} />
          </label>)}</div>
        </>}
        {(state.action === "approve" || state.action === "reject" || state.action === "close" || state.action === "supervised-close") && <label className="cash-drawer-field">
          <span>Approval request UUID {state.action === "close" || state.action === "supervised-close" ? "(if required by the server)" : "(required)"}</span>
          <input type="text" autoComplete="off" spellCheck={false} maxLength={36} value={state.approvalId} onChange={event => controller.setApprovalId(event.target.value)} />
        </label>}
        {(state.action === "close" || state.action === "supervised-close") && <label className="cash-drawer-field"><span>Variance reason, when using an approval ID</span>
          <VoiceTextarea aria-label="Cash drawer variance reason" contextKey={`${drawer.propertyNode}:${drawer.drawerId}:${drawer.session?.sessionId ?? "new"}:close`}
            onVoiceValue={value => controller.setReason(value)} maxLength={500} value={state.reason}
            onChange={event => controller.setReason(event.target.value)} /></label>}
        {(state.action === "approve" || state.action === "reject") && <p>The approval UUID must be supplied from a separately supervised request handoff. This page cannot read pending approval state; the server enforces actor separation.</p>}
        <div className="cash-drawer-buttons"><button type="button" onClick={() => controller.review()}>Review exact request</button><button type="button" className="quiet" onClick={() => controller.cancel()}>Cancel</button></div>
      </div>}
    </div>}
    {canEdit && !drawer && <div className="cash-drawer-form" role="alert">
      <p>The selected drawer is unavailable. This unsent draft is retained; cancel it and refresh before starting again.</p>
      <button type="button" className="quiet" onClick={() => controller.cancel()}>Cancel draft</button>
    </div>}
    {state.status === "review" && command && <div className="cash-drawer-review">
        <h4>Review {LABEL[command.action]}</h4>
        <p>Drawer {drawer?.name ?? command.drawerId}; {command.sessionId ? `session ${command.sessionId}` : "new session"}{command.countId ? `; count ${command.countId}` : ""}.</p>
        {(command.action === "open" || command.action === "count") && <ul>{(command.body.denominations as readonly { denominationMinor: string; quantity: string }[]).map(row =>
          <li key={row.denominationMinor}>{row.denominationMinor} minor units × {row.quantity}</li>)}</ul>}
        {command.approvalId && <p>Approval UUID: {command.approvalId}</p>}
        {typeof command.body.reason === "string" && <p>Reason: {command.body.reason}</p>}
        <p className="cash-drawer-note">The command body and operation key freeze on submission. If the response is uncertain, only this exact request can be reconciled.</p>
        <label className="cash-drawer-confirm"><input type="checkbox" checked={confirmed} onChange={event => onConfirmed(event.target.checked)} /> I verified the physical count and the exact drawer action.</label>
        <div className="cash-drawer-buttons"><button type="button" disabled={!confirmed || state.readError !== null || !drawer} onClick={() => void controller.submit()}>Submit {LABEL[command.action]}</button><button type="button" className="quiet" disabled={!drawer} onClick={() => controller.edit()}>Edit</button><button type="button" className="quiet" onClick={() => controller.cancel()}>Cancel</button></div>
      </div>}
    {state.status === "posting" && <p role="status">Checking the exact cashier request…</p>}
    {state.status === "uncertain" && <div className="cash-drawer-uncertain" role="alert"><p>{state.message}</p><button type="button" onClick={() => void controller.submit()}>Reconcile exact request</button></div>}
    {(state.status === "ready" || state.status === "rejected") && <div className={state.status === "ready" ? "cash-drawer-ready" : "cash-drawer-error"} role="status">
      <p>{state.message}</p>{state.status === "ready" && typeof state.evidence?.approvalId === "string" && <p>Approval request UUID for supervised handoff: <code>{state.evidence.approvalId}</code></p>}
      <button type="button" onClick={() => controller.acknowledge()}>Done</button>
    </div>}
    {state.message && (state.status === "editing" || state.status === "idle") && <p role="alert" className="cash-drawer-error">{state.message}</p>}
  </section>;
}

function Action({ action, blocked, start }: Readonly<{ action: CashAction; blocked: boolean; start: (action: CashAction) => boolean }>) {
  return <button type="button" disabled={blocked} onClick={() => start(action)}>{LABEL[action]}</button>;
}
