# Closing Markers — Rules and Rationale

Authoritative behaviour for MDC closing markers, derived from `@theriety/mdc` parser and stringifier defaults. Loaded by the skill in `edit` and `author` modes.

---

## 1. What a Closing Marker Is

A closing marker is a single line of the form:

```
--{ ref: <ref-id> }--
```

It marks the **end** of a `ref:`-bearing block. The marker sits at the same indentation level as the block's opening annotation and content.

```markdown
{{ ref: parent }}
- Parent
  {{ ref: child }}
  - Child
  --{ ref: child }--
--{ ref: parent }--
```

The grammar accepts **only `ref`** as the marker's argument. A marker with any other key (or with no argument) is a `ParseError`.

---

## 2. Optional When Parsing — Never Flag As Missing

The parser treats closing markers as **optional**. A block with a `ref:` and children is perfectly legal **without** a marker. The skill must:

- **Reading**: never report "missing closing marker" as a defect, warning, or error.
- **Editing**: never proactively delete an absent marker (it's already absent). Never refuse to read a file because markers are missing.

Indentation alone is sufficient to reconstruct the block tree in the common case. Markers exist for the **uncommon** case where indentation is unreliable — see §4.

---

## 3. Strict Rules When a Marker IS Present

The parser enforces these on every closing marker it sees. The skill must preserve all four when editing:

1. **Single argument only**: `--{ ref: <id> }--`. Anything else → `ParseError: 'Closing marker only accepts ref as its argument'`.
2. **Ref must match**: the marker's `ref` must equal the opening block's `ref`. Mismatch → `ParseError: 'Closing marker ref "X" does not match block ref "Y"'`.
3. **Indent must match**: the marker's leading whitespace must equal the opening block's leading whitespace. Mismatch → `ParseError: 'Closing marker indent must match block indent'`.
4. **One marker per ref-bearing block**: a marker is consumed by exactly one block; you cannot share a marker between two openings.

Relevant parser logic in `src/parser/closing.ts`:

```ts
// closing.ts (excerpt)
if (token.indent === parentClosing?.indent && closingRef === parentClosing.ref) {
  return 'defer';                       // belongs to the parent, not this block
}
if (token.indent !== blockIndent) {
  throw new ParseError('Closing marker indent must match block indent', …);
}
if (!block.ref || closingRef !== block.ref) {
  throw new ParseError(`Closing marker ref "${closingRef}" does not match block ref "${block.ref ?? ''}"`, …);
}
return 'consume';
```

---

## 4. Why Markers Exist — the Resilience Pattern

Markers extend a parent's hierarchical scope **beyond what indentation alone implies**. Concretely, the parser's `shouldStopParsingBlocks` consults the open marker boundary:

```ts
// closing.ts (excerpt)
if (token.indent >= indent) return false;             // still inside the block
return !closing || !hasDeclaredClosingMarker(tokens, position, token.indent);
//                  ^ if a declared child has its own marker further down,
//                    keep parsing — it's still a descendant.
```

In English: when a closing marker is open, **under-indented** content that has its own `ref:` annotation **and** a matching marker further on is still treated as a descendant of the marker-bound parent. This is what makes the marker pattern resilient against LLMs that drop an indent level mid-edit.

Concrete failure mode the marker prevents:

```markdown
{{ ref: parent }}
- Parent
  {{ ref: child }}
- Under-indented child    ← would normally detach from parent
--{ ref: parent }--       ← marker keeps it inside parent's scope
```

Without the marker on `parent`, the under-indented child would be promoted to a sibling. With the marker, the child stays a descendant.

---

## 5. When to Add a Closing Marker

The reference stringifier emits closing markers by default. Specifically, `stringify(ast, { omitClosingMarkers: false })` (the default) emits a marker for **every block that has a `ref:` and at least one child**. The skill mirrors this exactly.

### Reading mode

Do nothing. Preserve as-is.

### Editing mode

- **Preserve** any closing marker that is already present, even if you consider it unnecessary.
- **Add** a closing marker for any block that:
  - has a `ref:` annotation, **and**
  - has (or after the edit will have) at least one child block,
  - and does not already have a marker.
- **Remove** a closing marker when the edit drops the block's last child. A marker on a block with no children is legal but redundant; removing it keeps stringifier-round-trip stable. (If unsure, leave it — the parser tolerates it.)
- **Rename** the marker's `ref` whenever you rename the opening block's `ref`. They must match.

### Author mode

Emit a closing marker by default for every block with `ref:` + children. Skip the marker for ref'd blocks with no children (no value to add), and for unref'd blocks (cannot have a marker).

---

## 6. Marker Placement

The marker goes on its own line, at the **opening block's indentation**, **after the last child** of the block. Examples:

Top-level block:

```markdown
{{ ref: section }}
## Section
  {{ ref: paragraph }}
  Some paragraph text.
--{ ref: section }--
```

Nested block — marker indent matches its block's indent:

```markdown
{{ ref: parent }}
- Parent
  {{ ref: child }}
  - Child
    {{ ref: grandchild }}
    - Grandchild
    --{ ref: grandchild }--
  --{ ref: child }--
--{ ref: parent }--
```

Note that markers stack from innermost to outermost, each at its own block's indentation level.

---

## 7. Checklist

When editing a file with closing markers, verify after the edit:

- [ ] Every existing marker is still present (unless its block lost its last child).
- [ ] Every newly ref-bearing block with children has a matching marker.
- [ ] Each marker's `ref` exactly matches its opening block's `ref` (case-sensitive).
- [ ] Each marker's leading whitespace exactly equals the opening block's leading whitespace.
- [ ] Markers stack from innermost-first (descendants close before ancestors).
- [ ] No marker carries any argument other than `ref:`.
