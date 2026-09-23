import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as AppRuntime from "../yellow-api";
import type {
  ReservationDetail, Stay, Lane, FolioStatement, FolioChargeOption, FolioChargeGroup, FolioTransferGroup, FolioTransferPreview, FolioTransferDraft, FolioTransferReceipt, FolioTransferAttempt, ReceivableTarget, ReceivablePreview, ReceivableApprovalReceipt, HostedDepositWorkbench, HostedDepositLink, HostedDepositStatus, DepositDraft, DepositAttempt, CashierSnapshot
} from "../yellow-api";

const routeMatch = /^\/p\/([^/]+)(?:\/res\/([^/]+))?(?:\/[^/]*)?$/.exec(window.location.pathname);
const propertyId = routeMatch?.[1] ?? "6081b544-22a1-534f-a86d-bb1ae0519e14";
const requestedFinanceReservation = new URLSearchParams(window.location.search).get("reservation")?.trim() ?? null;
const { session, loadCashierSnapshot, loadFolioStatement, loadReservationBoard, loadReservation, loadHostedDepositWorkbench, loadHostedDepositStatus, createHostedDeposit, applyHostedDeposit, loadReceivableTargets, previewReceivableTransfer, requestReceivableApproval, submitReceivableTransfer, postFolioCharge, requestFolioTransferPreview, previewMatchesFolioTransferDraft, sameTransferPreview, submitFolioTransfer, housekeepingFailureIsUncertain, sameReceivablePreview, openPrimaryFolio, transferWindowNameIsValid, transferReasonIsValid, FolioChargeRequestError, FolioTransferRequestError, PrimaryFolioRequestError, POSITIVE_MINOR, EXACT_MINOR } = AppRuntime;
const nameOf = (stay: Stay) => stay.primaryGuestDisplayName ?? stay.primaryPartyName ?? stay.confirmationNo;
export const reservationStatusLabel = (status: string): string => {
  if (status === "due_in") return "Expected arrival";
  if (status === "due_out") return "Departure today";
  if (status === "in_house") return "In house";
  if (status === "checked_out") return "Departed history";
  return status.replaceAll("_", " ");
};
export const reservationStatusDescription = (status: string): string => {
  if (status === "due_in") return "Due in · expected arrival";
  if (status === "due_out") return "Due out · departure today";
  if (status === "in_house") return "In house · occupied";
  if (status === "checked_out") return "Checked out · departed history";
  return reservationStatusLabel(status);
};
function money(minor: string, currency: string): string { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(BigInt(minor)) / 100); }
function moneyExactMinor(minor: string, currency: string): string { const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency }); const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2; const amount = BigInt(minor); const negative = amount < 0n; const absolute = negative ? -amount : amount; const scale = 10n ** BigInt(fractionDigits); const whole = absolute / scale; const fraction = (absolute % scale).toString().padStart(fractionDigits, "0"); const parts = formatter.formatToParts(negative ? -whole : whole); const rendered = parts.map((part) => part.type === "fraction" ? fraction : part.value).join(""); return negative && whole === 0n && !parts.some((part) => part.type === "minusSign") ? `-${rendered}` : rendered; }
function CashierGroupIcon({ group }: Readonly<{ group: FolioChargeGroup | "All" }>) { return <svg className="cashier-group-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">{group === "All" ? <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></> : null}{group === "Rooms" ? <><path d="M4 18V8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5V18" /><path d="M4 14h16M7 14v-3h4v3M3 18h18" /></> : null}{group === "Food & beverage" ? <><path d="M7 3v8a3 3 0 0 0 3 3V3M7 7h3M8.5 14v7" /><path d="M16 3v18M16 3c3 2 3 7 0 9" /></> : null}{group === "Wellness" ? <><path d="M12 21c4-3 7-6.2 7-11a4 4 0 0 0-7-2.6A4 4 0 0 0 5 10c0 4.8 3 8 7 11Z" /><path d="M9 12h6M12 9v6" /></> : null}{group === "Guest services" ? <><path d="M5 19h14M7 19v-3a5 5 0 0 1 10 0v3M12 11V8" /><circle cx="12" cy="5.5" r="1.5" /></> : null}{group === "Other" ? <><circle cx="6" cy="12" r="1.25" /><circle cx="12" cy="12" r="1.25" /><circle cx="18" cy="12" r="1.25" /></> : null}</svg>; }
function folioChargeGroup(option: FolioChargeOption): FolioChargeGroup { const searchable = `${option.code} ${option.name} ${option.usaliLine}`.toLocaleLowerCase(); if (/room|accommodation|lodging/u.test(searchable)) return "Rooms"; if (/food|beverage|drink|bar|alcohol|restaurant|dessert|f&b/u.test(searchable)) return "Food & beverage"; if (/spa|wellness|massage|salon|fitness/u.test(searchable)) return "Wellness"; if (/laundry|transport|transfer|parking|telephone|guest service/u.test(searchable)) return "Guest services"; return "Other"; }
function statusTone(status: string): string { if (status === "in_house" || status === "open" || status === "ready") return "positive"; if (status === "due_in" || status === "due_out" || status === "pending") return "attention"; return "neutral"; }
const CASHIER_STAY_PAGE_SIZE = 12;
function cashierCursorFor(page: number): string { return `cashier:${Math.max(0, page).toString(36)}`; }
function cashierPageFromCursor(cursor: string | null): number {
  if (!cursor?.startsWith("cashier:")) return 0;
  const page = Number.parseInt(cursor.slice("cashier:".length), 36);
  return Number.isFinite(page) && page >= 0 ? page : 0;
}
function cashierSearchEvidence(stay: Stay): readonly { label: string; value: string }[] {
  return [
    { label: "Confirmation", value: stay.confirmationNo },
    { label: "Room", value: stay.sellableUnitLabel ?? stay.unitTypeLabel ?? "Unassigned" },
    { label: "Source", value: [stay.channelCode, stay.sourceCode].filter(Boolean).join(" · ") || "Not recorded" },
    { label: "Market", value: stay.marketCode ?? "Not recorded" },
  ] as const;
}

function FinanceWorkspace({
  initialReservationId = requestedFinanceReservation,
  onLifecycleBusyChange,
}: Readonly<{
  initialReservationId?: string | null;
  onLifecycleBusyChange?: (busy: boolean) => void;
}> = {}) {
  const query = useQuery<CashierSnapshot, Error>({
    queryKey: ["cashier-snapshot", propertyId],
    queryFn: loadCashierSnapshot,
  });
  if (query.isLoading)
    return <section className="commercial-workspace"><p className="empty">Loading cashier and folio controls…</p></section>;
  if (query.isError || !query.data)
    return <section className="commercial-workspace"><p className="error">{query.error?.message ?? "Cashier status is unavailable."}</p></section>;
  const { drawers } = query.data;
  return <CashierWorkbench drawers={drawers} initialReservationId={initialReservationId} onLifecycleBusyChange={onLifecycleBusyChange} />;
}

type PrimaryBillingWindowAttempt = Readonly<{
  reservationId: string;
  fingerprint: string;
  key: string;
  body: "{}";
}>;

