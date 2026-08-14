# MDC Syntax Reference

Authoritative grammar for MDC (Contextual Markdown, `@theriety/mdc` dialect). Mirrors the package grammar and parser behaviour. Loaded by the skill in every mode.

---

## 1. Document Structure

An MDC document is:

```
document       ::= front_matter? block*
front_matter   ::= '---' NL yaml NL '---' NL
block          ::= block_annotation? content children? closing_marker?
block_annotation ::= '{{ ' yaml_params ' }}' NL
content        ::= heading | item | todo | quote | code_fence | table | layout | paragraph
children       ::= (INDENT block)+
closing_marker ::= '--{ ref: ' ref_value ' }--' NL?
INDENT         ::= '  '   (* exactly 2 spaces per nesting level *)
```

### Front Matter

- Optional. When present, must be the **first content** in the document — no preceding whitespace, no preceding lines.
- Delimiters are exactly `---` alone on a line (open and close).
- Body is **standard YAML**. All YAML scalar / mapping / sequence forms are valid.
- Anything after the closing `---` is the page body.

```markdown
---
title: Quarterly Review
ref: review-2026-q1
tags: [finance, q1]
owner:
  - name: Jane Doe
    email: jane@example.com
---

# First block starts here
```

---

## 2. Block Annotations

A block annotation attaches metadata to the **immediately following** block. It is on its own line and starts with `{{` and ends with `}}`.

```
{{ param1: value1, param2: value2 }}
```

**Placement rules**

- Annotation MUST be on the line **immediately preceding** its target block.
- **No blank line** between the annotation and the block it modifies. A blank line detaches the annotation — this is the single most common LLM-edit failure mode.
- One annotation per block; pack multiple parameters into the same `{{ }}`.

**With comment**

```
{{ ref: header, type: heading } # main section heading }
```

The `#` and following text are a YAML end-of-line comment; the outer `}}` still closes the annotation.

---

## 3. Inline Annotations

Inline annotations wrap a span **within** a line of text.

```
[content]{{ key: value, ... }}
[text](url){{ key: value, ... }}
[]{{ type: marker }}
```

- The `[…]` (or `[…](url)`) is the visible content; the trailing `{{ … }}` carries metadata.
- No whitespace between the closing `]` (or `)`) and the opening `{{`.
- Empty-content form `[]{{ type: x }}` is used for pure-type markers.
- Can be combined with all standard Markdown inline formatting (`**bold**`, `_italic_`, `~~strike~~`, `` `code` `` , `$math$`).

```markdown
The revenue increased by [+12%]{{ trend: positive, delta: 0.12 }}.
See [API Documentation](https://example.com/doc){{ verified: true }}.
The **[critical value]{{ severity: high }}** must not be exceeded.
```

---

## 4. Block Type Inference

Block type is inferred from Markdown syntax unless overridden by an explicit `type:` parameter.

| Markdown prefix       | Inferred type           | Example             |
| --------------------- | ----------------------- | ------------------- |
| `#`                   | `heading` (depth 1)     | `# Title`           |
| `##`                  | `heading` (depth 2)     | `## Section`        |
| `###`                 | `heading` (depth 3)     | `### Subsection`    |
| `-` or `*`            | `item` (unordered)      | `- Item`            |
| `1.` (number + dot)   | `item` (ordered)        | `1. First`          |
| `- [ ]`               | `todo` (unchecked)      | `- [ ] Task`        |
| `- [x]`               | `todo` (checked)        | `- [x] Done`        |
| `>`                   | `quote`                 | `> Quote text`      |
| ` ``` `               | `code`                  | fenced code block   |
| `\|` with separator   | `table`                 | pipe-delimited grid |
| `\|` without separator| `layout`                | pipe grid w/o sep   |
| _(none)_              | `paragraph`             | plain text          |

Override the inferred type by setting `type:` in the annotation:

```markdown
{{ type: callout, icon: ⚠️ }}
This paragraph is now a callout block.
```

### Inline AST inference

| Markdown                 | Inferred node                                                |
| ------------------------ | ------------------------------------------------------------ |
| `plain text`             | `{ type: 'text', text: '…' }`                                |
| `**bold**`               | `{ type: 'text', formats: ['bold'] }`                        |
| `_italic_` / `*italic*`  | `{ type: 'text', formats: ['italic'] }`                      |
| `~~strike~~`             | `{ type: 'text', formats: ['strikethrough'] }`               |
| `` `code` ``             | `{ type: 'text', formats: ['code'] }`                        |
| `[text](url)`            | `{ type: 'link', text: '…', link: '…' }`                     |
| `$expr$`                 | `{ type: 'equation', expression: '…' }`                      |
| `[c]{{ … }}`             | `{ type: 'meta', text: 'c', annotations: {…} }`              |
| `[t](u){{ … }}`          | `{ type: 'link', text: 't', link: 'u', annotations: {…} }`   |
| `[]{{ type: x }}`        | `{ type: 'x', text: '', annotations: {…} }`                  |

Formats can be nested (`**_bold italic_**` → `['bold', 'italic']`).

---

## 5. Indentation & Nesting

- **2 spaces per nesting level. No tabs.**
- Indentation is **cumulative**: depth 3 = 6 leading spaces.
- A child block must be indented **exactly one level deeper** than its parent.
- Blank lines inside an indented section preserve hierarchy as long as the next non-blank line is indented.

```markdown
{{ type: callout, icon: 📌 }}
Important notice
This paragraph is a child of the callout.

