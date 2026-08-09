# RST-TOOL-03: bacon Is the Dev Loop; cargo watch Is Forbidden

**Tool Coverage:** standard-only — no tool flags `cargo watch` invocations in docs or scripts, or a missing `bacon.toml`.

## Intent

The local development feedback loop MUST use `bacon`, configured via a checked-in `bacon.toml`. `cargo watch -x check` and friends are forbidden anywhere they could end up in a contributor's hands: README snippets, onboarding docs, justfiles, npm scripts. `bacon` runs `check`, `clippy`, `test`, and custom jobs in a TUI that surfaces only the diagnostics that changed — `cargo watch` re-prints the entire compiler output on every keystroke, drowning real errors in noise and refusing to handle multi-job switching (you have to stop and restart with different `-x` args).

## Fix

```toml
# ✅ GOOD: bacon.toml at the repo root
default_job = "clippy"

[jobs.check]
command = ["cargo", "check", "--workspace", "--all-targets", "--color", "always"]
need_stdout = false

[jobs.clippy]
command = [
    "cargo", "clippy",
    "--workspace", "--all-targets",
    "--color", "always",
    "--", "-W", "clippy::pedantic",
]
need_stdout = false

[jobs.test]
command = ["cargo", "nextest", "run", "--workspace", "--color", "always"]
need_stdout = true

[jobs.doc]
command = ["cargo", "doc", "--workspace", "--no-deps", "--color", "always"]
need_stdout = false
```

```bash
# ✅ GOOD: developer loop is a single command
bacon                       # runs default job (clippy) in watch mode
bacon --job test            # swap to nextest under the same TUI
bacon --job check           # swap to fast check
# inside the TUI: `c` → clippy, `t` → test, `q` → quit
```

```bash
# ❌ BAD: cargo watch in onboarding docs
cargo watch -x check                     # forbidden
cargo watch -x 'clippy --workspace'      # forbidden
cargo watch -x check -x test             # forbidden — re-prints full output, no TUI
```

### Why `bacon` Over `cargo watch`

- **Filtered output**: bacon shows only the diagnostics from the current run, redrawn in place; cargo watch dumps the full compiler stream every time.
- **Job switching**: `--job <name>` (or in-TUI keybindings) flips between `check`, `clippy`, `test`, `doc` without restarting the process and without losing build cache warmth.
- **Status summary**: bacon shows a colour-coded pass/fail header for the most recent run — at-a-glance signal that survives long output.
- **First-class clippy support**: clippy's structured output is parsed and grouped by file; cargo watch treats it as opaque text.

## Edge Cases

- CI does not run bacon — CI invokes `cargo clippy`, `cargo nextest run`, etc. directly. `bacon.toml` is purely the dev-loop contract.
- Editors with built-in watch (e.g., rust-analyzer's `cargo check on save`) coexist with bacon; bacon adds the test/doc/custom jobs that the editor does not run.
- Custom workspace tasks (e.g., regenerating a code-gen target) can be added as new `[jobs.NAME]` entries — keep them in `bacon.toml` rather than spawning a separate watcher tool.
- If a contributor truly cannot install bacon (sandbox limitation), the fallback is `cargo check` invoked manually — never `cargo watch`.

## Related

RST-TOOL-01, RST-TOOL-02, RST-TOOL-04, RST-CORE-04
