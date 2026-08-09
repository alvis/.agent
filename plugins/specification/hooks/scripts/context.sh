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

get_plugin_context() {
  local context=""
  local current_dir="$(pwd)"

  # Determine repository root
  local REPO_ROOT
  if git rev-parse --git-dir >/dev/null 2>&1; then
    REPO_ROOT=$(git rev-parse --show-toplevel)
  else
    REPO_ROOT="$current_dir"
  fi

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

  echo -n "$context"
}
