import { VoiceInput } from "../ui/VoiceField";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  attachGroupMember, createGroup, findGroupCandidate, GroupRequestError, loadGroup, loadGroups,
  type GroupCandidate, type GroupDetail, type GroupHeader,
} from "../group-reservations-api";
import { reservationGroupFromSearch } from "../reservation-navigation";
import "./group-reservations.css";

type Attempt = Readonly<{ key: string; name: string }>;
type MemberAttempt = Readonly<{ key: string; groupId: string; reservationId: string }>;
function pendingAttempt<T>(storageKey: string, valid: (value: Record<string, unknown>) => boolean): T | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) && valid(value as Record<string, unknown>) ? value as T : null;
  } catch { return null; }
}
function persistAttempt(storageKey: string, value: Attempt | MemberAttempt | null): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey);
    return true;
  } catch { return false; }
}

function GroupReservationWorkspaceInner({ propertyId }: Readonly<{ propertyId: string }>) {
  const createStorageKey = `yellow-group-create:${propertyId}`;
  const memberStorageKey = `yellow-group-member:${propertyId}`;
  const [groups, setGroups] = useState<readonly GroupHeader[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [name, setName] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [candidate, setCandidate] = useState<GroupCandidate | null>(null);
  const [createAttempt, setCreateAttempt] = useState<Attempt | null>(() => pendingAttempt<Attempt>(createStorageKey,
    (value) => typeof value.key === "string" && typeof value.name === "string"));
  const [memberAttempt, setMemberAttempt] = useState<MemberAttempt | null>(() => pendingAttempt<MemberAttempt>(memberStorageKey,
    (value) => typeof value.key === "string" && typeof value.groupId === "string" && typeof value.reservationId === "string"));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [linkLoading, setLinkLoading] = useState(false);
  const linkGeneration = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [memberCursor, setMemberCursor] = useState<string | null>(null);

  const refreshGroups = useCallback(async () => {
    const page = await loadGroups(propertyId);
    setGroups(page.groups); setNextCursor(page.nextCursor);
  }, [propertyId]);
  const refreshDetail = useCallback(async (groupId: string) => {
    const result = await loadGroup(propertyId, groupId);
    setDetail(result); setMemberCursor(result.nextMemberCursor);
  }, [propertyId]);
  useEffect(() => { persistAttempt(createStorageKey, createAttempt); }, [createStorageKey, createAttempt]);
  useEffect(() => { persistAttempt(memberStorageKey, memberAttempt); }, [memberStorageKey, memberAttempt]);
  useEffect(() => {
    if (!createAttempt && !memberAttempt) return;
    const preventLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLeave);
    return () => window.removeEventListener("beforeunload", preventLeave);
  }, [createAttempt, memberAttempt]);
  useEffect(() => {
    if (!memberAttempt) return;
    let active = true;
    void loadGroup(propertyId, memberAttempt.groupId).then((result) => {
      if (!active) return;
      setSelectedId(memberAttempt.groupId); setDetail(result); setMemberCursor(result.nextMemberCursor);
    }).catch((cause: unknown) => { if (active) setError(String(cause)); });
    return () => { active = false; };
  }, [propertyId, memberAttempt?.groupId]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadGroups(propertyId).then((page) => {
      if (!active) return;
      setGroups(page.groups); setNextCursor(page.nextCursor); setLoading(false);
    }).catch((cause: unknown) => { if (active) { setError(String(cause)); setLoading(false); } });
    return () => { active = false; };
  }, [propertyId]);
  useEffect(() => {
    if (createAttempt || memberAttempt) return;
    let active = true;
    const openLinkedGroup = () => {
      const generation = ++linkGeneration.current;
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") !== "groups") { setLinkLoading(false); return; }
      const groupId = reservationGroupFromSearch(window.location.search);
      setSelectedId(null); setDetail(null); setMemberCursor(null); setCandidate(null); setConfirmation("");
      if (groupId === undefined) { setError(null); setLinkLoading(false); return; }
      if (groupId === null) {
        setLinkLoading(false); setError("The group link is invalid."); return;
      }
      setError(null); setLinkLoading(true);
      void loadGroup(propertyId, groupId).then((result) => {
        if (!active || linkGeneration.current !== generation || reservationGroupFromSearch(window.location.search) !== groupId) return;
        setSelectedId(groupId); setDetail(result); setMemberCursor(result.nextMemberCursor); setLinkLoading(false);
      }).catch((cause: unknown) => {
        if (active && linkGeneration.current === generation && reservationGroupFromSearch(window.location.search) === groupId) {
          setError(cause instanceof Error ? cause.message : "The linked group could not be opened.");
          setLinkLoading(false);
        }
      });
    };
    openLinkedGroup();
    window.addEventListener("popstate", openLinkedGroup);
    return () => { active = false; ++linkGeneration.current; window.removeEventListener("popstate", openLinkedGroup); };
  }, [propertyId, Boolean(createAttempt), Boolean(memberAttempt)]);

  const select = async (groupId: string) => {
    if (busy || linkLoading || createAttempt || memberAttempt) return;
    const generation = ++linkGeneration.current;
    setBusy(true); setError(null); setCandidate(null); setConfirmation("");
    setSelectedId(null); setDetail(null); setMemberCursor(null);
    const url = new URL(window.location.href);
    url.searchParams.set("view", "groups"); url.searchParams.set("group", groupId);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    try {
      const result = await loadGroup(propertyId, groupId);
      if (linkGeneration.current === generation && reservationGroupFromSearch(window.location.search) === groupId) {
        setSelectedId(groupId); setDetail(result); setMemberCursor(result.nextMemberCursor);
      }
    }
    catch (cause) {
      if (linkGeneration.current === generation && reservationGroupFromSearch(window.location.search) === groupId)
        setError(String(cause));
    }
    finally { setBusy(false); }
  };
  const submitCreate = async () => {
    if (busy || linkLoading || memberAttempt) return;
    const attempt = createAttempt ?? { key: crypto.randomUUID(), name: name.trim() };
    if (!attempt.name || attempt.name.length > 120) { setError("Enter a group name of 1–120 characters."); return; }
    if (!persistAttempt(createStorageKey, attempt)) {
      setError("This browser cannot retain a safe retry. Enable session storage before creating a group."); return;
    }
    setCreateAttempt(attempt); setBusy(true); setError(null); setNotice(null);
    let commandSucceeded = false;
    try {
      const created = await createGroup(propertyId, attempt.name, attempt.key);
      commandSucceeded = true;
      await Promise.all([refreshGroups(), refreshDetail(created.group.groupId)]);
      const url = new URL(window.location.href);
      url.searchParams.set("view", "groups"); url.searchParams.set("group", created.group.groupId);
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      persistAttempt(createStorageKey, null);
      setSelectedId(created.group.groupId); setName(""); setCreateAttempt(null);
      setNotice(created.replayed ? "Group creation was reconciled." : "Group created. No rooms are held by this group.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Group creation failed.");
      if (!commandSucceeded && (!(cause instanceof GroupRequestError) || !cause.uncertain)) {
        persistAttempt(createStorageKey, null); setCreateAttempt(null);
      }
    } finally { setBusy(false); }
  };
  const lookup = async () => {
    if (!selectedId || busy || createAttempt || memberAttempt) return;
    setBusy(true); setError(null); setCandidate(null);
    try {
      const result = await findGroupCandidate(propertyId, selectedId, confirmation.trim());
      setCandidate(result); if (!result) setNotice("No reservation matched that confirmation in this property.");
      else setNotice(null);
    } catch (cause) { setError(String(cause)); }
    finally { setBusy(false); }
  };
  const attach = async () => {
    if ((!selectedId && !memberAttempt) || busy || createAttempt || (!candidate && !memberAttempt)) return;
    const attempt = memberAttempt ?? { key: crypto.randomUUID(), groupId: selectedId!, reservationId: candidate!.reservationId };
    if (!persistAttempt(memberStorageKey, attempt)) {
      setError("This browser cannot retain a safe retry. Enable session storage before linking a reservation."); return;
    }
    setMemberAttempt(attempt); setBusy(true); setError(null); setNotice(null);
    let commandSucceeded = false;
    try {
      const result = await attachGroupMember(propertyId, attempt.groupId, attempt.reservationId, attempt.key);
      commandSucceeded = true;
      await Promise.all([refreshDetail(attempt.groupId), refreshGroups()]);
      persistAttempt(memberStorageKey, null);
      setSelectedId(attempt.groupId); setCandidate(null); setConfirmation(""); setMemberAttempt(null);
      setNotice(result.replayed ? "Membership was reconciled." : "Reservation linked. Its inventory remains unchanged.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Membership change failed.");
      if (!commandSucceeded && (!(cause instanceof GroupRequestError) || !cause.uncertain)) {
        persistAttempt(memberStorageKey, null); setMemberAttempt(null); setCandidate(null);
      }
    } finally { setBusy(false); }
  };
  const loadMoreGroups = async () => {
    if (!nextCursor || busy) return;
    setBusy(true); setError(null);
    try { const page = await loadGroups(propertyId, nextCursor); setGroups((old) => [...old, ...page.groups]); setNextCursor(page.nextCursor); }
    catch (cause) { setError(String(cause)); } finally { setBusy(false); }
  };
  const loadMoreMembers = async () => {
    if (!selectedId || !memberCursor || busy) return;
    const groupId = selectedId, generation = linkGeneration.current;
    setBusy(true); setError(null);
    try {
      const page = await loadGroup(propertyId, groupId, memberCursor);
      if (linkGeneration.current !== generation || reservationGroupFromSearch(window.location.search) !== groupId) return;
      setDetail((old) => old ? { ...old, members: [...old.members, ...page.members], nextMemberCursor: page.nextMemberCursor } : page);
      setMemberCursor(page.nextMemberCursor);
    } catch (cause) { setError(String(cause)); } finally { setBusy(false); }
  };

  return <section className="group-reservation-workspace" aria-label="Group reservations">
    <header><h2>Groups</h2><p>Create a linked group and associate existing reservations. No rooms are held by a linked group; each reservation keeps its own inventory, price, policy and folio.</p></header>
    {error ? <div className="group-error" role="alert"><p>{error}</p><button type="button" disabled={busy}
      onClick={() => { setError(null); setLoading(true); void refreshGroups().then(() => setLoading(false))
        .catch((cause: unknown) => { setError(String(cause)); setLoading(false); }); }}>Refresh groups</button></div> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {linkLoading ? <p role="status">Opening the selected group from this property…</p> : null}
    <form className="group-create" onSubmit={(event) => { event.preventDefault(); void submitCreate(); }}>
      <label>Group name<VoiceInput aria-label="Group name" contextKey={`${propertyId}:${selectedId}`} onVoiceValue={voiceValue => setName(voiceValue)} value={createAttempt?.name ?? name} maxLength={120} disabled={busy || linkLoading || createAttempt !== null || memberAttempt !== null}
        onChange={(event) => setName(event.target.value)} placeholder="e.g. Patel wedding party" required /></label>
      <button disabled={busy || linkLoading || memberAttempt !== null || (!createAttempt && !name.trim())} type="submit">
        {createAttempt ? "Reconcile same group request" : "Create linked group"}
      </button>
    </form>
    {createAttempt ? <p role="status">{busy ? "Creating or reconciling this group…" : "Creation response is uncertain. The group name and request key are locked; retry the same request."}</p> : null}
    {memberAttempt && !candidate ? <div className="group-pending-member" role="status"><p>A reservation link needs reconciliation. The same group, reservation and request key are retained.</p>
      <button type="button" onClick={() => void attach()} disabled={busy || createAttempt !== null}>{busy ? "Reconciling…" : "Reconcile same link request"}</button></div> : null}
    <div className="group-layout">
      <aside aria-label="Group list">
        {loading ? <p>Loading groups…</p> : groups.length === 0 ? <p>No groups for this property yet.</p> : null}
        {groups.map((group) => <button type="button" className={selectedId === group.groupId ? "selected" : ""}
          key={group.groupId} onClick={() => void select(group.groupId)} disabled={busy || linkLoading || createAttempt !== null || memberAttempt !== null}>
          <strong>{group.name}</strong><small>{group.code} · {group.kind === "linked" ? "Linked reservations · no rooms held" : `${group.kind} group · block controls not available here`} · {group.memberCount} member{group.memberCount === 1 ? "" : "s"}</small>
        </button>)}
        {nextCursor ? <button type="button" onClick={() => void loadMoreGroups()} disabled={busy}>Load more groups</button> : null}
      </aside>
      <div className="group-detail">
        {!detail ? <p>Select a group to see its reservations.</p> : <>
          <h3>{detail.group.name}</h3>
          <p>{detail.group.code} · {detail.group.kind === "linked" ? "Linked group · no rooms held" : `${detail.group.kind} group · view only here`}</p>
          {detail.group.kind === "linked" ? <div className="group-add-member">
            <label>Find reservation by confirmation number<VoiceInput aria-label="Reservation confirmation" contextKey={`${propertyId}:${selectedId}`} onVoiceValue={voiceValue => { setConfirmation(voiceValue); setCandidate(null); }} value={confirmation} maxLength={120} disabled={busy || memberAttempt !== null || createAttempt !== null}
              onChange={(event) => { setConfirmation(event.target.value); setCandidate(null); }} /></label>
            <button type="button" onClick={() => void lookup()} disabled={busy || !confirmation.trim() || memberAttempt !== null || createAttempt !== null}>Find reservation</button>
            {candidate ? <div className="group-candidate"><strong>{candidate.guestName}</strong><span>{candidate.confirmationNo} · {candidate.status}</span>
              {candidate.currentGroupId ? <p>Already associated with a group.</p> : candidate.status === "reserved" || candidate.status === "due_in" ?
                <button type="button" onClick={() => void attach()} disabled={busy || createAttempt !== null}>{memberAttempt ? "Reconcile same link request" : "Link reservation"}</button> :
                <p>Only reserved or due-in reservations can be linked.</p>}
            </div> : null}
            {memberAttempt ? <p role="status">{busy ? "Linking or reconciling this reservation…" : "The link response is uncertain. The same request is retained; retry to reconcile."}</p> : null}
          </div> : <p>Existing room-block details remain available in the block overview. This screen does not change allotments or pickup.</p>}
          <h4>Associated reservations ({detail.group.memberCount})</h4>
          {detail.members.length === 0 ? <p>No reservations linked yet.</p> : <ul>{detail.members.map((member) =>
            <li key={member.reservationId}>{createAttempt || memberAttempt ? <strong>{member.guestName} · {member.confirmationNo}</strong> :
              <a href={`/p/${encodeURIComponent(propertyId)}/res/${encodeURIComponent(member.reservationId)}`}>
                {member.guestName} · {member.confirmationNo}</a>}<span>{member.status.replaceAll("_", " ")}</span></li>)}</ul>}
          {memberCursor ? <button type="button" onClick={() => void loadMoreMembers()} disabled={busy}>Load more reservations</button> : null}
        </>}
      </div>
    </div>
  </section>;
}

export function GroupReservationWorkspace({ propertyId }: Readonly<{ propertyId: string }>) {
  return <GroupReservationWorkspaceInner key={propertyId} propertyId={propertyId} />;
}
