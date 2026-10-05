import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState, type InputHTMLAttributes, type Ref, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { DictationController, type DictationState } from "./field-dictation";
import "./voice-field.css";

type VoiceExtras = { onVoiceValue: (value: string) => void; contextKey?: string | number };
export type VoiceInputProps = InputHTMLAttributes<HTMLInputElement> & VoiceExtras;
export type VoiceTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & VoiceExtras;

type PanelProps = {
  controller: DictationController;
  state: DictationState;
  panelId: string;
  disabled: boolean;
  onCancel: () => void;
  onUse: () => void;
  panelRef: { current: HTMLDivElement | null };
};

function VoicePanel({ controller, state, panelId, disabled, onCancel, onUse, panelRef }: PanelProps) {
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (state.stage === "disclosure") startRef.current?.focus(); }, [state.stage]);
  if (state.stage === "closed" || disabled) return null;
  return <div ref={panelRef} id={panelId} className="voice-field-panel" role="group" aria-label="Field dictation">
    {state.stage === "disclosure" ? <>
      <p>Speech recognition may send microphone audio to your browser vendor for processing. Yellow does not store the audio.</p>
      <button ref={startRef} type="button" onClick={() => controller.start()} disabled={!state.supported}>Start microphone</button>
    </> : <>
      <p aria-live="polite">{state.stage === "listening" ? "Listening… Speak your text." : "Review the recognized text before using it."}</p>
      {state.draft && <p className="voice-field-draft" aria-label="Recognized draft">{state.draft}</p>}
      {state.truncated && <p className="voice-field-error" role="status">Text exceeds this field’s limit. Only the draft shown above will be used.</p>}
      {state.stage === "listening" && <button type="button" onClick={() => controller.stop()}>Stop</button>}
      {state.stage === "stopping" && <p role="status">Finishing recognition…</p>}
      {state.stage === "review" && <button type="button" disabled={!state.draft.trim()} onClick={onUse}>Use text</button>}
    </>}
    {state.error && <p className="voice-field-error" role="alert">{state.error}</p>}
    {!state.supported && <p role="status">Speech recognition is unavailable in this browser. You can still type.</p>}
    <button type="button" onClick={onCancel}>Cancel</button>
  </div>;
}

export function resolveVoicePanelHost(field: HTMLInputElement | HTMLTextAreaElement | null): HTMLElement | null {
  if (!field) return typeof document === "undefined" ? null : document.body;
  const layer = field.closest("dialog, [role=\"dialog\"]") as HTMLElement | null;
  const nativeDialog = layer?.tagName === "DIALOG";
  if (nativeDialog && "open" in layer && layer.open) {
    try {
      if (layer.matches(":modal")) return layer;
    } catch {
      // Browsers without :modal support use the body portal fallback.
    }
  }
  if (layer && !nativeDialog) return layer;
  return field.ownerDocument.body;
}

function usePanelHost(fieldRef: { current: HTMLInputElement | HTMLTextAreaElement | null }, open: boolean) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setHost(open ? resolveVoicePanelHost(fieldRef.current) : null);
  }, [fieldRef, open]);
  return host;
}

function usePanelPosition(host: HTMLElement | null, fieldRef: { current: HTMLInputElement | HTMLTextAreaElement | null },
  panelRef: { current: HTMLDivElement | null }, state: DictationState) {
  useLayoutEffect(() => {
    if (!host) return;
    const position = () => {
      const field = fieldRef.current;
      const panel = panelRef.current;
      if (!field || !panel) return;
      if (window.matchMedia("(max-width: 600px)").matches) {
        panel.style.top = "";
        panel.style.left = "";
        return;
      }
      const anchor = field.getBoundingClientRect();
      const bounds = panel.getBoundingClientRect();
      const width = bounds.width || Math.min(330, window.innerWidth - 24);
      const height = bounds.height;
      const left = Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12));
      let top = anchor.bottom + 6;
      if (top + height > window.innerHeight - 12) top = anchor.top - height - 6;
      if (top < 12) top = Math.max(12, window.innerHeight - height - 12);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    };
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [host, fieldRef, panelRef, state.stage, state.draft, state.error]);
}

function fieldVisible(element: HTMLInputElement | HTMLTextAreaElement | null) {
  if (!element?.isConnected || element.ownerDocument.visibilityState === "hidden") return false;
  if (element.closest("[inert]") || element.getClientRects().length === 0) return false;
  return element.checkVisibility?.({ checkVisibilityCSS: true }) ?? true;
}

function assignRef<T>(ref: Ref<T>, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

function useVoiceField(value: string, contextKey: string | number | undefined, maxLength: number | undefined,
  disabled: boolean, onVoiceValue: (value: string) => void, elementRef: { current: HTMLInputElement | HTMLTextAreaElement | null }) {
  const [state, setState] = useState<DictationState>({ stage: "closed", draft: "", error: "", supported: false, truncated: false });
  const controllerRef = useRef<DictationController | null>(null);
  const latest = useRef({ value, contextKey, maxLength, disabled });
  latest.current = { value, contextKey, maxLength, disabled };
  if (!controllerRef.current) controllerRef.current = new DictationController(setState, onVoiceValue);
  const controller = controllerRef.current;
  controller.setCallbacks(setState, onVoiceValue);
  controller.setCurrentGuard(() => {
    const field = latest.current;
    return controller.matchesField(field.value, field.contextKey, field.maxLength, field.disabled) && fieldVisible(elementRef.current);
  });
  useEffect(() => { controller.setField(value, contextKey, maxLength, disabled); }, [controller, value, contextKey, maxLength, disabled]);
  useEffect(() => () => controller.dispose(), [controller]);
  return { controller, state };
}

function MicIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.85"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="12" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4m-4 0h8" />
  </svg>;
}

