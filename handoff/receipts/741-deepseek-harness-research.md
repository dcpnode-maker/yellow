# Research Receipt: Order741 DeepSeek Company Model Harness

## 1. Overview & Execution Metadata

- **Order Reference**: `handoff/orders/741-deepseek-company-harness.md`
- **Execution Date**: 2026-09-26
- **Researcher Role**: Delegated Gemini Research/Design Owner (Antigravity)
- **Approved Scope**: Read `PROJECT.md`, `AGENTS.md`, `handoff/orders/741-deepseek-company-harness.md`. Inspect official public GitHub metadata and primary source files for `deepseek-ai/deepseek-harness`. Output strictly `docs/DEEPSEEK-HARNESS-PLAN.md` and `handoff/receipts/741-deepseek-harness-research.md`.

---

## 2. Upstream Verification & Primary Source Evidence

Direct inspection was performed against official GitHub API and raw content endpoints (`api.github.com`, `raw.githubusercontent.com`).

| Artifact / Endpoint | Exact URL / Ref | Evidence Discovered |
|---|---|---|
| **Repository** | `https://api.github.com/repos/deepseek-ai/deepseek-harness` | Name: `deepseek-harness`, Description: `"DeepSeek Harness: Everything is a Plugin."` |
| **Latest Commit Pin** | `477b4f420553e8a52c2fbccc464d7561b239c443` | Date: `2026-09-24T13:39:59Z`, Author: Turtle (`turtle1999@deepseek.com`), Message: `Merge pull request #5180 from deepseek-harness/rel/dsh-0.1.7-rc.2 release(dsh): 0.1.7-rc.2` |
| **Latest Release / Tag** | `0.1.7-rc.2` | Confirmed in root `package.json` (`"version": "0.1.7-rc.2"`) and commit history. |
| **License** | `https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/master/LICENSE` | Standard **MIT License**, Copyright (c) 2026 DeepSeek. Permissive commercial and private use. |
| **Package Engines** | `package.json` | `pnpm@11.7.0`, Node.js `^22.19.0 \|\| >=24.0.0` |
| **Architecture Engine** | `README.md` | Built on **Cordis** framework (`@cordiverse/cordis`), spatiotemporal composability model. |
| **Local Staged Copy** | `E:/yellow/dsh/0.1.5-rc.2` | Existing offline package base present on host drive. |
| **Goose Tool** | `E:/yellow/goose/v1.51.0/dist-windows` | Existing offline tool binary present on host drive. |

---

## 3. Discovered Extension APIs & Package Structure

Inspection of repository packages tree revealed a clean modular monorepo:
1. **Core LLM Capability (`packages/llm/llm`)**:
   - Exposed under `ctx.llm`.
   - Streaming API: `ctx.llm.stream(options)` yielding token deltas with terminal `finish` chunks (`{ kind: 'error', failure }`, `{ kind: 'aborted', failure }`).
   - Provider registry: `ctx.llm.listProviders()`, `ctx.llm.listModels()`, `ctx.llm.resolveModel()`.
   - Frozen messages: requests arrive deep-frozen, preventing arbitrary in-flight mutations.
   - Provider adapters are separate packages: `dsh-llm-deepseek`, `dsh-llm-deepseek-api-key`, `dsh-llm-pi-ai`.
2. **Host Plugin Runner (`packages/extensions/cordis-host-runner`)**:
   - Runs dynamic host plugin definitions inside a `node:vm` realm with configurable `vmTimeoutMs` (default: 5000ms).
   - Provides `ctx.dynamicCordisRunner` and `ctx.cordisInspect`.
3. **Tool Capability (`packages/extensions/tool-cordis`)**:
   - Exposes runtime read-only API discovery on `ctx.tools`.
4. **Execution Safety**:
   - Upstream documentation notes the sandbox isolates globals but advises treating dynamic package loading with bash-equivalent care.

---

## 4. Host Constraints & Efficiency Analysis

- **Host Specifications**: Windows 11 Home, AMD Ryzen 5 5500U (6c/12t), 16,097,532 KiB total RAM (~3.34 GiB free at inspection).
- **RAM Reality**: Free RAM is transient. Running 70B+ weights locally is impossible on this hardware; smaller 3B-8B local models require cautious sizing to avoid host swapping.
- **Concurrency Policy**: Strict single-worker default (`maxWorkers: 1`).
- **Zero-Spend Mandate**: All paid API execution disabled by default. Quota stops with no automated limit bypass or rotation.
- **Hospitality ERP Boundary**: Model tools remain completely isolated from Yellow database, ledger invariants, and live tenant sessions.

---

## 5. Candidate Harness Evaluation & Status

- **DeepSeek Harness (`dsh`)**: Proven MIT license, clean Cordis plugin model, minimal overhead. Selected as the base architecture.
- **Block / Goose (v1.51.0)**: Inspected as an offline tool execution reference. Can inform MCP tool invocation patterns.
- **AMAP-ML / LongHorizon / Omnigent / OSWorld**: Noted as academic evaluation evidence; marked as **UNKNOWN / UNPROVEN** for production ERP operations.
- **Browser-Use / UI-TARS**: Architectural takeaway adopted: DOM tree extraction before image/screenshot capture to conserve memory and tokens.

---

## 6. Implementation Readiness & Next Actions

1. **Plan Output**: Detailed architecture, four-tier model, and routing matrix written to `docs/DEEPSEEK-HARNESS-PLAN.md`.
2. **Next Scoped Order (Order742)**:
   - Implement minimal plugin slice: `company-policy-guard` and `gemini-cli-adapter`.
   - Setup offline unit tests mocking provider responses.
   - Run single bounded smoke test using existing included quota.
   - Review through an independent reviewer session per `AGENTS.md`.
