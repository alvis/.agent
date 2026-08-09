# PYT-NAME-01: snake_case for Functions, Variables, Modules

**Tool Coverage:** ruff:N802,N803,N806,N816

## Intent

Use `snake_case` for function names, method names, parameter names, local and instance variables, module filenames, and package directories. PEP 8 makes this the community default; mixing `camelCase` or `PascalCase` into these slots signals the code was ported from Java/JavaScript and hurts readability for every subsequent Python reader.

## Fix

GOOD:
```python
# module: user_service.py (snake_case filename)
from myapp.billing import invoice_total

def create_user(full_name: str, email_address: str) -> User:
    normalized_email = email_address.strip().lower()
    return User(name=full_name, email=normalized_email)

class OrderBook:
    def place_order(self, order_id: str, quantity: int) -> None:
        remaining_quantity = quantity
        ...
```

BAD:
```python
# module: UserService.py (wrong — PascalCase filename)
from myapp.billing import invoiceTotal  # N813-style leak

def createUser(fullName: str, emailAddress: str) -> User:  # N802, N803
    normalizedEmail = emailAddress.strip().lower()         # N806
    return User(name=fullName, email=normalizedEmail)

class OrderBook:
    def placeOrder(self, orderId: str, quantity: int) -> None:  # N802, N803
        remainingQuantity = quantity                            # N806
        ...

MaxRetries = 3  # N816 — mixedCase/PascalCase at module scope for a non-constant
```

## Edge Cases

- Overriding third-party APIs that use `camelCase` (e.g. `setUp`/`tearDown` in `unittest.TestCase`, Qt signals, WSGI callables) is allowed — the external contract wins. Silence the lint locally with a targeted `# noqa: N802` rather than relaxing the project rule.
- Acronyms in identifiers stay lowercase: `parse_html`, `http_client`, not `parse_HTML` or `parseHTML`.
- Single-letter loop variables (`i`, `k`, `v`) are fine; short names are only a problem when they obscure meaning, not when they follow the case convention.
- Module filenames must be valid identifiers — prefer `user_service.py` over `user-service.py` so the module is importable without tricks.

## Related

PYT-NAME-02, PYT-NAME-03, PYT-NAME-04, PYT-MODL-01
