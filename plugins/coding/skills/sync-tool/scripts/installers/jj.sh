#!/usr/bin/env bash
# jj.sh — install or update Jujutsu (jj) per-OS.
#
# Branches:
#   - macOS (Darwin): brew install jj / brew upgrade jj
#   - Linux:          prefer `cargo install --locked --bin jj jj-cli`;
#                     else download release tarball jj-*-x86_64-unknown-linux-musl.tar.gz
#                     to ~/.local/bin
#   - Windows (MINGW/MSYS/CYGWIN): winget install --id martinvonz.jj
#
# Honors DRY_RUN=1 (echo planned cmd) and FORCE=1 (reinstall even if present).
# Minimum version: 0.44.0 (verification done by sync.py post-run).
# Exits 0 on success; non-zero with stderr message on failure.
#
# Self-contained: no shared shell library.

set -euo pipefail

DRY_RUN="${DRY_RUN:-0}"
FORCE="${FORCE:-0}"

run_cmd() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "+ $*" >&2
  else
    eval "$@"
  fi
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "jj.sh: required command '$1' not found on PATH" >&2
    exit 1
  fi
}

uname_s="$(uname -s)"

case "$uname_s" in
  Darwin)
    require_cmd brew
    if command -v jj >/dev/null 2>&1 && [[ "$FORCE" != "1" ]]; then
      run_cmd "brew upgrade jj || brew install jj"
    else
      run_cmd "brew install jj"
    fi
    ;;

  Linux)
    if command -v cargo >/dev/null 2>&1; then
      # Use cargo when available (most up-to-date, official upstream method).
      run_cmd "cargo install --locked --bin jj jj-cli"
    else
      # Fallback: musl tarball from GitHub releases.
      require_cmd curl
      require_cmd tar
      mkdir -p "$HOME/.local/bin"
      tmpdir="$(mktemp -d)"
      tarball_url="https://github.com/jj-vcs/jj/releases/latest/download/jj-x86_64-unknown-linux-musl.tar.gz"
      run_cmd "curl -fsSL \"$tarball_url\" -o \"$tmpdir/jj.tar.gz\""
      run_cmd "tar -xzf \"$tmpdir/jj.tar.gz\" -C \"$tmpdir\""
      run_cmd "install -m 0755 \"$tmpdir/jj\" \"$HOME/.local/bin/jj\""
      run_cmd "rm -rf \"$tmpdir\""
      case ":$PATH:" in
        *":$HOME/.local/bin:"*) ;;
        *)
          echo "jj.sh: note — \$HOME/.local/bin is not on PATH; add it to your shell rc." >&2
          ;;
      esac
    fi
    ;;

  MINGW* | MSYS* | CYGWIN*)
    require_cmd winget
    if command -v jj >/dev/null 2>&1 && [[ "$FORCE" != "1" ]]; then
      run_cmd "winget upgrade --id martinvonz.jj --silent --accept-source-agreements --accept-package-agreements || winget install --id martinvonz.jj --silent --accept-source-agreements --accept-package-agreements"
    else
      run_cmd "winget install --id martinvonz.jj --silent --accept-source-agreements --accept-package-agreements"
    fi
    ;;

  *)
    echo "jj.sh: unrecognized OS (uname -s: $uname_s)" >&2
    exit 1
    ;;
esac
