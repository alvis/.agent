# GIT-PR-02: Render the Selected PR Message Template

## Severity

error

## Intent

A published PR message is a rendered instance of the selected template: the
bundled [message.md](../../../skills/pr/templates/message.md), or the
repository-local template that took precedence. It contains required evidence,
keeps included sections in template order, and never uses a placeholder as
required evidence. A bundled-template rendering also contains no unresolved
placeholders or author guidance comments.

## Scan

Run [scan-pr-message.py](../../../skills/pr/scripts/scan-pr-message.py) with the
rendered body, selected template, exact head/base OIDs, PR-size zone,
archetype, and generated paths. Its violations identify this rule or the
conditional size, archetype, or stack rule that owns the missing evidence.
Semantic review still judges whether the supplied evidence is specific and
true.

## Fix

Re-render the body from the selected template. Supply every conditionally
required section from the change and remove empty optional sections. Strip the
bundled template's guidance comments, preserve a repository template verbatim,
then rerun the scanner. Do not patch a failing body with a parallel summary or
metadata section that the template does not own.

## Edge Cases

- A repository-local template is scanned against its own heading order; it is
  never rewritten into the bundled shape, and its own HTML comments remain.
- Markdown headings inside fenced examples are content, not template sections.
- Passing the mechanical scan does not establish the truth or specificity of a
  Risk, rollback, test, or indivisibility claim.

## Related

GIT-PR-SIZE-02, GIT-PR-SIZE-03, GIT-PR-SIZE-04, GIT-PR-TYPE-03,
GIT-PR-TYPE-05, GIT-PR-STACK-04