function PrimaryBillingWindowAction({
  reservation,
  reservationReadUnavailable,
  onOpened,
  onLifecycleBusyChange,
}: Readonly<{
  reservation: ReservationDetail["reservation"];
  reservationReadUnavailable: boolean;
  onOpened: (detail: ReservationDetail, folioId: string) => void;
  onLifecycleBusyChange?: (busy: boolean) => void;
}>) {
  const [confirmed, setConfirmed] = useState(false);
  const [posting, setPosting] = useState(false);
  const [recoveryLocked, setRecoveryLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const attempt = useRef<PrimaryBillingWindowAttempt | null>(null);
  const allowedStatuses = new Set(["reserved", "due_in", "in_house", "due_out"]);
  const eligible = allowedStatuses.has(reservation.status) && reservation.folios.length === 0;
  const reservationIdentity = `${reservation.reservationId}:${reservation.folios.map((folio) => folio.folioId).join("|")}`;
  const boundReservationIdentity = useRef(reservationIdentity);
  useEffect(() => {
    if (boundReservationIdentity.current === reservationIdentity) return;
    // A normal identity/topology change invalidates named consent. A retained
    // uncertain request is the narrow exception: it stays bound to its own key.
    if (!recoveryLocked && attempt.current === null) {
      setConfirmed(false);
      setMessage(null);
    }
    boundReservationIdentity.current = reservationIdentity;
  }, [recoveryLocked, reservationIdentity]);
  // An unresolved command must remain visible even if the next authoritative
  // read drifts. Its only permitted path is the retained same-key recovery.
  if ((!eligible || reservationReadUnavailable) && !recoveryLocked) return null;
  const confirmationName = reservation.guests.find((guest) => guest.role === "primary")?.displayName ?? reservation.confirmationNo;
  const isInHouseBilling = reservation.status === "in_house" || reservation.status === "due_out";
  const billingContextLabel = isInHouseBilling ? "IN-HOUSE BILLING" : "PRE-ARRIVAL BILLING";
  const completeFromDetail = (fresh: ReservationDetail, prefix: string): boolean => {
    if (fresh.reservation.reservationId !== reservation.reservationId) return false;
    const primary = fresh.reservation.folios.find((folio) => folio.windowNo === 1 && folio.status === "open");
    if (!primary) return false;
    attempt.current = null;
    setRecoveryLocked(false);
    setConfirmed(false);
    setMessage(`${prefix} The refreshed reservation confirms its open primary billing window.`);
    onLifecycleBusyChange?.(false);
    onOpened(fresh, primary.folioId);
    return true;
  };
  const submit = async () => {
    if (!confirmed || posting) return;
    setPosting(true);
    setMessage(null);
    onLifecycleBusyChange?.(true);
    let retainRecovery = recoveryLocked && attempt.current !== null;
    let crossedServerBoundary = false;
    try {
      const fresh = await loadReservation(reservation.reservationId);
      if (fresh.reservation.reservationId !== reservation.reservationId)
        throw new Error("The fresh reservation read does not match the selected billing context.");
      if (completeFromDetail(fresh, "No new billing-window command was needed.")) return;
      const fingerprint = JSON.stringify({
        reservationId: fresh.reservation.reservationId,
        status: fresh.reservation.status,
        folios: fresh.reservation.folios.map((folio) => ({ folioId: folio.folioId, windowNo: folio.windowNo, status: folio.status })),
      });
      if (!allowedStatuses.has(fresh.reservation.status) || fresh.reservation.folios.length !== 0) {
        if (attempt.current) {
          retainRecovery = true;
          setRecoveryLocked(true);
          setMessage("The live reservation changed before same-key reconciliation. Yellow retained the exact primary billing-window operation and keeps navigation locked.");
          return;
        }
        setConfirmed(false);
        setMessage("The live reservation changed before opening a billing window. Refresh the reservation and review the current record; nothing was sent.");
        return;
      }
      if (attempt.current && (attempt.current.reservationId !== fresh.reservation.reservationId || attempt.current.fingerprint !== fingerprint)) {
        retainRecovery = true;
        setRecoveryLocked(true);
        setMessage("The preflight no longer matches the retained billing-window operation. Yellow kept the same key and requires reconciliation against the current record.");
        return;
      }
      attempt.current ??= Object.freeze({
        reservationId: fresh.reservation.reservationId,
        fingerprint,
        // The server binds this idempotency key to the authenticated actor and exact empty canonical body.
        key: `yellow-primary-billing-window-${reservation.reservationId}-${crypto.randomUUID()}`,
        body: "{}",
      });
      crossedServerBoundary = true;
      await openPrimaryFolio(reservation.reservationId, attempt.current.key);
      const refreshed = await loadReservation(reservation.reservationId);
      if (refreshed.reservation.reservationId !== reservation.reservationId)
        throw new PrimaryFolioRequestError("The refreshed reservation does not match the retained primary billing-window operation.", true);
      if (completeFromDetail(refreshed, "Primary billing window opened.")) return;
      throw new PrimaryFolioRequestError("The server acknowledged the billing-window command, but the refreshed reservation has not confirmed an open primary folio. Yellow retained the same operation for reconciliation.", true);
    } catch (error) {
      const uncertain = crossedServerBoundary && (!(error instanceof PrimaryFolioRequestError) || error.uncertain);
      const reconciled = await loadReservation(reservation.reservationId).catch(() => null);
      if (reconciled && completeFromDetail(reconciled, "Primary billing window reconciled.")) return;
      if (uncertain || (recoveryLocked && attempt.current !== null)) {
        retainRecovery = true;
        setRecoveryLocked(true);
        setMessage("The primary billing-window outcome is uncertain. Yellow retained the exact reservation, body and idempotency key; use only the same-key reconciliation action.");
      } else {
        attempt.current = null;
        retainRecovery = false;
        setRecoveryLocked(false);
        setConfirmed(false);
        setMessage(error instanceof Error ? error.message : "The primary billing window could not be opened.");
      }
    } finally {
      setPosting(false);
      if (!retainRecovery) onLifecycleBusyChange?.(false);
    }
  };
  return (
    <section className="primary-billing-window" data-lifecycle-recovery={recoveryLocked ? "true" : undefined} aria-label="Open primary billing window">
      <span className="state">{billingContextLabel}</span>
      <h3>Open primary billing window</h3>
      <p>This {reservation.status === "in_house" || reservation.status === "due_out" ? "in-house" : "pre-arrival"} reservation has no folio. Yellow will refresh the exact reservation before it sends the existing canonical command.</p>
      {recoveryLocked ? <p className="error"><strong>Reconciliation required.</strong> Only the retained same-key primary-window request can continue.</p> : null}
      <label className="confirmation"><input type="checkbox" checked={confirmed} disabled={posting || recoveryLocked} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm opening the primary billing window for {confirmationName}.</label>
      <button type="button" disabled={!confirmed || posting} onClick={() => { void submit(); }}>{posting ? "Reconciling primary window…" : recoveryLocked ? "Retry retained primary window" : "Open confirmed primary window"}</button>
      {message ? <p role="status" className={message.includes("confirms") || message.startsWith("Primary billing window") ? "success" : "error"}>{message}</p> : null}
    </section>
  );
}

function AdvanceDepositWorkbench({
  reservation,
  statement,
  acquireMutationLease,
  releaseMutationLease,
  onStatementReconciled,
}: Readonly<{
  reservation: ReservationDetail["reservation"];
  statement: FolioStatement;
  acquireMutationLease: () => boolean;
  releaseMutationLease: () => void;
  onStatementReconciled: (statement: FolioStatement) => void;
}>) {
  const folioId = statement.folio.id;
  const [requestAmount, setRequestAmount] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [requestProposal, setRequestProposal] = useState<DepositDraft | null>(null);
  const [applyAmount, setApplyAmount] = useState("");
  const [applyProposal, setApplyProposal] = useState<DepositDraft | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recoveryLocked, setRecoveryLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [oneTimeBearer, setOneTimeBearer] = useState<string | null>(null);
  const attempt = useRef<DepositAttempt | null>(null);
  const mutationLeaseHeld = useRef(false);
  const running = useRef(false);
  const lastWorkbench = useRef<HostedDepositWorkbench | null>(null);
  const locked = recoveryLocked;
  const workbench = useQuery<HostedDepositWorkbench, Error>({
    queryKey: ["cashier-hosted-deposits", propertyId, folioId],
    queryFn: () => loadHostedDepositWorkbench(folioId),
    refetchInterval: (query) => {
      const data = query.state.data as HostedDepositWorkbench | undefined;
      return data?.deposits.some((deposit) => deposit.state === "ready" || deposit.state === "processing") ? 10_000 : false;
    },
  });
  const currentWorkbench = workbench.data?.folioId === folioId ? workbench.data : null;
  if (currentWorkbench) lastWorkbench.current = currentWorkbench;
  const visibleWorkbench = currentWorkbench ?? (lastWorkbench.current?.folioId === folioId ? lastWorkbench.current : null);
  const workbenchRefreshUnavailable = workbench.isError && visibleWorkbench !== null;
  useEffect(() => {
    setRequestAmount(""); setInstrumentId(""); setRequestProposal(null); setApplyAmount(""); setApplyProposal(null); setConfirmed(false); setError(null); setMessage(null); setOneTimeBearer(null); setRecoveryLocked(false); attempt.current = null;
  }, [folioId]);
  const primaryGuest = reservation.guests.find((guest) => guest.role === "primary")?.displayName ?? reservation.confirmationNo;
  const liveInstrument = visibleWorkbench?.instruments.find((instrument) => instrument.instrumentId === instrumentId) ?? null;
  const proposeRequest = () => {
    if (!POSITIVE_MINOR.test(requestAmount) || !liveInstrument || statement.folio.status !== "open") { setError("Choose one server-returned instrument and a canonical positive amount before preparing a deposit request."); return; }
    const accountId = reservation.folios.find((item) => item.folioId === folioId)?.accountId;
    if (!accountId) { setError("The selected folio account is no longer available for a deposit request."); return; }
    setError(null); setMessage(null); setConfirmed(false); setRequestProposal(Object.freeze({ reservationId: reservation.reservationId, folioId, accountId, folioReference: statement.folio.reference, amountMinor: requestAmount, currency: statement.folio.currency, balanceBeforeMinor: statement.balanceMinor, instrument: liveInstrument })); setApplyProposal(null);
  };
  const proposeApply = (deposit: HostedDepositStatus) => {
    if (deposit.state !== "captured" || BigInt(deposit.remainingMinor) <= 0n || BigInt(statement.balanceMinor) <= 0n) return;
    const maximum = BigInt(deposit.remainingMinor) < BigInt(statement.balanceMinor) ? deposit.remainingMinor : statement.balanceMinor;
    const accountId = reservation.folios.find((item) => item.folioId === folioId)?.accountId;
    if (!accountId) return;
    setApplyAmount(maximum); setRequestProposal(null); setApplyProposal(Object.freeze({ reservationId: reservation.reservationId, folioId, accountId, folioReference: statement.folio.reference, amountMinor: maximum, currency: deposit.currency, balanceBeforeMinor: statement.balanceMinor, requestSnapshot: deposit })); setConfirmed(false); setError(null); setMessage(null);
  };
  const run = async () => {
    const proposal = requestProposal ?? applyProposal;
    if (!proposal || !confirmed || busy || running.current) return;
    if (!mutationLeaseHeld.current) {
      if (!acquireMutationLease()) {
        setError("Another governed financial operation is already in progress.");
        return;
      }
      mutationLeaseHeld.current = true;
    }
    running.current = true;
    const kind = requestProposal ? "create" as const : "apply" as const;
    const retrying = attempt.current?.kind === kind;
    setBusy(true); setError(null); setMessage(retrying ? "Reconciling the retained same-key request against current server truth…" : "Refreshing the exact reservation, folio and deposit truth before sending this governed request…");
    let crossed = false;
    try {
      const [freshReservation, freshStatement, freshWorkbench] = await Promise.all([loadReservation(reservation.reservationId), loadFolioStatement(folioId), loadHostedDepositWorkbench(folioId)]);
      const currentFolio = freshReservation.reservation.folios.find((item) => item.folioId === folioId && item.status === "open");
      if (freshReservation.reservation.reservationId !== proposal.reservationId || !currentFolio || currentFolio.accountId !== proposal.accountId || freshStatement.reservationId !== proposal.reservationId || freshStatement.folio.id !== folioId || freshStatement.folio.reference !== proposal.folioReference || freshStatement.folio.status !== "open" || freshStatement.folio.currency !== proposal.currency || freshWorkbench.folioId !== folioId) {
        if (!retrying) { setConfirmed(false); setRequestProposal(null); setApplyProposal(null); }
        throw new Error("The reservation or folio changed during the fresh preflight. Nothing was sent.");
      }
      if (kind === "create" && !freshWorkbench.instruments.some((item) => JSON.stringify(item) === JSON.stringify(proposal.instrument))) {
        if (!retrying) { setConfirmed(false); setRequestProposal(null); }
        throw new Error(retrying ? "The current instrument list changed while Yellow reconciles the retained request; the exact same-key request remains locked." : "The selected masked instrument is no longer eligible. Nothing was sent.");
      }
      if (kind === "apply") {
        const current = freshWorkbench.deposits.find((item) => item.requestId === proposal.requestSnapshot?.requestId);
        if (!current || current.currency !== proposal.currency || (!retrying && (freshStatement.balanceMinor !== proposal.balanceBeforeMinor || JSON.stringify(current) !== JSON.stringify(proposal.requestSnapshot) || current.state !== "captured" || BigInt(proposal.amountMinor) > BigInt(current.remainingMinor) || BigInt(proposal.amountMinor) > BigInt(freshStatement.balanceMinor) || BigInt(freshStatement.balanceMinor) <= 0n))) {
          if (!retrying) { setConfirmed(false); setApplyProposal(null); } throw new Error("Captured deposit or positive folio balance changed during the fresh preflight. Nothing was sent.");
        }
      }
      const body = kind === "create" ? JSON.stringify({ instrumentId: proposal.instrument?.instrumentId, amountMinor: proposal.amountMinor }) : JSON.stringify({ amountMinor: proposal.amountMinor });
      if (!attempt.current) attempt.current = Object.freeze({ draft: proposal, key: `yellow-hosted-deposit-${kind}-${crypto.randomUUID()}`, body, kind });
      if (attempt.current.kind !== kind || attempt.current.body !== body) throw new Error("The retained deposit request does not match this proposal.");
      crossed = true;
      if (kind === "create") {
        const receipt = await createHostedDeposit(proposal, attempt.current.key);
        const status = await loadHostedDepositStatus(receipt.requestId);
        if (status.requestId !== receipt.requestId || status.operationId !== receipt.operationId || status.folioId !== folioId || status.propertyNode !== propertyId || status.amountMinor !== proposal.amountMinor || status.currency !== proposal.currency || status.generation !== receipt.generation || status.expiresAt !== receipt.expiresAt || (receipt.replayed && receipt.bearer !== undefined) || (!receipt.replayed && receipt.bearer !== undefined && status.state !== "ready")) throw new Error("The deposit request could not be reconciled to its authoritative status.");
        setOneTimeBearer(receipt.bearer ?? null);
        setMessage(receipt.bearer ? "Secure deposit handoff is ready. The bearer below is shown once; creating a replacement revokes the prior active link. A browser return never proves capture." : "The request was reconciled from server status. Its one-time bearer is not recoverable in Yellow.");
      } else {
        const receipt = await applyHostedDeposit(proposal, attempt.current.key);
        const [status, refreshedStatement] = await Promise.all([loadHostedDepositStatus(proposal.requestSnapshot!.requestId), loadFolioStatement(folioId)]);
        const matchingRows = refreshedStatement.rows.filter((row) => row.journalId === receipt.journalId);
        if (receipt.hostedRequestId !== proposal.requestSnapshot!.requestId || receipt.amountMinor !== proposal.amountMinor || receipt.currency !== proposal.currency || status.requestId !== proposal.requestSnapshot!.requestId || status.operationId !== proposal.requestSnapshot!.operationId || status.folioId !== folioId || status.propertyNode !== propertyId || status.currency !== proposal.currency || status.generation !== proposal.requestSnapshot!.generation || status.amountMinor !== proposal.requestSnapshot!.amountMinor || status.expiresAt !== proposal.requestSnapshot!.expiresAt || status.state !== "captured" || status.capturedMinor !== proposal.requestSnapshot!.capturedMinor || BigInt(status.appliedMinor) !== BigInt(proposal.requestSnapshot!.appliedMinor) + BigInt(proposal.amountMinor) || BigInt(status.remainingMinor) !== BigInt(proposal.requestSnapshot!.remainingMinor) - BigInt(proposal.amountMinor) || refreshedStatement.reservationId !== proposal.reservationId || refreshedStatement.folio.id !== folioId || refreshedStatement.folio.currency !== proposal.currency || BigInt(refreshedStatement.balanceMinor) !== BigInt(proposal.balanceBeforeMinor) - BigInt(proposal.amountMinor) || matchingRows.length !== 1 || matchingRows[0]?.amountMinor !== (-BigInt(proposal.amountMinor)).toString() || matchingRows[0]?.kind !== "payment") throw new Error("The application receipt did not reconcile to the authoritative deposit status and folio statement.");
        onStatementReconciled(refreshedStatement);
        setMessage(receipt.replayed ? "The existing deposit application was reconciled from the authoritative statement." : "Captured deposit applied and reconciled to the immutable folio statement.");
      }
      attempt.current = null; setRecoveryLocked(false); setRequestProposal(null); setApplyProposal(null); setConfirmed(false);
      mutationLeaseHeld.current = false; releaseMutationLease();
      await workbench.refetch();
    } catch (cause) {
      const uncertain = recoveryLocked || crossed;
      if (uncertain && attempt.current) { setRecoveryLocked(true); setError(`${cause instanceof Error ? cause.message : "Deposit outcome is uncertain."} Yellow retained the exact body and same operation key; only same-key reconciliation is available.`); }
      else {
        attempt.current = null; setConfirmed(false);
        mutationLeaseHeld.current = false; releaseMutationLease();
        setError(cause instanceof Error ? cause.message : "The deposit action could not be completed.");
      }
    } finally { running.current = false; setBusy(false); }
  };
  const proposal = requestProposal ?? applyProposal;
  return <section className="cashier-deposit-workbench" data-lifecycle-recovery={locked ? "true" : undefined} aria-label="Advance deposits">
    <div className="cashier-receivable-heading"><div><span>GOVERNED ADVANCE DEPOSITS</span><h3>Secure deposit requests</h3></div><span className="cashier-status neutral">{statement.folio.currency}</span></div>
    <p>Prepare a hosted request only from a server-returned masked instrument. Yellow never accepts card, UPI or token details.</p>
    {!visibleWorkbench && workbench.isLoading ? <p className="empty">Loading advance-deposit truth…</p> : !visibleWorkbench ? <p className="error">{workbench.error?.message ?? "Advance deposits are unavailable; no zero balance is assumed."}</p> : <>
      {workbenchRefreshUnavailable ? <p className="cashier-detail-refresh-warning" role="status"><strong>The latest advance-deposit refresh is unavailable.</strong> The last confirmed record remains visible only for same-key recovery; Yellow will fresh-read before it sends any command.</p> : null}
      <div className="deposit-status-list">{visibleWorkbench.deposits.length ? visibleWorkbench.deposits.map((deposit) => <article key={deposit.requestId}><strong>Generation {deposit.generation} · {deposit.state}</strong><span>Requested {moneyExactMinor(deposit.amountMinor, deposit.currency)} · captured {moneyExactMinor(deposit.capturedMinor, deposit.currency)}</span><small>Applied {moneyExactMinor(deposit.appliedMinor, deposit.currency)} · remaining {moneyExactMinor(deposit.remainingMinor, deposit.currency)} · expires {new Date(deposit.expiresAt).toLocaleString()}</small>{deposit.state === "captured" && BigInt(deposit.remainingMinor) > 0n && BigInt(statement.balanceMinor) > 0n ? <button type="button" disabled={busy || locked || workbenchRefreshUnavailable} onClick={() => proposeApply(deposit)}>Prepare deposit application</button> : null}</article>) : <p className="empty">No advance deposits.</p>}</div>
      <fieldset className="deposit-request-fields" disabled={busy || locked || workbenchRefreshUnavailable || statement.folio.status !== "open"}><legend>Prepare secure deposit request</legend><div className="deposit-instruments">{visibleWorkbench.instruments.map((instrument) => <label key={instrument.instrumentId} className={instrumentId === instrument.instrumentId ? "selected" : undefined}><input type="radio" name={`deposit-instrument-${folioId}`} checked={instrumentId === instrument.instrumentId} onChange={() => { setInstrumentId(instrument.instrumentId); setRequestProposal(null); setConfirmed(false); }} /> <span><strong>{instrument.brand ?? instrument.kind}</strong><small>{instrument.last4 ? `•••• ${instrument.last4}` : "Masked network instrument"}{instrument.expiry ? ` · ${instrument.expiry}` : ""}</small></span></label>)}</div>{visibleWorkbench.instruments.length === 0 ? <p className="empty">No eligible masked instruments are available for this open folio.</p> : null}<label>Amount ({statement.folio.currency} minor units)<input inputMode="numeric" pattern="[1-9][0-9]*" value={requestAmount} onChange={(event) => { setRequestAmount(event.target.value); setRequestProposal(null); setConfirmed(false); }} /></label><button type="button" onClick={proposeRequest}>Review deposit request</button></fieldset>
      {proposal ? <div className="deposit-proposal"><strong>{requestProposal ? "Deposit request proposal" : "Deposit application proposal"}</strong><span>{primaryGuest} · {reservation.confirmationNo} · {proposal.folioReference ?? `Window ${statement.folio.windowNo}`}</span><span>Audit purpose: Advance deposit / hosted payment request</span><span>{moneyExactMinor(proposal.amountMinor, proposal.currency)}{requestProposal ? ` · ${proposal.instrument?.brand ?? proposal.instrument?.kind ?? "masked instrument"}` : ` · liability applied ${moneyExactMinor(proposal.requestSnapshot!.appliedMinor, proposal.currency)} → ${moneyExactMinor((BigInt(proposal.requestSnapshot!.appliedMinor) + BigInt(proposal.amountMinor)).toString(), proposal.currency)} · remaining ${moneyExactMinor(proposal.requestSnapshot!.remainingMinor, proposal.currency)} → ${moneyExactMinor((BigInt(proposal.requestSnapshot!.remainingMinor) - BigInt(proposal.amountMinor)).toString(), proposal.currency)} · folio ${moneyExactMinor(proposal.balanceBeforeMinor, proposal.currency)} → ${moneyExactMinor((BigInt(proposal.balanceBeforeMinor) - BigInt(proposal.amountMinor)).toString(), proposal.currency)}`}</span><label className="receivable-confirm"><input type="checkbox" checked={confirmed} disabled={busy || locked} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm this exact governed {requestProposal ? "deposit request" : "deposit application"}.</label><button type="button" className="receivable-transfer-action" disabled={!confirmed || busy} onClick={() => { void run(); }}>{busy ? "Reconciling server truth…" : locked ? "Retry retained same-key request" : requestProposal ? "Create confirmed secure request" : "Apply confirmed deposit"}</button></div> : null}
      {oneTimeBearer ? <div className="deposit-one-time" role="status"><strong>One-time secure handoff</strong><p>Copy or open this bearer now. Yellow cannot recover it later, and a replacement revokes the active link.</p><a href={`/api/public/hosted-deposits/${encodeURIComponent(oneTimeBearer)}`} target="_blank" rel="noreferrer">Open guest deposit page</a></div> : null}
    </>}
    {message ? <p className="receivable-message" role="status">{message}</p> : null}{error ? <p className="error" role="alert">{error}</p> : null}
  </section>;
}

function CashierWorkbench({
  drawers,
  initialReservationId,
  onLifecycleBusyChange,
}: Readonly<{
  drawers: CashierSnapshot["drawers"];
  initialReservationId: string | null;
  onLifecycleBusyChange?: (busy: boolean) => void;
}>) {
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(initialReservationId);
  const [selectedFolioId, setSelectedFolioId] = useState<string | null>(null);
  const [staySearch, setStaySearch] = useState("");
  const [stayScope, setStayScope] = useState<"all" | "current">("all");
  const [cashierResultCursor, setCashierResultCursor] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [openingReference, setOpeningReference] = useState(false);
  const [txCode, setTxCode] = useState("");
  const [amountMinor, setAmountMinor] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [confirmed, setConfirmed] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [postingClass, setPostingClass] = useState("all");
  const [chargeGroup, setChargeGroup] = useState<FolioChargeGroup | "All">("All");
  const [receivableAccountId, setReceivableAccountId] = useState("");
  const [receivablePreview, setReceivablePreview] = useState<ReceivablePreview | null>(null);
  const [receivableReason, setReceivableReason] = useState("");
  const [receivableConfirmed, setReceivableConfirmed] = useState(false);
  const [receivableBusy, setReceivableBusy] = useState(false);
  const [receivableUncertainOperation, setReceivableUncertainOperation] = useState<"approval" | "transfer" | null>(null);
  const receivableAttemptUncertain = receivableUncertainOperation !== null;
  const [depositLocked, setDepositLocked] = useState(false);
  const queryClient = useQueryClient();
  const [receivableError, setReceivableError] = useState<string | null>(null);
  const [receivableMessage, setReceivableMessage] = useState<string | null>(null);
  const [receivableApproval, setReceivableApproval] = useState<ReceivableApprovalReceipt | null>(null);
  const [allocationGroupIds, setAllocationGroupIds] = useState<readonly string[]>([]);
  const [allocationDestinationFolioId, setAllocationDestinationFolioId] = useState("");
  const [allocationNewWindowName, setAllocationNewWindowName] = useState("");
  const [allocationReason, setAllocationReason] = useState("");
  const [allocationPreview, setAllocationPreview] = useState<FolioTransferPreview | null>(null);
  const [allocationConfirmed, setAllocationConfirmed] = useState(false);
  const [allocationBusy, setAllocationBusy] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [allocationMessage, setAllocationMessage] = useState<string | null>(null);
  const [allocationUncertainAttempt, setAllocationUncertainAttempt] = useState<FolioTransferAttempt | null>(null);
  const idempotencyKey = useRef<string | null>(null);
  const allocationAttemptKey = useRef<string | null>(null);
  const receivableTransferKey = useRef<string | null>(null);
  const receivableTransferFingerprint = useRef<string | null>(null);
  const receivableApprovalKey = useRef<string | null>(null);
  const receivableApprovalFingerprint = useRef<string | null>(null);
  const receivableGeneration = useRef(0);
  const depositMutationLease = useRef(false);
  const board = useQuery<Lane, Error>({
    queryKey: ["cashier-reservation-board", propertyId],
    queryFn: loadReservationBoard,
  });
  const detail = useQuery<ReservationDetail, Error>({
    queryKey: ["cashier-reservation", propertyId, selectedReservationId],
    queryFn: () => loadReservation(selectedReservationId!),
    enabled: selectedReservationId !== null,
  });
  const lastReservationDetail = useRef<ReservationDetail | null>(null);
  const currentReservationDetail = detail.data?.reservation.reservationId === selectedReservationId
    ? detail.data
    : null;
  if (currentReservationDetail) lastReservationDetail.current = currentReservationDetail;
  const visibleReservationDetail = currentReservationDetail ?? (
    lastReservationDetail.current?.reservation.reservationId === selectedReservationId
      ? lastReservationDetail.current
      : null
  );
  const reservationDetailRefreshUnavailable = detail.isError && visibleReservationDetail !== null;
  const folio = useQuery<FolioStatement, Error>({
    queryKey: ["cashier-folio-statement", propertyId, selectedFolioId],
    queryFn: () => loadFolioStatement(selectedFolioId!),
    enabled: selectedFolioId !== null,
  });
  const receivableTargets = useQuery<readonly ReceivableTarget[], Error>({
    queryKey: ["cashier-receivable-targets", propertyId, selectedFolioId],
    queryFn: loadReceivableTargets,
    enabled: selectedFolioId !== null,
  });
  const resetReceivableDraft = () => {
    receivableGeneration.current += 1;
    setReceivableAccountId("");
    setReceivablePreview(null);
    setReceivableReason("");
    setReceivableConfirmed(false);
    setReceivableError(null);
    setReceivableMessage(null);
    setReceivableApproval(null);
    setReceivableUncertainOperation(null);
    receivableTransferKey.current = null;
    receivableTransferFingerprint.current = null;
    receivableApprovalKey.current = null;
    receivableApprovalFingerprint.current = null;
  };
  const resetCandidate = () => {
    idempotencyKey.current = null;
    setConfirmed(false);
    setPostError(null);
  };
  const allocationLocked = allocationBusy || allocationUncertainAttempt !== null;
  const depositInteractionLocked = () => depositMutationLease.current || depositLocked;
  const acquireDepositMutationLease = () => {
    if (depositMutationLease.current || openingReference || posting || allocationLocked ||
        receivableBusy || receivableAttemptUncertain) return false;
    depositMutationLease.current = true;
    setDepositLocked(true);
    onLifecycleBusyChange?.(true);
    return true;
  };
  const releaseDepositMutationLease = () => {
    depositMutationLease.current = false;
    setDepositLocked(false);
    onLifecycleBusyChange?.(false);
  };
  const resetAllocationDraft = () => {
    if (allocationUncertainAttempt) return;
    setAllocationGroupIds([]);
    setAllocationDestinationFolioId("");
    setAllocationNewWindowName("");
    setAllocationReason("");
    setAllocationPreview(null);
    setAllocationConfirmed(false);
    setAllocationError(null);
    setAllocationMessage(null);
    allocationAttemptKey.current = null;
  };
  const invalidateAllocationPreview = () => {
    if (allocationUncertainAttempt) return;
    setAllocationPreview(null);
    setAllocationConfirmed(false);
    setAllocationError(null);
    setAllocationMessage(null);
    allocationAttemptKey.current = null;
  };
  const selectReservation = (reservationId: string) => {
    if (receivableBusy || receivableAttemptUncertain || allocationLocked || depositInteractionLocked()) {
      setAllocationError("Reconcile the retained financial operation before opening another reservation.");
      return;
    }
    setSelectedReservationId(reservationId);
    setSelectedFolioId(null);
    setTxCode("");
    setChargeGroup("All");
    setAmountMinor("");
    setSearchError(null);
    resetReceivableDraft();
    resetAllocationDraft();
    resetCandidate();
  };
  const selectFolio = (folioId: string) => {
    if (receivableBusy || receivableAttemptUncertain || allocationLocked || depositInteractionLocked()) {
      setAllocationError("Reconcile the retained financial operation before opening another folio.");
      return;
    }
    setSelectedFolioId(folioId);
    setPostingClass("all");
    setTxCode("");
    setChargeGroup("All");
    setAmountMinor("");
    resetReceivableDraft();
    resetAllocationDraft();
    resetCandidate();
  };
  const enterOpenedPrimaryBillingWindow = (fresh: ReservationDetail, folioId: string) => {
    // The post-command read is the authority. Cache and selection both use its exact reservation and folio ids.
    setSelectedReservationId(fresh.reservation.reservationId);
    setSelectedFolioId(folioId);
    setPostingClass("all");
    setTxCode("");
    setChargeGroup("All");
    setAmountMinor("");
    setSearchError(null);
    resetReceivableDraft();
    resetAllocationDraft();
    resetCandidate();
    void board.refetch();
    void detail.refetch();
  };
  useEffect(() => {
    if (!selectedReservationId || selectedFolioId || !detail.data) return;
    const firstWindow =
      detail.data.reservation.folios.find((item) => item.status === "open") ??
      detail.data.reservation.folios[0];
    if (firstWindow) selectFolio(firstWindow.folioId);
  }, [detail.data, selectedFolioId, selectedReservationId]);
  const selectedOption = folio.data?.chargeOptions.find((option) => option.code === txCode) ?? null;
  const chargeGroups = useMemo(
    () => [...new Set((folio.data?.chargeOptions ?? []).map(folioChargeGroup))],
    [folio.data?.chargeOptions],
  );
  const visibleChargeOptions = (folio.data?.chargeOptions ?? []).filter(
    (option) => chargeGroup === "All" || folioChargeGroup(option) === chargeGroup,
  );
  const normalizedStaySearch = staySearch.trim().toLocaleLowerCase();
  const eligibleStays = (board.data?.reservations ?? []).filter((stay) =>
    stayScope === "all" || stay.status === "in_house" || stay.status === "due_out",
  );
  const matchingStays = normalizedStaySearch.length === 0
    ? eligibleStays
    : eligibleStays.filter((stay) =>
      nameOf(stay).toLocaleLowerCase().includes(normalizedStaySearch) ||
      stay.confirmationNo.toLocaleLowerCase().includes(normalizedStaySearch) ||
      (stay.sellableUnitLabel ?? "").toLocaleLowerCase().includes(normalizedStaySearch) ||
      (stay.unitTypeLabel ?? "").toLocaleLowerCase().includes(normalizedStaySearch) ||
      (stay.channelCode ?? "").toLocaleLowerCase().includes(normalizedStaySearch) ||
      (stay.sourceCode ?? "").toLocaleLowerCase().includes(normalizedStaySearch) ||
      (stay.marketCode ?? "").toLocaleLowerCase().includes(normalizedStaySearch),
    );
  const cashierResultPage = Math.min(
    cashierPageFromCursor(cashierResultCursor),
    Math.max(0, Math.ceil(matchingStays.length / CASHIER_STAY_PAGE_SIZE) - 1),
  );
  const cashierResultStart = cashierResultPage * CASHIER_STAY_PAGE_SIZE;
  const pagedMatchingStays = matchingStays.slice(cashierResultStart, cashierResultStart + CASHIER_STAY_PAGE_SIZE);
  useEffect(() => { setCashierResultCursor(null); }, [normalizedStaySearch, stayScope]);
  const openFolioReference = async () => {
    const reference = staySearch.trim();
    if (!reference || openingReference || receivableBusy || receivableAttemptUncertain || depositInteractionLocked()) return;
    setOpeningReference(true);
    setSearchError(null);
    try {
      const statement = await loadFolioStatement(reference);
      if (!statement.reservationId) {
        setSearchError("That folio is not attached to a current reservation at this property.");
        return;
      }
      const currentReservation = await loadReservation(statement.reservationId);
      resetReceivableDraft();
      setSelectedReservationId(statement.reservationId);
      setSelectedFolioId(statement.folio.id);
      setTxCode("");
      setChargeGroup("All");
      setAmountMinor("");
      resetCandidate();
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "That folio reference could not be opened.");
    } finally {
      setOpeningReference(false);
    }
  };
  const validAmount = /^[1-9][0-9]*$/.test(amountMinor);
  const validQuantity = /^[1-9][0-9]*$/.test(quantity);
  const canPost = Boolean(
    folio.data?.chargeAvailability.allowed && selectedOption && validAmount && validQuantity,
  );
  const postingClasses = useMemo(
    () => [...new Set((folio.data?.rows ?? []).map((row) => row.kind).filter(Boolean))].sort(),
    [folio.data?.rows],
  );
  const visiblePostingRows = (folio.data?.rows ?? []).filter(
    (row) => postingClass === "all" || row.kind === postingClass,
  );
  const transferGroups = useMemo(() => {
    const groups = new Map<string, FolioTransferGroup>();
    for (const row of folio.data?.rows ?? []) {
      const group = row.transferGroup;
      if (!groups.has(group.id)) groups.set(group.id, group);
    }
    return [...groups.values()].sort((left, right) => left.id.localeCompare(right.id));
  }, [folio.data?.rows]);
  const selectableTransferGroups = transferGroups.filter((group) =>
    group.eligible && group.currentWindowId === folio.data?.folio.id,
  );
  const selectedTransferGroups = selectableTransferGroups.filter((group) =>
    allocationGroupIds.includes(group.id),
  );
  const destinationWindow = folio.data?.siblingWindows.find((window) =>
    window.id === allocationDestinationFolioId && window.id !== folio.data?.folio.id && window.status === "open",
  ) ?? null;
  const trimmedAllocationWindowName = allocationNewWindowName.trim();
  const allocationUsesNewWindow = allocationDestinationFolioId.length === 0 && trimmedAllocationWindowName.length > 0;
  const allocationDestinationIsValid = (destinationWindow !== null) !== allocationUsesNewWindow &&
    (!allocationUsesNewWindow || transferWindowNameIsValid(trimmedAllocationWindowName));
  const allocationReasonIsValid = transferReasonIsValid(allocationReason);
  const canPreviewAllocation = Boolean(
    folio.data && folio.data.folio.status === "open" && selectedTransferGroups.length > 0 &&
    selectedTransferGroups.length === allocationGroupIds.length && allocationDestinationIsValid &&
    allocationReasonIsValid && !allocationLocked && !depositLocked,
  );
  const allocationDraftFor = (generation: string, previewRevision: string): FolioTransferDraft | null => {
    if (!folio.data || !canPreviewAllocation) return null;
    return Object.freeze({
      sourceFolioId: folio.data.folio.id,
      destinationFolioId: destinationWindow?.id ?? null,
      newWindowName: allocationUsesNewWindow ? trimmedAllocationWindowName : null,
      groupIds: Object.freeze([...allocationGroupIds].sort()),
      reason: allocationReason,
      generation,
      previewRevision,
    });
  };
  const previewBillWindowAllocation = async () => {
    if (!folio.data || !canPreviewAllocation || depositInteractionLocked()) return;
    const draft = allocationDraftFor(folio.data.generation, "");
    if (!draft) return;
    setAllocationBusy(true);
    setAllocationError(null);
    setAllocationMessage("Checking exact charge-group routing against the current folio family…");
    try {
      const preview = await requestFolioTransferPreview(draft);
      if (!previewMatchesFolioTransferDraft(
        preview,
        draft,
        folio.data.folio.currency,
        destinationWindow?.name ?? null,
      )) {
        throw new Error("The canonical preview does not match the selected complete charge groups.");
      }
      setAllocationPreview(preview);
      setAllocationConfirmed(false);
      allocationAttemptKey.current = null;
      setAllocationMessage("Preview ready. Review every complete group and the exact before/after balances, then confirm the balanced transfer.");
    } catch (error) {
      setAllocationPreview(null);
      setAllocationConfirmed(false);
      setAllocationError(error instanceof Error ? error.message : "The bill-window preview failed.");
      setAllocationMessage(null);
    } finally {
      setAllocationBusy(false);
    }
  };
  const receiptMatchesAllocation = (receipt: FolioTransferReceipt, attempt: FolioTransferAttempt): boolean => {
    const expected = attempt.preview;
    return receipt.sourceFolioId === expected.sourceFolioId &&
      (expected.destinationFolioId === null || receipt.destinationFolioId === expected.destinationFolioId) &&
      receipt.destinationFolioId !== null && receipt.destinationName === expected.destinationName &&
      receipt.destinationWindowNo === expected.destinationWindowNo && receipt.currency === expected.currency &&
      receipt.sourceBeforeMinor === expected.sourceBeforeMinor && receipt.sourceAfterMinor === expected.sourceAfterMinor &&
      receipt.destinationBeforeMinor === expected.destinationBeforeMinor && receipt.destinationAfterMinor === expected.destinationAfterMinor &&
      receipt.stayTotalMinor === expected.stayTotalMinor && receipt.unchangedStayTotalMinor === expected.unchangedStayTotalMinor &&
      receipt.generation === expected.generation && receipt.previewRevision === expected.previewRevision &&
      receipt.memberEffects.length === expected.memberEffects.length &&
      receipt.memberEffects.every((effect, index) => JSON.stringify(effect) === JSON.stringify(expected.memberEffects[index]));
  };
  const reconcileBillWindowAllocation = async () => {
    if (!folio.data || (!allocationPreview && !allocationUncertainAttempt) || depositInteractionLocked()) return;
    const retryingRetainedAttempt = allocationUncertainAttempt !== null;
    let attempt = allocationUncertainAttempt;
    setAllocationBusy(true);
    setAllocationError(null);
    setAllocationMessage(retryingRetainedAttempt
      ? "Reconciling the retained bill-window transfer with its original operation key…"
      : "Refreshing the source folio and repeating the canonical preview before the transfer…");
    onLifecycleBusyChange?.(true);
    let submitted = false;
    let keepParentLocked = false;
    try {
      if (!attempt) {
        const originalPreview = allocationPreview!;
        const freshSource = await loadFolioStatement(originalPreview.sourceFolioId);
        if (freshSource.folio.id !== originalPreview.sourceFolioId || freshSource.folio.currency !== originalPreview.currency) {
          throw new Error("The authoritative source folio changed before submission.");
        }
        const refreshedDraft = allocationDraftFor(freshSource.generation, "");
        if (!refreshedDraft) throw new Error("The selected bill-window draft is no longer complete.");
        const freshPreview = await requestFolioTransferPreview(refreshedDraft);
        if (!sameTransferPreview(freshPreview, originalPreview)) {
          setAllocationPreview(freshPreview);
          setAllocationConfirmed(false);
          allocationAttemptKey.current = null;
          setAllocationMessage("The folio family changed. Yellow refreshed the exact preview; review and confirm it again.");
          throw new Error("The bill-window preview drifted before submission. Nothing was transferred.");
        }
        const draft = Object.freeze({ ...refreshedDraft, previewRevision: freshPreview.previewRevision });
        allocationAttemptKey.current ??= `yellow-folio-transfer-${crypto.randomUUID()}`;
        attempt = Object.freeze({ draft, preview: freshPreview, idempotencyKey: allocationAttemptKey.current });
      }
      submitted = true;
      const receipt = await submitFolioTransfer(attempt.draft, attempt.idempotencyKey);
      if (!receiptMatchesAllocation(receipt, attempt)) {
        throw new FolioTransferRequestError("The returned transfer receipt does not match the confirmed complete-group preview.", true);
      }
      const destinationFolioId = receipt.destinationFolioId;
      if (!destinationFolioId) {
        throw new FolioTransferRequestError("The transfer receipt did not name a destination folio. Yellow retained the exact operation for reconciliation.", true);
      }
      const [sourceStatement, destinationStatement] = await Promise.all([
        loadFolioStatement(receipt.sourceFolioId),
        loadFolioStatement(destinationFolioId),
      ]);
      const reconciled = sourceStatement.folio.id === receipt.sourceFolioId &&
        destinationStatement.folio.id === destinationFolioId &&
        sourceStatement.folio.currency === receipt.currency && destinationStatement.folio.currency === receipt.currency &&
        sourceStatement.balanceMinor === receipt.sourceAfterMinor &&
        destinationStatement.balanceMinor === receipt.destinationAfterMinor &&
        sourceStatement.stayTotalMinor === receipt.stayTotalMinor && destinationStatement.stayTotalMinor === receipt.stayTotalMinor &&
        receipt.stayTotalMinor === receipt.unchangedStayTotalMinor &&
        sourceStatement.rows.some((row) => row.journalId === receipt.journalId) &&
        destinationStatement.rows.some((row) => row.journalId === receipt.journalId);
      if (!reconciled) {
        throw new FolioTransferRequestError("The transfer response was received, but both authoritative statements do not yet reconcile to its exact balances. Yellow retained the same-key operation.", true);
      }
      await folio.refetch();
      setAllocationUncertainAttempt(null);
      setAllocationPreview(null);
      setAllocationConfirmed(false);
      setAllocationGroupIds([]);
      setAllocationDestinationFolioId("");
      setAllocationNewWindowName("");
      setAllocationReason("");
      allocationAttemptKey.current = null;
      setAllocationMessage(receipt.replayed
        ? "The existing balanced transfer was reconciled from authoritative source and destination statements."
        : "Balanced bill-window transfer recorded and reconciled from authoritative source and destination statements.");
    } catch (error) {
      const uncertain = retryingRetainedAttempt || (submitted &&
        (!(error instanceof FolioTransferRequestError) || error.uncertain));
      keepParentLocked = uncertain;
      if (uncertain && attempt) setAllocationUncertainAttempt(attempt);
      setAllocationError(`${error instanceof Error ? error.message : "The bill-window transfer failed."}${uncertain ? " The exact source, destination, groups, reason and operation key are locked for same-key reconciliation." : " Review the current preview before trying again."}`);
      setAllocationMessage(null);
    } finally {
      setAllocationBusy(false);
      onLifecycleBusyChange?.(keepParentLocked);
    }
  };
  const toggleAllocationGroup = (groupId: string) => {
    if (allocationLocked || depositInteractionLocked()) return;
    setAllocationGroupIds((current) => current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId].sort());
    invalidateAllocationPreview();
  };
  const postCharge = async () => {
    if (!folio.data || !selectedOption || !canPost || !confirmed || posting || allocationLocked || depositInteractionLocked()) return;
    onLifecycleBusyChange?.(true);
    setPosting(true);
    setPostError(null);
    idempotencyKey.current ??= `yellow-public-demo-${crypto.randomUUID()}`;
    try {
      await postFolioCharge(
        folio.data.folio.id,
        { txCode: selectedOption.code, amountMinor, quantity },
        idempotencyKey.current,
      );
      setConfirmed(false);
      setAmountMinor("");
      idempotencyKey.current = null;
      await folio.refetch();
    } catch (error) {
      setPostError(error instanceof Error ? error.message : "The charge could not be posted.");
      await folio.refetch();
    } finally {
      setPosting(false);
      onLifecycleBusyChange?.(false);
    }
  };
  const previewDirectBilling = async () => {
    if (!folio.data || !receivableAccountId || receivableBusy || receivableAttemptUncertain || depositInteractionLocked()) return;
    const generation = receivableGeneration.current + 1;
    receivableGeneration.current = generation;
    setReceivableBusy(true);
    setReceivableError(null);
    setReceivableMessage(null);
    setReceivableConfirmed(false);
    setReceivableApproval(null);
    receivableTransferKey.current = null;
    receivableTransferFingerprint.current = null;
    receivableApprovalKey.current = null;
    receivableApprovalFingerprint.current = null;
    try {
      const preview = await previewReceivableTransfer(folio.data.folio.id, receivableAccountId);
      if (generation !== receivableGeneration.current) return;
      if (preview.folioId !== folio.data.folio.id || preview.receivableAccountId !== receivableAccountId ||
          preview.currency !== folio.data.folio.currency || preview.amountMinor !== folio.data.balanceMinor) {
        throw new Error("The live folio changed while Yellow prepared direct billing. Refresh and preview again.");
      }
      setReceivablePreview(preview);
      setReceivableMessage(preview.requiresApproval
        ? "A different authorised supervisor must approve this exact over-limit request."
        : "The server confirmed this exact balance is within the target’s current credit limit.");
    } catch (error) {
      if (generation !== receivableGeneration.current) return;
      setReceivablePreview(null);
      setReceivableError(error instanceof Error ? error.message : "The direct-billing preview failed.");
    } finally {
      if (generation === receivableGeneration.current) setReceivableBusy(false);
    }
  };
  const requestDirectBillingApproval = async () => {
    if (!folio.data || !receivablePreview?.requiresApproval || receivableBusy || receivableUncertainOperation === "transfer" || depositInteractionLocked()) return;
    const generation = receivableGeneration.current + 1;
    receivableGeneration.current = generation;
    const fingerprint = JSON.stringify({
      folioId: folio.data.folio.id,
      accountId: receivablePreview.receivableAccountId,
      amountMinor: receivablePreview.amountMinor,
      projectedExposureMinor: receivablePreview.projectedExposureMinor,
    });
    if (receivableApprovalFingerprint.current !== fingerprint) {
      receivableApprovalFingerprint.current = fingerprint;
      receivableApprovalKey.current = `yellow-receivable-approval-${crypto.randomUUID()}`;
    }
    setReceivableBusy(true);
    setReceivableError(null);
    onLifecycleBusyChange?.(true);
    let keepParentLocked = false;
    let approvalReceiptAccepted = false;
    try {
      const receipt = await requestReceivableApproval(
        folio.data.folio.id,
        receivablePreview.receivableAccountId,
        receivableApprovalKey.current!,
      );
      approvalReceiptAccepted = true;
      if (generation !== receivableGeneration.current) return;
      if (receipt.folioId !== receivablePreview.folioId ||
          receipt.receivableAccountId !== receivablePreview.receivableAccountId ||
          receipt.partyId !== receivablePreview.partyId || receipt.partyRole !== receivablePreview.partyRole ||
          receipt.currency !== receivablePreview.currency || receipt.amountMinor !== receivablePreview.amountMinor ||
          receipt.exposureMinor !== receivablePreview.exposureMinor ||
          receipt.creditLimitMinor !== receivablePreview.creditLimitMinor ||
          receipt.projectedExposureMinor !== receivablePreview.projectedExposureMinor) {
        throw new Error("The approval receipt does not match the current direct-billing proposal.");
      }
      setReceivableApproval(receipt);
      setReceivableUncertainOperation(null);
      setReceivableMessage(receipt.replayed
        ? "The existing approval request was confirmed. A different authorised supervisor must decide it."
        : "Approval requested. A different authorised supervisor must decide this exact amount and target.");
    } catch (error) {
      if (generation !== receivableGeneration.current) return;
      const uncertain = receivableUncertainOperation === "approval" || approvalReceiptAccepted || housekeepingFailureIsUncertain(error);
      keepParentLocked = uncertain;
      setReceivableUncertainOperation(uncertain ? "approval" : null);
      setReceivableError(`${error instanceof Error ? error.message : "The approval request failed."} Retry keeps the same operation key.`);
    } finally {
      if (generation === receivableGeneration.current) {
        setReceivableBusy(false);
        onLifecycleBusyChange?.(keepParentLocked);
      }
    }
  };
  const directBillingReasonIsValid = receivableReason.length >= 1 && receivableReason.length <= 500 &&
    receivableReason.trim() === receivableReason && !/[\x00-\x1f\x7f\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u.test(receivableReason);
  const canTransferReceivable = Boolean(
    folio.data && receivablePreview && !receivablePreview.requiresApproval &&
    receivablePreview.folioId === folio.data.folio.id &&
    (receivableUncertainOperation === "transfer" || receivablePreview.amountMinor === folio.data.balanceMinor) &&
    directBillingReasonIsValid && receivableConfirmed && !receivableBusy && !depositLocked,
  );
  const transferDirectBilling = async () => {
    if (!folio.data || !receivablePreview || !canTransferReceivable || receivableUncertainOperation === "approval" || depositInteractionLocked()) return;
    const folioId = folio.data.folio.id;
    const retryingRetainedAttempt = receivableUncertainOperation === "transfer";
    const confirmedPreview = receivablePreview;
    const input = {
      receivableAccountId: confirmedPreview.receivableAccountId,
      reason: receivableReason,
    };
    const generation = receivableGeneration.current + 1;
    receivableGeneration.current = generation;
    setReceivableBusy(true);
    setReceivableError(null);
    setReceivableMessage(retryingRetainedAttempt
      ? "Reconciling the retained transfer with its original operation key…"
      : "Rechecking the exact balance and credit evidence before recording the transfer…");
    onLifecycleBusyChange?.(true);
    let transferSubmitted = false;
    let transferReceiptAccepted = false;
    let keepParentLocked = false;
    try {
      if (!retryingRetainedAttempt) {
        const freshPreview = await previewReceivableTransfer(folioId, input.receivableAccountId);
        if (generation !== receivableGeneration.current) return;
        if (!sameReceivablePreview(freshPreview, confirmedPreview)) {
          const refreshedStatement = await folio.refetch();
          if (generation !== receivableGeneration.current) return;
          if (refreshedStatement.isError || !refreshedStatement.data ||
              refreshedStatement.data.folio.id !== freshPreview.folioId ||
              refreshedStatement.data.folio.currency !== freshPreview.currency ||
              refreshedStatement.data.balanceMinor !== freshPreview.amountMinor) {
            setReceivablePreview(null);
            setReceivableConfirmed(false);
            throw new Error("The proposal changed, but the authoritative folio could not be refreshed to the same exact balance.");
          }
          setReceivablePreview(freshPreview);
          setReceivableConfirmed(false);
          setReceivableMessage("The live balance or credit evidence changed. Review the refreshed exact proposal and confirm it again.");
          throw new Error("The direct-billing proposal changed before submission.");
        }
      }
      const fingerprint = JSON.stringify({ folioId, ...input, amountMinor: confirmedPreview.amountMinor });
      if (!retryingRetainedAttempt && receivableTransferFingerprint.current !== fingerprint) {
        receivableTransferFingerprint.current = fingerprint;
        receivableTransferKey.current = `yellow-receivable-transfer-${crypto.randomUUID()}`;
      }
      if (!receivableTransferKey.current) throw new Error("The retained transfer operation key is unavailable.");
      transferSubmitted = true;
      const idempotencyKey = receivableTransferKey.current;
      const receipt = await submitReceivableTransfer(folioId, input, idempotencyKey, confirmedPreview);
      transferReceiptAccepted = true;
      if (generation !== receivableGeneration.current) return;
      const refreshed = await loadFolioStatement(folioId);
      const receiptRows = refreshed.rows.filter((row) => row.journalId === receipt.journalId);
      const expectedGuestCreditMinor = (-BigInt(receipt.amountMinor)).toString();
      if (refreshed.folio.id !== folioId || refreshed.folio.currency !== receipt.currency ||
          BigInt(refreshed.balanceMinor) !== 0n || receiptRows.length !== 1 ||
          receiptRows[0]?.amountMinor !== expectedGuestCreditMinor) {
        throw new Error("No successful transfer will be claimed without an exact zero-balance statement containing the confirmed journal and guest credit.");
      }
      await folio.refetch();
      setReceivableConfirmed(false);
      setReceivableReason("");
      setReceivablePreview(null);
      setReceivableApproval(null);
      receivableTransferKey.current = null;
      receivableTransferFingerprint.current = null;
      setReceivableUncertainOperation(null);
      setReceivableMessage(receipt.replayed
        ? "The existing direct-billing transfer was reconciled. The guest folio is now zero."
        : `Direct billing recorded to ${receivablePreview.name}. The guest folio is now zero.`);
    } catch (error) {
      if (generation !== receivableGeneration.current) return;
      const uncertain = receivableUncertainOperation === "transfer" ||
        (transferSubmitted && (transferReceiptAccepted || housekeepingFailureIsUncertain(error)));
      keepParentLocked = uncertain;
      setReceivableUncertainOperation(uncertain ? "transfer" : null);
      setReceivableError(`${error instanceof Error ? error.message : "The direct-billing transfer failed."} ${uncertain ? "The proposal is locked; retry or reconcile the unchanged attempt with the same operation key." : "Review the proposal before trying again."}`);
    } finally {
      if (generation === receivableGeneration.current) {
        setReceivableBusy(false);
        onLifecycleBusyChange?.(keepParentLocked);
      }
    }
  };
  return (
    <section className="commercial-workspace">
      <div className="reservation-hero board-hero">
        <div><span className="state">FRONT DESK FINANCE</span><h1>Cashier & folios</h1><p>Select an authoritative stay, then review its immutable folio before preparing a charge. Yellow never invents transaction codes or bypasses a confirmation.</p></div>
      </div>
      <div className="cashier-workbench">
        <article className="cashier-panel">
          <span className="state">01 · SELECT STAY</span>
          <h2>Find any reservation or bill</h2>
          <form className="cashier-unified-search" onSubmit={(event) => { event.preventDefault(); if (matchingStays.length === 0) void openFolioReference(); }}>
          <label className="cashier-search">Search guest, reservation, room, source, channel or folio
            <input
              value={staySearch}
              onChange={(event) => { setStaySearch(event.target.value); setSearchError(null); setCashierResultCursor(null); }}
              placeholder="Name, confirmation, room, OTA, company or exact folio"
              autoComplete="off"
            />
          </label>
            <button type="submit" disabled={!staySearch.trim() || matchingStays.length > 0 || openingReference || receivableBusy || receivableAttemptUncertain || depositLocked}>{openingReference ? "Opening…" : "Find exact folio"}</button>
          </form>
          <div className="cashier-search-scope" role="group" aria-label="Reservation search scope">
            <button type="button" className={stayScope === "all" ? "active" : undefined} aria-pressed={stayScope === "all"} onClick={() => { setStayScope("all"); setCashierResultCursor(null); }}>All returned stays</button>
            <button type="button" className={stayScope === "current" ? "active" : undefined} aria-pressed={stayScope === "current"} onClick={() => { setStayScope("current"); setCashierResultCursor(null); }}>In house &amp; due out</button>
          </div>
          <p className="cashier-search-note">Exact folio reference is accepted in the same search. Results stay bounded to this property’s governed reservation board.</p>
          {searchError ? <p className="error">{searchError}</p> : null}
          {board.isLoading ? <p className="empty">Loading reservations…</p> : board.isError ? <p className="error">{board.error.message}</p> : (
            <div className="cashier-stay-list">
              {pagedMatchingStays.map((stay) => <button type="button" key={stay.reservationId} disabled={receivableBusy || receivableAttemptUncertain || depositLocked} className={selectedReservationId === stay.reservationId ? "selected" : undefined} onClick={() => selectReservation(stay.reservationId)}><strong>{nameOf(stay)}</strong><small>{stay.confirmationNo} · {stay.sellableUnitLabel ?? stay.unitTypeLabel ?? "Room unassigned"}</small><span className="cashier-result-evidence" aria-label={`Search evidence for ${stay.confirmationNo}`}>{cashierSearchEvidence(stay).map((item) => <span key={item.label}><b>{item.label}</b>{item.value}</span>)}</span><span data-status={stay.status} className={`cashier-status ${statusTone(stay.status)}`}>{reservationStatusLabel(stay.status)}</span></button>)}
              {matchingStays.length === 0 ? <p className="empty">No returned reservation matches. If this is an exact folio reference, use “Find exact folio”.</p> : null}
              {matchingStays.length > CASHIER_STAY_PAGE_SIZE ? (
                <nav className="cashier-result-pagination" aria-label="Cashier search result pagination">
                  <button type="button" disabled={cashierResultPage === 0 || receivableBusy || receivableAttemptUncertain || depositLocked} onClick={() => setCashierResultCursor(cashierCursorFor(cashierResultPage - 1))}>Previous</button>
                  <span>Showing {cashierResultStart + 1}-{Math.min(cashierResultStart + CASHIER_STAY_PAGE_SIZE, matchingStays.length)} of {matchingStays.length}</span>
                  <button type="button" disabled={cashierResultStart + CASHIER_STAY_PAGE_SIZE >= matchingStays.length || receivableBusy || receivableAttemptUncertain || depositLocked} onClick={() => setCashierResultCursor(cashierCursorFor(cashierResultPage + 1))}>Next</button>
                </nav>
              ) : null}
            </div>
          )}
        </article>
        <article className="cashier-panel">
          <span className="state">02 · OPEN WINDOW</span>
          <h2>Server-owned folios</h2>
          {!selectedReservationId ? <p className="empty">Select a stay to load its folio windows.</p> : !visibleReservationDetail && detail.isLoading ? <p className="empty">Loading governed folio windows…</p> : !visibleReservationDetail ? <p className="error">{detail.error?.message ?? "The current reservation record is unavailable."}</p> : (
            <>
              {reservationDetailRefreshUnavailable ? <p className="cashier-detail-refresh-warning" role="status"><strong>The latest reservation refresh is unavailable.</strong> The last confirmed reservation record remains visible only for same-key recovery; Yellow will require a fresh authoritative preflight before it sends any command.</p> : null}
              <div className="cashier-selected-stay" role="status" aria-live="polite">
                <span>Selected reservation</span>
                <strong>{visibleReservationDetail.reservation.guests.find((guest) => guest.role === "primary")?.displayName ?? visibleReservationDetail.reservation.confirmationNo}</strong>
                <small>{visibleReservationDetail.reservation.confirmationNo}</small>
                <span data-status={visibleReservationDetail.reservation.status} className={`cashier-status ${statusTone(visibleReservationDetail.reservation.status)}`}>{reservationStatusDescription(visibleReservationDetail.reservation.status)}</span>
              </div>
              <p className="cashier-billing-context">{visibleReservationDetail.reservation.status === "in_house" || visibleReservationDetail.reservation.status === "due_out" ? "In-house billing context" : "Pre-arrival billing context"}. The current server record controls whether charges can be posted.</p>
              {visibleReservationDetail.reservation.folios.length ? (
                <div className="cashier-stay-list">{visibleReservationDetail.reservation.folios.map((item) => <button type="button" key={item.folioId} disabled={receivableBusy || receivableAttemptUncertain || reservationDetailRefreshUnavailable || depositLocked} className={selectedFolioId === item.folioId ? "selected" : undefined} onClick={() => selectFolio(item.folioId)}><strong>Window {item.windowNo} · {item.name ?? item.folioNo}</strong><small>{item.folioNo}</small><span data-status={item.status} className={`cashier-status ${statusTone(item.status)}`}>{item.status.replaceAll("_", " ")}</span></button>)}</div>
              ) : (
                <div className="cashier-empty-folio" role="status">
                  <strong>No folio windows exist for this reservation.</strong>
                  <p>A governed folio window must be opened before charges can be reviewed or posted.</p>
                </div>
              )}
              <PrimaryBillingWindowAction key={visibleReservationDetail.reservation.reservationId} reservation={visibleReservationDetail.reservation} reservationReadUnavailable={reservationDetailRefreshUnavailable} onOpened={enterOpenedPrimaryBillingWindow} onLifecycleBusyChange={onLifecycleBusyChange} />
            </>
          )}
        </article>
        <article className="cashier-panel cashier-posting">
          <span className="state">03 · REVIEW &amp; PREPARE</span>
          <h2>Folio posting</h2>
          {!selectedFolioId ? <p className="empty">{visibleReservationDetail?.reservation.folios.length === 0 ? "A folio window is required before any charge can be prepared." : "Select a folio window to review its statement."}</p> : folio.isLoading ? <p className="empty">Loading immutable statement…</p> : !folio.data ? <p className="error">{folio.error?.message ?? "Folio is unavailable."}</p> : <>
            {folio.isError ? <p className="error">The latest folio refresh failed. The last authoritative statement remains visible{receivableAttemptUncertain ? "; use the highlighted recovery control to reconcile the retained attempt." : "."}</p> : null}
            <p className="cashier-balance">Balance <strong>{money(folio.data.balanceMinor, folio.data.folio.currency)}</strong> · Window {folio.data.folio.windowNo}</p>
            {folio.data.siblingWindows.length > 1 ? <div className="cashier-window-tabs" aria-label="Folio windows">{folio.data.siblingWindows.map((window) => <button type="button" key={window.id} className={window.id === folio.data?.folio.id ? "active" : undefined} onClick={() => selectFolio(window.id)}>Window {window.windowNo}<small>{money(window.balanceMinor, folio.data!.folio.currency)}</small></button>)}</div> : null}
            {postingClasses.length > 1 ? <div className="cashier-posting-tabs" aria-label="Posting classes"><button type="button" className={postingClass === "all" ? "active" : undefined} onClick={() => setPostingClass("all")}>All postings ({folio.data.rows.length})</button>{postingClasses.map((kind) => <button type="button" key={kind} className={postingClass === kind ? "active" : undefined} onClick={() => setPostingClass(kind)}>{kind.replaceAll("_", " ")} ({folio.data!.rows.filter((row) => row.kind === kind).length})</button>)}</div> : null}
            <div className="cashier-ledger" aria-label="Immutable folio postings">{visiblePostingRows.map((row) => <div key={row.lineId}><strong>{row.txCode}</strong><span>{row.description ?? row.kind} · {money(row.amountMinor, folio.data!.folio.currency)} · quantity {row.quantity}</span><small>{row.businessDate} · running balance {money(row.runningBalanceMinor, folio.data!.folio.currency)}</small></div>)}{visiblePostingRows.length === 0 ? <p className="empty">No postings match this statement view.</p> : null}</div>
            <form className="cashier-charge-form" onSubmit={(event) => { event.preventDefault(); void postCharge(); }}>
              <fieldset className="cashier-charge-picker" disabled={!folio.data.chargeAvailability.allowed || posting || depositLocked}>
                <legend>Charge class</legend>
                {chargeGroups.length > 1 ? <div className="cashier-charge-groups" aria-label="Charge groups">{(["All", ...chargeGroups] as const).map((group) => <button type="button" key={group} aria-pressed={chargeGroup === group} className={chargeGroup === group ? "active" : undefined} data-group={group.toLocaleLowerCase().replaceAll(" ", "-").replaceAll("&", "and")} onClick={() => { setChargeGroup(group); if (group !== "All" && selectedOption && folioChargeGroup(selectedOption) !== group) setTxCode(""); resetCandidate(); }}><CashierGroupIcon group={group} /><span>{group}</span></button>)}</div> : null}
                <div className="cashier-charge-options" aria-label="Charge options">{visibleChargeOptions.map((option) => <button type="button" key={option.code} aria-pressed={txCode === option.code} className={txCode === option.code ? "active" : undefined} onClick={() => { setTxCode(option.code); resetCandidate(); }}><strong>{option.name}</strong><small>{option.usaliLine}</small></button>)}</div>
                {visibleChargeOptions.length === 0 ? <p className="empty">No governed charges are configured for this group.</p> : null}
              </fieldset>
              <label>Amount (minor units)<input inputMode="numeric" pattern="[0-9]*" value={amountMinor} onChange={(event) => { setAmountMinor(event.target.value); resetCandidate(); }} disabled={!folio.data.chargeAvailability.allowed || posting || depositLocked} placeholder="e.g. 125000" /></label>
              <label>Quantity<input inputMode="numeric" pattern="[0-9]*" value={quantity} onChange={(event) => { setQuantity(event.target.value); resetCandidate(); }} disabled={!folio.data.chargeAvailability.allowed || posting || depositLocked} /></label>
              {!folio.data.chargeAvailability.allowed ? <p className="error">{folio.data.chargeAvailability.reason ?? "This folio is not available for charges."}</p> : null}
              <label className="cashier-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={!canPost || posting || depositLocked} /> I confirm the selected class, amount and folio window. Post this immutable charge.</label>
              {postError ? <p className="error">{postError}</p> : null}
              <button type="submit" disabled={!canPost || !confirmed || posting || depositLocked}>{posting ? "Posting governed charge…" : "Post confirmed charge"}</button>
            </form>
            <section className="cashier-bill-allocation" aria-labelledby="cashier-bill-allocation-heading" data-lifecycle-recovery={allocationUncertainAttempt ? "true" : undefined}>
              <div className="cashier-bill-allocation-heading">
                <div><span>COMPLETE-GROUP ROUTING</span><h3 id="cashier-bill-allocation-heading">Split bill windows</h3></div>
                <span className="cashier-status neutral">No partial amount split</span>
              </div>
              <p>Move one or more complete canonical charge groups between this guest’s governed folio windows. Financial history remains immutable; Yellow adds a balanced transfer.</p>
              {allocationUncertainAttempt ? <p className="cashier-allocation-uncertain" role="status"><strong>Transfer outcome needs reconciliation.</strong> Source, destination, selected complete groups, reason, request body and operation key are locked. Only the same-key recovery action is available.</p> : null}
              <fieldset className="cashier-allocation-groups" disabled={allocationLocked}>
                <legend>1 · Choose complete charge groups</legend>
                {transferGroups.length ? <div className="cashier-allocation-group-list">
                  {transferGroups.map((group) => {
                    const selectable = group.eligible && group.currentWindowId === folio.data!.folio.id;
                    const routedWindow = folio.data!.siblingWindows.find((window) => window.id === group.currentWindowId);
                    const explanation = selectable
                      ? `${group.memberCount} immutable member${group.memberCount === 1 ? "" : "s"}`
                      : group.currentWindowId !== folio.data!.folio.id
                        ? `Already routed to Window ${routedWindow?.windowNo ?? "unknown"}`
                        : group.reason ?? "Ineligible for transfer";
                    return <label key={group.id} className={selectable ? undefined : "ineligible"}>
                      <input type="checkbox" checked={allocationGroupIds.includes(group.id)} disabled={!selectable} onChange={() => toggleAllocationGroup(group.id)} />
                      <span><strong>Group {group.id.slice(0, 8)}</strong><small>{explanation}</small></span>
                    </label>;
                  })}
                </div> : <p className="empty">No server-returned complete charge groups are available in this window.</p>}
              </fieldset>
              <fieldset className="cashier-allocation-destination" disabled={allocationLocked}>
                <legend>2 · Choose a different bill window</legend>
                <div className="cashier-allocation-destination-list" role="radiogroup" aria-label="Transfer destination">
                  {folio.data.siblingWindows.filter((window) => window.id !== folio.data!.folio.id && window.status === "open").map((window) => <label key={window.id} className={allocationDestinationFolioId === window.id ? "selected" : undefined}>
                    <input type="radio" name="allocation-destination" checked={allocationDestinationFolioId === window.id} onChange={() => { setAllocationDestinationFolioId(window.id); setAllocationNewWindowName(""); invalidateAllocationPreview(); }} />
                    <span><strong>Existing Window {window.windowNo}</strong><small>{window.name ?? window.reference ?? "Unnamed"} · {moneyExactMinor(window.balanceMinor, folio.data!.folio.currency)}</small></span>
                  </label>)}
                  <label className={allocationUsesNewWindow ? "selected" : undefined}>
                    <input type="radio" name="allocation-destination" checked={allocationDestinationFolioId.length === 0 && allocationNewWindowName.length > 0} onChange={() => { setAllocationDestinationFolioId(""); if (!allocationNewWindowName) setAllocationNewWindowName("New bill window"); invalidateAllocationPreview(); }} />
                    <span><strong>New named window</strong><small>Created only by the governed transfer if confirmed.</small></span>
                  </label>
                </div>
                <label className="cashier-allocation-window-name">New window name
                  <input value={allocationNewWindowName} maxLength={80} disabled={allocationLocked || allocationDestinationFolioId.length > 0} onChange={(event) => { setAllocationDestinationFolioId(""); setAllocationNewWindowName(event.target.value); invalidateAllocationPreview(); }} placeholder="Example: Colleague B" />
                </label>
              </fieldset>
              <label className="cashier-allocation-reason">3 · Audit reason
                <textarea rows={2} maxLength={500} value={allocationReason} readOnly={allocationLocked} onChange={(event) => { setAllocationReason(event.target.value); invalidateAllocationPreview(); }} placeholder="Example: Split complete dinner and minibar groups to colleague B" />
              </label>
              <div className="cashier-allocation-actions">
                <button type="button" disabled={!canPreviewAllocation || allocationBusy} onClick={() => void previewBillWindowAllocation()}>{allocationBusy && !allocationUncertainAttempt ? "Preparing exact preview…" : "Preview complete-group transfer"}</button>
              </div>
              {allocationPreview ? <div className="cashier-allocation-preview" role="status" aria-live="polite">
                <div><span>Source</span><strong>{moneyExactMinor(allocationPreview.sourceBeforeMinor, allocationPreview.currency)} → {moneyExactMinor(allocationPreview.sourceAfterMinor, allocationPreview.currency)}</strong></div>
                <div><span>Destination</span><strong>{moneyExactMinor(allocationPreview.destinationBeforeMinor, allocationPreview.currency)} → {moneyExactMinor(allocationPreview.destinationAfterMinor, allocationPreview.currency)}</strong></div>
                <div><span>Stay total</span><strong>{moneyExactMinor(allocationPreview.stayTotalMinor, allocationPreview.currency)} unchanged</strong></div>
                <div><span>Destination window</span><strong>{allocationPreview.destinationName ?? `Window ${allocationPreview.destinationWindowNo}`}</strong></div>
                <ul>{allocationPreview.memberEffects.map((effect) => <li key={effect.rootLineId}><strong>{effect.txCode}</strong><span>{effect.description ?? "No description"} · {moneyExactMinor(effect.amountMinor, allocationPreview.currency)} · quantity {effect.quantity}</span></li>)}</ul>
              </div> : null}
              {allocationPreview && !allocationUncertainAttempt ? <label className="cashier-confirm cashier-allocation-confirm"><input type="checkbox" checked={allocationConfirmed} disabled={allocationBusy} onChange={(event) => setAllocationConfirmed(event.target.checked)} /> I confirm these complete charge groups, exact destination and audit reason. Append this balanced transfer.</label> : null}
              {allocationError ? <p className="error">{allocationError}</p> : null}
              {allocationMessage ? <p className="cashier-allocation-message" role="status">{allocationMessage}</p> : null}
              <button type="button" className="cashier-allocation-commit" disabled={allocationBusy || (allocationUncertainAttempt === null && (!allocationPreview || !allocationConfirmed))} onClick={() => void reconcileBillWindowAllocation()}>{allocationUncertainAttempt ? "Retry same transfer and reconcile" : allocationBusy ? "Reconciling governed transfer…" : "Confirm balanced bill-window transfer"}</button>
            </section>
            <section className="cashier-receivable" aria-labelledby="cashier-receivable-heading">
              <div className="cashier-receivable-heading">
                <div><span>ACCOUNT-OWNED SETTLEMENT</span><h3 id="cashier-receivable-heading">Direct billing / Post Master</h3></div>
                <span className="cashier-status neutral">Independent of cash drawer</span>
              </div>
              <p>Company and travel-agent balances move to account-owned receivables, never to a physical room.</p>
              {(!EXACT_MINOR.test(folio.data.balanceMinor) || BigInt(folio.data.balanceMinor) <= 0n) && receivableUncertainOperation !== "transfer" ? (
                <p className="empty">Direct billing requires an open folio with a positive guest balance.</p>
              ) : receivableTargets.isLoading && !receivableAttemptUncertain ? (
                <p className="empty">Loading eligible company and travel-agent accounts…</p>
              ) : receivableTargets.isError && !receivableAttemptUncertain ? (
                <p className="error">{receivableTargets.error.message}</p>
              ) : (receivableTargets.data?.filter((target) => target.currency === folio.data?.folio.currency).length ?? 0) === 0 && !receivableAttemptUncertain ? (
                <p className="empty">No eligible receivable account exists for this property and currency.</p>
              ) : (
                <form className="receivable-transfer-form" data-lifecycle-recovery={receivableAttemptUncertain || undefined} onSubmit={(event) => { event.preventDefault(); void transferDirectBilling(); }}>
                  <fieldset disabled={receivableBusy || receivableAttemptUncertain || depositLocked}>
                    <legend>1 · Select a server-owned target</legend>
                    <div className="receivable-targets" role="radiogroup" aria-label="Eligible receivable accounts">
                      {receivableTargets.data?.filter((target) => target.currency === folio.data?.folio.currency).map((target) => (
                        <label key={target.accountId} className={receivableAccountId === target.accountId ? "selected" : undefined}>
                          <input type="radio" name="receivable-target" value={target.accountId} checked={receivableAccountId === target.accountId} onChange={() => {
                            receivableGeneration.current += 1;
                            setReceivableAccountId(target.accountId);
                            setReceivablePreview(null);
                            setReceivableApproval(null);
                            setReceivableConfirmed(false);
                            setReceivableError(null);
                            setReceivableMessage(null);
                            receivableTransferKey.current = null;
                            receivableTransferFingerprint.current = null;
                            receivableApprovalKey.current = null;
                            receivableApprovalFingerprint.current = null;
                          }} />
                          <span><strong>{target.name}</strong><small>{target.partyRole} · {target.currency} · limit {moneyExactMinor(target.creditLimitMinor, target.currency)}</small></span>
                        </label>
                      ))}
                    </div>
                    <button type="button" className="receivable-preview-action" disabled={!receivableAccountId || receivableBusy} onClick={() => void previewDirectBilling()}>{receivableBusy && !receivablePreview ? "Checking live credit…" : "Preview exact transfer"}</button>
                  </fieldset>
                  {receivablePreview ? <>
                    <div className="receivable-preview-grid" role="status" aria-live="polite">
                      <div><span>Target</span><strong>{receivablePreview.name}</strong></div>
                      <div><span>Exact transfer</span><strong>{moneyExactMinor(receivablePreview.amountMinor, receivablePreview.currency)}</strong></div>
                      <div><span>Current exposure</span><strong>{moneyExactMinor(receivablePreview.exposureMinor, receivablePreview.currency)}</strong></div>
                      <div><span>Credit limit</span><strong>{receivablePreview.creditLimitMinor === null ? "Not configured" : moneyExactMinor(receivablePreview.creditLimitMinor, receivablePreview.currency)}</strong></div>
                      <div><span>Projected exposure</span><strong>{moneyExactMinor(receivablePreview.projectedExposureMinor, receivablePreview.currency)}</strong></div>
                      <div><span>Approval</span><strong>{receivablePreview.requiresApproval ? "Supervisor required" : "Within limit"}</strong></div>
                    </div>
                    {receivablePreview.requiresApproval ? (
                      <div className="receivable-approval">
                        <strong>A different authorised supervisor must approve this exact over-limit request.</strong>
                        <p>Requesting approval does not move money. This colleague session cannot approve its own request.</p>
                        {receivableUncertainOperation === "approval" ? <p className="receivable-uncertain" role="status"><strong>Approval-request outcome not yet verified.</strong> Yellow has locked this exact request and operation key for same-attempt reconciliation.</p> : null}
                        <button type="button" disabled={receivableBusy || receivableApproval?.status === "pending"} onClick={() => void requestDirectBillingApproval()}>{receivableApproval?.status === "pending" ? "Approval pending" : receivableUncertainOperation === "approval" ? "Retry same approval request" : "Request supervisor approval"}</button>
                      </div>
                    ) : <>
                      <label className="receivable-reason">Audit reason<textarea rows={2} maxLength={500} value={receivableReason} readOnly={receivableAttemptUncertain} onChange={(event) => { setReceivableReason(event.target.value); setReceivableConfirmed(false); receivableTransferKey.current = null; receivableTransferFingerprint.current = null; }} placeholder="Example: OTA virtual-card settlement to agency receivable" /></label>
                      <label className="cashier-confirm receivable-confirm"><input type="checkbox" checked={receivableConfirmed} onChange={(event) => setReceivableConfirmed(event.target.checked)} disabled={!directBillingReasonIsValid || receivableBusy || receivableAttemptUncertain} /> I confirm this exact balance, target and audit reason. Record the immutable direct-billing transfer.</label>
                      {receivableAttemptUncertain ? <p className="receivable-uncertain" role="status"><strong>Outcome not yet verified.</strong> Yellow has locked this exact folio, target, amount, reason and operation key. Retry below to reconcile the same attempt.</p> : null}
                      <button type="submit" className="receivable-transfer-action" disabled={!canTransferReceivable}>{receivableBusy ? "Recording and reconciling…" : receivableAttemptUncertain ? "Retry and reconcile same transfer" : "Transfer confirmed balance"}</button>
                    </>}
                  </> : null}
                  {receivableMessage ? <p className="receivable-message" role="status">{receivableMessage}</p> : null}
                  {receivableError ? <p className="error" role="alert">{receivableError}</p> : null}
                </form>
              )}
            </section>
            <AdvanceDepositWorkbench reservation={visibleReservationDetail!.reservation} statement={folio.data} acquireMutationLease={acquireDepositMutationLease} releaseMutationLease={releaseDepositMutationLease} onStatementReconciled={(refreshed) => queryClient.setQueryData(["cashier-folio-statement", propertyId, refreshed.folio.id], refreshed)} />
          </>}
        </article>
      </div>
      <article className="detail-card commercial-plans"><div className="section-heading"><div><span>SERVER-OWNED DRAWERS</span><h2>Cash custody readiness</h2></div></div>{drawers.length ? <ul>{drawers.map((drawer) => <li key={drawer.drawerId}><strong>{drawer.name} · {drawer.code}</strong><span>{drawer.currency} · {drawer.session ? `session ${drawer.session.status ?? "active"}` : "no active session"}</span><small>{drawer.canOpen ? "Open" : "Open unavailable"} · {drawer.canCount ? "Count" : "Count unavailable"} · {drawer.canClose ? "Close" : "Close unavailable"}{drawer.supervised ? " · supervised" : ""}</small></li>)}</ul> : <div className="cashier-drawer-empty"><span className="cashier-status neutral">Cash drawer not configured</span><p>Cash custody controls are unavailable. Governed room, service and non-cash folio charges can still be posted above.</p></div>}</article>
      <p className="commercial-note">Charges and direct billing use their canonical financial endpoints, stable operation keys, server-owned catalogues and separate visible confirmations. Corrections, payment settlement and fiscal documents remain distinct governed actions.</p>
    </section>
  );
}


export { FinanceWorkspace, PrimaryBillingWindowAction, AdvanceDepositWorkbench, CashierWorkbench };
