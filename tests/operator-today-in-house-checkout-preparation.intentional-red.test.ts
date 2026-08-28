import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

function functionSource(name: string): string {
  const start = script.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const opening = script.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = opening; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

test("Order 223 intentional red requires exact Today in-house checkout preparation", () => {
  const action = new Function(`return (${functionSource("todayOperationalAction")})`)() as
    (lane: string, row: string) => { workbench: string; label: string } | null;
  expect(action("in_house", "in_house")).toEqual({ workbench: "checkout", label: "Prepare checkout" });
});