- And this list is also inside the callout
  - Nested item (4 spaces)
```

Consecutive list items wrap automatically in a `list` container; nested items create nested `list` nodes.

---

## 6. Tables and Layouts

Both use pipe syntax. The presence of a `|---|` separator row distinguishes them.

**Table** — with separator row:

```markdown
| Name  | Score |
|-------|-------|
| Alice | 95    |
| Bob   | 87    |
```

**Layout** — without separator row:

```markdown
| Column 1  | Column 2  |
| Content A | Content B |
```

**Alignment** in tables — colons in the separator row:

| Syntax     | Alignment |
| ---------- | --------- |
| `---`      | default   |
| `:---`     | left      |
| `:---:`    | center    |
| `---:`     | right     |

**Layouts with column-level annotations**:

```markdown
{{ type: layout }}
| {{ ref: col1 }} | {{ ref: col2 }} |
| Content A       | Content B       |
```

---

## 7. Parameter Value Syntax (YAML inside `{{ }}`)

The body of `{{ … }}` is **standard YAML object syntax**. Anything a YAML parser accepts as a mapping body works.

| Type             | Form                          | Example                       |
| ---------------- | ----------------------------- | ----------------------------- |
| unquoted string  | no spaces / special chars     | `color: red`                  |
| quoted string    | single or double quotes       | `title: 'Hello World'`        |
| number           | int or float                  | `count: 42`, `ratio: 3.14`    |
| boolean          | `true` / `false` (unquoted)   | `collapsed: true`             |
| array            | square brackets               | `tags: [a, b, c]`             |
| null             | `null` or `~`                 | `value: null`                 |
| nested object    | inline braces or YAML flow    | `style: { color: green }`     |

YAML escape rules apply inside quoted strings (`\'`, `\"`, `\\`).

End-of-line `#` comments are supported inside the outer braces:

```
{{ ref: header } # main section }
```

---

## 8. Escaping

Escape these only outside fenced code (code fences are parser-opaque):

| Render literally | Write           |
| ---------------- | --------------- |
| `{{`             | `\{\{`          |
| `}}`             | `\}\}`          |
| `[`              | `\[`            |
| `]`              | `\]`            |
| `\`              | `\\`            |

Inside ` ```…``` ` no escaping is required:

````markdown
```javascript
const annotation = `{{ type: 'callout' }}`;
```
````

---

## 9. Standard Parameters

**Block-level**

| Parameter | Type   | Purpose                                                 |
| --------- | ------ | ------------------------------------------------------- |
| `ref`     | string | stable identifier — addressing primitive for diff/links |
| `type`    | string | explicit block-type override                            |

**Inline**

| Parameter | Type | Purpose                                              |
| --------- | ---- | ---------------------------------------------------- |
| `type`    | str  | inline annotation type (defaults to `meta`)          |
| _(any)_   | any  | arbitrary domain-specific metadata                   |

Any other key is a domain-specific parameter (Notion, spreadsheet, medical, etc.) and is passed through verbatim.

---

## 10. Quick Reference

```
---                                # front matter open
key: value
---                                # front matter close

{{ ref: id, type: callout }}        # block annotation (no blank line before block)
Content of the block.

  {{ ref: child-id }}              # child annotation (indent matches child block)
  - Child item                     # child block (2 spaces)
--{ ref: id }--                    # optional closing marker (matches parent ref)

The figure is [+12%]{{ trend: up }} this quarter.   # inline annotation
```
