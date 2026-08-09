"""Fixture for the py-type-ignore-format scanner."""

import legacy_lib


def fetch_blanket() -> object:
    # violation: blanket ignore hides every future error on this line
    return legacy_lib.fetch()  # type: ignore


def fetch_code_only() -> object:
    # violation: code present but no `# reason:` justification
    return legacy_lib.fetch()  # type: ignore[no-untyped-call]


def fetch_compliant() -> object:
    # compliant: specific code and a reason, two spaces before the reason
    return legacy_lib.fetch()  # type: ignore[no-untyped-call]  # reason: legacy_lib ships no py.typed marker
