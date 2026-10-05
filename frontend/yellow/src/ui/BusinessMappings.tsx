import { VoiceInput } from "./VoiceField";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createTableQuery, queryTableRows, tableColumnSort, type TableColumn, type TableQuery } from "../table-query";
import type { CommercialMappingContent, CommercialMappingNode, CommercialMappingsSnapshot } from "../commercial-mapping-types";
import { CommercialMappingsRequestError, loadCommercialMappings, saveCommercialMappings } from "../yellow-api";
import { TableControls } from "./TableControls";
import { TableColumnMenu } from "./TableColumnMenu";
import "./business-mappings.css";

type LocalNode = CommercialMappingNode & { readonly key: string };
type LocalDemandGroup = LocalNode & { readonly segments: readonly LocalNode[] };
type LocalSource = LocalNode & { readonly channelCodes: readonly string[]; readonly channelText: string };
type LocalDistributionGroup = LocalNode & { readonly sources: readonly LocalSource[] };
type EditorContent = {
  demandGroups: LocalDemandGroup[];
  distributionGroups: LocalDistributionGroup[];
  companies: CommercialMappingContent["companies"];
  roomClasses: CommercialMappingContent["roomClasses"];
  marketMappings: Array<CommercialMappingContent["marketMappings"][number] & { readonly key: string }>;
};
type MarketRow = Readonly<{ originalIndex: number; marketCode: string; segmentCode: string }>;

const EMPTY_CONTENT: CommercialMappingContent = {
  demandGroups: [], distributionGroups: [], companies: [], roomClasses: [], marketMappings: [],
};
let localSequence = 0;
const localKey = (): string => `mapping-row-${++localSequence}`;
const node = (value: CommercialMappingNode): LocalNode => ({ ...value, key: localKey() });

function editorContent(content: CommercialMappingContent): EditorContent {
  return {
    demandGroups: content.demandGroups.map(group => ({ ...group, key: localKey(), segments: group.segments.map(node) })),
    distributionGroups: content.distributionGroups.map(group => ({ ...group, key: localKey(), sources: group.sources.map(source => ({ ...source, key: localKey(), channelCodes: [...source.channelCodes], channelText: source.channelCodes.join(", ") })) })),
    companies: content.companies,
    roomClasses: content.roomClasses,
    marketMappings: content.marketMappings.map(mapping => ({ ...mapping, key: localKey() })),
  };
}

function payloadOf(content: EditorContent): CommercialMappingContent {
  return {
    demandGroups: content.demandGroups.map(({ code, label, segments }) => ({ code, label, segments: segments.map(({ code: segmentCode, label: segmentLabel }) => ({ code: segmentCode, label: segmentLabel })) })),
    distributionGroups: content.distributionGroups.map(({ code, label, sources }) => ({ code, label, sources: sources.map(({ code: sourceCode, label: sourceLabel, channelText }) => ({ code: sourceCode, label: sourceLabel, channelCodes: channelText.split(",").map(value => value.trim()).filter(Boolean) })) })),
    companies: content.companies,
    roomClasses: content.roomClasses,
    marketMappings: content.marketMappings.map(({ marketCode, segmentCode }) => ({ marketCode, segmentCode })),
  };
}

