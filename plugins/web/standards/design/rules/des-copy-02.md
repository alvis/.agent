# DES-COPY-02: Error Messages

## Intent

Error messages must follow problem + cause + solution structure. Write from the user's task perspective, not implementation details. No technical jargon or error codes in user-facing messages.

## Fix

- Structure: "What happened" + "Why" (if safe to disclose) + "What to do"
- Example: "Your file couldn't be uploaded. It exceeds the 10MB limit. Try compressing the image or choosing a smaller file."
- Anti-example: "Error 413: Request entity too large"
- Preserve user input on form validation errors
- Place error messages near the field or action that caused them
- Provide a retry action when applicable

## Code Superpowers

- Check error message patterns — flag generic messages ("Something went wrong", "An error occurred")
- Look for error codes displayed to users (HTTP status codes, internal error codes)
- Verify form error messages are placed adjacent to their fields

## Common Mistakes

1. Generic error messages: "Something went wrong" without guidance
2. Technical error codes or HTTP status shown to users
3. Error messages far from the field that caused them
4. Form errors that clear user input on submission

## Edge Cases

- Security-sensitive errors (auth failures) should be vague intentionally to prevent enumeration
- API rate limiting errors may need technical guidance for developer-facing tools

## Related

DES-COPY-01, DES-STAT-01
