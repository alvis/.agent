"""Assert the Python aggregator matches ``design-audit-aggregator.js`` output.

Executes the JS aggregator via Node against a fixed fixture, then runs the
Python port on the same issue-set and asserts equality on every numeric
field that the JS side computes (category scores, overall, risk, counts).
"""

import json
import shutil
import subprocess
from pathlib import Path
from typing import TypedDict, cast

from audit_cli.report.aggregate import (
    compute_category_score,
    compute_overall_score,
    determine_risk,
)

_FIXTURE_PATH = Path(__file__).parent / "fixtures" / "findings_sample.json"
_JS_AGGREGATOR = (
    Path(__file__).resolve().parents[2]
    / "skills/audit/scripts/design-audit-aggregator.js"
)


def _require_executable(name: str, /) -> str:
    executable = shutil.which(name)
    if executable is None:
        raise RuntimeError(f"{name} is required for aggregator parity tests")
    return executable


NODE = _require_executable("node")


class _Category(TypedDict):
    issues: list[dict[str, object]]


class _Fixture(TypedDict):
    categories: dict[str, _Category]


class _CategoryScore(TypedDict):
    score: int


class _Summary(TypedDict):
    byCategory: dict[str, _CategoryScore]
    overallScore: int
    bySeverity: dict[str, int]
    risk: str


class _JsReport(TypedDict):
    summary: _Summary


def _run_js_baseline(categories: dict[str, _Category]) -> _JsReport:
    """Drive the JS aggregator in Node and capture its unified output."""
    runner = f"""
const globals = {{ window: {{}} }};
Object.assign(globalThis, globals);
const vm = require('vm');
const fs = require('fs');
const src = fs.readFileSync('{_JS_AGGREGATOR}', 'utf-8');
vm.runInThisContext(src);

const categories = {json.dumps(categories)};
for (const [key, value] of Object.entries(categories)) {{
    const fnMap = {{
        text: 'runWcagTextAudit',
        structure: 'runSemanticStructureAudit',
        interaction: 'runInteractionAudit',
        mobile: 'runMobileLayoutAudit',
        visual: 'runVisualLayoutAudit',
        tokens: 'runDesignTokensAudit',
        typography: 'runTypographyAudit',
        spatial: 'runSpatialLayoutAudit',
        css: 'runUnusedCssAudit'
    }};
    globalThis.window[fnMap[key]] = () => ({{issues: value.issues, stats: {{}}}});
}}

const report = globalThis.window.runDesignAudit({{
    categories: Object.keys(categories),
    viewport: 'desktop',
    viewportLabel: 'Desktop 1440x900'
}});
process.stdout.write(JSON.stringify(report));
"""
    completed = subprocess.run(
        [NODE, "-e", runner], capture_output=True, text=True, check=True
    )
    return cast(_JsReport, json.loads(completed.stdout))


def test_python_aggregator_matches_js_scoring() -> None:
    fixture = cast(
        _Fixture,
        json.loads(_FIXTURE_PATH.read_text(encoding="utf-8")),
    )
    categories = fixture["categories"]

    js_report = _run_js_baseline(categories)

    py_category_scores: dict[str, int] = {}
    for key, cat in categories.items():
        issues = cat["issues"]
        py_category_scores[key] = compute_category_score(issues)

    js_by_cat = js_report["summary"]["byCategory"]
    for key, score in py_category_scores.items():
        assert js_by_cat[key]["score"] == score, f"category {key} diverged"

    assert (
        compute_overall_score(py_category_scores)
        == js_report["summary"]["overallScore"]
    )
    assert (
        determine_risk(js_report["summary"]["bySeverity"])
        == js_report["summary"]["risk"]
    )