function validateContent(content: CommercialMappingContent): string[] {
  const errors: string[] = [];
  const codePattern = /^[A-Z0-9][A-Z0-9_.-]{0,31}$/;
  for (const [subject, rows] of [["Demand groups", content.demandGroups], ["Distribution groups", content.distributionGroups], ["Market mappings", content.marketMappings]] as const) {
    if (rows.length > 512) errors.push(`${subject} cannot exceed 512 rows.`);
  }
  const checkNode = (item: CommercialMappingNode, location: string) => {
    const code = item.code.trim().toUpperCase();
    if (!codePattern.test(code) || code === "UNMAPPED") errors.push(`${location}: enter a valid code (up to 32 characters).`);
    if (!item.label.trim() || new TextEncoder().encode(item.label.normalize("NFC").trim()).length > 120) errors.push(`${location}: enter a label up to 120 bytes.`);
  };
  const unique = (values: readonly string[], subject: string) => {
    const normalized = values.map(value => value.trim().toUpperCase());
    if (new Set(normalized).size !== normalized.length) errors.push(`${subject} must be unique.`);
  };
  content.demandGroups.forEach((group, index) => {
    if (group.segments.length > 512) errors.push(`Demand group ${index + 1} cannot exceed 512 segments.`);
    checkNode(group, `Demand group ${index + 1}`);
    group.segments.forEach((segment, segmentIndex) => checkNode(segment, `Segment ${segmentIndex + 1} in ${group.code || `group ${index + 1}`}`));
    unique(group.segments.map(segment => segment.code), `Segments in ${group.code || `group ${index + 1}`}`);
  });
  unique(content.demandGroups.map(group => group.code), "Demand groups");
  unique(content.demandGroups.flatMap(group => group.segments.map(segment => segment.code)), "Segment codes across demand groups");
  content.distributionGroups.forEach((group, index) => {
    if (group.sources.length > 512) errors.push(`Distribution group ${index + 1} cannot exceed 512 sources.`);
    checkNode(group, `Distribution group ${index + 1}`);
    group.sources.forEach((source, sourceIndex) => {
      checkNode(source, `Source ${sourceIndex + 1} in ${group.code || `group ${index + 1}`}`);
      source.channelCodes.forEach(channel => {
        const normalized = channel.trim().toUpperCase();
        if (!codePattern.test(normalized) || normalized === "UNMAPPED") errors.push(`Source ${source.code || sourceIndex + 1}: enter valid channel codes.`);
      });
      unique(source.channelCodes, `Channels in ${source.code || `source ${sourceIndex + 1}`}`);
    });
    unique(group.sources.map(source => source.code), `Sources in ${group.code || `group ${index + 1}`}`);
  });
  unique(content.distributionGroups.map(group => group.code), "Distribution groups");
  unique(content.distributionGroups.flatMap(group => group.sources.map(source => source.code)), "Source codes across distribution groups");
  unique(content.distributionGroups.flatMap(group => group.sources.flatMap(source => [...source.channelCodes])), "Channel codes");
  const segmentCodes = new Set(content.demandGroups.flatMap(group => group.segments.map(segment => segment.code.trim().toUpperCase())));
  content.marketMappings.forEach((mapping, index) => {
    const marketCode = mapping.marketCode.trim().toUpperCase();
    const segmentCode = mapping.segmentCode.trim().toUpperCase();
    if (!codePattern.test(marketCode) || marketCode === "UNMAPPED") errors.push(`Market mapping ${index + 1}: enter a valid market code.`);
    if (!segmentCodes.has(segmentCode)) errors.push(`Market mapping ${index + 1}: choose an existing segment.`);
  });
  unique(content.marketMappings.map(mapping => mapping.marketCode), "Market codes");
  return errors;
}

