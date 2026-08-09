#!/usr/bin/env bash
# Project context retrieval for Claude Code
# Detects and formats Git, Node.js, and Python project information
# Compatible with bash 3.2+

detect_node_package_manager() {
  local search_dir="$1"
  local repo_root="$2"

  # Check package.json for packageManager field (highest priority)
  if [[ -f "$search_dir/package.json" ]]; then
    local pkg_manager=$(jq -r '.packageManager // empty' "$search_dir/package.json" 2>/dev/null)
    if [[ -n "$pkg_manager" ]]; then
      # Extract manager name (e.g., "pnpm@8.0.0" -> "pnpm")
      echo "${pkg_manager%%@*}"
      return
    fi
  fi

  # Check for lock files in current directory
  if [[ -f "$search_dir/pnpm-lock.yaml" ]]; then
    echo "pnpm"
    return
  elif [[ -f "$search_dir/yarn.lock" ]]; then
    echo "yarn"
    return
  elif [[ -f "$search_dir/bun.lockb" ]]; then
    echo "bun"
    return
  elif [[ -f "$search_dir/package-lock.json" ]]; then
    echo "npm"
    return
  fi

  # If search_dir is different from repo_root, check repo root too
  if [[ "$search_dir" != "$repo_root" ]]; then
    if [[ -f "$repo_root/pnpm-lock.yaml" ]]; then
      echo "pnpm"
      return
    elif [[ -f "$repo_root/yarn.lock" ]]; then
      echo "yarn"
      return
    elif [[ -f "$repo_root/bun.lockb" ]]; then
      echo "bun"
      return
    elif [[ -f "$repo_root/package-lock.json" ]]; then
      echo "npm"
      return
    fi
  fi

  # No lock file found
  echo "unknown (ask for clarification if package operations are pending)"
}

detect_python_package_manager() {
  local search_dir="$1"
  local repo_root="$2"

  # Check current directory first
  if [[ -f "$search_dir/poetry.lock" ]] || ( [[ -f "$search_dir/pyproject.toml" ]] && grep -q '\[tool\.poetry\]' "$search_dir/pyproject.toml" 2>/dev/null ); then
    echo "poetry"
    return
  elif [[ -f "$search_dir/Pipfile.lock" ]] || [[ -f "$search_dir/Pipfile" ]]; then
    echo "pipenv"
    return
  elif [[ -f "$search_dir/pyproject.toml" ]] && grep -q '\[tool\.pdm\]' "$search_dir/pyproject.toml" 2>/dev/null; then
    echo "pdm"
    return
  elif [[ -f "$search_dir/requirements.txt" ]]; then
    echo "pip"
    return
  fi

  # If search_dir is different from repo_root, check repo root too
  if [[ "$search_dir" != "$repo_root" ]]; then
    if [[ -f "$repo_root/poetry.lock" ]] || ( [[ -f "$repo_root/pyproject.toml" ]] && grep -q '\[tool\.poetry\]' "$repo_root/pyproject.toml" 2>/dev/null ); then
      echo "poetry"
      return
    elif [[ -f "$repo_root/Pipfile.lock" ]] || [[ -f "$repo_root/Pipfile" ]]; then
      echo "pipenv"
      return
    elif [[ -f "$repo_root/pyproject.toml" ]] && grep -q '\[tool\.pdm\]' "$repo_root/pyproject.toml" 2>/dev/null; then
      echo "pdm"
      return
    elif [[ -f "$repo_root/requirements.txt" ]]; then
      echo "pip"
      return
    fi
  fi

  # No package manager detected
  echo "unknown (ask for clarification if package operations are pending)"
}

extract_package_name_from_setup_py() {
  local setup_file="$1"

  # Try to extract name parameter from setup() call
  # Handles both name="pkg" and name='pkg' formats
  local pkg_name=$(grep -E '^\s*name\s*=' "$setup_file" 2>/dev/null | \
    sed -E 's/.*name\s*=\s*["\047]([^"'\'']+)["\047].*/\1/' | \
    head -n 1)

  echo "$pkg_name"
}

