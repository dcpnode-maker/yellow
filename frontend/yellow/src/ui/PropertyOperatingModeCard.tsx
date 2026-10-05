import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPropertyOperatingModeAttempt,
  clearPropertyOperatingModeDraft,
  isPropertyOperatingMode,
  readPropertyOperatingModeDraft,
  reconcilePropertyOperatingModeAttempt,
  writePropertyOperatingModeDraft,
  type PropertyOperatingModeActorScope,
  type PropertyOperatingMode,
  type PropertyOperatingModeAttempt,
} from "../property-operating-mode";
import {
  loadPropertyOperatingMode,
  propertyOperatingModeActorScope,
  PropertyOperatingModeRequestError,
  savePropertyOperatingMode,
} from "../yellow-api";
import "./PropertyOperatingModeCard.css";

const modeChoices: readonly Readonly<{ mode: PropertyOperatingMode; label: string; description: string }>[] = [
  { mode: "hotel", label: "Hotel", description: "Use the hotel's operating view." },
  { mode: "str", label: "STR", description: "Use the short-stay rental operating view." },
  { mode: "both", label: "Both", description: "Choose Hotel or STR views over this same property and inventory." },
];

export function PropertyModeRecoveryControls({ attempt, busy, message, onRetry, onCheck }: Readonly<{
  attempt: PropertyOperatingModeAttempt | null;
  busy: boolean;
  message: string | null;
  onRetry: () => void;
  onCheck: () => void;
}>) {
  if (!attempt) return null;
  return <div className="property-mode-notice is-warning" role="alert">
    <p>{message ?? "The save outcome is uncertain."}</p>
    <button type="button" onClick={onRetry} disabled={busy}>Retry this exact save</button>
    <button type="button" className="property-mode-text-button" onClick={onCheck} disabled={busy}>Check saved status</button>
  </div>;
}

