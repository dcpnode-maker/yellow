import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VoiceInput, VoiceTextarea } from "../frontend/yellow/src/ui/VoiceField";

const onVoiceValue = (_value: string) => {};

test("compact microphone keeps a matching accessible name and native hover prompt", () => {
  const input = renderToStaticMarkup(createElement(VoiceInput, {
    "aria-label": "Guest note", value: "", onVoiceValue,
  }));
  const textarea = renderToStaticMarkup(createElement(VoiceTextarea, {
    "aria-label": "Guest note", value: "", onVoiceValue,
  }));
  for (const html of [input, textarea]) {
    expect(html).toContain('aria-label="Dictate Guest note"');
    expect(html).toContain('title="Dictate Guest note"');
    expect(html).toContain('width="14" height="14"');
    expect(html).toContain('stroke-linecap="round"');
    expect(html).toContain('stroke-linejoin="round"');
    expect(html).toContain('aria-expanded="false"');
  }
});

test("disabled, read-only, and non-text financial/secret inputs remain microphone-free", () => {
  const field = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(VoiceInput, {
    value: "", onVoiceValue, ...props,
  }));
  expect(field({ disabled: true, "aria-label": "Guest note" })).not.toContain('title="Dictate Guest note"');
  expect(field({ readOnly: true, "aria-label": "Guest note" })).not.toContain('title="Dictate Guest note"');
  expect(field({ type: "number", "aria-label": "Financial amount" })).not.toContain("voice-field-mic");
  expect(field({ type: "password", "aria-label": "Payment secret" })).not.toContain("voice-field-mic");
});

test("rest state is transparent, touch target stays 44px, fine-pointer desktop is compact", async () => {
  const css = await Bun.file("frontend/yellow/src/ui/voice-field.css").text();
  expect(css).toMatch(/\.voice-field \.voice-field-control > \.voice-field-mic \{[^}]*width: 44px;[^}]*min-width: 44px;[^}]*height: 44px;[^}]*min-height: 44px;[^}]*background: transparent;/u);
  const fineMedia = css.slice(css.indexOf("@media (pointer: fine) and (min-width: 601px)"), css.indexOf(".voice-field-panel {"));
  expect(fineMedia).toContain(".voice-field .voice-field-control > .voice-field-mic { width: 32px; min-width: 32px; height: 32px; min-height: 32px;");
  expect(fineMedia).toContain("padding-right: 36px;");
  expect(css).toContain(".voice-field-panel.voice-field-panel > button { min-height: 44px;");
});
