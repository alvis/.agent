#!/usr/bin/env bash
set -euo pipefail

# Stable allowed-tools entrypoint for the dependency-free scoped-save validator.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bun run "$SCRIPT_DIR/validate_scoped_save.ts" "$@"
