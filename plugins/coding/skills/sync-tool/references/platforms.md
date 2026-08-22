# Platforms

`sync-tool` supports macOS, Linux, and Windows (via Git-Bash / MSYS / Cygwin).
OS detection is performed twice — once in `scripts/lib.ts::detectOs()` for
TypeScript-side decisions, and once via `uname -s` inside each installer shell
script. Both branches must stay in sync.

## OS detection rules

| `uname -s` output                  | Internal name | Notes                                           |
| ---------------------------------- | ------------- | ----------------------------------------------- |
| `Darwin`                           | `darwin`      | macOS — Homebrew is the default package manager.|
| `Linux`                            | `linux`       | Distro detected at install time (apt/dnf/etc.). |
| `MINGW*` / `MSYS*` / `CYGWIN*`     | `windows`     | Git-Bash, MSYS2, or Cygwin under Windows.       |
| anything else                      | `unknown`     | Hard error; nothing is attempted.               |

Inside an installer, the `case` statement looks like:

```bash
case "$(uname -s)" in
  Darwin)                      ;;  # macOS
  Linux)                       ;;  # Linux distros
  MINGW* | MSYS* | CYGWIN*)    ;;  # Windows shells
  *) echo "unrecognized OS" >&2; exit 1 ;;
esac
```

## Per-OS install method matrix

Each cell shows the primary install method per the tool's official upstream
guidance. Fallbacks are listed in the relevant `installers/<tool>.sh`.

| Tool   | macOS                   | Linux (apt)                                      | Linux (dnf)                  | Linux (other)                       | Windows                            |
| ------ | ----------------------- | ------------------------------------------------ | ---------------------------- | ----------------------------------- | ---------------------------------- |
| `brew` | official install script | _skip_ (mac-only in this registry)               | _skip_                       | _skip_                              | _skip_                             |
| `jj`   | `brew install jj`       | `cargo install --locked --bin jj jj-cli` *       | `cargo install --locked …` * | musl tarball → `~/.local/bin`       | `winget install --id martinvonz.jj`|
| `gh`   | `brew install gh`       | official `cli.github.com` apt repo + `apt install gh` | `dnf install gh` (after config-manager add-repo) | release tarball → `~/.local/bin` | `winget install --id GitHub.cli`   |
| `fallow` | `cargo install fallow-cli` † | `cargo install fallow-cli` †                 | `cargo install fallow-cli` † | `cargo install fallow-cli` †        | `cargo install fallow-cli` †       |
| `python` | `brew install python`     | `apt-get update && apt-get install -y python3` | `dnf install -y python3` | _none_ (fails with manual-install note) | `winget install python3` |

\* When `cargo` is not installed, falls back to the Linux tarball path.

† `cargo` is cross-platform, so `fallow` uses the same command on every OS. It
requires the Rust toolchain (`cargo`) as a prerequisite; the installer fails
with a clear message pointing at <https://rustup.rs> when `cargo` is absent.

## Conventions

- **Idempotence**: Re-running an installer with the same env/flags must not
  cause errors. Already-current installs are detected pre-flight by `sync.ts`.
- **Dry run**: `DRY_RUN=1` causes installer scripts to echo each planned
  command (`+ <cmd>` to stderr) without executing it.
- **Force**: `FORCE=1` causes the installer to reinstall/upgrade even when the
  tool is present at minimum version (`sync.ts` skips its own short-circuit).
- **No interactive auth**: `gh.sh` only polls `gh auth status`; it never invokes
  `gh auth login`. The user is instructed via banner to run `gh auth login` in
  another terminal. `SYNC_TOOL_NO_WAIT=1` lets non-interactive callers fail
  fast with the banner printed once.
- **Self-contained installers**: There is no shared shell library by design.
  Each installer can be run standalone (`bash installers/jj.sh`) for ad-hoc
  troubleshooting without depending on `sync.ts`.

## Known platform caveats

- **macOS without Xcode CLT**: Homebrew's installer prompts for the Xcode
  Command Line Tools the first time. Under `NONINTERACTIVE=1` this still works
  but may take several minutes; output is left on stderr for visibility.
- **Linux without `sudo`**: The apt/dnf branches assume `sudo` is available and
  the user has root privileges. If neither apt nor dnf is present, the tarball
  fallback installs into `$HOME/.local/bin` which does not require root.
- **Windows under PowerShell/CMD**: `sync.ts` is invoked from a POSIX shell;
  PowerShell/CMD are not supported. Use Git-Bash or MSYS2.
