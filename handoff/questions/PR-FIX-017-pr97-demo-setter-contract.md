# PR-FIX-017 - The old test required a compile error

## RESOLVED

The second full suite failed only because Order620's static callback expectation
names nonexistent setAssistantOpen. PR-FIX-014 uses the already-existing setter
setAssistant, passes frontend tsc and preserves explicit microphone/speech consent.
Correct that exact assertion and add a negative guard against the original typo.
