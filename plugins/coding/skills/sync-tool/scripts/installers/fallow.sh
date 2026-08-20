#!/usr/bin/env bash
# fallow.sh — install or update fallow (codebase intelligence for TS/JS) per-OS.
#
# Branches:
#   - macOS (Darwin):              cargo install fallow-cli
#   - Linux:                       cargo install fallow-cli
#   - Windows (MINGW/MSYS/CYGWIN): cargo install fallow-cli
#
# `cargo install fallow-cli` is cross-platform — the same command on every OS.
# It requires the Rust toolchain (`cargo`); no Homebrew or winget package is
# published. If `cargo` is absent the script fails with a clear message
# pointing at https://rustup.rs (mirrors how jj.sh assumes `cargo` on Linux).
#
# Honors DRY_RUN=1 (echo planned cmd) and FORCE=1 (reinstall even if present).
# Minimum version: 2.0.0 (verification done by sync.ts post-run).
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

require_cargo() {
  if ! command -v cargo >/dev/null 2>&1; then
    echo "fallow.sh: required command 'cargo' not found on PATH." >&2
    echo "fallow.sh: install the Rust toolchain first (see https://rustup.rs), then re-run." >&2
    exit 1
  fi
}

install_fallow() {
  # `cargo install` is idempotent: it upgrades in place when already present.
  # FORCE adds --force so a same-version reinstall is honored.
  if command -v fallow >/dev/null 2>&1 && [[ "$FORCE" == "1" ]]; then
    run_cmd "cargo install --force fallow-cli"
  else
    run_cmd "cargo install fallow-cli"
  fi
}

uname_s="$(uname -s)"

case "$uname_s" in
  Darwin)
    require_cargo
    install_fallow
    ;;

  Linux)
    require_cargo
    install_fallow
    ;;

  MINGW* | MSYS* | CYGWIN*)
    require_cargo
    install_fallow
    ;;

  *)
    echo "fallow.sh: unrecognized OS (uname -s: $uname_s)" >&2
    exit 1
    ;;
esac
