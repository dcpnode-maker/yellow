import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DictationController, type SpeechEngine, type SpeechEvent } from "../frontend/yellow/src/ui/field-dictation";
import { resolveVoicePanelHost, VoiceInput, VoiceTextarea } from "../frontend/yellow/src/ui/VoiceField";

class SyntheticRecognition implements SpeechEngine {
  static instances: SyntheticRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((event: SpeechEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  starts = 0;
  stops = 0;
  aborts = 0;
  constructor() { SyntheticRecognition.instances.push(this); }
  start() { this.starts++; }
  stop() { this.stops++; }
  abort() { this.aborts++; }
  emit(transcript: string, isFinal = true) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal, 0: { transcript }, length: 1 }] });
  }
}

function harness(maxLength?: number) {
  const used: string[] = [];
  let updates = 0;
  const controller = new DictationController(() => { updates++; }, value => used.push(value), () => SyntheticRecognition);
  controller.setField("original", "record-A", maxLength, false);
  return { controller, used, updates: () => updates };
}

test("disclosure precedes the only explicit microphone start; final review alone can apply", () => {
  SyntheticRecognition.instances.length = 0;
  const { controller, used } = harness();
  controller.open();
  expect(controller.state.stage).toBe("disclosure");
  expect(SyntheticRecognition.instances).toHaveLength(0);
  controller.start();
  const engine = SyntheticRecognition.instances.at(-1)!;
  expect(engine.starts).toBe(1);
  expect(engine.continuous).toBe(true);
  engine.emit("not final", false);
  expect(controller.state.draft).toBe("");
  engine.emit("Guest notes");
  expect(controller.state.draft).toBe("Guest notes");
  expect(used).toEqual([]);
  controller.stop();
  expect(engine.stops).toBe(1);
  expect(controller.state.stage).toBe("stopping");
  engine.emit("Final spoken phrase");
  expect(controller.state.draft).toBe("Final spoken phrase");
  engine.onend?.();
  expect(engine.onresult).toBeNull();
  controller.use();
  expect(used).toEqual(["Final spoken phrase"]);
  expect(controller.state.stage).toBe("closed");
});

test("cancel, field/context changes, disable and dispose discard stale sessions", () => {
  const { controller, used } = harness();
  controller.open(); controller.start();
  const stale = SyntheticRecognition.instances.at(-1)!;
  const callback = stale.onresult!;
  controller.cancel();
  expect(stale.aborts).toBe(1);
  callback({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "stale" }, length: 1 }] });
  expect(controller.state.draft).toBe("");
  controller.open(); controller.start();
  const contextEngine = SyntheticRecognition.instances.at(-1)!;
  controller.setField("original", "record-B", undefined, false);
  expect(contextEngine.aborts).toBe(1);
  controller.open(); controller.start();
  const editedEngine = SyntheticRecognition.instances.at(-1)!;
  controller.setField("typed", "record-B", undefined, false);
  expect(editedEngine.aborts).toBe(1);
  controller.open(); controller.start();
  const disabledEngine = SyntheticRecognition.instances.at(-1)!;
  controller.setField("typed", "record-B", undefined, true);
  expect(disabledEngine.aborts).toBe(1);
  controller.open(); controller.start();
  const disposedEngine = SyntheticRecognition.instances.at(-1)!;
  controller.dispose();
  expect(disposedEngine.aborts).toBe(1);
  expect(used).toEqual([]);
});

test("permission rejection and unsupported browser keep the typing path", () => {
  const { controller, used } = harness();
  controller.open(); controller.start();
  SyntheticRecognition.instances.at(-1)!.onerror?.({ error: "not-allowed" });
  expect(controller.state.error).toContain("permission was denied");
  expect(controller.state.stage).toBe("review");
  controller.use();
  expect(used).toEqual([]);
  const unavailable = new DictationController(() => {}, () => used.push("unexpected"), () => null);
  unavailable.open(); unavailable.start();
  expect(unavailable.state.supported).toBe(false);
  expect(unavailable.state.error).toContain("unavailable");
  expect(used).toEqual([]);
});

test("one microphone session at a time and maxLength applies to the reviewed draft", () => {
  const first = harness();
  const second = harness(4);
  first.controller.open(); first.controller.start();
  const firstEngine = SyntheticRecognition.instances.at(-1)!;
  second.controller.open(); second.controller.start();
  expect(firstEngine.aborts).toBe(1);
  expect(first.controller.state.stage).toBe("closed");
  SyntheticRecognition.instances.at(-1)!.emit("Long name");
  expect(second.controller.state.draft).toBe("Long");
  expect(second.controller.state.truncated).toBe(true);
  second.controller.stop(); SyntheticRecognition.instances.at(-1)!.onend?.(); second.controller.use();
  expect(second.used).toEqual(["Long"]);
  expect(first.used).toEqual([]);
});

