import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import type { PartyProfile } from "../yellow-api";
import { VoiceInput } from "./VoiceField";
import {
  createGuestProfileController,
  type GuestProfileController,
  type GuestProfileDraft,
} from "./guest-profile-create";
import "./guest-profile-create.css";

export type GuestProfileCreateProps = Readonly<{
  propertyId: string;
  getToken: () => Promise<string>;
  onCreated: (profile: PartyProfile) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}>;

const blankDraft = (): GuestProfileDraft => Object.freeze({ displayName: "" });

export function GuestProfileCreate({ propertyId, getToken, onCreated, onBusyChange, disabled = false }: GuestProfileCreateProps) {
  const callbacks = useRef({ getToken, onCreated, onBusyChange });
  callbacks.current = { getToken, onCreated, onBusyChange };
  const controller = useMemo<GuestProfileController>(() => createGuestProfileController({
    propertyId,
    getToken: () => callbacks.current.getToken(),
  }), [propertyId]);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<GuestProfileDraft>(blankDraft);
  const [distinctConfirmed, setDistinctConfirmed] = useState(false);
  const [notice, setNotice] = useState("");
  const completedPartyId = useRef<string | null>(null);
  const locked = state.busy || state.status === "uncertain";
  const controlsDisabled = disabled || locked || state.status === "duplicates";

  useEffect(() => {
    callbacks.current.onBusyChange?.(state.busy);
  }, [controller, state.busy]);

  useEffect(() => {
    controller.activate();
    return () => {
      controller.dispose();
      callbacks.current.onBusyChange?.(false);
    };
  }, [controller]);

  useLayoutEffect(() => {
    completedPartyId.current = null;
    setDraft(blankDraft());
    setExpanded(false);
    setDistinctConfirmed(false);
    setNotice("");
    controller.setProperty(propertyId);
  }, [controller, propertyId]);

  useEffect(() => {
    if (state.status !== "ready" || !state.profile || completedPartyId.current === state.profile.partyId) return;
    completedPartyId.current = state.profile.partyId;
    callbacks.current.onCreated(state.profile);
    setNotice(state.created ? "Guest profile created and verified. No reservation has been booked." : "Existing guest profile verified and selected.");
    setExpanded(false);
    setDraft(blankDraft());
    setDistinctConfirmed(false);
    controller.reset();
  }, [controller, state]);

  const edit = (key: keyof GuestProfileDraft, value: string) => {
    if (locked) return;
    controller.reset();
    completedPartyId.current = null;
    setNotice("");
    setDistinctConfirmed(false);
    setDraft((current) => Object.freeze({ ...current, [key]: value }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || locked || state.status === "duplicates") return;
    setNotice("");
    void controller.submit(draft);
  };

  const close = () => {
    if (locked || disabled) return;
    controller.reset();
    setDraft(blankDraft());
    setDistinctConfirmed(false);
    setExpanded(false);
  };

  const recovery = state.status === "uncertain";

  return <section className="guest-profile-create" data-lifecycle-recovery="true" aria-busy={state.busy} aria-label="Create or select guest profile">
    {!expanded ? <button type="button" className="guest-profile-create-toggle" disabled={disabled} onClick={() => { setExpanded(true); setNotice(""); }}>Create guest profile</button> : null}
    {expanded ? <div className="guest-profile-create-panel">
      <header className="guest-profile-create-heading">
        <div><h3>Create guest profile</h3><p>Creates a canonical person and verifies the saved profile. Booking remains a separate step.</p></div>
        {!recovery ? <button type="button" className="quiet guest-profile-create-cancel" disabled={disabled || state.busy} onClick={close}>Cancel</button> : null}
      </header>

      {state.status !== "uncertain" ? <form className="guest-profile-create-form" onSubmit={submit}>
        <label>Display name
          <VoiceInput aria-label="Guest display name" name="displayName" value={draft.displayName} disabled={controlsDisabled} required maxLength={200} contextKey={propertyId} onChange={(event) => edit("displayName", event.currentTarget.value)} onVoiceValue={(value) => edit("displayName", value)} />
        </label>
        <label>Legal name <span>(optional)</span>
          <VoiceInput aria-label="Guest legal name" name="legalName" value={draft.legalName ?? ""} disabled={controlsDisabled} maxLength={300} contextKey={propertyId} onChange={(event) => edit("legalName", event.currentTarget.value)} onVoiceValue={(value) => edit("legalName", value)} />
        </label>
        <label>Email <span>(optional)</span>
          <input aria-label="Guest email" name="email" type="email" autoComplete="off" maxLength={254} value={draft.email ?? ""} disabled={controlsDisabled} onChange={(event) => edit("email", event.currentTarget.value)} />
        </label>
        <label>Phone <span>(optional, E.164)</span>
          <input aria-label="Guest phone" name="phone" type="tel" autoComplete="off" inputMode="tel" maxLength={16} pattern="\+[1-9][0-9]{6,14}" placeholder="+919876543210" value={draft.phone ?? ""} disabled={controlsDisabled} onChange={(event) => edit("phone", event.currentTarget.value)} />
        </label>
        <p className="guest-profile-create-note">Contact details are sent only for profile creation. Search results and duplicate review show masked hints.</p>
        <div className="guest-profile-create-actions">
          <button type="submit" disabled={controlsDisabled}>{state.status === "posting" ? "Checking possible matches…" : "Review and create"}</button>
          {!recovery && state.status !== "posting" ? <button type="button" className="guest-profile-create-secondary" disabled={disabled} onClick={close}>Back to guest search</button> : null}
        </div>
      </form> : null}

      {state.status === "duplicates" ? <section className="guest-profile-create-duplicates" aria-labelledby="guest-profile-create-duplicate-title" tabIndex={-1}>
        <h4 id="guest-profile-create-duplicate-title">Review possible matches</h4>
        <p>{state.candidates.length ? "No profile was created. Choose an existing profile or acknowledge every current candidate to create a distinct guest." : "No current candidates remain. Confirm that you want to create a separate guest profile."}</p>
        <ul>{state.candidates.map((candidate) => <li key={candidate.partyId}>
          <div><strong>{candidate.displayNameHint}</strong><span>Party {candidate.partyId} · {candidate.reasons.join(", ")}</span>
            {candidate.contacts.length ? <small>{candidate.contacts.map((contact) => `${contact.kind}: ${contact.hint}`).join(" · ")}</small> : null}</div>
          <button type="button" disabled={state.busy || disabled} onClick={() => void controller.useCandidate(candidate.partyId)}>Use this profile</button>
        </li>)}</ul>
        <label className="guest-profile-create-ack"><input type="checkbox" checked={distinctConfirmed} disabled={state.busy || disabled} onChange={(event) => setDistinctConfirmed(event.currentTarget.checked)} /> I reviewed every current candidate and want to create a separate guest profile.</label>
        <div className="guest-profile-create-actions">
          <button type="button" disabled={!distinctConfirmed || state.busy || disabled} onClick={() => { setDistinctConfirmed(false); void controller.acknowledgeDistinct(); }}>Create distinct profile</button>
          <button type="button" className="guest-profile-create-secondary" disabled={state.busy || disabled} onClick={close}>Back to guest search</button>
        </div>
      </section> : null}

      {recovery ? <section className="guest-profile-create-recovery" aria-live="polite" aria-label="Guest profile recovery">
        <p>{state.message ?? "The save outcome is not confirmed."}</p>
        <button type="button" disabled={disabled} onClick={() => void controller.reconcile()}>Reconcile same request</button>
      </section> : null}
      {state.message && state.status !== "duplicates" && !recovery ? <p className="guest-profile-create-message" role="alert">{state.message}</p> : null}
    </div> : null}
    {notice ? <p className="guest-profile-create-success" role="status">{notice}</p> : null}
  </section>;
}