extract_python_scripts() {
  local config_file="$1"
  local config_type="$2"
  local scripts=""

  case "$config_type" in
    pyproject.toml)
      # Extract from [project.scripts] (PEP 621)
      if grep -q '^\[project\.scripts\]' "$config_file" 2>/dev/null; then
        local project_scripts=$(sed -n '/^\[project\.scripts\]/,/^\[/p' "$config_file" | \
          grep -E '^[[:space:]]*[a-zA-Z0-9_-]+[[:space:]]*=' | \
          sed -E 's/^[[:space:]]*([a-zA-Z0-9_-]+)[[:space:]]*=.*/\1/' | \
          grep -v '^\[' | \
          tr '\n' ',' | sed 's/,$//')
        scripts="$project_scripts"
      fi

      # Extract from [tool.poetry.scripts]
      if grep -q '^\[tool\.poetry\.scripts\]' "$config_file" 2>/dev/null; then
        local poetry_scripts=$(sed -n '/^\[tool\.poetry\.scripts\]/,/^\[/p' "$config_file" | \
          grep -E '^[[:space:]]*[a-zA-Z0-9_-]+[[:space:]]*=' | \
          sed -E 's/^[[:space:]]*([a-zA-Z0-9_-]+)[[:space:]]*=.*/\1/' | \
          grep -v '^\[' | \
          tr '\n' ',' | sed 's/,$//')
        if [[ -n "$scripts" && -n "$poetry_scripts" ]]; then
          scripts="$scripts, $poetry_scripts"
        elif [[ -n "$poetry_scripts" ]]; then
          scripts="$poetry_scripts"
        fi
      fi

      # Extract from [tool.poe.tasks] (Poe the Poet)
      if grep -q '^\[tool\.poe\.tasks' "$config_file" 2>/dev/null; then
        local poe_scripts=$(sed -n '/^\[tool\.poe\.tasks/,/^\[/p' "$config_file" | \
          grep -E '^[[:space:]]*[a-zA-Z0-9_-]+[[:space:]]*=' | \
          sed -E 's/^[[:space:]]*([a-zA-Z0-9_-]+)[[:space:]]*=.*/\1/' | \
          grep -v '^\[' | \
          tr '\n' ',' | sed 's/,$//')
        if [[ -n "$scripts" && -n "$poe_scripts" ]]; then
          scripts="$scripts, $poe_scripts"
        elif [[ -n "$poe_scripts" ]]; then
          scripts="$poe_scripts"
        fi
      fi

      # Extract from [tool.pdm.scripts]
      if grep -q '^\[tool\.pdm\.scripts\]' "$config_file" 2>/dev/null; then
        local pdm_scripts=$(sed -n '/^\[tool\.pdm\.scripts\]/,/^\[/p' "$config_file" | \
          grep -E '^[[:space:]]*[a-zA-Z0-9_-]+[[:space:]]*=' | \
          sed -E 's/^[[:space:]]*([a-zA-Z0-9_-]+)[[:space:]]*=.*/\1/' | \
          grep -v '^\[' | \
          tr '\n' ',' | sed 's/,$//')
        if [[ -n "$scripts" && -n "$pdm_scripts" ]]; then
          scripts="$scripts, $pdm_scripts"
        elif [[ -n "$pdm_scripts" ]]; then
          scripts="$pdm_scripts"
        fi
      fi
      ;;

    Pipfile)
      # Extract from [scripts] section
      if grep -q '^\[scripts\]' "$config_file" 2>/dev/null; then
        scripts=$(sed -n '/^\[scripts\]/,/^\[/p' "$config_file" | \
          grep -E '^[[:space:]]*[a-zA-Z0-9_-]+[[:space:]]*=' | \
          sed -E 's/^[[:space:]]*([a-zA-Z0-9_-]+)[[:space:]]*=.*/\1/' | \
          grep -v '^\[' | \
          tr '\n' ',' | sed 's/,$//')
      fi
      ;;

    setup.py)
      # Extract console_scripts from entry_points
      if grep -q 'console_scripts' "$config_file" 2>/dev/null; then
        scripts=$(grep -A 10 'console_scripts' "$config_file" | \
          grep -oE '[a-zA-Z0-9_-]+[[:space:]]*=' | \
          sed -E 's/([a-zA-Z0-9_-]+)[[:space:]]*=.*/\1/' | \
          tr '\n' ',' | sed 's/,$//')
      fi
      ;;
  esac

  echo "$scripts"
}

