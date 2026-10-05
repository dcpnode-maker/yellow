# Receipt — Order 650 Gemini live proof

Captured: 2026-09-23T14:25:46.1686104+05:30

Runtime:

- Public URL: `https://social-taxes-talk.loca.lt`
- Proof route: `/api/v1/demo/gemini-live-proof`
- Docker app: healthy
- Gemini model: `gemini-3.6-flash`

Observed proof:

- `localConfigured=true`
- `localLiveGeminiProved=true`
- `publicLiveGeminiProved=true`
- public proof bundle remaining gates: `governed-real-commands`
- non-operational provider: `gemini`
- operational provider: `deterministic-local`
- operational executed: `false`
- `secretExposed=false`

Safety:

- Gemini is used only for non-operational demo guidance.
- Operational PMS prompts remain local, confirmation-gated and non-executing.
- The configured API key was injected through environment only and was not committed.
