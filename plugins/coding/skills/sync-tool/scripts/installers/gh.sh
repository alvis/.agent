#!/usr/bin/env bash
# gh.sh — install or update GitHub CLI (gh) per-OS, then poll auth status.
#
# Branches:
#   - macOS (Darwin): brew install gh / brew upgrade gh
#   - Linux:
#       Debian/Ubuntu (apt-get available): official cli.github.com apt repo
#       Fedora/RHEL  (dnf available):      dnf install gh
#       Fallback:                          GitHub release tarball into ~/.local/bin
#   - Windows (MINGW/MSYS/CYGWIN): winget install --id GitHub.cli
#
# Post-install:
#   Run `gh auth status`. If exit != 0, print a multi-line banner instructing
#   the user to run `gh auth login` in another terminal, then poll every 5s.
#   Re-print the banner every 6th poll (~30s). Exit 0 on auth success.
#   Honors SYNC_TOOL_NO_WAIT=1 → print banner once, exit non-zero.
#
# Honors DRY_RUN=1 (echo planned cmd) and FORCE=1 (reinstall even if present).
# Minimum version: 2.0.0 (verification done by sync.ts post-run).
# Exits 0 on success; non-zero with stderr message on failure.
#
# Self-contained: no shared shell library.

set -euo pipefail

DRY_RUN="${DRY_RUN:-0}"
FORCE="${FORCE:-0}"
SYNC_TOOL_NO_WAIT="${SYNC_TOOL_NO_WAIT:-0}"

run_cmd() {
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "+ $*" >&2
  else
    eval "$@"
  fi
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "gh.sh: required command '$1' not found on PATH" >&2
    exit 1
  fi
}

print_auth_banner() {
  cat >&2 <<'BANNER'
============================================================
⚠️  GitHub CLI is not authenticated.
In ANOTHER terminal window, run:
    gh auth login
This shell will re-check every 5 seconds and continue
automatically once login succeeds. Press Ctrl-C to abort.
============================================================
BANNER
}

poll_gh_auth() {
  # Already authenticated? Done.
  if gh auth status >/dev/null 2>&1; then
    user="$(gh api user --jq .login 2>/dev/null || echo 'unknown')"
    echo "✓ gh authenticated as $user" >&2
    return 0
  fi

  if [[ "$SYNC_TOOL_NO_WAIT" == "1" ]]; then
    print_auth_banner
    echo "gh.sh: SYNC_TOOL_NO_WAIT=1 set — exiting without waiting for auth." >&2
    return 1
  fi

  print_auth_banner
  trap 'echo; echo "gh.sh: aborted; gh remains unauthenticated" >&2; exit 130' INT

  local poll_count=0
  while true; do
    if gh auth status >/dev/null 2>&1; then
      user="$(gh api user --jq .login 2>/dev/null || echo 'unknown')"
      echo "✓ gh authenticated as $user" >&2
      return 0
    fi
    poll_count=$((poll_count + 1))
    if (( poll_count % 6 == 0 )); then
      print_auth_banner
    fi
    sleep 5
  done
}

uname_s="$(uname -s)"

case "$uname_s" in
  Darwin)
    require_cmd brew
    if command -v gh >/dev/null 2>&1 && [[ "$FORCE" != "1" ]]; then
      run_cmd "brew upgrade gh || brew install gh"
    else
      run_cmd "brew install gh"
    fi
    ;;

  Linux)
    if command -v apt-get >/dev/null 2>&1; then
      # Official apt repo: https://cli.github.com/packages
      require_cmd curl
      run_cmd "sudo mkdir -p -m 755 /etc/apt/keyrings"
      run_cmd "curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/etc/apt/keyrings/githubcli-archive-keyring.gpg"
      run_cmd "sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg"
      run_cmd "echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main\" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null"
      run_cmd "sudo apt-get update"
      run_cmd "sudo apt-get install -y gh"
    elif command -v dnf >/dev/null 2>&1; then
      run_cmd "sudo dnf install -y 'dnf-command(config-manager)'"
      run_cmd "sudo dnf config-manager --add-repo https://cli.github.com/packages/rpm/gh-cli.repo"
      run_cmd "sudo dnf install -y gh --refresh"
    else
      # Fallback: GitHub release tarball.
      require_cmd curl
      require_cmd tar
      mkdir -p "$HOME/.local/bin"
      tmpdir="$(mktemp -d)"
      arch="$(uname -m)"
      case "$arch" in
        x86_64) arch_tag="amd64" ;;
        aarch64 | arm64) arch_tag="arm64" ;;
        *)
          echo "gh.sh: unsupported arch '$arch' for tarball fallback" >&2
          exit 1
          ;;
      esac
      tarball_url="https://github.com/cli/cli/releases/latest/download/gh_linux_${arch_tag}.tar.gz"
      run_cmd "curl -fsSL \"$tarball_url\" -o \"$tmpdir/gh.tar.gz\""
      run_cmd "tar -xzf \"$tmpdir/gh.tar.gz\" -C \"$tmpdir\""
      gh_bin="$(find "$tmpdir" -type f -name gh -path '*/bin/gh' | head -n1)"
      if [[ -z "$gh_bin" ]]; then
        echo "gh.sh: could not locate gh binary in tarball" >&2
        exit 1
      fi
      run_cmd "install -m 0755 \"$gh_bin\" \"$HOME/.local/bin/gh\""
      run_cmd "rm -rf \"$tmpdir\""
      case ":$PATH:" in
        *":$HOME/.local/bin:"*) ;;
        *)
          echo "gh.sh: note — \$HOME/.local/bin is not on PATH; add it to your shell rc." >&2
          ;;
      esac
    fi
    ;;

  MINGW* | MSYS* | CYGWIN*)
    require_cmd winget
    if command -v gh >/dev/null 2>&1 && [[ "$FORCE" != "1" ]]; then
      run_cmd "winget upgrade --id GitHub.cli --silent --accept-source-agreements --accept-package-agreements || winget install --id GitHub.cli --silent --accept-source-agreements --accept-package-agreements"
    else
      run_cmd "winget install --id GitHub.cli --silent --accept-source-agreements --accept-package-agreements"
    fi
    ;;

  *)
    echo "gh.sh: unrecognized OS (uname -s: $uname_s)" >&2
    exit 1
    ;;
esac

# Post-install auth check (skipped on dry-run since gh may not actually be on PATH).
if [[ "$DRY_RUN" == "1" ]]; then
  echo "+ gh auth status (post-install poll skipped under DRY_RUN=1)" >&2
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh.sh: gh not on PATH after install" >&2
  exit 1
fi

if poll_gh_auth; then
  exit 0
else
  exit 1
fi