# walks upward from $1 (default pwd), returning the first ancestor that holds
# any common project marker; stops at $HOME or /; falls back to start_dir
find_project_root() {
  local dir="${1:-$(pwd)}"
  local markers=(
    package.json pnpm-workspace.yaml deno.json bun.lock
    pyproject.toml setup.py setup.cfg Pipfile poetry.lock
    Cargo.toml go.mod
    pom.xml build.gradle build.gradle.kts
    Gemfile composer.json
    .code-spec
  )
  local stop="${HOME:-/}"
  local marker

  while [[ -n "$dir" && "$dir" != "/" ]]; do
    for marker in "${markers[@]}"; do
      if [[ -e "$dir/$marker" ]]; then
        printf '%s\n' "$dir"
        return 0
      fi
    done
    [[ "$dir" == "$stop" ]] && break
    dir="$(dirname "$dir")"
  done

  printf '%s\n' "${1:-$(pwd)}"
}

# returns the VCS workspace root for $1 (default pwd): git toplevel, else
# jj workspace root, else empty string when neither is available
find_monorepo_root() {
  local start="${1:-$(pwd)}"

  if (cd "$start" 2>/dev/null && git rev-parse --git-dir >/dev/null 2>&1); then
    (cd "$start" && git rev-parse --show-toplevel)
    return 0
  fi

  if command -v jj >/dev/null 2>&1; then
    local jj_root
    if jj_root=$(cd "$start" 2>/dev/null && jj workspace root 2>/dev/null); then
      [[ -n "$jj_root" ]] && printf '%s\n' "$jj_root" && return 0
    fi
  fi

  printf '\n'
}

# lists markdown files at $1 (root) plus its immediate subdirectories, ordered
# README -> curated docs -> remaining root *.md -> depth-1 *.md; emits "- <rel>"
# bullets on stdout AND the absolute paths on FD 3 for caller-side dedupe;
# $2 is a newline-delimited set of absolute paths to skip
_collect_markdown() {
  local root="$1"
  local exclude_abs="$2"

  local curated=(README.md CONTEXT.md DESIGN.md PLAN.md NOTES.md REQUIREMENTS.md DATA.md UI.md REFERENCE.md)
  local exclude_dirs=(.git .jj .hg .svn node_modules .venv venv dist build out .next .turbo .cache coverage .code-spec)

  local ordered=()
  local seen=$'\n'"$exclude_abs"$'\n'
  local name abs

  # 1. Curated, root-level, in order (README first).
  for name in "${curated[@]}"; do
    abs="$root/$name"
    if [[ -f "$abs" ]] && [[ "$seen" != *$'\n'"$abs"$'\n'* ]]; then
      ordered+=("$abs")
      seen+="$abs"$'\n'
    fi
  done

  # 2. Remaining *.md at root.
  while IFS= read -r abs; do
    [[ -z "$abs" ]] && continue
    [[ "$seen" == *$'\n'"$abs"$'\n'* ]] && continue
    ordered+=("$abs")
    seen+="$abs"$'\n'
  done < <(find "$root" -maxdepth 1 -type f -iname '*.md' 2>/dev/null | LC_ALL=C sort -f)

  # 3. *.md one level down, with exclusions.
  local prune=()
  for name in "${exclude_dirs[@]}"; do
    prune+=(-path "$root/$name" -prune -o)
  done
  while IFS= read -r abs; do
    [[ -z "$abs" ]] && continue
    [[ "$seen" == *$'\n'"$abs"$'\n'* ]] && continue
    ordered+=("$abs")
    seen+="$abs"$'\n'
  done < <(find "$root" -mindepth 2 -maxdepth 2 "${prune[@]}" -type f -iname '*.md' -print 2>/dev/null | LC_ALL=C sort -f)

  local rel
  for abs in "${ordered[@]}"; do
    rel="${abs#"$root"/}"
    printf -- '- %s\n' "$rel"
    printf '%s\n' "$abs" >&3
  done
}

