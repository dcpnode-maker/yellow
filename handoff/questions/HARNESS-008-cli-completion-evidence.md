# HARNESS-008: CLI termination is not semantic completion

Pinned upstream llama.cpp c829670 tools/cli/cli-context.cpp consumes content and
timings but discards API finish_reason. Its successful finite process exit cannot
prove that a response did not hit its output token limit. Refusing all such text
would make this advisory-only slice unusable; claiming completion would be false.

Independent bounded Luna advisory recommends explicitly unverified, possibly
truncated in-memory preview. Order 008 is updated openly: no accepted artifact,
executor receipt or Paperclip state transition can derive from this preview.
Nonzero exit, timeout, excess/empty output and known limit errors are rejected.

The same source interprets a prompt beginning `/read` or `/glob` as a file command.
The fixed runner prefixes every task with plain text, disables stdin and binds
the original prompt plus actual prefixed runtime-input digests. User text is
never evaluated, run as a shell, applied or allowed to select another model.

Source reviewed as public text only; no unrecognized runtime is installed and
the separate permitted finite test remains on the original pinned runtime.
