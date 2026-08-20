#!/usr/bin/env bash
set -euo pipefail

PR_SKILL_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
CODING_PLUGIN_DIR="$(cd -- "${PR_SKILL_DIR}/../.." && pwd)"

exec bun run "${CODING_PLUGIN_DIR}/scripts/scan_potential_violations.ts" "$@"
