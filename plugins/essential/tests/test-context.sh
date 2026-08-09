#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../hooks/scripts" && pwd)"
# shellcheck source=plugins/essential/hooks/scripts/context.sh
source "$SCRIPT_DIR/context.sh"

fixture="$(mktemp -d)"
trap 'rm -rf "$fixture"' EXIT

git init -q "$fixture"
git -C "$fixture" symbolic-ref HEAD refs/heads/main

mkdir -p \
  "$fixture/.state/works/eng-42/state" \
  "$fixture/.state/works/eng-99/state" \
  "$fixture/docs/architecture/decisions" \
  "$fixture/docs/design/system" \
  "$fixture/docs/specs/accounts" \
  "$fixture/docs/specs/payments"

touch \
  "$fixture/README.md" \
  "$fixture/.gitignore" \
  "$fixture/CONTEXT.md" \
  "$fixture/DESIGN.md" \
  "$fixture/PLAN.md" \
  "$fixture/NOTES.md" \
  "$fixture/.state/works/eng-42/state/working.md" \
  "$fixture/.state/works/eng-42/state.md" \
  "$fixture/.state/works/eng-42/decisions.md" \
  "$fixture/.state/works/eng-99/state/working.md" \
  "$fixture/.state/works/eng-99/state.md" \
  "$fixture/docs/README.md" \
  "$fixture/docs/architecture/README.md" \
  "$fixture/docs/architecture/runtime-boundaries.md" \
  "$fixture/docs/architecture/LEGACY.md" \
  "$fixture/docs/architecture/decisions/0001-runtime.md" \
  "$fixture/docs/design/README.md" \
  "$fixture/docs/design/system.md" \
  "$fixture/docs/design/checkout-flow.md" \
  "$fixture/docs/design/LEGACY.md" \
  "$fixture/docs/design/system/10-tokens.md" \
  "$fixture/docs/specs/README.md" \
  "$fixture/docs/specs/accounts/README.md" \
  "$fixture/docs/specs/accounts/session.md" \
  "$fixture/docs/specs/payments/README.md" \
  "$fixture/docs/specs/payments/error-contract.md" \
  "$fixture/docs/specs/payments/UPPER.md"

printf '.state/\n' > "$fixture/.gitignore"

# Simulate a case-insensitive alias by giving the second spelling the same
# filesystem identity. Bootstrap must emit the onboarding file only once.
if [[ ! -e "$fixture/readme.md" ]]; then
  ln "$fixture/README.md" "$fixture/readme.md"
fi

export ENGINEERING_WORK_ID=eng-42
output="$(get_repo_root_documents_context "$fixture")"
unset ENGINEERING_WORK_ID

assert_contains() {
  case "$output" in
    *"$1"*) ;;
    *) printf 'missing expected path: %s\n' "$1" >&2; exit 1 ;;
  esac
}

assert_absent() {
  case "$output" in
    *"$1"*) printf 'unexpected legacy/detail path: %s\n' "$1" >&2; exit 1 ;;
    *) ;;
  esac
}

assert_before() {
  local first="$1" second="$2" positions first_line second_line
  positions="$(printf '%s\n' "$output" | grep -n -F -e "$first" -e "$second")"
  first_line="$(printf '%s\n' "$positions" | grep -F "$first" | cut -d: -f1)"
  second_line="$(printf '%s\n' "$positions" | grep -F "$second" | cut -d: -f1)"
  if [[ -z "$first_line" || -z "$second_line" || "$first_line" -ge "$second_line" ]]; then
    printf 'expected %s before %s\n' "$first" "$second" >&2
    exit 1
  fi
}

case "$output" in
  *'\n'*) printf 'context contains a literal \\n escape\n' >&2; exit 1 ;;
  *) ;;
esac

assert_contains '- README.md'
assert_contains '- .state/works/eng-42/state/working.md'
assert_contains '- .state/works/eng-42/state.md'
assert_absent '.state/works/eng-99/state/working.md'
assert_absent '.state/works/eng-99/state.md'
assert_contains '- docs/README.md'
assert_contains '- docs/architecture/README.md'
assert_contains '- docs/design/README.md'
assert_contains '- docs/specs/README.md'
assert_absent 'docs/design/system.md'
assert_absent 'docs/specs/accounts/README.md'
assert_absent 'docs/specs/payments/README.md'

assert_absent 'CONTEXT.md'
assert_absent 'DESIGN.md'
assert_absent 'PLAN.md'
assert_absent 'NOTES.md'
assert_absent '.state/works/eng-42/decisions.md'
assert_absent 'docs/architecture/LEGACY.md'
assert_absent 'docs/architecture/runtime-boundaries.md'
assert_absent 'docs/architecture/decisions/0001-runtime.md'
assert_absent 'docs/design/LEGACY.md'
assert_absent 'docs/design/checkout-flow.md'
assert_absent 'docs/design/system/10-tokens.md'
assert_absent 'docs/specs/payments/UPPER.md'
assert_absent 'docs/specs/accounts/session.md'
assert_absent 'docs/specs/payments/error-contract.md'

readme_count="$(printf '%s\n' "$output" | grep -Eic '^- readme\.md$')"
if [[ "$readme_count" -ne 1 ]]; then
  printf 'expected one README identity, got %s\n' "$readme_count" >&2
  exit 1
fi

assert_before '.state/works/eng-42/state/working.md' '.state/works/eng-42/state.md'
assert_before '.state/works/eng-42/state.md' 'docs/README.md'
assert_before 'docs/README.md' 'docs/architecture/README.md'
assert_before 'docs/architecture/README.md' 'docs/design/README.md'
assert_before 'docs/design/README.md' 'docs/specs/README.md'

ambiguous_output="$(get_repo_root_documents_context "$fixture")"
case "$ambiguous_output" in
  *'.state/works/eng-42/state/working.md'*|*'.state/works/eng-42/state.md'*|*'.state/works/eng-99/state/working.md'*|*'.state/works/eng-99/state.md'*)
    printf 'ambiguous work detail must not be injected without an active ID\n' >&2
    exit 1
    ;;
esac
case "$ambiguous_output" in
  *'Engineering work selection is unresolved; ask only when artifact work begins.'*) ;;
  *) printf 'ambiguous work selection notice missing\n' >&2; exit 1 ;;
esac

printf 'essential context discovery tests passed\n'
