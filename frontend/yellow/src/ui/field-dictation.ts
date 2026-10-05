export type SpeechResult = { isFinal: boolean; 0?: { transcript: string }; length: number };
export type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
export type SpeechEngine = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart?: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechConstructor = new () => SpeechEngine;
export type DictationState = {
  stage: "closed" | "disclosure" | "listening" | "stopping" | "review";
  draft: string;
  error: string;
  supported: boolean;
  truncated: boolean;
};

let activeController: DictationController | null = null;

export function speechConstructor(): SpeechConstructor | null {
  if (typeof window === "undefined") return null;
  const vendor = window as typeof window & {
    SpeechRecognition?: SpeechConstructor;
    webkitSpeechRecognition?: SpeechConstructor;
  };
  return vendor.SpeechRecognition ?? vendor.webkitSpeechRecognition ?? null;
}

export class DictationController {
  state: DictationState;
  private engine: SpeechEngine | null = null;
  private generation = 0;
  private finals = new Map<number, string>();
  private baseline = "";
  private context: string | number | undefined;
  private limit: number | undefined;
  private onState: (state: DictationState) => void;
  private onUse: (value: string) => void;
  private resolve: () => SpeechConstructor | null;
  private isCurrent: () => boolean = () => true;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private guardTimer: ReturnType<typeof setInterval> | null = null;
  private readonly onVisibilityChange = () => { if (!this.isCurrent()) this.cancel(); };
  private readonly onPageHide = () => this.cancel();
  private readonly onWindowBlur = () => this.cancel();

  constructor(onState: (state: DictationState) => void, onUse: (value: string) => void,
    resolve: () => SpeechConstructor | null = speechConstructor) {
    this.onState = onState;
    this.onUse = onUse;
    this.resolve = resolve;
    this.state = { stage: "closed", draft: "", error: "", supported: Boolean(resolve()), truncated: false };
  }

  setCallbacks(onState: (state: DictationState) => void, onUse: (value: string) => void) {
    this.onState = onState;
    this.onUse = onUse;
  }

  setCurrentGuard(isCurrent: () => boolean) { this.isCurrent = isCurrent; }

  matchesField(value: string, context: string | number | undefined, maxLength: number | undefined, unavailable: boolean) {
    return !unavailable && value === this.baseline && context === this.context && maxLength === this.limit;
  }

  setField(value: string, context: string | number | undefined, maxLength: number | undefined, unavailable: boolean) {
    if (value !== this.baseline || context !== this.context || maxLength !== this.limit || unavailable) this.cancel();
    this.baseline = value;
    this.context = context;
    this.limit = maxLength;
  }

  open() {
    if (this.state.stage !== "closed") return;
    this.publish({ stage: "disclosure", draft: "", error: "", supported: Boolean(this.resolve()), truncated: false });
  }

  start() {
    if (this.state.stage !== "disclosure" && this.state.stage !== "review") return;
    if (!this.isCurrent()) { this.cancel(); return; }
    const Constructor = this.resolve();
    if (!Constructor) {
      this.publish({ ...this.state, error: "Speech recognition is unavailable in this browser. You can still type." });
      return;
    }
    activeController?.cancel();
    this.detach("abort");
    activeController = this;
    const generation = ++this.generation;
    this.finals.clear();
    let engine: SpeechEngine;
    try { engine = new Constructor(); }
    catch {
      if (activeController === this) activeController = null;
      this.publish({ ...this.state, stage: "review", error: "Microphone could not start. You can still type." });
      return;
    }
    this.engine = engine;
    engine.continuous = true;
    engine.interimResults = true;
    engine.lang = typeof navigator === "undefined" ? "en" : navigator.language || "en";
    engine.onresult = event => {
      if (this.engine !== engine || this.generation !== generation) return;
      if (!this.isCurrent()) { this.cancel(); return; }
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result?.isFinal) this.finals.set(index, result[0]?.transcript ?? "");
      }
      const complete = [...this.finals.entries()].sort(([a], [b]) => a - b)
        .map(([, part]) => part.trim()).filter(Boolean).join(" ").trim();
      const draft = this.limit === undefined ? complete : complete.slice(0, Math.max(0, this.limit));
      this.publish({ ...this.state, draft, truncated: draft.length < complete.length });
    };
    engine.onstart = () => {
      if (this.engine === engine && this.generation === generation && typeof window !== "undefined") {
        window.addEventListener("blur", this.onWindowBlur);
      }
    };
    engine.onerror = event => {
      if (this.engine !== engine || this.generation !== generation) return;
      if (!this.isCurrent()) { this.cancel(); return; }
      const error = event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone permission was denied. You can still type."
        : `Speech recognition stopped (${event.error}). You can still type.`;
      this.detach("abort");
      this.publish({ ...this.state, stage: "review", error });
    };
    engine.onend = () => {
      if (this.engine !== engine || this.generation !== generation) return;
      if (!this.isCurrent()) { this.cancel(); return; }
      this.detach("none");
      this.publish({ ...this.state, stage: "review" });
    };
    try {
      engine.start();
      this.publish({ ...this.state, stage: "listening", draft: "", error: "", truncated: false });
      this.guardTimer = setInterval(() => { if (!this.isCurrent()) this.cancel(); }, 250);
      if (typeof window !== "undefined") window.addEventListener("pagehide", this.onPageHide);
      if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.onVisibilityChange);
    } catch {
      this.detach("abort");
      this.publish({ ...this.state, stage: "review", error: "Microphone could not start. You can still type." });
    }
  }

  stop() {
    if (this.state.stage !== "listening") return;
    const engine = this.engine;
    if (!engine) return;
    this.publish({ ...this.state, stage: "stopping" });
    try { engine.stop(); } catch { this.finishStop(engine); return; }
    if (this.engine === engine) this.stopTimer = setTimeout(() => this.finishStop(engine), 1500);
  }

  use() {
    if (this.state.stage !== "review" || !this.state.draft.trim()) return;
    if (!this.isCurrent()) { this.cancel(); return; }
    const value = this.limit === undefined ? this.state.draft : this.state.draft.slice(0, Math.max(0, this.limit));
    if (!value.trim()) return;
    this.cancel();
    this.onUse(value);
  }

  cancel() {
    this.detach("abort");
    if (this.state.stage !== "closed" || this.state.error || this.state.draft) {
      this.publish({ ...this.state, stage: "closed", draft: "", error: "", truncated: false });
    }
  }

  dispose() {
    this.detach("abort");
    this.state = { ...this.state, stage: "closed", draft: "", error: "", truncated: false };
  }

  private finishStop(engine: SpeechEngine) {
    if (this.engine !== engine) return;
    if (!this.isCurrent()) { this.cancel(); return; }
    this.detach("abort");
    this.publish({ ...this.state, stage: "review" });
  }

  private detach(mode: "abort" | "stop" | "none") {
    if (this.stopTimer !== null) { clearTimeout(this.stopTimer); this.stopTimer = null; }
    if (this.guardTimer !== null) { clearInterval(this.guardTimer); this.guardTimer = null; }
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", this.onPageHide);
      window.removeEventListener("blur", this.onWindowBlur);
    }
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onVisibilityChange);
    const engine = this.engine;
    ++this.generation;
    this.engine = null;
    if (activeController === this) activeController = null;
    if (!engine) return;
    engine.onresult = null;
    engine.onerror = null;
    engine.onend = null;
    engine.onstart = null;
    try { if (mode === "abort") engine.abort(); else if (mode === "stop") engine.stop(); }
    catch { /* Already stopped by the browser. */ }
  }

  private publish(state: DictationState) {
    this.state = state;
    this.onState(state);
  }
}
