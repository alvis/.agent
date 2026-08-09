# DES-COPY-01: Action Labels

## Intent

Labels must be concise verb-first action descriptions ("Save draft", "Send invite"), never vague words ("Submit", "OK", "Done"). Help text layered progressively: L0=label, L1=placeholder hint, L2=inline help, L3=tooltip/expandable. No jargon. Consistent terminology everywhere.

## Fix

- Button labels: verb + object format ("Save changes", "Create project", "Send invite")
- Never use generic labels: "Submit", "OK", "Done", "Click here", "Confirm"
- Layer help text: start at L0 (label always visible), add deeper layers only when needed
- Use the same word for the same concept everywhere (don't alternate Settings/Preferences/Configuration)
- Write from the user's task perspective, not implementation details

## Code Superpowers

- Search for generic button labels: "Submit", "OK", "Done", "Confirm", "Click here" — flag all
- Check for consistent terminology across navigation labels and page headings
- Verify form labels use verb + object format

## Common Mistakes

1. Vague button labels ("Submit", "OK", "Done") that don't describe the action
2. Inconsistent terminology across screens (Settings vs Preferences)
3. Technical jargon in user-facing copy
4. Redundant or excessive explanatory text

## Edge Cases

- Dialog confirmations may use "OK" for simple acknowledgment (not action) — prefer "Got it" or "Understood"
- Platform conventions (iOS "Done" for navigation) may override this rule

## Related

DES-COPY-02, DES-NAVI-01, DES-CONS-02
