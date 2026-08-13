"""Run the Discover presentation validator as part of the repository suite.

The validator is a CLI module named ``test_html_templates.py`` that pytest
cannot collect (it holds no test functions and shadows the naming convention),
so ``pytest.ini`` ignores it and this wrapper imports it by path instead. Until
this file existed, the repository's own rule — every mechanical gate is a pytest
test — was false for the largest generator in the tree.

``run("complete")`` compiles boards through ``build_artifact.build``, which
downloads the Tailwind and Mermaid runtimes unless the gitignored vendor cache
holds them. CI has a network, so the gate runs there. An offline developer gets
a skip rather than a failure that says nothing about their change.
"""

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest

VALIDATOR = (
    Path(__file__).resolve().parents[1]
    / "skills"
    / "discover"
    / "scripts"
    / "test_html_templates.py"
)


def _load_validator() -> ModuleType:
    spec = importlib.util.spec_from_file_location("discover_validator", VALIDATOR)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.dont_write_bytecode = True  # keep scripts/__pycache__ out of the tree
    spec.loader.exec_module(module)
    return module


def test_discover_presentation_contract_holds() -> None:
    assert VALIDATOR.is_file(), f"{VALIDATOR}: Discover validator is missing"
    validator = _load_validator()

    # Only the compile step needs a network. Skipping the whole gate on an
    # unreachable CDN would turn source drift, scaffold, stylesheet, runtime and
    # pattern-coverage regressions into a green skip during any transient
    # outage — the failure mode that makes a gate worse than no gate.
    builder = validator._load_builder()
    include_builder = True
    # Probe every runtime the compile step needs, not just the long-standing
    # one: a checkout that cached Tailwind before diagrams existed would
    # otherwise pass this probe and then hard-fail compiling the diagram board.
    for fetch in (builder.get_tailwind_runtime, builder.get_mermaid_runtime):
        try:
            fetch()
        except builder.BuildError as error:
            # An unreachable CDN with no cache is an offline developer; every
            # other BuildError is a real finding and must still fail.
            if "could not fetch" not in str(error):
                raise
            include_builder = False

    result = validator.run("complete", include_builder=include_builder)
    assert result["errors"] == []
    assert result["status"] == "pass"
    assert (
        result["presentation_patterns_covered"]
        == result["presentation_patterns_required"]
    )
    if not include_builder:
        pytest.skip("compile checks skipped: a runtime CDN is unreachable and uncached")