function microphoneLabel(label: string | undefined, placeholder: string | undefined, name: string | undefined) {
  return `Dictate ${label?.trim() || placeholder?.trim() || name?.replace(/([a-z])([A-Z])/g, "$1 $2") || "text"}`;
}

export const VoiceInput = forwardRef<HTMLInputElement, VoiceInputProps>(function VoiceInput(
  { onVoiceValue, contextKey, value, defaultValue, disabled, readOnly, maxLength, className, type = "text", onChange, ...props }, ref,
) {
  const panelId = useId();
  const micLabel = microphoneLabel(props["aria-label"], props.placeholder, props.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const micRef = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const eligible = type === "text" || type === "search";
  const unavailable = Boolean(disabled || readOnly || !eligible);
  const { controller, state } = useVoiceField(String(value ?? defaultValue ?? ""), contextKey, maxLength, unavailable, onVoiceValue, inputRef);
  const panelHost = usePanelHost(inputRef, state.stage !== "closed" && eligible && !unavailable);
  usePanelPosition(panelHost, inputRef, panelRef, state);
  const cancel = () => {
    const active = document.activeElement;
    const restore = wrapperRef.current?.contains(active) || panelRef.current?.contains(active);
    controller.cancel();
    if (restore) queueMicrotask(() => micRef.current?.focus());
  };
  const useDraft = () => {
    const restore = panelRef.current?.contains(document.activeElement);
    controller.use();
    if (restore && controller.state.stage === "closed") queueMicrotask(() => inputRef.current?.focus());
  };
  return <span ref={wrapperRef} className="voice-field" onKeyDown={event => {
    if (event.key === "Escape" && state.stage !== "closed") { event.preventDefault(); event.stopPropagation(); cancel(); }
  }}>
    <span className="voice-field-control">
      <input {...props} ref={node => { inputRef.current = node; assignRef(ref, node); }} className={className} type={type} value={value} defaultValue={defaultValue} disabled={disabled}
        readOnly={readOnly} maxLength={maxLength} onChange={event => { controller.cancel(); onChange?.(event); }} />
      {eligible && !unavailable && <button ref={micRef} type="button" className="voice-field-mic" aria-label={micLabel} title={micLabel}
        aria-expanded={state.stage !== "closed"} aria-controls={state.stage !== "closed" ? panelId : undefined}
        onClick={event => { event.preventDefault(); controller.open(); }}><MicIcon /></button>}
    </span>
    {panelHost && eligible && createPortal(<VoicePanel controller={controller} state={state} panelId={panelId}
      disabled={unavailable} onCancel={cancel} onUse={useDraft} panelRef={panelRef} />, panelHost)}
  </span>;
});

export const VoiceTextarea = forwardRef<HTMLTextAreaElement, VoiceTextareaProps>(function VoiceTextarea(
  { onVoiceValue, contextKey, value, defaultValue, disabled, readOnly, maxLength, className, onChange, ...props }, ref,
) {
  const panelId = useId();
  const micLabel = microphoneLabel(props["aria-label"], props.placeholder, props.name);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const micRef = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const unavailable = Boolean(disabled || readOnly);
  const { controller, state } = useVoiceField(String(value ?? defaultValue ?? ""), contextKey, maxLength, unavailable, onVoiceValue, inputRef);
  const panelHost = usePanelHost(inputRef, state.stage !== "closed" && !unavailable);
  usePanelPosition(panelHost, inputRef, panelRef, state);
  const cancel = () => {
    const active = document.activeElement;
    const restore = wrapperRef.current?.contains(active) || panelRef.current?.contains(active);
    controller.cancel();
    if (restore) queueMicrotask(() => micRef.current?.focus());
  };
  const useDraft = () => {
    const restore = panelRef.current?.contains(document.activeElement);
    controller.use();
    if (restore && controller.state.stage === "closed") queueMicrotask(() => inputRef.current?.focus());
  };
  return <span ref={wrapperRef} className="voice-field voice-field-textarea" onKeyDown={event => {
    if (event.key === "Escape" && state.stage !== "closed") { event.preventDefault(); event.stopPropagation(); cancel(); }
  }}>
    <span className="voice-field-control">
      <textarea {...props} ref={node => { inputRef.current = node; assignRef(ref, node); }} className={className} value={value} defaultValue={defaultValue} disabled={disabled}
        readOnly={readOnly} maxLength={maxLength} onChange={event => { controller.cancel(); onChange?.(event); }} />
      {!unavailable && <button ref={micRef} type="button" className="voice-field-mic" aria-label={micLabel} title={micLabel}
        aria-expanded={state.stage !== "closed"} aria-controls={state.stage !== "closed" ? panelId : undefined}
        onClick={event => { event.preventDefault(); controller.open(); }}><MicIcon /></button>}
    </span>
    {panelHost && createPortal(<VoicePanel controller={controller} state={state} panelId={panelId}
      disabled={unavailable} onCancel={cancel} onUse={useDraft} panelRef={panelRef} />, panelHost)}
  </span>;
});