test("late results from an earlier recording cannot enter a new recording", () => {
  const { controller, used } = harness();
  controller.open(); controller.start();
  const old = SyntheticRecognition.instances.at(-1)!;
  const oldResult = old.onresult!;
  controller.stop(); old.onend?.();
  controller.start();
  const current = SyntheticRecognition.instances.at(-1)!;
  oldResult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "old" }, length: 1 }] });
  expect(controller.state.draft).toBe("");
  current.emit("new");
  controller.stop(); current.onend?.(); controller.use();
  expect(used).toEqual(["new"]);
});

test("an incoming result is rejected immediately when the current field becomes unavailable", () => {
  const { controller, used } = harness();
  let current = true;
  controller.setCurrentGuard(() => current);
  controller.open(); controller.start();
  const engine = SyntheticRecognition.instances.at(-1)!;
  current = false;
  engine.emit("Hidden workspace text");
  expect(engine.aborts).toBe(1);
  expect(controller.state.stage).toBe("closed");
  expect(controller.state.draft).toBe("");
  expect(used).toEqual([]);
});

test("native field props and labels survive server rendering; secret and disabled inputs have no mic", () => {
  const onVoiceValue = (_value: string) => {};
  const input = renderToStaticMarkup(createElement(VoiceInput, {
    id: "guest-name", name: "guestName", value: "Ana", required: true, maxLength: 20,
    "aria-label": "Guest name", onVoiceValue,
  }));
  expect(input).toContain('id="guest-name"');
  expect(input).toContain('name="guestName"');
  expect(input).toContain('aria-label="Guest name"');
  expect(input).toContain('aria-label="Dictate Guest name"');
  expect(input).toContain('type="button"');
  const textarea = renderToStaticMarkup(createElement(VoiceTextarea, { value: "Note", onVoiceValue }));
  expect(textarea).toContain("<textarea");
  expect(textarea).toContain('aria-label="Dictate text"');
  const secret = renderToStaticMarkup(createElement(VoiceInput, { type: "password", value: "secret", onVoiceValue }));
  expect(secret).not.toContain('aria-label="Dictate text"');
  const disabled = renderToStaticMarkup(createElement(VoiceInput, { disabled: true, value: "", onVoiceValue }));
  expect(disabled).not.toContain('aria-label="Dictate text"');
});

test("voice panel uses its native modal or containing dialog layer and otherwise falls back to body", () => {
  const body = { tagName: "BODY" } as unknown as HTMLElement;
  const modal = {
    tagName: "DIALOG", open: true,
    matches: (selector: string) => selector === ":modal",
  } as unknown as HTMLElement;
  const roleDialog = { tagName: "DIV" } as unknown as HTMLElement;
  const field = (layer: HTMLElement | null) => ({
    ownerDocument: { body },
    closest: (_selector: string) => layer,
  } as unknown as HTMLInputElement);

  expect(resolveVoicePanelHost(field(modal))).toBe(modal);
  expect(resolveVoicePanelHost(field(roleDialog))).toBe(roleDialog);
  expect(resolveVoicePanelHost(field(null))).toBe(body);
});

test("portaled voice controls retain a viewport layer, mobile dock clearance, and 44px actions", async () => {
  const css = await Bun.file("frontend/yellow/src/ui/voice-field.css").text();
  expect(css).toContain(".voice-field-panel { position: fixed; z-index: 2201;");
  expect(css).toContain(".table-column-menu:has(> .voice-field-panel) { z-index: 2202;");
  expect(css).toContain(".voice-field-panel.voice-field-panel > button { min-height: 44px;");
  expect(css).toContain("bottom: max(96px, calc(84px + env(safe-area-inset-bottom, 0px)))");
});

test("both field adapters return focus after Use without bypassing reviewed draft application", async () => {
  const source = await Bun.file("frontend/yellow/src/ui/VoiceField.tsx").text();
  expect(source).toContain('onClick={onUse}>Use text');
  expect(source.match(/onUse=\{useDraft\}/g)?.length).toBe(2);
  expect(source.match(/controller\.use\(\);\s+if \(restore && controller\.state\.stage === "closed"\) queueMicrotask\(\(\) => inputRef\.current\?\.focus\(\)\);/g)?.length).toBe(2);
});
