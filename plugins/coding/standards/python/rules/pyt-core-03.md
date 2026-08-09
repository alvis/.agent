# PYT-CORE-03: Mandated `# type: ignore` Format

**Tool Coverage:** ruff:PGH003 (partial - PGH003 forbids blanket # type: ignore, but does not enforce the "# reason:" justification postfix)

## Intent

Every type-checker suppression MUST name the specific error code AND include a human-readable justification in the exact form `# type: ignore[code]  # reason: <text>` (two spaces between the ignore and the reason comment). Blanket `# type: ignore` hides unrelated errors that appear later; code-only ignores without a reason strand future maintainers guessing why the hatch exists. The mandated format is grep-friendly: `grep -rn "# reason:" src/` enumerates every suppression and its rationale in one pass at review time.

## Fix

```python
# ✅ GOOD: specific code + reason, two spaces before the reason
value = legacy_lib.fetch()  # type: ignore[no-untyped-call]  # reason: legacy_lib 0.4 ships no py.typed marker

config: dict[str, object] = {}
config["port"] = os.getenv("PORT", 8080)  # type: ignore[assignment]  # reason: getenv returns str|int here by design
```

```python
# ❌ BAD: blanket ignore hides every future error on this line
value = legacy_lib.fetch()  # type: ignore

# ❌ BAD: code-only, no reason — maintainer cannot tell if it is still needed
value = legacy_lib.fetch()  # type: ignore[no-untyped-call]

# ❌ BAD: reason present but wrong separator (one space) — breaks the grep workflow
value = legacy_lib.fetch()  # type: ignore[no-untyped-call] # reason: untyped dep
```

### Review-Time Grep Workflow

Because every suppression ends with `  # reason: …`, reviewers and auditors run one command to surface them all:

```bash
grep -rn "# type: ignore\[" src/ | grep -v "# reason:"   # format violations
grep -rn "# reason:" src/                                # full audit inventory
```

The first query finds any ignore missing its justification; the second lists every accepted escape hatch so they can be revisited when the upstream cause is fixed (new stubs land, library adds `py.typed`, etc.).

## Edge Cases

- Multi-line statements: place the comment on the line where the checker reports the error, not the opening line of the statement.
- Mypy codes and ty codes differ — use the code the checker configured for this project emits. Do not invent cross-checker codes.
- For single-use narrowing, prefer `assert isinstance(x, T)` or an explicit `cast`; reserve `# type: ignore` for situations where neither is possible.
- Never disable an entire file with `# type: ignore` at module top. If a module is genuinely untypable, exclude it in the checker config with a comment pointing to the tracking issue.

## Related

PYT-CORE-01, PYT-CORE-02, PYT-CORE-05
