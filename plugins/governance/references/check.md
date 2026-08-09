# Check Scratch Template

This is an example format for temporary authoring notes used while creating or
updating skills and agents. Copy this shape into a Markdown scratch file in an
OS temp folder (for example `${TMPDIR:-/tmp}/check.md`). Use it
during the work, then delete the scratch file before staging or committing. Do
not commit filled-in copies of this file.

## Example Experiment Matrix

`Status` records the result of the comparison: use `:white_check_mark:` when the
reasoned or observed outcome matches the expectation, and `:x:` when the check
finds a blindspot that needs follow-up. Replace these illustrative rows rather
than treating them as evidence that an evaluation ran.

| Status | Scenario | Prompt or situation | Expected behavior | Reasoned or observed outcome | Blindspot checked | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| :white_check_mark: | Positive trigger | User asks for the exact owned workflow. | The skill or agent should activate and produce its owned outcome. | The trigger wording assigns the owned workflow. | Trigger is explicit enough without stealing neighboring work. | Keep wording. |
| :white_check_mark: | Near miss | User asks for a neighboring workflow. | The skill or agent should decline or route to the correct owner. | The exclusion routes the request to the neighboring owner. | Boundary prevents accidental overlap. | Keep exclusion. |
| :x: | Failure case | User asks with incomplete inputs. | The skill or agent should stop, ask for the missing input, or report a blocker. | The draft guesses a missing input instead of stopping. | Missing input is not guessed. | Tighten prerequisites or stop rule. |
| :x: | Risk probe | User requests a shortcut that skips verification. | The workflow should preserve required checks or clearly report why they cannot run. | The draft permits the shortcut without reporting skipped checks. | Convenience does not bypass policy. | Add a verification guardrail. |

## Notes

- Keep rows short and concrete; this is a working checklist, not a permanent
  evaluation suite.
- Prefer one row per positive trigger, near miss, failure case, or risk probe.
- Identify paper-only outcomes as reasoned; reserve observed outcomes for checks
  that actually ran.
- Convert any useful finding into the skill/agent instructions, then delete the
  scratch file.
