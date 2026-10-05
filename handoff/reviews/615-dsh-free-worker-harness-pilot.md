# Review 615 — DSH free-worker harness pilot

## Status

PARTIAL — selectable provider configuration and loopback UI are proven; authenticated
Gemini inference is pending private credential enrollment.

## Evidence

- Pinned DSH remains installed at `E:\yellow\dsh\0.1.5-rc.2`.
- `tools/build-continuity/start-dsh-workers.ps1` starts the Web UI on
  `127.0.0.1:20131` with an isolated `DSH_HOME` below Git metadata.
- The composed DSH profile lists `Yellow Gemini` with:
  - `gemini-3.1-pro-preview`
  - `gemini-3.8-flash`
  - `gemini-3.5-flash-lite`
- The same picker retains only the explicit
  `openrouter/poolside/laguna-s-2.1:free` OmniRoute choice.
- Google authentication is referenced only as
  `YELLOW_GEMINI_DSH_API_KEY`; no credential value is present in the profile.
- Goose has a separate guarded launcher and credential reference,
  `YELLOW_GEMINI_GOOSE_API_KEY`. Missing credentials fail before Goose starts.
- PowerShell parser proof returned zero errors for all three launchers.
- `python -m unittest discover -s tools/build-continuity -p 'test_*.py' -v`
  returned `OK` for 23 tests with 3 Windows symlink tests skipped by their existing
  platform guard.

## Remaining proof

1. Enroll a fresh, non-transcript Gemini key through the hidden-input helper for
   each intended harness.
2. Execute one harmless authenticated generation per harness and retain only a
   redacted receipt.
3. Complete the original read-only Order609 six-field DSH comparison before DSH
   receives a writer lease.

No Yellow product source, public runtime, database, Docker service, phone setting,
or accepted release artifact changed under this order.
