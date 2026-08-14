# Tool Registry

`sync-tool` operates on a fixed registry of CLI tools, evaluated in order.
Order matters: on macOS, `brew` must be present before `jj` and `gh` are installed.

## Currently registered

| Order | Name   | Min version | macOS-only | Installer script              | Source of truth                                    |
| ----- | ------ | ----------- | ---------- | ----------------------------- | -------------------------------------------------- |
| 1     | `brew` | 4.0.0       | yes        | `scripts/installers/brew.sh`  | <https://brew.sh>                                    |
| 2     | `jj`   | 0.44.0      | no         | `scripts/installers/jj.sh`    | <https://github.com/jj-vcs/jj>                       |
| 3     | `gh`   | 2.0.0       | no         | `scripts/installers/gh.sh`    | <https://cli.github.com> / <https://github.com/cli/cli> |
| 4     | `fallow` | 2.0.0     | no         | `scripts/installers/fallow.sh` | <https://github.com/fallow-rs/fallow>               |
| 5     | `python` | latest available | no       | `scripts/installers/python.sh` | <https://www.python.org/downloads/>                 |

## Adding a new tool

To register a new tool (e.g., `rg`):

1. **Author the installer**: Create `scripts/installers/<tool>.sh` following the contract:
   - Branch on `uname -s`: `Darwin` / `Linux` / `MINGW*|MSYS*|CYGWIN*` / `*`.
   - Honor `DRY_RUN=1` (echo planned commands without executing) and `FORCE=1` (reinstall even if present).
   - Self-contained — no shared shell helpers.
   - Exit 0 on success; non-zero with a clear stderr message on failure.
   - Prefer the official upstream install method per OS (Homebrew on macOS, official apt repo / dnf / cargo / tarball on Linux, winget on Windows).
2. **Register it in `scripts/sync.py`**: Append a `ToolEntry(...)` to the `REGISTRY` tuple. Set:
   - `name`: the executable name on `PATH`.
   - `installer`: filename in `scripts/installers/`.
   - `min_version`: minimum acceptable `--version` output.
   - `version_args`: tuple of args that produce a parseable version string (default `("--version",)`).
   - `macos_only`: `True` only for tools that genuinely don't apply elsewhere (e.g., `brew`).
3. **Update this file**: Add a row to the table above.
4. **Update `references/platforms.md`**: Document the per-OS install method for the new tool.

## Why this is a closed registry

`sync-tool` is intentionally not a generic package manager. It exists to guarantee a known set of coding CLIs are present at minimum versions for sibling skills (e.g., `coding:commit` uses `jj` for history and `gh` for remote-state checks, while `coding:pr create` uses both for publication). Keeping the registry small and explicit means each tool gets a hand-tuned, audited installer that matches its upstream's official guidance.

The `jj` floor is 0.44.0 because the shared coding guide and PR workflow rely
on `jj arrange`, `jj bookmark advance`, and read-only `jj run`.
