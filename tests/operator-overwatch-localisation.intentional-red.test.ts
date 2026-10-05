import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");

test("Order 418: Overwatch's immediate operational replies follow the selected Indian language", () => {
  expect(script).toContain("function overwatchText(key, values = {})");
  for (const language of ["en-IN", "hi-IN", "mr-IN", "kn-IN", "te-IN"]) {
    expect(script).toContain(`\"${language}\": {`);
  }
  expect(script).toContain('return reply(overwatchText("arrivals"), "today", "due_in")');
  expect(script).toContain('overwatchText(prepare ? "preparing" : "opened", { guest:row.primaryGuestDisplayName })');
  expect(script).toContain('overwatchText("selected", { language:option.text })');
  expect(script).toContain('const language = jarvisVoicePreference.language;');
  for (const command of ["चेक[ -]?इन\\s+तैयार", "चेक[ -]?इन\\s+तयार", "ಚೆಕ್[ -]?ಇನ್\\s+ಸಿದ್ಧಪಡಿಸಿ", "చెక్[ -]?ఇన్\\s+సిద్ధం"]) {
    expect(script).toContain(command);
  }
  expect(script).toContain("const overwatchNaturalPauseMs = 3000;");
  expect(script).toContain("}, overwatchNaturalPauseMs);");
  expect(script).toContain("function addOverwatchSuggestedPrompts()");
  expect(script).toContain('"mr-IN":["आजचे आगमन दाखवा", "निर्गमन दाखवा"');
  expect(script).toContain('[labels[3], "prepare check-in Aarav Mehta"]');
  expect(script).toContain("addOverwatchSuggestedPrompts();");
  expect(css).toContain(".overwatch-suggested-prompts");
});
