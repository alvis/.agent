# DEL-RETR-01: Bound Retries

Re-dispatch only failed items and bound retries to about two per batch by default. After the bound is reached, report the remaining issue instead of looping. A skill may set a tighter retry limit for costly or risky operations.
