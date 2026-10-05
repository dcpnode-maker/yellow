# Upstream options for Yellow's personal harness

Reviewed against the public upstream repositories on 27 September 2026. These are
**candidates**, not installed dependencies or endorsements. No upstream code was
copied into this order. A later order must pin a commit/version, inspect its
license and transitive dependencies, define the exact adapter surface and run a
Yellow-specific test before adoption. Upstream speed/token claims are not Yellow
benchmarks.

| Repository | Fit for Yellow | Present decision |
| --- | --- | --- |
| [Graft](https://github.com/trailhq/graft) | Local code graph, file/API lookup and blast-radius hints; structural mode needs no model key. | **Trial next**, isolated `--dry-run`/structural build. Do not let `init` rewrite `AGENTS.md`, global Codex settings or hooks. Deep summaries need a provider and may cost tokens. |
| [Headroom](https://github.com/headroomlabs-ai/headroom) (formerly `chopratejas/headroom`) | Reversible compression of repetitive tool output and logs. | Trial only with exact-answer regression tests; no global proxy/wrap or shared prompt rewriting yet. |
| [Better Harness](https://github.com/QoderAI/better-harness) | Evidence-backed analysis of coding-agent workflow across hosts. | Useful as a read-only evaluation lens, not the worker runtime. |
| [TrueForge](https://github.com/truefoundry/trueforge) | Agent loop, approvals, sessions, MCP and local SQLite UI/API. | Strong candidate for a later loop pilot; avoid duplicating its full runtime until footprint and isolation are tested. |
| [UniHarness](https://github.com/UnicomAI/UniHarness) | Separates model runtime from sandboxed computer. | Study its computer protocol; no direct OS-level adapter until threat model and independent review. |
| [OpenHarness](https://github.com/autonomous-ai/openharness) | Multi-agent/multi-machine command center. | Product/UI reference. Current app instructions target macOS/Linux with tmux/Flutter; not a Windows quick-start. |
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | Coding-agent loop source. | Developer-preview reference only; no automatic local execution. |
| [Goose](https://github.com/block/goose) | Existing open coding agent with tools. | Possible worker adapter; no reason to clone its entire runtime. |
| [Paperclip](https://github.com/paperclipai/paperclip) | MIT-licensed Node/React goal, team, budget, heartbeat and task control plane. | Strong UI/organization reference after the local protocol works; benchmark its footprint before running it on this laptop. |
| [OpenClaw](https://github.com/openclaw/openclaw) | Broad personal assistant/channel gateway. | Not required for initial Yellow coding controller; broad surface increases memory and authority. |
| [Browser Use](https://github.com/browser-use/browser-use) | Browser-agent library/CLI. | Optional for bounded, authorized UI testing. Cloud browser/model costs are separate; no stealth scraping requirement in this order. |
| [vLLM](https://github.com/vllm-project/vllm), [SGLang](https://github.com/sgl-project/sglang) | GPU inference servers, not agent harnesses. | Benchmark only after actual GPU allocation/model fit is known; avoid running on low-RAM Windows laptop. |
| [Bifrost](https://github.com/maximhq/bifrost) | Model-provider gateway/router. | Candidate only if existing OmniRoute routing becomes a measured bottleneck; no second resident gateway now. |
| [LangGraph](https://github.com/langchain-ai/langgraph) | Durable workflow graph with human checkpoints. | Evaluate if orchestration complexity outgrows the small controller. Do not add as a default dependency. |
| [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) | Python agent loop and handoffs. | Possible model adapter; API usage costs are separate from the open-source SDK. |
| [AutoGen](https://github.com/microsoft/autogen) | Multi-agent research framework. | **Do not start new work on it**; its README states maintenance mode. |
| [Mem0](https://github.com/mem0ai/mem0) | Long-term agent memory. | Defer; first prove current source-index and task receipts are insufficient. |
| [Strix](https://github.com/usestrix/strix) | Authorized app-security testing. | Separate Yellow security test order only, against owned local/synthetic targets; not a coding-worker dependency. |
| [GenOffice](https://github.com/genspark-ai/genoffice) | Local Office document tooling. | Useful for Yellow business documents later, not harness core. |
| [awesome-opensource-ai](https://github.com/alvinreal/awesome-opensource-ai) | Curated repository directory. | Research index, not reusable runtime code. |

The initially referenced GSH name is ambiguous among unrelated repositories.
No GSH code is selected until the founder identifies the exact URL. For any
GPL-licensed candidate, keep it as a separately invoked program unless the
founder approves a license-compatibility plan; never paste its code into Yellow.

Priority for the next measured trial: **Graft structural lookup → Headroom
compression → one agent loop (TrueForge vs existing coding CLI) → one GPU inference
server/model**. Check accuracy, latency, RAM and license at each step, with
rollback before adding the next component.
