#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIRECTORY="$(cd "$(dirname "$0")" && pwd)"
exec bun run "$SCRIPT_DIRECTORY/install_agents.ts" "$@"
