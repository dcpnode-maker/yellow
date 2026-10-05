import { expect, test } from "bun:test";
import { hostedDepositHandoffPath } from "../frontend/yellow/src/hosted-deposit-handoff";

const opaque = "11111111-1111-4111-8111-111111111111." + "A_-9".repeat(10) + "a_Z";

test("a supported opaque bearer opens one same-origin HTML path without inheriting search or hash", () => {
  const path = hostedDepositHandoffPath(opaque);
  expect(path).not.toBeNull();
  for (const origin of ["https://yellow.example", "http://127.0.0.1:30123"]) {
    const current = new URL("/p/property/today?workspace=finance&reservation=other#drawer", origin);
    const destination = new URL(path!, current);
    expect(destination.origin).toBe(current.origin);
    expect(destination.pathname.split("/")).toEqual(["", "pay", opaque]);
    expect(destination.search).toBe("");
    expect(destination.hash).toBe("");
    expect(destination.username).toBe("");
    expect(destination.password).toBe("");
    expect(decodeURIComponent(destination.pathname.slice(5))).toBe(opaque);
    expect(destination.pathname.startsWith("/api/")).toBe(false);
  }
});

test("missing, replayed or malformed capabilities cannot produce a clickable handoff", () => {
  const unsupported: unknown[] = [
    undefined, null, "", 0, false, {}, [], { bearer: opaque },
    "javascript:alert(1)", "data:text/html,test", "//foreign.example/pay/test",
    "https://foreign.example/pay/test", "/../", ".", "..", "%2e%2e", "%2f", "\\",
    opaque + "?next=//foreign.example", opaque + "#return", opaque + "/return",
    opaque + "\r\n", " " + opaque, opaque + " ", opaque.replace(".", "%2e"),
    opaque.replace(".", "/"), opaque.replace(".", "\\"), opaque.replace(".", "@"),
    opaque.replace(".", ":"), "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA." + "A".repeat(43),
    opaque.slice(0, -1), opaque + "A",
    "\ud800", opaque.slice(0, -1) + "\ud800", opaque.slice(0, -1) + "\u2028",
  ];
  for (const value of unsupported) expect(hostedDepositHandoffPath(value)).toBeNull();
});

test("compatible opaque tokens retain every character without deriving authority or decoding", () => {
  for (const suffix of ["A".repeat(43), "_".repeat(43), "-".repeat(43), "0".repeat(43)]) {
    const value = "00000000-0000-0000-0000-000000000000." + suffix;
    const path = hostedDepositHandoffPath(value);
    expect(path?.slice(5)).toBe(value);
    expect(new URL(path!, "https://yellow.example").pathname.split("/").length).toBe(3);
  }
});