export function BusinessMappings({ propertyId, onDirtyChange }: { propertyId: string; onDirtyChange?: (dirty: boolean) => void }) {
  const [snapshot, setSnapshot] = useState<CommercialMappingsSnapshot | null>(null);
  const [content, setContent] = useState<EditorContent>(() => editorContent(EMPTY_CONTENT));
  const [baseline, setBaseline] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [query, setQuery] = useState<TableQuery>(() => createTableQuery());
  const [pendingConfirmation, setPendingConfirmation] = useState<Readonly<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
  }> | null>(null);
  const confirmationDialog = useRef<HTMLDialogElement | null>(null);
  const confirmationReturnFocus = useRef<HTMLElement | null>(null);
  const payload = useMemo(() => payloadOf(content), [content]);
  const serialized = useMemo(() => JSON.stringify(payload), [payload]);
  const dirty = snapshot !== null && serialized !== baseline;
  const editable = snapshot?.canWrite === true && !busy && !loading;

  const requestConfirmation = (title: string, description: string, confirmLabel: string, onConfirm: () => void) => {
    setPendingConfirmation({ title, description, confirmLabel, onConfirm });
  };
  const confirmRemove = (subject: string, onConfirm: () => void) => {
    requestConfirmation(`Remove ${subject}?`, "This only removes the item from your unsaved form. Save the draft to record this change.", "Remove from draft", onConfirm);
  };
  const finishConfirmation = (confirm: boolean) => {
    if (confirm) pendingConfirmation?.onConfirm();
    setPendingConfirmation(null);
  };

  useEffect(() => {
    const dialog = confirmationDialog.current;
    if (pendingConfirmation) {
      if (dialog && !dialog.open) {
        confirmationReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.showModal();
      }
      return;
    }
    if (dialog?.open) dialog.close();
    const returnFocus = confirmationReturnFocus.current;
    confirmationReturnFocus.current = null;
    returnFocus?.focus();
  }, [pendingConfirmation]);

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const preventLoss = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [dirty]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    setValidationErrors([]);
    try {
      const result = await loadCommercialMappings(propertyId);
      const nextContent = editorContent(result.draft?.content ?? result.active?.content ?? EMPTY_CONTENT);
      setSnapshot(result);
      setContent(nextContent);
      setBaseline(JSON.stringify(payloadOf(nextContent)));
      setQuery(createTableQuery());
      setMessage("Saved configuration reloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Business mappings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [dirty, propertyId]);

  useEffect(() => {
    void refresh();
    // Each property gets one scoped read when this settings section is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const reloadSaved = () => {
    if (dirty) {
      requestConfirmation(
        "Reload saved mappings?",
        "Reloading replaces your unsaved edits with the latest saved draft or active configuration. No server data is deleted.",
        "Discard edits and reload",
        () => { void refresh(); },
      );
      return;
    }
    void refresh();
  };

  const updateDemandGroup = (index: number, patch: Partial<CommercialMappingNode>) => setContent(current => ({
    ...current, demandGroups: current.demandGroups.map((group, position) => position === index ? { ...group, ...patch } : group),
  }));
  const updateSegment = (groupIndex: number, segmentIndex: number, patch: Partial<CommercialMappingNode>) => setContent(current => ({
    ...current, demandGroups: current.demandGroups.map((group, position) => position === groupIndex
      ? { ...group, segments: group.segments.map((segment, child) => child === segmentIndex ? { ...segment, ...patch } : segment) } : group),
  }));
  const updateDistributionGroup = (index: number, patch: Partial<CommercialMappingNode>) => setContent(current => ({
    ...current, distributionGroups: current.distributionGroups.map((group, position) => position === index ? { ...group, ...patch } : group),
  }));
  const updateSource = (groupIndex: number, sourceIndex: number, patch: Partial<CommercialMappingNode>) => setContent(current => ({
    ...current, distributionGroups: current.distributionGroups.map((group, position) => position === groupIndex
      ? { ...group, sources: group.sources.map((source, child) => child === sourceIndex ? { ...source, ...patch } : source) } : group),
  }));
  const updateChannels = (groupIndex: number, sourceIndex: number, value: string) => setContent(current => ({
    ...current, distributionGroups: current.distributionGroups.map((group, position) => position === groupIndex
      ? { ...group, sources: group.sources.map((source, child) => child === sourceIndex ? { ...source, channelText: value } : source) } : group),
  }));

  const marketRows: MarketRow[] = content.marketMappings.map((row, originalIndex) => ({ originalIndex, marketCode: row.marketCode, segmentCode: row.segmentCode }));
  const marketColumns: readonly TableColumn<MarketRow>[] = [
    { key: "marketCode", label: "Market code", value: row => row.marketCode },
    { key: "segmentCode", label: "Segment code", value: row => row.segmentCode },
  ];
  const visibleMarketRows = queryTableRows(marketRows, marketColumns, query);
  const segmentOptions = content.demandGroups.flatMap(group => group.segments.map(segment => ({ code: segment.code, label: `${segment.label} (${segment.code})` })));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot || !snapshot.canWrite || busy || loading) return;
    const errors = validateContent(payload);
    setValidationErrors(errors);
    if (errors.length) {
      setMessage("Fix the mapping issues below before saving.");
      return;
    }
    setBusy(true);
    setMessage("Saving a new draft version…");
    let postSucceeded = false;
    try {
      await saveCommercialMappings(propertyId, { content: payload, expectedVersion: snapshot.latestVersion });
      postSucceeded = true;
      const refreshed = await loadCommercialMappings(propertyId);
      const nextContent = editorContent(refreshed.draft?.content ?? refreshed.active?.content ?? EMPTY_CONTENT);
      setSnapshot(refreshed);
      setContent(nextContent);
      setBaseline(JSON.stringify(payloadOf(nextContent)));
      setMessage(`Draft version ${refreshed.draft?.version ?? refreshed.latestVersion} saved and reloaded. It is not active; live reports are unchanged.`);
    } catch (error) {
      if (error instanceof CommercialMappingsRequestError && error.kind === "conflict") {
        setMessage("A newer mapping version was saved elsewhere. Your edits are still here; reload the latest version to continue.");
      } else if (error instanceof CommercialMappingsRequestError && error.kind === "permission") {
        setMessage("This session does not have permission to save business mappings for this property. Your edits are still here.");
      } else if (error instanceof CommercialMappingsRequestError && error.kind === "validation") {
        setMessage(`The server rejected this draft: ${error.message}`);
      } else if (postSucceeded) {
        setMessage("The draft save may have succeeded, but its confirmation could not be loaded. Reload the saved version to verify before retrying.");
      } else {
        setMessage(error instanceof Error ? error.message : "The draft could not be saved. Your edits are still here.");
      }
    } finally {
      setBusy(false);
    }
  }

  const codeLabelFields = (key: string, code: string, label: string, onCode: (value: string) => void, onLabel: (value: string) => void) => <div className="business-mappings-fields" key={key}>
    <label>Code<VoiceInput aria-label="Code" contextKey={propertyId} onVoiceValue={voiceValue => onCode(voiceValue)} maxLength={32} autoCapitalize="characters" value={code} disabled={!editable} onChange={event => onCode(event.target.value)} /></label>
    <label>Label<VoiceInput aria-label="Label" contextKey={propertyId} onVoiceValue={voiceValue => onLabel(voiceValue)} maxLength={120} value={label} disabled={!editable} onChange={event => onLabel(event.target.value)} /></label>
  </div>;

  return <section className="business-mappings" aria-labelledby="business-mappings-title">
    <header className="business-mappings-header">
      <div><p className="business-mappings-eyebrow">Property settings</p><h2 id="business-mappings-title">Business mappings</h2>
        <p>Maintain how this property groups markets, segments, booking sources and channels.</p></div>
      <button type="button" className="business-mappings-secondary" disabled={loading || busy} onClick={reloadSaved}>{loading ? "Loading…" : "Reload saved version"}</button>
    </header>
    <div className="business-mappings-notice" role="note"><strong>Drafts do not change live reports.</strong> Saving creates a new draft version. The active configuration and operational business rules remain unchanged until a separately governed activation.</div>
    {snapshot && <div className="business-mappings-version" aria-label="Configuration versions">
      <span>Active <strong>{snapshot.active ? `v${snapshot.active.version}` : "None"}</strong></span>
      <span>Latest draft <strong>{snapshot.draft ? `v${snapshot.draft.version}` : "None"}</strong></span>
      <span>Latest version <strong>v{snapshot.latestVersion}</strong></span>
      <span className={snapshot.canWrite ? "business-mappings-access" : "business-mappings-readonly"}>{snapshot.canWrite ? "Edit access granted" : "Read only for this session"}</span>
    </div>}
    {message && <p className="business-mappings-message" role="status" aria-live="polite">{message}</p>}
    {loading && !snapshot ? <p className="business-mappings-loading">Loading this property’s saved mappings…</p> : <form onSubmit={event => void save(event)}>
      {!snapshot && <p className="business-mappings-error">Saved mappings have not loaded. Use reload to try again.</p>}
      {dirty && <p className="business-mappings-unsaved">Unsaved edits</p>}
      <div className="business-mappings-grid">
        <section className="business-mappings-card" aria-labelledby="demand-groups-title">
          <div className="business-mappings-card-heading"><div><p className="business-mappings-eyebrow">Market segments</p><h3 id="demand-groups-title">Demand groups and segments</h3></div>
            <button type="button" disabled={!editable} onClick={() => setContent(current => ({ ...current, demandGroups: [...current.demandGroups, { ...node({ code: "", label: "" }), segments: [] }] }))}>Add demand group</button></div>
          {content.demandGroups.length === 0 && <p className="business-mappings-empty">No demand groups in this configuration yet.</p>}
          {content.demandGroups.map((group, groupIndex) => <details className="business-mappings-nested" key={group.key}>
            <summary>{group.label || "New demand group"} <small>{group.code || "Set up"} · {group.segments.length} segments</small></summary>
            <div className="business-mappings-nested-heading"><h4>Demand group {groupIndex + 1}</h4><button type="button" className="business-mappings-remove" disabled={!editable} onClick={() => confirmRemove(`demand group ${group.code || groupIndex + 1}`, () => setContent(current => ({ ...current, demandGroups: current.demandGroups.filter((_, index) => index !== groupIndex) })))}>Remove group</button></div>
            {codeLabelFields(group.key, group.code, group.label, value => updateDemandGroup(groupIndex, { code: value }), value => updateDemandGroup(groupIndex, { label: value }))}
            <div className="business-mappings-child-list">{group.segments.map((segment, segmentIndex) => <div className="business-mappings-child" key={segment.key}>
              <div className="business-mappings-nested-heading"><span>Segment {segmentIndex + 1}</span><button type="button" className="business-mappings-remove" disabled={!editable} onClick={() => confirmRemove(`segment ${segment.code || segmentIndex + 1}`, () => setContent(current => ({ ...current, demandGroups: current.demandGroups.map((item, index) => index === groupIndex ? { ...item, segments: item.segments.filter((_, child) => child !== segmentIndex) } : item) })))}>Remove</button></div>
              {codeLabelFields(segment.key, segment.code, segment.label, value => updateSegment(groupIndex, segmentIndex, { code: value }), value => updateSegment(groupIndex, segmentIndex, { label: value }))}
            </div>)}</div>
            <button type="button" className="business-mappings-link" disabled={!editable} onClick={() => setContent(current => ({ ...current, demandGroups: current.demandGroups.map((item, index) => index === groupIndex ? { ...item, segments: [...item.segments, node({ code: "", label: "" })] } : item) }))}>Add segment</button>
          </details>)}
        </section>
        <section className="business-mappings-card" aria-labelledby="distribution-title">
          <div className="business-mappings-card-heading"><div><p className="business-mappings-eyebrow">Distribution</p><h3 id="distribution-title">Source and channel relationships</h3></div>
            <button type="button" disabled={!editable} onClick={() => setContent(current => ({ ...current, distributionGroups: [...current.distributionGroups, { ...node({ code: "", label: "" }), sources: [] }] }))}>Add distribution group</button></div>
          {content.distributionGroups.length === 0 && <p className="business-mappings-empty">No distribution groups in this configuration yet.</p>}
          {content.distributionGroups.map((group, groupIndex) => <details className="business-mappings-nested" key={group.key}>
            <summary>{group.label || "New distribution group"} <small>{group.code || "Set up"} · {group.sources.length} sources</small></summary>
            <div className="business-mappings-nested-heading"><h4>Distribution group {groupIndex + 1}</h4><button type="button" className="business-mappings-remove" disabled={!editable} onClick={() => confirmRemove(`distribution group ${group.code || groupIndex + 1}`, () => setContent(current => ({ ...current, distributionGroups: current.distributionGroups.filter((_, index) => index !== groupIndex) })))}>Remove group</button></div>
            {codeLabelFields(group.key, group.code, group.label, value => updateDistributionGroup(groupIndex, { code: value }), value => updateDistributionGroup(groupIndex, { label: value }))}
            <div className="business-mappings-child-list">{group.sources.map((source, sourceIndex) => <div className="business-mappings-child" key={source.key}>
              <div className="business-mappings-nested-heading"><span>Source {sourceIndex + 1}</span><button type="button" className="business-mappings-remove" disabled={!editable} onClick={() => confirmRemove(`source ${source.code || sourceIndex + 1}`, () => setContent(current => ({ ...current, distributionGroups: current.distributionGroups.map((item, index) => index === groupIndex ? { ...item, sources: item.sources.filter((_, child) => child !== sourceIndex) } : item) })))}>Remove</button></div>
              {codeLabelFields(source.key, source.code, source.label, value => updateSource(groupIndex, sourceIndex, { code: value }), value => updateSource(groupIndex, sourceIndex, { label: value }))}
              <label className="business-mappings-channel-field">Channel codes <span>Separate codes with commas</span><VoiceInput aria-label="Channel codes" contextKey={propertyId} onVoiceValue={voiceValue => updateChannels(groupIndex, sourceIndex, voiceValue)} maxLength={512} value={source.channelText} disabled={!editable} onChange={event => updateChannels(groupIndex, sourceIndex, event.target.value)} /></label>
            </div>)}</div>
            <button type="button" className="business-mappings-link" disabled={!editable} onClick={() => setContent(current => ({ ...current, distributionGroups: current.distributionGroups.map((item, index) => index === groupIndex ? { ...item, sources: [...item.sources, { ...node({ code: "", label: "" }), channelCodes: [], channelText: "" }] } : item) }))}>Add source</button>
          </details>)}
        </section>
      </div>
      <section className="business-mappings-card business-mappings-market" aria-labelledby="market-mappings-title">
        <div className="business-mappings-card-heading"><div><p className="business-mappings-eyebrow">Market attribution</p><h3 id="market-mappings-title">Market to segment</h3><p>Each market code can point to one configured segment.</p></div>
          <button type="button" disabled={!editable} onClick={() => { setQuery(createTableQuery()); setContent(current => ({ ...current, marketMappings: [...current.marketMappings, { key: localKey(), marketCode: "", segmentCode: "" }] })); }}>Add market mapping</button></div>
        <TableControls label="Market mappings" columns={marketColumns} query={query} onChange={setQuery} count={visibleMarketRows.length} total={marketRows.length} disabled={busy} />
        {marketRows.length === 0 ? <p className="business-mappings-empty">No market mappings in this configuration yet.</p> : <div className="business-mappings-market-list">
          <table className="business-mappings-market-table"><caption>Market to segment mappings</caption>
            <thead><tr>{marketColumns.map(column => <th scope="col" key={column.key} aria-sort={tableColumnSort(query, column.key)}>
              <TableColumnMenu column={column} query={query} onChange={setQuery} values={marketRows.map(column.value)} disabled={busy} />
            </th>)}<th scope="col">Actions</th></tr></thead>
            <tbody>{visibleMarketRows.map(row => <tr key={content.marketMappings[row.originalIndex]!.key}>
            <td><label><span className="business-mappings-cell-label">Market code</span><VoiceInput contextKey={propertyId} onVoiceValue={voiceValue => setContent(current => ({ ...current, marketMappings: current.marketMappings.map((item, index) => index === row.originalIndex ? { ...item, marketCode: voiceValue } : item) }))} aria-label={`Market code ${row.originalIndex + 1}`} maxLength={32} autoCapitalize="characters" value={content.marketMappings[row.originalIndex]!.marketCode} disabled={!editable} onChange={event => setContent(current => ({ ...current, marketMappings: current.marketMappings.map((item, index) => index === row.originalIndex ? { ...item, marketCode: event.target.value } : item) }))} /></label></td>
            <td><label><span className="business-mappings-cell-label">Segment</span><select aria-label={`Segment ${row.originalIndex + 1}`} value={content.marketMappings[row.originalIndex]!.segmentCode} disabled={!editable} onChange={event => setContent(current => ({ ...current, marketMappings: current.marketMappings.map((item, index) => index === row.originalIndex ? { ...item, segmentCode: event.target.value } : item) }))}>
              <option value="">Choose a segment</option>{segmentOptions.map((option, index) => <option key={`${option.code}-${index}`} value={option.code}>{option.label}</option>)}
            </select></label></td>
            <td><button type="button" className="business-mappings-remove" aria-label={`Remove market mapping ${row.marketCode || row.originalIndex + 1}`} disabled={!editable} onClick={() => confirmRemove(`market mapping ${row.marketCode || row.originalIndex + 1}`, () => setContent(current => ({ ...current, marketMappings: current.marketMappings.filter((_, index) => index !== row.originalIndex) })))}>Remove</button></td>
          </tr>)}</tbody></table>
          {visibleMarketRows.length === 0 ? <p className="business-mappings-empty">No market mappings match this view. Clear filters to see your saved and unsaved rows.</p> : null}
        </div>}
      </section>
      <details className="business-mappings-advanced"><summary>Advanced intersections (view only)</summary><p>Company mappings and room-class mappings are preserved exactly as loaded. Editing these linked party and room references is pending a separately scoped workflow.</p>
        <p>{payload.companies.length} company mapping{payload.companies.length === 1 ? "" : "s"} · {payload.roomClasses.length} room-class mapping{payload.roomClasses.length === 1 ? "" : "s"}</p></details>
      {validationErrors.length > 0 && <div className="business-mappings-validation" role="alert"><h3>Resolve these mapping issues</h3><ul>{validationErrors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></div>}
      <footer className="business-mappings-footer"><span>{dirty ? "Changes are not saved yet." : "All form values match the loaded version."}</span>
        <button type="submit" disabled={!editable || !snapshot || !dirty || loading}>{busy ? "Saving draft…" : "Save draft version"}</button></footer>
    </form>}
    <dialog
      className="business-mappings-confirm"
      ref={confirmationDialog}
      aria-labelledby="business-mappings-confirm-title"
      aria-describedby="business-mappings-confirm-description"
      onCancel={() => finishConfirmation(false)}
    >
      <h3 id="business-mappings-confirm-title">{pendingConfirmation?.title}</h3>
      <p id="business-mappings-confirm-description">{pendingConfirmation?.description}</p>
      <div className="business-mappings-confirm-actions">
        <button type="button" className="business-mappings-secondary" autoFocus onClick={() => finishConfirmation(false)}>Cancel</button>
        <button type="button" className="business-mappings-confirm-danger" onClick={() => finishConfirmation(true)}>{pendingConfirmation?.confirmLabel}</button>
      </div>
    </dialog>
  </section>;
}
