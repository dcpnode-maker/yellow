import test from "node:test";
import assert from "node:assert/strict";
import { createTokenHarborClient, assertFreeModels, tokenHarborOrigin } from "./tokenharbor.mjs";

const token = "thk_live_" + "x".repeat(64);
const model = "test-coder:free";
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" } });
function harness(response) {
  const calls = [];
  let reads = 0;
  const client = createTokenHarborClient({ models: [model],
    readToken: async () => { reads++; return token; },
    fetchImpl: async (url, options) => { calls.push({ url, options }); return response(); } });
  return { client, calls, reads: () => reads };
}

test("paid aliases, smart routing and unknown free IDs fail before credentials or network", async () => {
  const h = harness(() => json({}));
  for (const id of ["test-coder", "th-orchestra", "gpt-6-astra", "unknown:free", "test-coder:free "])
    await assert.rejects(h.client.generate({ model: id, prompt: "public fixture" }), /paid routes/);
  assert.equal(h.reads(), 0); assert.equal(h.calls.length, 0);
  for (const ids of [["test-coder"], [model, model], ["x:free".repeat(100)]])
    assert.throws(() => assertFreeModels(ids));
});

test("catalogue exposes only explicit free IDs and makes one fixed-origin request", async () => {
  const h = harness(() => json({ data: [{ id: model }, { id: "paid-coder" }, { id: "th-orchestra" }] }));
  assert.deepEqual(await h.client.discover(), [model]);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, tokenHarborOrigin + "/models");
  assert.equal(h.calls[0].options.redirect, "error");
  assert.equal(h.calls[0].options.credentials, "omit");
  assert.equal(h.calls[0].options.cache, "no-store");
  assert.equal(h.calls[0].options.headers.authorization, "Bearer " + token);
});

test("bounded completion has the exact free ID and no tools, fallback or streaming", async () => {
  const h = harness(() => json({ choices: [{ message: { content: "fixture" }, finish_reason: "stop" }],
    usage: { completion_tokens: 1, cost: 0 } }));
  const result = await h.client.generate({ model, prompt: "public fixture", maxOutputTokens: 16 });
  assert.equal(result.text, "fixture"); assert.equal(result.requestedModel, model);
  assert.equal(result.completionTokens, 1);
  assert.deepEqual(JSON.parse(h.calls[0].options.body), { model,
    messages: [{ role: "user", content: "public fixture" }], max_tokens: 16, stream: false });
});

test("invalid prompts and token bounds fail before credential access", async () => {
  const h = harness(() => json({}));
  for (const prompt of ["", null, "x".repeat(32769), "🙂".repeat(8193)])
    await assert.rejects(h.client.generate({ model, prompt }), /bounds/);
  for (const maxOutputTokens of [0, 1025, 1.5, Infinity])
    await assert.rejects(h.client.generate({ model, prompt: "public", maxOutputTokens }), /bounds/);
  assert.equal(h.reads(), 0); assert.equal(h.calls.length, 0);
});

test("401, quota exhaustion and redirects never retry or disclose upstream errors", async () => {
  for (const status of [401, 403, 402, 429, 307, 500]) {
    const h = harness(() => json({ error: { message: token } }, status));
    await assert.rejects(h.client.discover(), (error) =>
      error.message.includes(`HTTP ${status}`) && !error.message.includes(token));
    assert.equal(h.calls.length, 1);
  }
});

test("credential and network exceptions are sanitized", async () => {
  for (const where of ["credential", "network"]) {
    let calls = 0;
    const client = createTokenHarborClient({ models: [model],
      readToken: async () => { if (where === "credential") throw new Error(token); return token; },
      fetchImpl: async () => { calls++; throw new Error(token); } });
    await assert.rejects(client.discover(), (error) => !error.message.includes(token));
    assert.equal(calls, where === "credential" ? 0 : 1);
  }
  const h = createTokenHarborClient({ readToken: async () => "invalid", fetchImpl: () => {
    throw new Error("must not reach network"); } });
  await assert.rejects(h.discover(), /not confirmed/);
});

test("oversize declared or streamed responses, bad JSON and credential reflections fail", async () => {
  for (const response of [
    () => new Response("{}", { headers: { "content-type": "application/json", "content-length": "100" } }),
    () => json({ text: "x".repeat(100) }),
    () => new Response("bad json", { headers: { "content-type": "application/json" } }),
    () => json({ data: [], reflected: token }),
    () => new Response("html", { headers: { "content-type": "text/html" } }),
  ]) {
    const client = createTokenHarborClient({ readToken: async () => token,
      maxBytes: response.toString().includes("reflected") ? 500 : 50,
      fetchImpl: async () => response() });
    await assert.rejects(client.discover(), (error) => !error.message.includes(token));
  }
});

test("tools, multiple choices and nonzero reported free-route cost are not accepted", async () => {
  for (const body of [
    { choices: [{ message: { content: "tool", tool_calls: [{}] } }] },
    { choices: [{ message: { content: "tool", function_call: {} } }] },
    { choices: [{ message: { content: "one" } }, { message: { content: "two" } }] },
    { choices: [{ message: { content: "paid" } }], usage: { cost: 0.01 } },
  ]) {
    const h = harness(() => json(body));
    await assert.rejects(h.client.generate({ model, prompt: "public" }));
    assert.equal(h.calls.length, 1);
  }
});

test("timeouts abort exactly one request without a fallback", async () => {
  let calls = 0;
  const client = createTokenHarborClient({ readToken: async () => token, timeoutMs: 20,
    fetchImpl: async (_url, { signal }) => {
      calls++;
      return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error(token))));
    } });
  await assert.rejects(client.discover(), /no retry or paid fallback/);
  assert.equal(calls, 1);
});