export function PropertyOperatingModeCard({ propertyId, onNavigationLockChange }: Readonly<{ propertyId: string; onNavigationLockChange?: (locked: boolean) => void }>) {
  const queryClient = useQueryClient();
  const queryKey = ["property-operating-mode", propertyId] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => loadPropertyOperatingMode(propertyId),
    retry: false,
  });
  const [selection, setSelection] = useState<PropertyOperatingMode | null | undefined>(undefined);
  const [attempt, setAttempt] = useState<PropertyOperatingModeAttempt | null>(null);
  const [actorScope, setActorScope] = useState<PropertyOperatingModeActorScope | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void propertyOperatingModeActorScope().then((scope) => {
      if (!active) return;
      setActorScope(scope);
      try {
        const restored = readPropertyOperatingModeDraft(window.localStorage, scope, propertyId);
        if (restored) {
          setSelection(restored.selection);
          setAttempt(restored.attempt);
        }
        setDraftReady(true);
      } catch (cause) {
        setDraftError(cause instanceof Error ? cause.message : "Pending mode recovery is unavailable.");
      }
    }).catch((cause: unknown) => {
      if (active) setDraftError(cause instanceof Error ? cause.message : "The signed-in session cannot scope pending mode recovery.");
    });
    return () => { active = false; };
  }, [propertyId]);

  useEffect(() => {
    if (query.data && draftReady && selection === undefined) setSelection(query.data.mode);
  }, [query.data, selection, draftReady]);

  useEffect(() => {
    if (!query.data || !draftReady || !actorScope || attempt || selection === undefined || selection !== query.data.mode) return;
    try { clearPropertyOperatingModeDraft(window.localStorage, actorScope, propertyId); } catch { /* A stale non-authoritative draft is safe to reconcile on the next load. */ }
  }, [query.data, draftReady, actorScope, attempt, selection, propertyId]);

  const navigationLocked = attempt !== null || (Boolean(query.data?.canWrite) && selection !== undefined && query.data !== undefined && selection !== query.data.mode);
  useEffect(() => {
    onNavigationLockChange?.(navigationLocked);
    return () => onNavigationLockChange?.(false);
  }, [navigationLocked, onNavigationLockChange]);

  const reload = async () => {
    const result = await query.refetch();
    const snapshot = result.data;
    if (!snapshot) return;
    if (!attempt) {
      setMessage("Current saved status refreshed. Your unsaved choice is still shown.");
      return;
    }
    const resolution = reconcilePropertyOperatingModeAttempt(attempt, snapshot);
    if (resolution === "accepted") {
      if (actorScope) clearPropertyOperatingModeDraft(window.localStorage, actorScope, propertyId);
      setAttempt(null);
      setSelection(snapshot.mode);
      setMessage("The requested mode is now saved.");
    } else if (resolution === "conflict") {
      if (actorScope && isPropertyOperatingMode(selection)) writePropertyOperatingModeDraft(window.localStorage, actorScope, propertyId, { selection, attempt: null });
      setAttempt(null);
      setMessage("The property changed while this save was in flight. Review the current mode and save your selection again.");
    } else if (attempt) {
      setMessage("The server has not confirmed this save. Retry the same request to reconcile it.");
    }
  };

  const submit = async (retryExact: boolean) => {
    if (busy || (!attempt && !query.data?.canWrite)) return;
    if (attempt && !retryExact) return;
    if (!attempt && !isPropertyOperatingMode(selection)) return;
    const expectedVersion = attempt?.expectedVersion ?? query.data?.version;
    if (expectedVersion === undefined) return;
    const request = attempt ?? createPropertyOperatingModeAttempt(
      expectedVersion,
      selection as PropertyOperatingMode,
      crypto.randomUUID(),
      crypto.randomUUID(),
    );
    if (!actorScope || !draftReady) {
      setMessage(draftError ?? "Yellow cannot safely preserve this pending change yet. The request was not sent.");
      return;
    }
    const currentScope = await propertyOperatingModeActorScope().catch(() => null);
    if (!currentScope || currentScope.tenantId !== actorScope.tenantId || currentScope.actorId !== actorScope.actorId) {
      setMessage("This pending change belongs to a different signed-in session. It was not retried.");
      return;
    }
    try {
      writePropertyOperatingModeDraft(window.localStorage, actorScope, propertyId, { selection: request.mode, attempt: request });
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Yellow could not safely preserve this request. It was not sent.");
      return;
    }
    onNavigationLockChange?.(true);
    if (!attempt) setAttempt(request);
    setBusy(true);
    setMessage(null);
    try {
      const receipt = await savePropertyOperatingMode(propertyId, request);
      try { clearPropertyOperatingModeDraft(window.localStorage, actorScope, propertyId); }
      catch {
        writePropertyOperatingModeDraft(window.localStorage, actorScope, propertyId, { selection: receipt.propertyMode.mode, attempt: null });
      }
      setAttempt(null);
      setSelection(receipt.propertyMode.mode);
      queryClient.setQueryData(queryKey, receipt.propertyMode);
      await queryClient.invalidateQueries({ queryKey });
      setMessage(receipt.replayed ? "The saved request was reconciled." : receipt.changed ? "Operating mode saved." : "The property already had this mode.");
    } catch (cause) {
      const error = cause instanceof PropertyOperatingModeRequestError
        ? cause
        : new PropertyOperatingModeRequestError(null, "The save outcome is uncertain. Retry this exact save to reconcile it.", true);
      if (error.uncertain) {
        setMessage(error.message);
      } else if (error.status === 409) {
        if (actorScope && isPropertyOperatingMode(selection)) writePropertyOperatingModeDraft(window.localStorage, actorScope, propertyId, { selection, attempt: null });
        setAttempt(null);
        setMessage("The property changed before this save. Refreshing its current version; your selection is preserved.");
        await query.refetch();
      } else {
        if (actorScope && isPropertyOperatingMode(selection)) writePropertyOperatingModeDraft(window.localStorage, actorScope, propertyId, { selection, attempt: null });
        setAttempt(null);
        setMessage(error.message);
        if (error.status === 403) await query.refetch();
      }
    } finally {
      setBusy(false);
    }
  };

  const discardDraft = () => {
    if (attempt || !query.data) return;
    try { if (actorScope) clearPropertyOperatingModeDraft(window.localStorage, actorScope, propertyId); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "The draft could not be discarded safely."); return; }
    setSelection(query.data.mode);
    setMessage("Unsaved operating-mode choice discarded.");
  };

  if (query.isLoading) return <section className="property-mode-card" data-property-mode-recovery="true" aria-labelledby="property-mode-title"><p role="status">Loading property operating mode…</p></section>;
  if (query.isError || !query.data) return <section className="property-mode-card" data-property-mode-recovery="true" aria-labelledby="property-mode-title">
    <header><div><span>PROPERTY WORKSPACE</span><h2 id="property-mode-title">Operating mode</h2></div><span className="property-mode-state">Unavailable</span></header>
    <p className="property-mode-unavailable">{attempt ? "A save is still awaiting reconciliation. Retry its exact request or check the saved status." : "Operating mode is unavailable for this property. Your access may be read-only or not granted."}</p>
    <PropertyModeRecoveryControls attempt={attempt} busy={busy || query.isFetching} message={message} onRetry={() => void submit(true)} onCheck={() => void reload()} />
    {draftError ? <p role="alert">{draftError}</p> : null}
    <button type="button" className="property-mode-secondary" onClick={() => void reload()} disabled={query.isFetching}>Retry</button>
  </section>;

  const snapshot = query.data;
  const selected = selection === undefined ? snapshot.mode : selection;
  const dirty = selection !== undefined && selection !== snapshot.mode;
  const uncertain = attempt !== null;
  const savedLabel = snapshot.mode === null ? "Not configured" : modeChoices.find((choice) => choice.mode === snapshot.mode)?.label ?? "Unavailable";
  return <section className="property-mode-card" data-property-mode-recovery="true" aria-labelledby="property-mode-title">
    <header>
      <div><span>PROPERTY WORKSPACE</span><h2 id="property-mode-title">Operating mode</h2><p>Choose the workspace views for this property. Inventory and property identity stay the same.</p></div>
      <span className={"property-mode-state" + (snapshot.canWrite ? " is-editable" : "")}>{snapshot.canWrite ? "Editable" : "Read-only"}</span>
    </header>
    <div className="property-mode-saved"><span>Saved mode</span><strong>{savedLabel}</strong>
      {snapshot.effectiveBusinessDate ? <small>Effective from business date {snapshot.effectiveBusinessDate}</small> : snapshot.mode === null ? <small>No mode has been configured.</small> : null}
    </div>
    <PropertyModeRecoveryControls attempt={attempt} busy={busy || query.isFetching} message={message} onRetry={() => void submit(true)} onCheck={() => void reload()} />
    {draftError ? <p className="property-mode-notice is-warning" role="alert">{draftError} Yellow will not send a change until it can preserve recovery data.</p> : null}
    {snapshot.canWrite ? <>
      <fieldset className="property-mode-choices" disabled={busy || uncertain || !draftReady}>
        <legend>Select a mode</legend>
        {modeChoices.map((choice) => <label key={choice.mode} className={selected === choice.mode ? "is-selected" : ""}>
          <input type="radio" name={"property-operating-mode-" + propertyId} value={choice.mode} checked={selected === choice.mode} onChange={() => {
            if (!actorScope || !draftReady) return;
            try {
              if (choice.mode === snapshot.mode) clearPropertyOperatingModeDraft(window.localStorage, actorScope, propertyId);
              else writePropertyOperatingModeDraft(window.localStorage, actorScope, propertyId, { selection: choice.mode, attempt: null });
              setSelection(choice.mode);
              onNavigationLockChange?.(attempt !== null || choice.mode !== snapshot.mode);
              setMessage(null);
            } catch (cause) { setMessage(cause instanceof Error ? cause.message : "The draft could not be preserved."); }
          }} />
          <span><strong>{choice.label}</strong><small>{choice.description}</small></span>
        </label>)}
      </fieldset>
      {!uncertain ? <div className="property-mode-save-row"><button type="button" className="property-mode-save" onClick={() => void submit(false)} disabled={!draftReady || Boolean(draftError) || !dirty || !isPropertyOperatingMode(selected) || busy}>{busy ? "Saving…" : "Save operating mode"}</button><button type="button" className="property-mode-secondary" onClick={() => void reload()} disabled={busy || query.isFetching}>Refresh status</button>{dirty ? <button type="button" className="property-mode-text-button" onClick={discardDraft} disabled={busy}>Discard selection</button> : null}</div> : null}
    </> : <><p className="property-mode-readonly">You can view this setting, but do not have permission to change it.</p>{dirty && !uncertain ? <div className="property-mode-notice is-warning" role="status"><p>Your unsaved selection is preserved, but this session cannot change the saved mode.</p><button type="button" className="property-mode-text-button" onClick={discardDraft}>Discard selection</button></div> : null}</>}
    {message && !uncertain ? <p className="property-mode-message" role="status">{message}</p> : null}
  </section>;
}