# renders the "## Target Repo Documents" section for $1 (project root) and an
# optional "## Monorepo Documents" section for $2; paths listed under the
# project section are suppressed from the monorepo section by absolute-path
# dedupe so each file appears at most once
get_repo_root_documents_context() {
  local project_root="$1"
  local monorepo_root="$2"
  local context=""

  local project_abs
  project_abs="$(mktemp)"
  local project_lines
  project_lines="$(_collect_markdown "$project_root" "" 3>"$project_abs")"

  if [[ -n "$project_lines" ]]; then
    context+="## Target Repo Documents\n\n${project_lines}\n"
  fi

  if [[ -n "$monorepo_root" ]]; then
    local exclude_abs
    exclude_abs="$(cat "$project_abs")"
    local mono_abs
    mono_abs="$(mktemp)"
    local mono_lines
    mono_lines="$(_collect_markdown "$monorepo_root" "$exclude_abs" 3>"$mono_abs")"
    rm -f "$mono_abs"
    if [[ -n "$mono_lines" ]]; then
      context+="## Monorepo Documents\n\n${mono_lines}\n"
    fi
  fi

  rm -f "$project_abs"
  echo -n "$context"
}

get_plugin_context() {
  local context=""
  local current_dir="$(pwd)"

  local PROJECT_ROOT
  PROJECT_ROOT="$(find_project_root "$current_dir")"

  local MONOREPO_ROOT
  MONOREPO_ROOT="$(find_monorepo_root "$current_dir")"

  # single root when the project sits at the VCS top
  if [[ "$MONOREPO_ROOT" == "$PROJECT_ROOT" ]]; then
    MONOREPO_ROOT=""
  fi

  # existing Node/Python detection below keys off REPO_ROOT (= PROJECT_ROOT)
  local REPO_ROOT="$PROJECT_ROOT"

  context+="## Project\n\n**Root**: $PROJECT_ROOT\n\n"

  # Node.js Project
  if [[ -f "package.json" ]] || [[ -f "$REPO_ROOT/package.json" ]]; then
    local pkg_json="package.json"
    if [[ ! -f "$pkg_json" ]] && [[ -f "$REPO_ROOT/package.json" ]]; then
      pkg_json="$REPO_ROOT/package.json"
    fi

    local project_name=$(jq -r '.name // "unknown"' "$pkg_json" 2>/dev/null || echo "unknown")
    local project_version=$(jq -r '.version // "0.0.0"' "$pkg_json" 2>/dev/null || echo "0.0.0")
    local package_manager=$(detect_node_package_manager "$current_dir" "$REPO_ROOT")

    context+="### Node.js Project\n\n"
    context+="**Name**: $project_name\n"
    context+="**Version**: $project_version\n"
    context+="**Package Manager**: $package_manager\n"

    if jq -e '.scripts' "$pkg_json" >/dev/null 2>&1; then
      local scripts=$(jq -r '.scripts | keys | join(", ")' "$pkg_json" 2>/dev/null || echo "none")
      context+="**Available Scripts**: $scripts\n"
    fi
    context+="\n"
  fi

  # Python Project
  if [[ -f "requirements.txt" || -f "pyproject.toml" || -f "setup.py" || -f "Pipfile" || -f "poetry.lock" ]] || \
     [[ -f "$REPO_ROOT/requirements.txt" || -f "$REPO_ROOT/pyproject.toml" || -f "$REPO_ROOT/setup.py" || -f "$REPO_ROOT/Pipfile" || -f "$REPO_ROOT/poetry.lock" ]]; then

    local package_manager=$(detect_python_package_manager "$current_dir" "$REPO_ROOT")
    local project_name=""
    local python_scripts=""

    context+="## Python Project\n\n"

    if [[ -f "pyproject.toml" ]] || [[ -f "$REPO_ROOT/pyproject.toml" ]]; then
      local pyproject_file="pyproject.toml"
      if [[ ! -f "$pyproject_file" ]] && [[ -f "$REPO_ROOT/pyproject.toml" ]]; then
        pyproject_file="$REPO_ROOT/pyproject.toml"
      fi

      # Try to extract name from pyproject.toml
      project_name=$(grep -E '^name\s*=' "$pyproject_file" 2>/dev/null | sed -E 's/^[^"'\'']*["\047]([^"'\'']+)["\047].*$/\1/' || echo "")

      # Extract available scripts
      python_scripts=$(extract_python_scripts "$pyproject_file" "pyproject.toml")

      context+="**Config**: pyproject.toml\n"
    elif [[ -f "setup.py" ]] || [[ -f "$REPO_ROOT/setup.py" ]]; then
      local setup_file="setup.py"
      if [[ ! -f "$setup_file" ]] && [[ -f "$REPO_ROOT/setup.py" ]]; then
        setup_file="$REPO_ROOT/setup.py"
      fi

      # Try to extract name from setup.py
      project_name=$(extract_package_name_from_setup_py "$setup_file")

      # Extract console_scripts
      python_scripts=$(extract_python_scripts "$setup_file" "setup.py")

      context+="**Config**: setup.py\n"
    fi

    # Check for Pipfile scripts
    if [[ -f "Pipfile" ]] || [[ -f "$REPO_ROOT/Pipfile" ]]; then
      local pipfile="Pipfile"
      if [[ ! -f "$pipfile" ]] && [[ -f "$REPO_ROOT/Pipfile" ]]; then
        pipfile="$REPO_ROOT/Pipfile"
      fi

      local pipfile_scripts=$(extract_python_scripts "$pipfile" "Pipfile")
      if [[ -n "$pipfile_scripts" ]]; then
        if [[ -n "$python_scripts" ]]; then
          python_scripts="$python_scripts, $pipfile_scripts"
        else
          python_scripts="$pipfile_scripts"
        fi
      fi
    fi

    # Display project name if found
    if [[ -n "$project_name" ]]; then
      context+="**Name**: $project_name\n"
    fi

    context+="**Package Manager**: $package_manager\n"

    # Display available scripts if found
    if [[ -n "$python_scripts" ]]; then
      context+="**Available Scripts**: $python_scripts\n"
    fi

    context+="\n"
  fi

  if [[ -n "$MONOREPO_ROOT" ]]; then
    context+="## Monorepo\n\n**Root**: $MONOREPO_ROOT\n\n"
  fi

  context+=$(get_repo_root_documents_context "$PROJECT_ROOT" "$MONOREPO_ROOT")

  # Agent Capabilities
  local agent_capabilities=""

  # Detect Agent Teams support
  if [[ "${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-}" == "1" ]]; then
    agent_capabilities+="**Agent Teams**: enabled\n"
  fi

  # Only add section if any capabilities detected
  if [[ -n "$agent_capabilities" ]]; then
    context+="## Agent Capabilities\n\n"
    context+="$agent_capabilities"
    context+="\n"
  fi

  echo -n "$context"
}
