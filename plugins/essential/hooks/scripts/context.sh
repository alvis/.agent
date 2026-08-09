#!/usr/bin/env bash
# Basic context retrieval for Claude Code
# Generates session header, working directory, custom context, and environment info
# Compatible with bash 3.2+

# Emit context in the JSON envelope required by Claude hook events.
output_hook_context() {
  local event_name="$1"
  local context="$2"
  local escaped_context
  escaped_context=$(printf '%s' "$context" | jq -Rs .)

  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "$event_name",
    "additionalContext": $escaped_context
  }
}
EOF
  exit 0
}

# Get working directory context
get_working_directory_context() {
  printf '%s\n' "**Working directory**: \`$(pwd)\`"
}

get_repo_root() {
  local root=""
  if command -v jj >/dev/null 2>&1 &&
     root="$(jj --ignore-working-copy root 2>/dev/null)" && [[ -n "$root" ]]; then
    printf '%s\n' "$root"
  elif git rev-parse --git-dir >/dev/null 2>&1; then
    git rev-parse --show-toplevel
  else
    pwd
  fi
}

get_file_identity() {
  local path="$1"
  if stat -f '%d:%i' "$path" >/dev/null 2>&1; then
    stat -f '%d:%i' "$path"
  elif stat -c '%d:%i' "$path" >/dev/null 2>&1; then
    stat -c '%d:%i' "$path"
  else
    (cd "$(dirname "$path")" && printf '%s/%s\n' "$(pwd -P)" "$(basename "$path")")
  fi
}

get_repo_root_documents_context() {
  local repo_root
  repo_root="$(cd "$1" && pwd -P)"
  local context=""
  local path rel name identity
  local seen_identities=$'\n'

  # Small onboarding entrypoints remain useful and are not generated work
  # state. Do not enumerate arbitrary root Markdown.
  local onboarding_groups=("README.md readme.md" "AGENTS.md" "CONTRIBUTING.md contributing.md" "SECURITY.md security.md")
  local group
  for group in "${onboarding_groups[@]}"; do
    for name in $group; do
      if [[ -f "$repo_root/$name" ]]; then
        identity="$(get_file_identity "$repo_root/$name")"
        if [[ "$seen_identities" != *$'\n'"$identity"$'\n'* ]]; then
          context+="- $name"$'\n'
          seen_identities+="$identity"$'\n'
        fi
        break
      fi
    done
  done

  # Reuse the resolver's selection semantics. Paths are pointers for the main
  # session, not an instruction for every agent to load both files.
  local essential_root resolver_payload resolver_status work_dir
  essential_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  resolver_payload="$("$essential_root/scripts/resolve-state-workspace" \
    --path "$repo_root" 2>/dev/null || true)"
  resolver_status="$(jq -r '.status // empty' <<<"$resolver_payload" 2>/dev/null || true)"
  if [[ "$resolver_status" == "resolved" || "$resolver_status" == "requires_ignore" ]]; then
    work_dir="$(jq -r '.work_dir // empty' <<<"$resolver_payload")"
    for name in state/working.md state.md; do
      path="$work_dir/$name"
      if [[ -f "$path" ]]; then
        rel="${path#"$repo_root"/}"
        context+="- $rel"$'\n'
      fi
    done
  elif [[ "$resolver_status" == "work_id_required" ]]; then
    context+="- Engineering work selection is unresolved; ask only when artifact work begins."$'\n'
  fi

  # Durable entrypoints only. Their READMEs provide progressive disclosure
  # into architecture, design, and specification detail.
  if [[ -f "$repo_root/docs/README.md" ]]; then
    context+="- docs/README.md"$'\n'
  fi
  if [[ -f "$repo_root/docs/architecture/README.md" ]]; then
    context+="- docs/architecture/README.md"$'\n'
  fi

  if [[ -f "$repo_root/docs/design/README.md" ]]; then
    context+="- docs/design/README.md"$'\n'
  fi

  if [[ -f "$repo_root/docs/specs/README.md" ]]; then
    context+="- docs/specs/README.md"$'\n'
  fi

  if [[ -n "$context" ]]; then
    context="## Target Repo Documents"$'\n\n'"${context}"
  fi

  printf '%s' "$context"
}

# Get environment and session info
# Parameters: $1 = session_id
get_environment_context() {
  # Detect shell and version
  local shell_path="${SHELL:-/bin/bash}"
  local shell_name
  shell_name="$(basename "$shell_path")"
  local shell_version=""

  if [[ -x "$shell_path" ]]; then
    shell_version=$("$shell_path" --version 2>&1 | head -1 || echo "version unknown")
  else
    shell_version="version unknown"
  fi

  printf '**Environment**: %s %s\n**Shell**: %s — write %s-compatible scripts\n' \
    "$(uname -s)" "$(uname -m)" "$shell_version" "$shell_name"
}

# Get agent capability signal.
# Emitted here (essential's env) because essential is the only plugin that still
# injects an environment block after the env dedup; the coding/governance hooks
# that used to carry this signal now run without --with-plugin-context.
get_agent_capabilities_context() {
  if [[ "${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-}" == "1" ]]; then
    printf '## Agent Capabilities\n\n**Agent Teams**: enabled\n'
  fi
}

# One shared pointer to plugin standards, replacing the per-plugin
# enumeration that used to dominate the boot context. Each plugin's reference
# catalogs its own standards; the full set lives under the directory below.
get_standards_pointer_context() {
  printf '%s\n' "Standards: each plugin's \`standards/\` (cataloged in its reference)."
}

# Get all basic context in one call
# Combines working directory, custom context, and environment info
get_plugin_context() {
  local audience="${1:-session}"
  local context=""
  local repo_root
  local block

  repo_root=$(get_repo_root)
  context+="$(get_working_directory_context)"$'\n\n'
  context+="$(get_environment_context)"$'\n'
  if [[ "$audience" != "subagent" ]]; then
    block="$(get_repo_root_documents_context "$repo_root")"
    if [[ -n "$block" ]]; then
      context+="$block"$'\n\n'
    fi
  fi
  block="$(get_agent_capabilities_context)"
  if [[ -n "$block" ]]; then
    context+="$block"$'\n\n'
  fi
  context+="$(get_standards_pointer_context)"
  printf '%s' "$context"
}
