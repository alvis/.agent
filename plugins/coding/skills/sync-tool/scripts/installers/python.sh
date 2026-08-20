#!/usr/bin/env bash
# python.sh — install or update the latest available Python 3 per-OS.
#
# Branches:
#   - macOS (Darwin): brew install python / brew upgrade python
#   - Linux:          prefer `apt-get install -y python3` (when apt available);
#                     else `dnf install -y python3` (when dnf available);
#                     else print a clear fallback note and exit non-zero.
#   - Windows (MINGW/MSYS/CYGWIN): winget install python3
#
# Honors DRY_RUN=1 (echo planned cmd) and FORCE=1 (reinstall even if present).
# Verification: sync.ts checks that python3 is present after install.
# Exits 0 on success; non-zero with stderr message on failure.
#
# Self-contained: no shared shell library.

set -euo pipefail

DRY_RUN="${DRY_RUN:-0}"
FORCE="${FORCE:-0}"
PYTHON_CMD="python3"
BREW_FORMULA="python"
LINUX_PACKAGE="python3"
WINGET_MONIKER="python3"

run_cmd() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "+ $*" >&2
  else
    eval "$@"
  fi
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "python.sh: required command '$1' not found on PATH" >&2
    exit 1
  fi
}

uname_s="$(uname -s)"

case "$uname_s" in
  Darwin)
    require_cmd brew
    if command -v "$PYTHON_CMD" >/dev/null 2>&1 && [[ "$FORCE" != "1" ]]; then
      run_cmd "brew upgrade $BREW_FORMULA || brew install $BREW_FORMULA"
    else
      run_cmd "brew install $BREW_FORMULA"
    fi
    ;;

  Linux)
    if command -v apt-get >/dev/null 2>&1; then
      run_cmd "sudo apt-get update && sudo apt-get install -y $LINUX_PACKAGE"
    elif command -v dnf >/dev/null 2>&1; then
      run_cmd "sudo dnf install -y $LINUX_PACKAGE"
    else
      echo "python.sh: no supported package manager (apt-get/dnf) found on PATH." >&2
      echo "python.sh: install the latest available Python 3 manually — see https://www.python.org/downloads/" >&2
      exit 1
    fi
    ;;

  MINGW* | MSYS* | CYGWIN*)
    require_cmd winget
    if command -v "$PYTHON_CMD" >/dev/null 2>&1 && [[ "$FORCE" != "1" ]]; then
      run_cmd "winget upgrade $WINGET_MONIKER --source winget --silent --accept-source-agreements --accept-package-agreements || winget install $WINGET_MONIKER --source winget --silent --accept-source-agreements --accept-package-agreements"
    else
      run_cmd "winget install $WINGET_MONIKER --source winget --silent --accept-source-agreements --accept-package-agreements"
    fi
    ;;

  *)
    echo "python.sh: unrecognized OS (uname -s: $uname_s)" >&2
    exit 1
    ;;
esac
