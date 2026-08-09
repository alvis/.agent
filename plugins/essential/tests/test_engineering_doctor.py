from __future__ import annotations

import json
from pathlib import Path
import re
import subprocess
import time

import pytest


ESSENTIAL = Path(__file__).resolve().parents[1]
DOCTOR = ESSENTIAL / "skills/doctor/scripts/state-doctor"
RESOLVER = ESSENTIAL / "scripts/resolve-state-workspace"
DOCTOR_SOURCE = DOCTOR.read_text(encoding="utf-8")


def doctor_constant(name: str) -> int:
    """Read a threshold from the doctor, so the test cannot drift off it."""
    found = re.search(rf"^{name} = (\d+)$", DOCTOR_SOURCE, re.MULTILINE)
    assert found is not None, name
    return int(found.group(1))


UNKNOWN_BLOCKER_STALE_DAYS = doctor_constant("UNKNOWN_BLOCKER_STALE_DAYS")

HEADER = (
    "| ID | Mark | Status | Task | Depends on | Required | Acceptance | Owner "
    "| Evidence / next action |\n"
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n"
)


def row(
    task_id: str,
    mark: str = "-",
    status: str = "planned",
    depends: str = "—",
    required: str = "yes",
    evidence: str = "Pending.",
) -> str:
    return (
        f"| {task_id} | {mark} | {status} | Do {task_id}. [targets: none] "
        f"| {depends} | {required} | Done when done. | PM | {evidence} |\n"
    )


class Workspace:
    """A scratch work directory plus doctor invocation helpers."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.work_dir = root / ".state" / "works" / "demo"
        (self.work_dir / "state").mkdir(parents=True)
        self.write_charter()

    def write_charter(self, provenance: str = "approved") -> None:
        """Write the charter every stream must have; `-` writes none."""
        goal = self.work_dir / "goal.md"
        if provenance == "-":
            goal.unlink(missing_ok=True)
            return
        goal.write_text(
            "# Charter\n\n"
            f"- Charter: `{provenance}`\n"
            "- Charter revision: `1`\n\n"
            "## Goal\n\nDemonstrate the doctor.\n",
            encoding="utf-8",
        )

    def write_state(
        self, task_rows: str, metadata: str = "", lifecycle: str = "working"
    ) -> None:
        (self.work_dir / "state.md").write_text(
            "# Engineering work\n\n"
            "- State role: `root`\n"
            "- Work ID: `demo`\n"
            f"- Lifecycle status: `{lifecycle}`\n"
            "- State revision: `3`\n"
            f"{metadata}"
            "\n## Tasks\n\n" + HEADER + task_rows,
            encoding="utf-8",
        )

    def run_doctor(
        self, *arguments: str, repository_root: Path | None = None
    ) -> tuple[int, list[dict]]:
        command = [str(DOCTOR), "--work-dir", str(self.work_dir)]
        if repository_root is not None:
            command.extend(["--repository-root", str(repository_root)])
        command.extend(["--json", *arguments])
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
        )
        payload = json.loads(completed.stdout)
        return completed.returncode, payload["findings"]

    @staticmethod
    def checks(findings: list[dict]) -> set[str]:
        return {finding["check"] for finding in findings}


@pytest.fixture
def workspace(tmp_path: Path) -> Workspace:
    return Workspace(tmp_path)


def run_engineering_root(root: Path) -> tuple[int, list[dict]]:
    completed = subprocess.run(
        [str(DOCTOR), "--engineering-root", str(root / ".state"), "--json"],
        capture_output=True,
        text=True,
    )
    return completed.returncode, json.loads(completed.stdout)["findings"]


def write_effective_adr(
    root: Path, name: str = "0001-choice.md", body: str = ""
) -> Path:
    architecture = root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True, exist_ok=True)
    path = decisions / name
    number = name[:4] if len(name) >= 4 and name[:4].isdigit() else "0001"
    path.write_text(
        f"# ADR-{number}: Choice\n\n- Status: `Accepted`\n\n" + body,
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "# Architecture\n\n"
        "| Document | Status |\n| --- | --- |\n"
        f"| [ADR]({decisions.name}/{name}) | Accepted |\n",
        encoding="utf-8",
    )
    return path


def test_clean_fixture_has_zero_findings(workspace: Workspace) -> None:
    workspace.write_state(
        row("AAA", "✓", "done", evidence="Merged in abc123.")
        + row("BBB", "-", "planned", depends="AAA")
    )
    code, findings = workspace.run_doctor()
    assert code == 0
    assert findings == []


def test_reviewing_is_part_of_the_lifecycle_vocabulary(workspace: Workspace) -> None:
    workspace.write_state(
        row("AAA", "✓", "done", evidence="Merged in abc123."),
        lifecycle="reviewing",
    )
    code, findings = workspace.run_doctor()
    assert code == 0
    assert findings == []


def test_retired_lifecycle_value_is_flagged(workspace: Workspace) -> None:
    # `complete` was renamed to `completed`; the old value is not vocabulary
    workspace.write_state(
        row("AAA", "✓", "done", evidence="Merged in abc123."),
        lifecycle="complete",
    )
    _, findings = workspace.run_doctor()
    assert "lifecycle" in workspace.checks(findings)


def test_bootstrap_output_carries_no_defect(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init", "-q", str(repo)], check=True, capture_output=True)
    (repo / ".gitignore").write_text(".state/\n", encoding="utf-8")
    resolved = subprocess.run(
        [str(RESOLVER), "--work-id=demo", "--bootstrap"],
        cwd=repo,
        capture_output=True,
        text=True,
        check=True,
    )
    work_dir = json.loads(resolved.stdout)["work_dir"]
    completed = subprocess.run(
        [str(DOCTOR), "--work-dir", work_dir, "--json"],
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0, completed.stderr
    findings = json.loads(completed.stdout)["findings"]
    # Nothing the bootstrap writes may be a defect.
    assert [f for f in findings if f["severity"] == "error"] == []
    # A stream whose phase cannot be read is skipped in silence by every
    # phase-gated check, so a freshly bootstrapped stream must be visible to
    # them from its first byte. Asserted by name: the absence of this check is
    # the claim, and a count would not say so.
    assert "state-metadata" not in {f["check"] for f in findings}
    assert {f["check"] for f in findings} <= {
        "lifecycle-vocabulary",
        "charter-provenance",
    }
    # A re-packed template is caught here only as this absence; the packed
    # shape itself is exercised against a synthetic fixture in
    # `test_an_unparseable_phase_is_reported_not_silently_skipped`. Do not add
    # a byte-level pin for it here — the resolver's own suite owns that.


def test_malformed_and_duplicate_ids(workspace: Workspace) -> None:
    workspace.write_state(row("AAAA") + row("BBB") + row("BBB"))
    _, findings = workspace.run_doctor()
    messages = [finding["message"] for finding in findings]
    assert any("malformed task ID" in message for message in messages)
    assert any("duplicate task ID" in message for message in messages)


def test_dangling_dependency(workspace: Workspace) -> None:
    workspace.write_state(row("AAA", depends="ZZZ"))
    _, findings = workspace.run_doctor()
    assert "dependency" in workspace.checks(findings)


def test_dependency_cycle(workspace: Workspace) -> None:
    workspace.write_state(row("AAA", depends="BBB") + row("BBB", depends="AAA"))
    _, findings = workspace.run_doctor()
    assert any("cycle" in finding["message"] for finding in findings)


def test_contradictory_mark_status(workspace: Workspace) -> None:
    workspace.write_state(row("AAA", "✓", "working"))
    _, findings = workspace.run_doctor()
    assert "mark-status" in workspace.checks(findings)


def test_done_without_evidence(workspace: Workspace) -> None:
    workspace.write_state(row("AAA", "✓", "done", evidence=""))
    _, findings = workspace.run_doctor()
    assert "evidence" in workspace.checks(findings)


def test_failed_without_attempt_annotations(workspace: Workspace) -> None:
    workspace.write_state(row("AAA", "X", "failed", evidence="it broke"))
    _, findings = workspace.run_doctor()
    assert "evidence" in workspace.checks(findings)


def test_blocked_without_unblock(workspace: Workspace) -> None:
    workspace.write_state(row("AAA", "!", "blocked", evidence="waiting"))
    _, findings = workspace.run_doctor()
    assert "evidence" in workspace.checks(findings)


def test_required_cancelled(workspace: Workspace) -> None:
    workspace.write_state(row("AAA", "⊘", "cancelled"))
    _, findings = workspace.run_doctor()
    assert "roll-up" in workspace.checks(findings)


def test_parent_done_with_unfinished_required_child(workspace: Workspace) -> None:
    workspace.write_state(
        row("AAA", "✓", "done", evidence="rolled up")
        + row("AAA01", "-", "planned")
    )
    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "roll-up" and "AAA" in finding["message"]
        for finding in findings
    )


def test_broken_file_reference_and_absolute_path(workspace: Workspace) -> None:
    workspace.write_state(
        row("AAA"),
        metadata="- Charter: [charter](missing-goal.md)\n"
        "- Notes: [notes](/etc/absolute.md)\n",
    )
    _, findings = workspace.run_doctor()
    assert "file-reference" in workspace.checks(findings)
    assert "portability" in workspace.checks(findings)


def test_broken_image_file_reference_is_still_reported(workspace: Workspace) -> None:
    workspace.write_state(
        row("AAA"),
        metadata="- Diagram: ![diagram](missing.png)\n",
    )

    _, findings = workspace.run_doctor()
    assert "file-reference" in workspace.checks(findings)


def test_superseded_decision_without_successor(workspace: Workspace) -> None:
    workspace.write_state(row("AAA"))
    decisions = workspace.work_dir / "decisions"
    decisions.mkdir()
    (decisions / "old-choice.md").write_text(
        "- status: `superseded`\n- headline: Old choice.\n", encoding="utf-8"
    )
    _, findings = workspace.run_doctor()
    assert "decision" in workspace.checks(findings)
    (decisions / "new-choice.md").write_text(
        "- status: `accepted`\n- supersedes: `old-choice`\n", encoding="utf-8"
    )
    _, findings = workspace.run_doctor()
    assert "decision" not in workspace.checks(findings)


def test_adr_supersession_requires_archive_header_and_current_index(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-old-choice.md").write_text(
        "# ADR-0001: Old choice\n\n- Status: `Superseded`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "# Architecture\n\n"
        "| Document | Status |\n| --- | --- |\n"
        "| [ADR-0001](decisions/0001-old-choice.md) | Accepted |\n",
        encoding="utf-8",
    )
    _, findings = workspace.run_doctor()
    assert "adr-superseded" in workspace.checks(findings)

    old = decisions / "0001-old-choice.md"
    archived = decisions / "superseded"
    archived.mkdir()
    old.rename(archived / old.name)
    (decisions / "0002-new-choice.md").write_text(
        "# ADR-0002: New choice\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — New choice](../0002-new-choice.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\n"
        "## Decision\n\nThe original choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "# Architecture\n\n"
        "| Document | Status |\n| --- | --- |\n"
        "| [ADR-0002](decisions/0002-new-choice.md) | Accepted |\n",
        encoding="utf-8",
    )
    _, findings = workspace.run_doctor()
    assert not any(finding["check"].startswith("adr-") for finding in findings)


def test_adr_integrity_finding_offers_a_fix(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-choice.md").write_text(
        "# ADR-0001: Choice\n\n- Status: `Accepted`\n\n"
        "This ADR supersedes an earlier choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| [ADR-0001](decisions/0001-choice.md) | Accepted |\n",
        encoding="utf-8",
    )
    _, findings = workspace.run_doctor()
    integrity = [finding for finding in findings if finding["check"] == "adr-integrity"]
    assert integrity
    assert all(finding.get("fix") for finding in integrity)


def test_adr_filenames_are_canonical_for_effective_and_archived_records(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "database.md").write_text(
        "# ADR-0001: Database\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Database](decisions/database.md) | Accepted |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    filename_findings = [
        finding
        for finding in findings
        if finding["check"] == "adr-layout"
        and "filename must use" in finding["message"]
    ]
    assert {finding["work"] for finding in filename_findings} == {
        "docs/architecture/decisions/database.md",
        "docs/architecture/decisions/superseded/old-choice.md",
    }
    assert all(finding.get("fix") for finding in filename_findings)


def test_adr_archive_rejects_multiple_successor_links(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (decisions / "0003-other.md").write_text(
        "# ADR-0003: Other\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md), "
        "[ADR-0003 — Other](../0003-other.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| [ADR-0002](decisions/0002-current.md) | Accepted |\n"
        "| [ADR-0003](decisions/0003-other.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-superseded"
        and "exactly one successor link" in finding["message"]
        for finding in findings
    )


def test_adr_archive_rejects_unpaired_angle_successor_destination(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](<../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\n"
        "The original choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    successor = [
        finding
        for finding in findings
        if finding["check"] == "adr-superseded"
        and "successor link" in finding["message"]
    ]
    assert successor
    assert all(finding.get("fix") for finding in successor)


def test_adr_archive_decodes_character_references_in_successor_title(
    workspace: Workspace,
) -> None:
    current = write_effective_adr(workspace.root, name="0002-current.md")
    current.write_text(
        "# ADR-0002: R&D\n\n- Status: `Accepted`\n\nThe current choice.\n",
        encoding="utf-8",
    )
    decisions = current.parent
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — R&amp;D](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\n"
        "The original choice.\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"].startswith("adr-") for finding in findings)


def test_adr_numeric_identity_must_be_unique_across_current_and_archive(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0001-cache.md").write_text(
        "# ADR-0001: Cache\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-database.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| [ADR-0001](decisions/0001-cache.md) | Accepted |\n"
        "| [ADR-0002](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    identity_findings = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "numeric identity 0001 is duplicated" in finding["message"]
    ]
    assert {finding["work"] for finding in identity_findings} == {
        "docs/architecture/decisions/0001-cache.md",
        "docs/architecture/decisions/superseded/0001-database.md",
    }
    assert all(finding.get("fix") for finding in identity_findings)
    archived_identity = next(
        finding
        for finding in identity_findings
        if "superseded/0001-database.md" in finding["work"]
    )
    assert "provenance" in archived_identity["fix"]
    assert "archived H1" in archived_identity["fix"]


def test_adr_heading_identity_must_match_filename_for_current_and_archive(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0003-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0004: Old choice\n\n- Status: `Accepted`\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    identity = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "does not match filename prefix" in finding["message"]
    ]
    assert {finding["work"] for finding in identity} == {
        "docs/architecture/decisions/0002-current.md",
        "docs/architecture/decisions/superseded/0003-old-choice.md",
    }
    assert all(finding.get("fix") for finding in identity)
    archived_identity = next(
        finding
        for finding in identity
        if "superseded/0003-old-choice.md" in finding["work"]
    )
    assert "Rename the archived file" in archived_identity["fix"]
    assert "historical body" in archived_identity["fix"]
    current_identity = next(
        finding
        for finding in identity
        if finding["work"] == "docs/architecture/decisions/0002-current.md"
    )
    assert "provenance" in current_identity["fix"]
    assert "renaming the effective file" in current_identity["fix"]
    assert "edit the accepted heading" in current_identity["fix"]


def test_archived_adr_must_retain_original_body(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    body = [
        finding
        for finding in findings
        if finding["check"] == "adr-superseded"
        and "original canonical ADR heading and body" in finding["message"]
    ]
    assert body
    assert all(finding.get("fix") for finding in body)


def test_archived_adr_rejects_empty_raw_html_body(workspace: Workspace) -> None:
    current = write_effective_adr(workspace.root, name="0002-current.md")
    decisions = current.parent
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Choice](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\n"
        "<div></div>\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    body = [
        finding
        for finding in findings
        if finding["check"] == "adr-superseded"
        and "substantive decision content" in finding["message"]
    ]
    assert body
    assert all(finding.get("fix") for finding in body)


def test_archived_adr_requires_substantive_content_after_metadata(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    substantive = [
        finding
        for finding in findings
        if finding["check"] == "adr-superseded"
        and "substantive decision content" in finding["message"]
    ]
    assert substantive
    assert all(finding.get("fix") for finding in substantive)


def test_archived_adr_rejects_thematic_break_as_substantive_content(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\n---\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    substantive = [
        finding
        for finding in findings
        if finding["check"] == "adr-superseded"
        and "substantive decision content" in finding["message"]
    ]
    assert substantive
    assert all(finding.get("fix") for finding in substantive)


@pytest.mark.parametrize("original_status", ["", "- Status: `Proposed`"])
def test_archived_adr_requires_original_accepted_status(
    workspace: Workspace, original_status: str
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    original_metadata = f"{original_status}\n\n" if original_status else ""
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n"
        f"{original_metadata}## Decision\n\nThe original choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    status = [
        finding
        for finding in findings
        if finding["check"] == "adr-superseded"
        and "original Accepted status" in finding["message"]
    ]
    assert status
    assert all(finding.get("fix") for finding in status)


@pytest.mark.parametrize("marker", ["+", "1.", "2)"])
def test_archived_adr_accepts_markdown_list_status_markers(
    workspace: Workspace, marker: str
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n"
        f"{marker} Status: `Accepted`\n\n"
        "## Decision\n\nThe original choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(
        finding["check"] == "adr-superseded"
        and "original Accepted status" in finding["message"]
        for finding in findings
    )


def test_archived_adr_ignores_indented_status_examples(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n## Decision\n\nThe original choice.\n"
        "    - Status: `Accepted`\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    status = [
        finding
        for finding in findings
        if finding["check"] == "adr-superseded"
        and "original Accepted status" in finding["message"]
    ]
    assert status
    assert all(finding.get("fix") for finding in status)


def test_adr_literal_todo_prose_and_fenced_examples_are_not_placeholders(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-choice.md").write_text(
        "# ADR-0001: Choice\n\n- Status: `Accepted`\n\n"
        "## Context\n\nThe linter rejects literal TODO and TBD comments.\n\n"
        "```yaml\nexample: TODO\n```\n\n"
        "~~~yaml\nexample: TBD\n~~~\n"
        "    TODO: replace-me-at-runtime\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| [ADR-0001](decisions/0001-choice.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert "adr-integrity" not in workspace.checks(findings)


def test_adr_nested_list_placeholders_remain_visible(
    workspace: Workspace,
) -> None:
    write_effective_adr(
        workspace.root,
        body="- Follow-up:\n    - TODO: choose provider\n",
    )

    _, findings = workspace.run_doctor()
    placeholders = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "unresolved TODO/TBD placeholder" in finding["message"]
    ]
    assert placeholders
    assert all(finding.get("fix") for finding in placeholders)


def test_adr_nested_list_placeholders_survive_continuation(
    workspace: Workspace,
) -> None:
    write_effective_adr(
        workspace.root,
        body=(
            "- Follow-up:\n"
            "  Additional context.\n"
            "    - TODO: choose provider\n"
        ),
    )

    _, findings = workspace.run_doctor()
    placeholders = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "unresolved TODO/TBD placeholder" in finding["message"]
    ]
    assert placeholders
    assert all(finding.get("fix") for finding in placeholders)


def test_adr_four_space_list_continuation_remains_visible(
    workspace: Workspace,
) -> None:
    write_effective_adr(
        workspace.root,
        body="- Follow-up:\n    TODO: choose provider\n",
    )

    _, findings = workspace.run_doctor()
    placeholders = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "unresolved TODO/TBD placeholder" in finding["message"]
    ]
    assert placeholders
    assert all(finding.get("fix") for finding in placeholders)


def test_adr_four_space_lazy_paragraph_placeholder_remains_visible(
    workspace: Workspace,
) -> None:
    write_effective_adr(
        workspace.root,
        body="Context\n    TODO: choose provider\n",
    )

    _, findings = workspace.run_doctor()
    placeholders = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "unresolved TODO/TBD placeholder" in finding["message"]
    ]
    assert placeholders
    assert all(finding.get("fix") for finding in placeholders)


@pytest.mark.parametrize("marker", ["1.", "2)", "+"])
def test_adr_detects_ordered_and_plus_list_placeholders(
    workspace: Workspace, marker: str
) -> None:
    write_effective_adr(
        workspace.root,
        body=f"{marker} TODO: choose provider\n",
    )

    _, findings = workspace.run_doctor()
    placeholders = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "unresolved TODO/TBD placeholder" in finding["message"]
    ]
    assert placeholders
    assert all(finding.get("fix") for finding in placeholders)


def test_adr_indented_code_inside_list_is_ignored(
    workspace: Workspace,
) -> None:
    write_effective_adr(
        workspace.root,
        body="- Runtime example:\n      TODO: supplied-by-runtime\n",
    )

    _, findings = workspace.run_doctor()
    assert "adr-integrity" not in workspace.checks(findings)


def test_adr_detects_blockquote_placeholders(workspace: Workspace) -> None:
    write_effective_adr(workspace.root, body="> TODO: choose provider\n")

    _, findings = workspace.run_doctor()
    placeholders = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "unresolved TODO/TBD placeholder" in finding["message"]
    ]
    assert placeholders
    assert all(finding.get("fix") for finding in placeholders)


@pytest.mark.parametrize("marker", ["+", "1.", "2)"])
def test_adr_accepts_markdown_list_status_markers(
    workspace: Workspace, marker: str
) -> None:
    path = write_effective_adr(workspace.root)
    path.write_text(
        "# ADR-0001: Choice\n\n"
        f"{marker} Status: `Accepted`\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(
        finding["check"] == "adr-integrity"
        and "Accepted status declaration" in finding["message"]
        for finding in findings
    )


def test_adr_index_status_must_match_effective_status(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [ADR-0001](decisions/0001-current.md) | Superseded |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-index"
        and "contradicts effective ADR" in finding["message"]
        for finding in findings
    )


def test_adr_index_requires_status_column(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Authority |\n| --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    status = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "has no Status column" in finding["message"]
    ]
    assert status
    assert all(finding.get("fix") for finding in status)


def test_adr_index_requires_document_header(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Reference | Status |\n| --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    missing = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
    ]
    assert missing
    assert all(finding.get("fix") for finding in missing)


def test_adr_index_ends_before_pipe_bearing_heading(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "## Notes | detail\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    missing = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
    ]
    assert missing
    assert all(finding.get("fix") for finding in missing)


def test_adr_index_ignores_nonrendered_tables(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "```markdown\n| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n````\n\n"
        "<!--\n| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n-->\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    missing = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
    ]
    assert missing
    assert all(finding.get("fix") for finding in missing)


def test_adr_index_ignores_raw_html_tables(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "<pre>\n| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n</pre>\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    missing = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
    ]
    assert missing
    assert all(finding.get("fix") for finding in missing)


def test_adr_index_resumes_after_blank_line_in_block_html(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "<div>\n\n| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n\n</div>\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"].startswith("adr-") for finding in findings)


def test_adr_index_ignores_generic_raw_html_blocks(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "<custom>\n| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n"
        "</custom>\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    missing = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
    ]
    assert missing
    assert all(finding.get("fix") for finding in missing)


def test_adr_index_ignores_attribute_generic_raw_html_blocks(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        '<custom class="raw">\n| Document | Status |\n| --- | --- |\n'
        "| [Current](decisions/0001-current.md) | Accepted |\n"
        "</custom>\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    missing = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
    ]
    assert missing
    assert all(finding.get("fix") for finding in missing)


def test_adr_index_counts_links_only_from_document_cell(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Authority | Status |\n| --- | --- | --- |\n"
        "| Architecture | See [ADR](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
        for finding in findings
    )


def test_adr_index_requires_markdown_delimiter_row(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    delimiter = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "valid Markdown delimiter" in finding["message"]
    ]
    assert delimiter
    assert all(finding.get("fix") for finding in delimiter)


def test_adr_index_requires_delimiter_row_to_match_header_width(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    delimiter = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "valid Markdown delimiter" in finding["message"]
    ]
    assert delimiter
    assert all(finding.get("fix") for finding in delimiter)


def test_adr_index_requires_delimiter_row_immediately_after_header(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| Notes | Value |\n| --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    delimiter = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "valid Markdown delimiter" in finding["message"]
    ]
    assert delimiter
    assert all(finding.get("fix") for finding in delimiter)


def test_adr_index_rejects_duplicate_effective_entries(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    duplicate = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "listed more than once" in finding["message"]
    ]
    assert duplicate
    assert all(finding.get("fix") for finding in duplicate)


def test_adr_index_keeps_status_named_data_rows_active(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Authority | Status |\n| --- | --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Status | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"] == "adr-index" for finding in findings)


def test_adr_index_rejects_duplicate_status_columns(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Status | Status |\n| --- | --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Accepted | Superseded |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    duplicate = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "duplicate Status columns" in finding["message"]
    ]
    assert duplicate
    assert all(finding.get("fix") for finding in duplicate)


def test_adr_index_accepts_escaped_pipes_in_other_cells(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Authority | Status |\n| --- | --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Supports A \\| B | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"].startswith("adr-") for finding in findings)


def test_adr_index_accepts_rows_without_outer_pipes(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "Document | Status\n--- | ---\n"
        "[Current](decisions/0001-current.md) | Accepted\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"].startswith("adr-") for finding in findings)


def test_adr_index_accepts_link_titles(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        '| [Current](decisions/0001-current.md "decision record") | Accepted |\n',
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"].startswith("adr-") for finding in findings)


def test_adr_index_accepts_balanced_bracket_labels(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-cache-v2.md").write_text(
        "# ADR-0001: Cache [v2]\n\n- Status: `Accepted`\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Cache [v2]](decisions/0001-cache-v2.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"].startswith("adr-") for finding in findings)


def test_adr_index_ignores_links_inside_inline_html_attributes(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| <span data-link=\"[Current](decisions/0001-current.md)\">Current</span> | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    missing = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
    ]
    assert missing
    assert all(finding.get("fix") for finding in missing)


def test_adr_index_rejects_document_header_inside_existing_table(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Other | Value |\n| --- | --- |\n"
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    missing = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
    ]
    assert missing
    assert all(finding.get("fix") for finding in missing)


def test_adr_index_accepts_reference_style_links(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current][adr] | Accepted |\n\n"
        "[adr]: decisions/0001-current.md\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"].startswith("adr-") for finding in findings)


def test_adr_index_accepts_collapsed_reference_links(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current][] | Accepted |\n\n"
        "[Current]: decisions/0001-current.md\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"].startswith("adr-") for finding in findings)


def test_adr_index_accepts_shortcut_reference_links(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current] | Accepted |\n\n"
        "[Current]: decisions/0001-current.md\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"].startswith("adr-") for finding in findings)


def test_adr_index_uses_first_reference_definition(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current][adr] | Accepted |\n\n"
        "[adr]: decisions/missing.md\n"
        "[adr]: decisions/0001-current.md\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
        for finding in findings
    )


def test_adr_index_ignores_inline_code_links(workspace: Workspace) -> None:
    write_effective_adr(workspace.root)
    architecture = workspace.root / "docs" / "architecture"
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| `[Choice]` | Accepted |\n\n"
        "[Choice]: decisions/0001-choice.md\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
        for finding in findings
    )


def test_adr_index_ignores_nested_image_reference_labels(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| ![Architecture [Choice]](badge.svg) | Accepted |\n\n"
        "[Choice]: decisions/0001-current.md\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    missing = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
    ]
    assert missing
    assert all(finding.get("fix") for finding in missing)


def test_adr_index_ignores_footnote_references(workspace: Workspace) -> None:
    write_effective_adr(workspace.root)
    architecture = workspace.root / "docs" / "architecture"
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| Choice[^1] | Accepted |\n\n"
        "[^1]: decisions/0001-choice.md\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    missing = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
    ]
    assert missing
    assert all(finding.get("fix") for finding in missing)


def test_adr_index_accepts_angle_bracket_destinations(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](<decisions/0001-current.md>) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"].startswith("adr-") for finding in findings)


def test_adr_index_accepts_formatted_table_headers(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| **Document** | **Status** |\n| --- | --- |\n"
        "| [Current](decisions/0001-current.md) | **Accepted** |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"].startswith("adr-") for finding in findings)


def test_adr_index_ignores_indented_code_tables(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "    | Document | Status |\n    | --- | --- |\n"
        "    | [Current](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    missing = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
    ]
    assert missing
    assert all(finding.get("fix") for finding in missing)


def test_adr_index_ignores_image_destinations(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| ![ADR image](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    missing = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
    ]
    assert missing
    assert all(finding.get("fix") for finding in missing)


def test_adr_index_ignores_frontmatter_table_examples(workspace: Workspace) -> None:
    write_effective_adr(workspace.root)
    architecture = workspace.root / "docs" / "architecture"
    (architecture / "README.md").write_text(
        "---\n"
        "index-example: >-\n"
        "  | Document | Status |\n"
        "  | --- | --- |\n"
        "  | [Choice](decisions/0001-choice.md) | Accepted |\n"
        "---\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    missing = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
    ]
    assert missing
    assert all(finding.get("fix") for finding in missing)


def test_adr_rejects_uppercase_markdown_extension(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.MD").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )

    _, findings = workspace.run_doctor()
    extension = [
        finding
        for finding in findings
        if finding["check"] == "adr-layout"
        and "lowercase `.md` extension" in finding["message"]
    ]
    assert extension
    assert all(finding.get("fix") for finding in extension)


@pytest.mark.parametrize("filename", ["0001-current.markdown", "0001-current"])
def test_adr_rejects_alternate_numeric_extensions(
    workspace: Workspace, filename: str
) -> None:
    decisions = workspace.root / "docs" / "architecture" / "decisions"
    decisions.mkdir(parents=True)
    (decisions / filename).write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )

    _, findings = workspace.run_doctor()
    extension = [
        finding
        for finding in findings
        if finding["check"] == "adr-layout"
        and "lowercase `.md` extension" in finding["message"]
    ]
    assert extension
    assert all(finding.get("fix") for finding in extension)


def test_archived_header_fields_must_precede_body(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-superseded"
        and "header fields must appear in order" in finding["message"]
        for finding in findings
    )
    assert all(
        finding.get("fix")
        for finding in findings
        if finding["check"] == "adr-superseded"
    )


def test_archived_header_rejects_nonstandard_fields(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **Rationale:** This extra historical claim is not part of the header.\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\n"
        "## Decision\n\nThe original choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    header = [
        finding
        for finding in findings
        if finding["check"] == "adr-superseded"
        and "non-standard content" in finding["message"]
    ]
    assert header
    assert all(finding.get("fix") for finding in header)


def test_archived_header_allows_retained_html_comments(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "<!-- Retained historical note.\nStatus: Proposed\n"
        "> **Superseded by:** [ADR-9999 — Example](../9999-example.md)\n"
        "> **What changed:** The complete change replaced the example choice.\n"
        "# Retained editor note\n-->\n"
        "# ADR-0001: Old choice\n\n"
        "<!-- Example metadata: Status: Proposed -->\n"
        "- Status: `Accepted`\n\n"
        "## Decision\n\nThe original choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"] == "adr-superseded" for finding in findings)


def test_archived_header_allows_retained_pre_title_frontmatter(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "---\n"
        "title: Old choice\n"
        "---\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\n"
        "## Decision\n\nThe original choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"] == "adr-superseded" for finding in findings)


def test_adr_heading_ignores_yaml_comments_before_title(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-choice.md").write_text(
        "---\n"
        "title: Choice\n"
        "# editor note\n"
        "---\n"
        "# ADR-0001: Choice\n\n- Status: `Accepted`\n\n"
        "## Decision\n\nThe accepted choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Choice](decisions/0001-choice.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"].startswith("adr-") for finding in findings)


def test_adr_heading_ignores_raw_html_examples_before_title(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-choice.md").write_text(
        "<pre>\n"
        "# ADR-9999: Example\n"
        "</pre>\n"
        "# ADR-0001: Choice\n\n- Status: `Accepted`\n\n"
        "## Decision\n\nThe accepted choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Choice](decisions/0001-choice.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"].startswith("adr-") for finding in findings)


def test_adr_rejects_heading_without_rendered_title(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-choice.md").write_text(
        "# ADR-0001: #\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Choice](decisions/0001-choice.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    integrity = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "canonical" in finding["message"]
    ]
    assert integrity
    assert all(finding.get("fix") for finding in integrity)


@pytest.mark.parametrize(
    ("opening", "closing"),
    [("<?raw", "?>"), ("<!DOCTYPE raw", ">"), ("<![CDATA[", "]]>")],
)
def test_adr_index_ignores_non_tag_raw_html_blocks(
    workspace: Workspace, opening: str, closing: str
) -> None:
    write_effective_adr(workspace.root)
    architecture = workspace.root / "docs" / "architecture"
    (architecture / "README.md").write_text(
        f"{opening}\n"
        "| Document | Status |\n| --- | --- |\n"
        "| [Choice](decisions/0001-choice.md) | Accepted |\n"
        f"{closing}\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
        for finding in findings
    )


def test_adr_index_ignores_unterminated_html_comments(
    workspace: Workspace,
) -> None:
    write_effective_adr(workspace.root)
    architecture = workspace.root / "docs" / "architecture"
    (architecture / "README.md").write_text(
        "<!--\n"
        "| Document | Status |\n| --- | --- |\n"
        "| [Choice](decisions/0001-choice.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
        for finding in findings
    )


def test_adr_placeholder_after_inline_generic_tag_remains_visible(
    workspace: Workspace,
) -> None:
    write_effective_adr(
        workspace.root,
        body="Context\n<custom>\nTODO: choose provider\n",
    )

    _, findings = workspace.run_doctor()
    placeholders = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "unresolved TODO/TBD placeholder" in finding["message"]
    ]
    assert placeholders
    assert all(finding.get("fix") for finding in placeholders)


def test_adr_ignores_placeholders_inside_blockquoted_fences(
    workspace: Workspace,
) -> None:
    write_effective_adr(
        workspace.root,
        body=(
            "> ```text\n"
            "> TODO: supplied-by-runtime\n"
            "> ```\n"
        ),
    )

    _, findings = workspace.run_doctor()
    assert "adr-integrity" not in workspace.checks(findings)


def test_adr_index_keeps_blank_terminated_html_blocks_active(
    workspace: Workspace,
) -> None:
    write_effective_adr(workspace.root)
    architecture = workspace.root / "docs" / "architecture"
    (architecture / "README.md").write_text(
        "<div></div>\n"
        "| Document | Status |\n| --- | --- |\n"
        "| [Choice](decisions/0001-choice.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-index"
        and "missing from the ADR index" in finding["message"]
        for finding in findings
    )


def test_adr_ignores_fences_indented_in_list_content(
    workspace: Workspace,
) -> None:
    write_effective_adr(
        workspace.root,
        body=(
            "- Example:\n"
            "    ~~~\n"
            "    TODO: supplied-by-runtime\n"
            "    ~~~\n"
        ),
    )

    _, findings = workspace.run_doctor()
    assert "adr-integrity" not in workspace.checks(findings)


def test_effective_adr_rejects_unfilled_template_fields(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: <decision title>\n\n- Status: `Accepted`\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    placeholders = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "unresolved TODO/TBD placeholder" in finding["message"]
    ]
    assert placeholders
    assert all(finding.get("fix") for finding in placeholders)


@pytest.mark.parametrize("heading", ["# ADR-0001: TODO", "## TODO: Describe decision"])
def test_effective_adr_rejects_todo_headings(
    workspace: Workspace, heading: str
) -> None:
    path = write_effective_adr(workspace.root)
    if heading.startswith("# ADR-"):
        path.write_text(
            f"{heading}\n\n- Status: `Accepted`\n",
            encoding="utf-8",
        )
    else:
        path.write_text(
            "# ADR-0001: Choice\n\n- Status: `Accepted`\n\n"
            f"{heading}\n",
            encoding="utf-8",
        )

    _, findings = workspace.run_doctor()
    placeholders = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "unresolved TODO/TBD placeholder" in finding["message"]
    ]
    assert placeholders
    assert all(finding.get("fix") for finding in placeholders)


@pytest.mark.parametrize(
    "placeholder",
    [
        "<List the meaningful alternatives and why they were not selected.>",
        "<Record the benefits, costs, risks, and operational consequences.>",
    ],
)
def test_effective_adr_rejects_template_verb_placeholders(
    workspace: Workspace, placeholder: str
) -> None:
    write_effective_adr(workspace.root, body=f"{placeholder}\n")

    _, findings = workspace.run_doctor()
    placeholders = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "unresolved TODO/TBD placeholder" in finding["message"]
    ]
    assert placeholders
    assert all(finding.get("fix") for finding in placeholders)


def test_effective_adr_allows_autolinks_and_inline_html(
    workspace: Workspace,
) -> None:
    write_effective_adr(
        workspace.root,
        body=(
            "Links: <https://example.com> <team@example.com> "
            "<span>valid</span> <List items=\"all\">items</List> "
            "<Record class=\"entry\">entry</Record>.\n"
        ),
    )

    _, findings = workspace.run_doctor()
    assert "adr-integrity" not in workspace.checks(findings)


def test_effective_adr_ignores_placeholders_inside_inline_html(
    workspace: Workspace,
) -> None:
    write_effective_adr(
        workspace.root,
        body='<span data-example="<decision-title>">this form</span>\n',
    )

    _, findings = workspace.run_doctor()
    assert "adr-integrity" not in workspace.checks(findings)


def test_effective_adr_ignores_template_tokens_in_inline_code(
    workspace: Workspace,
) -> None:
    write_effective_adr(
        workspace.root,
        body="Decision IDs use `ADR-<nnnn>` in references.\n",
    )

    _, findings = workspace.run_doctor()
    assert "adr-integrity" not in workspace.checks(findings)


def test_effective_adr_respects_even_backslash_code_opener(
    workspace: Workspace,
) -> None:
    write_effective_adr(
        workspace.root,
        body="Decision IDs use \\\\`<decision-title>` in references.\n",
    )

    _, findings = workspace.run_doctor()
    assert "adr-integrity" not in workspace.checks(findings)


@pytest.mark.parametrize("declaration", ["<!foo", "<![cdata["])
def test_adr_keeps_lowercase_html_declarations_visible(
    workspace: Workspace, declaration: str
) -> None:
    write_effective_adr(
        workspace.root,
        body=f"{declaration}\nTODO: choose provider\n",
    )

    _, findings = workspace.run_doctor()
    placeholders = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "unresolved TODO/TBD placeholder" in finding["message"]
    ]
    assert placeholders
    assert all(finding.get("fix") for finding in placeholders)


def test_adr_detects_template_tokens_after_unequal_inline_code_runs(
    workspace: Workspace,
) -> None:
    write_effective_adr(
        workspace.root,
        body="Decision IDs use `<nnnn>`` in references.\n",
    )

    _, findings = workspace.run_doctor()
    placeholders = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "unresolved TODO/TBD placeholder" in finding["message"]
    ]
    assert placeholders
    assert all(finding.get("fix") for finding in placeholders)


@pytest.mark.parametrize(
    "body",
    [
        "This replaces ADR-0000.\n",
        "This ADR supersedes an earlier choice.\n",
    ],
)
def test_effective_adr_rejects_explicit_replacement_language(
    workspace: Workspace, body: str
) -> None:
    write_effective_adr(workspace.root, body=body)

    _, findings = workspace.run_doctor()
    replacement = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "supersession history" in finding["message"]
    ]
    assert replacement
    assert all(finding.get("fix") for finding in replacement)


@pytest.mark.parametrize(
    "body",
    [
        "This ADR **replaces** ADR-0000.\n",
        "This **ADR** replaces ADR-0000.\n",
    ],
)
def test_effective_adr_rejects_emphasized_replacement_language(
    workspace: Workspace, body: str
) -> None:
    write_effective_adr(workspace.root, body=body)

    _, findings = workspace.run_doctor()
    replacement = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "supersession history" in finding["message"]
    ]
    assert replacement
    assert all(finding.get("fix") for finding in replacement)


@pytest.mark.parametrize(
    "body",
    [
        "This ADR is the successor to ADR-0001.\n",
        "This ADR succeeds ADR-0001.\n",
    ],
)
def test_effective_adr_rejects_explicit_successor_language(
    workspace: Workspace, body: str
) -> None:
    write_effective_adr(workspace.root, body=body)

    _, findings = workspace.run_doctor()
    successor = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "supersession history" in finding["message"]
    ]
    assert successor
    assert all(finding.get("fix") for finding in successor)


def test_effective_adr_ignores_unrelated_replacement_language(
    workspace: Workspace,
) -> None:
    write_effective_adr(
        workspace.root,
        body="As specified by ADR-0002, the cache replaces repeated database reads.\n",
    )

    _, findings = workspace.run_doctor()
    assert "adr-integrity" not in workspace.checks(findings)


def test_effective_adr_ignores_domain_supersession_language(
    workspace: Workspace,
) -> None:
    write_effective_adr(
        workspace.root,
        body="Newer queue events supersede pending events with the same key.\n",
    )

    _, findings = workspace.run_doctor()
    assert "adr-integrity" not in workspace.checks(findings)


def test_effective_adr_rejects_relative_archived_links(
    workspace: Workspace,
) -> None:
    current = write_effective_adr(
        workspace.root,
        name="0002-current.md",
        body="See [the old choice](superseded/0001-old-choice.md).\n",
    )
    decisions = current.parent
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Choice](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\n"
        "## Decision\n\nThe original choice.\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    history = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "supersession history" in finding["message"]
    ]
    assert history
    assert all(finding.get("fix") for finding in history)


@pytest.mark.parametrize("fence", ["```", "~~~"])
def test_adr_text_bearing_fence_marker_does_not_close_fenced_content(
    workspace: Workspace, fence: str
) -> None:
    write_effective_adr(
        workspace.root,
        body=(
            f"{fence}text\n# ADR-0099: Example\n"
            f"{fence}not-a-closing-fence\n<decision title>\n"
        ),
    )

    _, findings = workspace.run_doctor()
    assert "adr-integrity" not in workspace.checks(findings)


def test_adr_rejects_backtick_fence_info_with_backtick(workspace: Workspace) -> None:
    write_effective_adr(
        workspace.root,
        body="```example`value\nTODO:\n",
    )

    _, findings = workspace.run_doctor()
    placeholder = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "unresolved TODO/TBD placeholder" in finding["message"]
    ]
    assert placeholder
    assert all(finding.get("fix") for finding in placeholder)


def test_adr_rejects_tab_indented_fence_marker(workspace: Workspace) -> None:
    write_effective_adr(
        workspace.root,
        body="\t```text\nTODO:\n\t```\n",
    )

    _, findings = workspace.run_doctor()
    placeholder = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "unresolved TODO/TBD placeholder" in finding["message"]
    ]
    assert placeholder
    assert all(finding.get("fix") for finding in placeholder)


def test_effective_adr_requires_canonical_heading_as_first_title(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# Notes\n\n- Status: `Accepted`\n\n"
        "# ADR-0001: Current\n\nThe decision.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    heading = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "canonical" in finding["message"]
    ]
    assert heading
    assert all(finding.get("fix") for finding in heading)


def test_effective_adr_rejects_indented_code_heading(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "    # ADR-0001: Current\n\n- Status: `Accepted`\n\n"
        "The decision.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    heading = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "missing its canonical" in finding["message"]
    ]
    assert heading
    assert all(finding.get("fix") for finding in heading)


def test_effective_adr_preserves_line_boundaries_around_comments(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# <!--\nnote\n-->ADR-0001: Current\n\n"
        "- Status: `Accepted`\n\nThe decision.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    heading = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "missing its canonical" in finding["message"]
    ]
    assert heading
    assert all(finding.get("fix") for finding in heading)


def test_adr_template_comment_is_ignored_by_integrity_checks(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-choice.md").write_text(
        "# ADR-0001: Choice\n\n- Status: `Accepted`\n\n"
        "## Context\n\nThe accepted choice.\n\n"
        "<!-- Optional superseded guidance says TODO and Superseded by. -->\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| [ADR-0001](decisions/0001-choice.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert "adr-integrity" not in workspace.checks(findings)


def test_adr_archive_rejects_duplicate_header_fields(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n"
        "> **What changed:** The complete change replaced the old choice again.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| [ADR-0002](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    duplicate = [
        finding
        for finding in findings
        if finding["check"] == "adr-superseded"
        and "exactly one" in finding["message"]
    ]
    assert duplicate
    assert "Superseded by" in duplicate[0]["message"]
    assert "What changed" in duplicate[0]["message"]


def test_archived_adr_rejects_duplicate_status_headers(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Status:** Accepted\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    duplicate = [
        finding
        for finding in findings
        if finding["check"] == "adr-superseded"
        and "exactly one Superseded status header" in finding["message"]
    ]
    assert duplicate
    assert all(finding.get("fix") for finding in duplicate)


def test_archived_adr_rejects_backward_successor_identity(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0003-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0003: Old choice\n\n- Status: `Accepted`\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    chronology = [
        finding
        for finding in findings
        if finding["check"] == "adr-superseded"
        and "later numeric identity" in finding["message"]
    ]
    assert chronology
    assert all(finding.get("fix") for finding in chronology)


def test_adr_archive_successor_label_must_match_target(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0003-database.md").write_text(
        "# ADR-0003: Database\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Cache](../0003-database.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| [ADR-0003](decisions/0003-database.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    mismatch = [
        finding
        for finding in findings
        if finding["check"] == "adr-superseded"
        and "label does not match target ADR" in finding["message"]
    ]
    assert mismatch
    assert "successor link" in mismatch[0]["fix"]
    assert "do not prepend another header" in mismatch[0]["fix"]


def test_adr_archive_accepts_rendered_successor_title(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current-choice.md").write_text(
        "# ADR-0002: **Current choice** ##\n\n- Status: `Accepted`\n",
        encoding="utf-8",
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current choice](../0002-current-choice.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\n"
        "## Decision\n\nThe original choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current-choice.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"] == "adr-superseded" for finding in findings)


def test_adr_archive_accepts_inline_formatted_successor_title(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current-choice.md").write_text(
        "# ADR-0002: Use the **current** cache\n\n- Status: `Accepted`\n",
        encoding="utf-8",
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Use the current cache](../0002-current-choice.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\n"
        "## Decision\n\nThe original choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current-choice.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"] == "adr-superseded" for finding in findings)


@pytest.mark.parametrize("label_title", ["Cache [v2]", r"Cache \[v2\]"])
def test_adr_archive_accepts_bracketed_successor_title(
    workspace: Workspace, label_title: str
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-cache-v2.md").write_text(
        "# ADR-0002: Cache [v2]\n\n- Status: `Accepted`\n",
        encoding="utf-8",
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        f"> **Superseded by:** [ADR-0002 — {label_title}](../0002-cache-v2.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\n"
        "## Decision\n\nThe original choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-cache-v2.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"] == "adr-superseded" for finding in findings)


def test_adr_archive_ignores_links_inside_inline_html_attributes(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** <span data-link=\"[ADR-0002 — Current](../0002-current.md)\">Current</span>\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\n"
        "## Decision\n\nThe original choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-superseded"
        and "exactly one successor link" in finding["message"]
        for finding in findings
    )


def test_adr_archive_rejects_escaped_successor_link(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** \\[ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\n"
        "## Decision\n\nThe original choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-superseded"
        and "exactly one successor link" in finding["message"]
        for finding in findings
    )


def test_adr_archive_ignores_template_placeholders_in_code_spans(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change now treats `<decision-title>` as a literal.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\n"
        "## Decision\n\nThe original choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"] == "adr-superseded" for finding in findings)


def test_adr_archive_rejects_empty_blockquote_body(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n>\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-superseded"
        and "substantive decision content" in finding["message"]
        for finding in findings
    )


@pytest.mark.parametrize("marker", ["-", "*", "+", "1."])
def test_adr_archive_rejects_empty_list_body(
    workspace: Workspace, marker: str
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        f"# ADR-0001: Old choice\n\n- Status: `Accepted`\n{marker}\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-superseded"
        and "substantive decision content" in finding["message"]
        for finding in findings
    )


def test_adr_archive_rejects_empty_heading_body(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n##\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-superseded"
        and "substantive decision content" in finding["message"]
        for finding in findings
    )


def test_adr_archive_change_summary_must_classify_scope(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** Switched databases.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| [ADR-0002](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-superseded"
        and "partial or complete" in finding["message"]
        for finding in findings
    )


@pytest.mark.parametrize(
    "summary",
    [
        "The old choice was completely replaced.",
        "The old choice was partially changed.",
    ],
)
def test_adr_archive_accepts_adverbial_change_scope(
    workspace: Workspace, summary: str
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        f"> **What changed:** {summary}\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\n"
        "## Decision\n\nThe original choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(finding["check"] == "adr-superseded" for finding in findings)


def test_adr_archive_change_summary_rejects_incidental_scope_word(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** The cache policy changed; the complete decision is documented elsewhere.\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\nA retained choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [ADR-0002](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-superseded"
        and "partial or complete" in finding["message"]
        for finding in findings
    )


def test_adr_scan_uses_explicit_active_repository_root(workspace: Workspace) -> None:
    wrong_architecture = workspace.root / "docs" / "architecture"
    wrong_decisions = wrong_architecture / "decisions"
    wrong_decisions.mkdir(parents=True)
    (wrong_decisions / "0001-wrong.md").write_text(
        "# ADR-0001: Wrong tree\n\n- Status: `Superseded`\n",
        encoding="utf-8",
    )

    active_root = workspace.root / "active-worktree"
    active_decisions = active_root / "docs" / "architecture" / "decisions"
    active_decisions.mkdir(parents=True)
    (active_decisions / "0002-current.md").write_text(
        "# ADR-0002: Current tree\n\n- Status: `Accepted`\n",
        encoding="utf-8",
    )
    (active_root / "docs" / "architecture" / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [ADR-0002](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor(repository_root=active_root)
    assert not any(finding["check"].startswith("adr-") for finding in findings)


def test_adr_scan_runs_when_engineering_root_is_absent(tmp_path: Path) -> None:
    repository = tmp_path / "repo"
    decisions = repository / "docs" / "architecture" / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n",
        encoding="utf-8",
    )
    (repository / "docs" / "architecture" / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [ADR-0001](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    completed = subprocess.run(
        [
            str(DOCTOR),
            "--engineering-root",
            ".state",
            "--json",
        ],
        cwd=repository,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0, completed.stderr
    assert json.loads(completed.stdout)["findings"] == []


def test_missing_non_state_engineering_root_is_an_error(tmp_path: Path) -> None:
    repository = tmp_path / "repo"
    repository.mkdir()

    completed = subprocess.run(
        [str(DOCTOR), "--engineering-root", ".staet", "--json"],
        cwd=repository,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 2
    assert "not a directory" in completed.stderr


def test_adr_status_in_body_example_does_not_contradict_metadata(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted`\n\n"
        "## Context\n\n```yaml\nstatus: pending\n```\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| [ADR-0001](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert "adr-integrity" not in workspace.checks(findings)


def test_adr_status_metadata_rejects_trailing_values(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    decisions.mkdir(parents=True)
    (decisions / "0001-current.md").write_text(
        "# ADR-0001: Current\n\n- Status: `Accepted` / `Proposed`\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0001-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    status = [
        finding
        for finding in findings
        if finding["check"] == "adr-integrity"
        and "Accepted status declaration" in finding["message"]
    ]
    assert status
    assert all(finding.get("fix") for finding in status)


def test_adr_metadata_stops_at_deep_subheadings(workspace: Workspace) -> None:
    write_effective_adr(
        workspace.root,
        body="### Implementation note\n\nStatus: Proposed\n",
    )

    _, findings = workspace.run_doctor()
    assert "adr-integrity" not in workspace.checks(findings)


def test_adr_unrecognized_subdirectory_is_reported(workspace: Workspace) -> None:
    decisions = workspace.root / "docs" / "architecture" / "decisions"
    misplaced = decisions / "legacy"
    misplaced.mkdir(parents=True)
    (misplaced / "0001-old.md").write_text(
        "# ADR-0001: Old\n\n- Status: `Accepted`\n", encoding="utf-8"
    )

    _, findings = workspace.run_doctor()
    layout = [finding for finding in findings if finding["check"] == "adr-layout"]
    assert layout
    assert layout[0].get("fix")


def test_adr_archive_rejects_unfilled_change_summary(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current](../0002-current.md)\n>\n"
        "> **What changed:** <State whether the change is partial or complete and summarize the changed choice.>\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| [ADR-0002](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-superseded"
        and "What changed" in finding["message"]
        for finding in findings
    )


def test_adr_archive_rejects_absolute_successor_link(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    current = decisions / "0002-current.md"
    current.write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    old = archived / "0001-old.md"
    old.write_text(
        "> **Status:** Superseded\n>\n"
        f"> **Superseded by:** [ADR-0002 — Current]({current.resolve()})\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| [ADR-0002](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-superseded"
        and "portable relative path" in finding["message"]
        for finding in findings
    )


def test_adr_archive_rejects_spaced_successor_link(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-current.md").write_text(
        "# ADR-0002: Current\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Current] (../0002-current.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\n"
        "## Decision\n\nThe original choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-current.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "adr-superseded"
        and "exactly one successor link" in finding["message"]
        for finding in findings
    )


def test_adr_index_rejects_archived_entries(workspace: Workspace) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-new-choice.md").write_text(
        "# ADR-0002: New choice\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — New choice](../0002-new-choice.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| [ADR-0002](decisions/0002-new-choice.md) | Accepted |\n"
        "| [ADR-0001](decisions/superseded/0001-old-choice.md) | Superseded |\n",
        encoding="utf-8",
    )
    _, findings = workspace.run_doctor()
    assert "adr-index" in workspace.checks(findings)


@pytest.mark.parametrize(
    "archived_cell",
    [
        "decisions/superseded/0001-old-choice.md",
        "`decisions/superseded/0001-old-choice.md`",
    ],
)
def test_adr_index_rejects_unlinked_archived_paths(
    workspace: Workspace, archived_cell: str
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-new-choice.md").write_text(
        "# ADR-0002: New choice\n\n- Status: `Accepted`\n",
        encoding="utf-8",
    )
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — New choice](../0002-new-choice.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Old choice\n\n- Status: `Accepted`\n\n"
        "## Decision\n\nThe original choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [New choice](decisions/0002-new-choice.md) | Accepted |\n"
        f"| {archived_cell} | Superseded |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    archived_paths = [
        finding
        for finding in findings
        if finding["check"] == "adr-index"
        and "lists an archived ADR path" in finding["message"]
    ]
    assert archived_paths
    assert all(finding.get("fix") for finding in archived_paths)


def test_adr_index_does_not_match_archived_filename_substrings(
    workspace: Workspace,
) -> None:
    architecture = workspace.root / "docs" / "architecture"
    decisions = architecture / "decisions"
    archived = decisions / "superseded"
    archived.mkdir(parents=True)
    (decisions / "0002-notes-0001-cache.md").write_text(
        "# ADR-0002: Notes about cache\n\n- Status: `Accepted`\n",
        encoding="utf-8",
    )
    (archived / "0001-cache.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR-0002 — Notes about cache](../0002-notes-0001-cache.md)\n>\n"
        "> **What changed:** The complete change replaced the old choice.\n\n"
        "# ADR-0001: Cache\n\n- Status: `Accepted`\n\n"
        "## Decision\n\nThe original choice.\n",
        encoding="utf-8",
    )
    (architecture / "README.md").write_text(
        "| Document | Status |\n| --- | --- |\n"
        "| [Current](decisions/0002-notes-0001-cache.md) | Accepted |\n",
        encoding="utf-8",
    )

    _, findings = workspace.run_doctor()
    assert not any(
        finding["check"] == "adr-index"
        and "archived ADR" in finding["message"]
        for finding in findings
    )


def test_expired_and_conflicting_lease(workspace: Workspace) -> None:
    workspace.write_state(row("AAA"))
    (workspace.work_dir / "lease.json").write_text(
        json.dumps(
            {
                "work_id": "demo",
                "token": "t",
                "expires_at_epoch": int(time.time()) - 60,
                "state_revision": 9,
            }
        ),
        encoding="utf-8",
    )
    _, findings = workspace.run_doctor()
    lease_findings = [f for f in findings if f["check"] == "lease"]
    severities = {finding["severity"] for finding in lease_findings}
    assert "warning" in severities  # expired
    assert "error" in severities  # revision ahead of state.md


def test_unparseable_state_is_only_info(workspace: Workspace) -> None:
    (workspace.work_dir / "state.md").write_text(
        "totally free-form notes\n", encoding="utf-8"
    )
    code, findings = workspace.run_doctor("--strict")
    assert code == 0
    assert [f for f in findings if f["check"] == "layout"][0]["severity"] == "info"
    assert not [f for f in findings if f["severity"] == "error"]
    # Free-form prose is not a defect, but an unreadable phase must still
    # surface: it is what silences every phase-gated check.
    assert {f["check"] for f in findings if f["severity"] == "warning"} == {
        "state-metadata"
    }


def test_strict_exit_code(workspace: Workspace) -> None:
    workspace.write_state(row("AAA", "✓", "working"))
    code, _ = workspace.run_doctor()
    assert code == 0
    code, _ = workspace.run_doctor("--strict")
    assert code == 1


def test_overview_drift(workspace: Workspace) -> None:
    workspace.write_state(row("AAA"))
    engineering_root = workspace.root / ".state"
    (engineering_root / "overview.md").write_text(
        "# Overview\n\n"
        "| Work ID | Lifecycle | Headline |\n| --- | --- | --- |\n"
        "| demo | completed | Demo. |\n",
        encoding="utf-8",
    )
    completed = subprocess.run(
        [str(DOCTOR), "--engineering-root", str(engineering_root), "--json"],
        capture_output=True,
        text=True,
    )
    findings = json.loads(completed.stdout)["findings"]
    assert any(finding["check"] == "overview" for finding in findings)


def test_overview_drift_ignores_tables_outside_the_streams_section(
    workspace: Workspace,
) -> None:
    """Awaiting-you questions and archived rows are not dangling stream rows.

    The overview carries three tables and only Streams indexes `works/`. A
    check that walks all three reports every operator question as a missing
    work directory, which is noise loud enough to bury the real drift it also
    reports — so this asserts the real one survives and the noise is gone.
    """
    workspace.write_state(row("AAA"))
    engineering_root = workspace.root / ".state"
    (engineering_root / "overview.md").write_text(
        "# Overview\n\n"
        "## Awaiting you\n\n"
        "| Question | Stream | Waiting since |\n| --- | --- | --- |\n"
        "| Accept ADR-0008? | `demo` | 2026-07-22 |\n\n"
        "## Streams\n\n"
        "| Work ID | Phase | Headline |\n| --- | --- | --- |\n"
        "| demo | completed | Demo. |\n\n"
        "## Recently landed\n\n"
        "| Work ID | Landed | Locator |\n| --- | --- | --- |\n"
        "| gone-for-good | 2026-07-28 | PR #71 |\n",
        encoding="utf-8",
    )
    completed = subprocess.run(
        [str(DOCTOR), "--engineering-root", str(engineering_root), "--json"],
        capture_output=True,
        text=True,
    )
    findings = json.loads(completed.stdout)["findings"]
    overview = [f for f in findings if f["check"] == "overview"]
    assert [f["work"] for f in overview] == ["demo"]
    assert "completed" in overview[0]["message"]


def test_unparseable_rows_surface_as_warning(workspace: Workspace) -> None:
    workspace.write_state(
        row("AAA")
        + "| BBB | - | planned | truncated row |\n"
        + "| CCC | broken |\n"
    )
    _, findings = workspace.run_doctor()
    warnings = [
        finding
        for finding in findings
        if finding["severity"] == "warning" and finding["check"] == "layout"
    ]
    assert len(warnings) == 1
    assert "2 task row(s) unparseable" in warnings[0]["message"]


def test_long_journal_gets_compaction_hint(workspace: Workspace) -> None:
    workspace.write_state(row("AAA"))
    journal = workspace.work_dir / "state" / "journal.md"
    lines = ["# Journal", ""] + [
        f"- 2026-07-24T00:00:00Z PM@pm rev:1 status AAA: tick {index}"
        for index in range(510)
    ]
    journal.write_text("\n".join(lines) + "\n", encoding="utf-8")
    _, findings = workspace.run_doctor()
    assert any(
        finding["check"] == "journal" and "compacting" in finding["message"]
        for finding in findings
    )


def test_written_under_drift_is_informational(workspace: Workspace) -> None:
    workspace.write_state(row("AAA"), metadata="- Written under: `00000000`\n")
    _, findings = workspace.run_doctor()
    drift = [f for f in findings if f["check"] == "written-under"]
    assert len(drift) == 1
    assert drift[0]["severity"] == "info"
    assert "written under contract 00000000" in drift[0]["message"]


def test_missing_state_root_still_checks_repository_adrs(tmp_path: Path) -> None:
    write_effective_adr(tmp_path)
    code, findings = run_engineering_root(tmp_path)
    assert code == 0
    assert findings == []


def test_adr_filename_and_numeric_prefix_are_validated(tmp_path: Path) -> None:
    write_effective_adr(tmp_path)
    architecture = tmp_path / "docs" / "architecture"
    (architecture / "decisions" / "choice.md").write_text(
        "# Invalid\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    archived = architecture / "decisions" / "superseded"
    archived.mkdir()
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR](../choice.md)\n>\n"
        "> **What changed:** Replaced.\n",
        encoding="utf-8",
    )
    _, findings = run_engineering_root(tmp_path)
    assert any(
        finding["check"] == "adr-layout"
        and "filename must use" in finding["message"]
        for finding in findings
    )
    assert any(
        "ADR numeric identity 0001 is duplicated" in finding["message"]
        for finding in findings
    )


def test_html_comments_do_not_trigger_adr_integrity_checks(tmp_path: Path) -> None:
    write_effective_adr(
        tmp_path,
        body="<!-- - Status: Superseded; TODO <fill this> -->\n",
    )
    _, findings = run_engineering_root(tmp_path)
    assert not any(finding["check"] == "adr-integrity" for finding in findings)


def test_nested_adr_files_are_reported_as_layout_errors(tmp_path: Path) -> None:
    write_effective_adr(tmp_path)
    nested = tmp_path / "docs" / "architecture" / "decisions" / "archive"
    nested.mkdir()
    (nested / "0002-nested.md").write_text(
        "# Nested\n\n- Status: `Accepted`\n", encoding="utf-8"
    )
    _, findings = run_engineering_root(tmp_path)
    assert any(finding["check"] == "adr-layout" for finding in findings)


def test_narrative_adr_link_does_not_satisfy_index_table(tmp_path: Path) -> None:
    write_effective_adr(tmp_path)
    readme = tmp_path / "docs" / "architecture" / "README.md"
    readme.write_text(
        "See [the choice](decisions/0001-choice.md).\n\n"
        "| Document | Status |\n| --- | --- |\n",
        encoding="utf-8",
    )
    _, findings = run_engineering_root(tmp_path)
    assert any(finding["check"] == "adr-index" for finding in findings)


def test_absolute_successor_link_is_rejected(tmp_path: Path) -> None:
    write_effective_adr(tmp_path, "0002-new-choice.md")
    archived = tmp_path / "docs" / "architecture" / "decisions" / "superseded"
    archived.mkdir()
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR](/docs/architecture/decisions/0002-new-choice.md)\n>\n"
        "> **What changed:** Replaced.\n",
        encoding="utf-8",
    )
    _, findings = run_engineering_root(tmp_path)
    assert any(
        finding["check"] == "adr-superseded"
        and "portable relative path" in finding["message"]
        for finding in findings
    )


def test_archive_placeholder_summary_is_rejected(tmp_path: Path) -> None:
    write_effective_adr(tmp_path, "0002-new-choice.md")
    archived = tmp_path / "docs" / "architecture" / "decisions" / "superseded"
    archived.mkdir()
    (archived / "0001-old-choice.md").write_text(
        "> **Status:** Superseded\n>\n"
        "> **Superseded by:** [ADR](../0002-new-choice.md)\n>\n"
        "> **What changed:** <State whether the decision changed>.\n",
        encoding="utf-8",
    )
    _, findings = run_engineering_root(tmp_path)
    assert any(
        finding["check"] == "adr-superseded"
        and "What changed" in finding["message"]
        for finding in findings
    )


# --- structure migration: the detections that let any repo move to the
# --- two-axis lifecycle, the split overview, and the archival ledger.


def overview_row(
    work_id: str = "demo",
    phase: str = "working",
    # a table cell cannot be absent, so `-` is how the overview carries "not
    # blocked"; it is a different fact from `unknown`
    blocked_on: str = "-",
    progress: str = "2026-07-30 (7d)",
    next_action: str = "Ship it.",
    location: str = "/Users/dev/tree",
) -> str:
    return (
        "| Work ID | Phase | Blocked on | Last progress | Headline "
        "| Next action | Location | Links |\n"
        "| --- | --- | --- | --- | --- | --- | --- | --- |\n"
        f"| {work_id} | {phase} | {blocked_on} | {progress} | Demo. "
        f"| {next_action} | {location} | - |\n"
    )


def write_overview(root: Path, body: str, siblings: bool = True) -> None:
    state = root / ".state"
    (state / "overview.md").write_text(body, encoding="utf-8")
    if siblings:
        for name in ("environment.md", "traps.md"):
            (state / name).write_text(f"# {name}\n", encoding="utf-8")


def write_journal(workspace: Workspace, *lines: str, name: str = "journal.md") -> None:
    (workspace.work_dir / "state" / name).write_text(
        "# Journal\n\n" + "".join(f"{line}\n" for line in lines),
        encoding="utf-8",
    )


def status_line(date: str, payload: str) -> str:
    return f"- {date}T09:00:00Z PM@pm rev:1 status demo: {payload}"


def test_overview_monolith_reports_missing_siblings_and_stray_sections(
    workspace: Workspace,
) -> None:
    workspace.write_state(row("AAA"))
    write_overview(
        workspace.root,
        "# Engineering overview\n\n"
        "The tree carries three jj workspaces and one orphaned checkout.\n\n"
        "## Environment\n\nBranch protection is absent on main.\n\n"
        "## Streams\n\n" + overview_row(),
        siblings=False,
    )
    _, findings = run_engineering_root(workspace.root)
    monolith = [f for f in findings if f["check"] == "overview-monolith"]
    messages = " ".join(finding["message"] for finding in monolith)
    assert "environment.md is missing" in messages
    assert "traps.md is missing" in messages
    assert "'Environment' is not one of" in messages
    assert "preamble line(s)" in messages
    assert all(finding["severity"] == "warning" for finding in monolith)
    assert all(finding.get("fix") for finding in monolith)


def test_canonical_overview_sections_are_not_reported(workspace: Workspace) -> None:
    workspace.write_state(row("AAA"))
    write_overview(
        workspace.root,
        "# Engineering overview\n\n- Updated: `2026-08-06`\n\n"
        "## Goal\n\nShip.\n\n## Requirements\n\nNone.\n\n"
        "## Awaiting you\n\n## Streams\n\n"
        + overview_row(progress="2026-07-30 (7d)")
        + "\n## Recently landed\n",
    )
    write_journal(workspace, status_line("2026-07-30", "working"))
    _, findings = run_engineering_root(workspace.root)
    assert "overview-monolith" not in Workspace.checks(findings)


def test_retired_lifecycle_words_are_format_drift_not_defects(
    workspace: Workspace,
) -> None:
    for retired, replacement in (
        ("initialized", "phase `planned`"),
        ("active", "phase `working`"),
        ("blocked", "`Blocked on:"),
        ("retiring", "phase `completed`"),
    ):
        workspace.write_state(
            row("AAA", "✓", "done", evidence="Merged in PR #42."),
            lifecycle=retired,
        )
        code, findings = workspace.run_doctor("--strict")
        drift = [f for f in findings if f["check"] == "lifecycle-vocabulary"]
        assert code == 0, retired
        assert len(drift) == 1, retired
        assert drift[0]["severity"] == "info"
        assert replacement in drift[0]["message"]


def test_blocked_on_must_name_a_blocker_or_record_unknown(
    workspace: Workspace,
) -> None:
    for metadata, expected in (
        # present and empty records neither a blocker nor the absence of one
        ("- Blocked on:\n", "present but empty"),
        ("- Blocked on: ``\n", "present but empty"),
        # `-` is the overview's cell for "not blocked"; in state.md the field
        # is nullable, so the same fact is written by omitting it
        ("- Blocked on: `-`\n", "names no blocker"),
        ("- Blocked on: `none`\n", "names no blocker"),
        ("- Blocked on: `tbd`\n", "names no blocker"),
        # the retired vocabulary carried in the new field
        ("- Blocked on: `running`\n", "retired motion vocabulary"),
        ("- Blocked on: `idle 9d`\n", "retired motion vocabulary"),
        ("- Blocked on: `waiting: operator`\n", "retired motion vocabulary"),
    ):
        workspace.write_state(row("AAA"), metadata=metadata)
        _, findings = workspace.run_doctor()
        blocked = [f for f in findings if f["check"] == "blocked-on"]
        assert len(blocked) == 1, metadata
        assert blocked[0]["severity"] == "warning", metadata
        assert expected in blocked[0]["message"], metadata

    # positive control for every zero below: a named blocker on the same
    # fixture reports nothing, so a silent run means the value was accepted
    workspace.write_state(row("AAA"), metadata="- Blocked on: `an operator ruling`\n")
    _, findings = workspace.run_doctor()
    assert "blocked-on" not in Workspace.checks(findings)


def test_an_absent_blocked_on_is_a_different_fact_from_unknown(
    workspace: Workspace,
) -> None:
    # `unknown` says the stream is stopped and nobody recorded why; absence
    # says nothing stopped it. A stale hold separates them: were they the same
    # value, a forgotten stream would read exactly like a healthy one.
    stale = time.strftime(
        "%Y-%m-%d",
        time.localtime(time.time() - (UNKNOWN_BLOCKER_STALE_DAYS + 2) * 86400),
    )
    workspace.write_state(row("AAA"))
    write_journal(workspace, status_line(stale, "working"))
    _, findings = workspace.run_doctor()
    assert "blocked-on" not in Workspace.checks(findings)

    workspace.write_state(row("AAA"), metadata="- Blocked on: `unknown`\n")
    write_journal(workspace, status_line(stale, "working"))
    _, findings = workspace.run_doctor()
    forgotten = [f for f in findings if f["check"] == "blocked-on"]
    assert len(forgotten) == 1
    assert forgotten[0]["severity"] == "warning"
    assert stale in forgotten[0]["message"]
    assert f"{UNKNOWN_BLOCKER_STALE_DAYS}-day window" in forgotten[0]["message"]


def test_a_fresh_unknown_blocker_is_not_yet_a_finding(workspace: Workspace) -> None:
    # the day it is written, `unknown` is honest; it rots into a finding only
    # once nobody can reconstruct the question
    today = time.strftime("%Y-%m-%d")
    workspace.write_state(row("AAA"), metadata="- Blocked on: `unknown`\n")
    write_journal(workspace, status_line(today, "working"))
    _, findings = workspace.run_doctor()
    assert "blocked-on" not in Workspace.checks(findings)

    # positive control: the check does fire on this fixture when it should
    workspace.write_state(row("AAA"), metadata="- Blocked on: `none`\n")
    write_journal(workspace, status_line(today, "working"))
    _, findings = workspace.run_doctor()
    assert "blocked-on" in Workspace.checks(findings)


def test_an_undatable_unknown_blocker_is_reported_rather_than_skipped(
    workspace: Workspace,
) -> None:
    """A hold with no reason AND no date must not be the one that reads clean.

    Measured against 26 live streams: 5 of the 6 carrying `unknown` had no
    derivable last progress, so an age-gated check skipped every one of them
    and reported zero. That is worse than the case it does report — neither why
    the stream stopped nor when was ever recorded — yet it was the quiet one.
    """
    workspace.write_state(row("AAA"), metadata="- Blocked on: `unknown`\n")
    # no journal written at all, so no progress date can be derived
    _, findings = workspace.run_doctor()
    undatable = [f for f in findings if f["check"] == "blocked-on"]
    assert len(undatable) == 1
    assert undatable[0]["severity"] == "warning"
    assert "no derivable last progress" in undatable[0]["message"]

    # ...and the same fixture goes quiet once the date exists and is fresh,
    # so the finding tracks the missing date and not merely the missing journal
    write_journal(workspace, status_line(time.strftime("%Y-%m-%d"), "working"))
    _, findings = workspace.run_doctor()
    assert "blocked-on" not in Workspace.checks(findings)


def test_an_unreadable_blocked_on_line_is_a_finding_not_a_silent_zero(
    workspace: Workspace,
) -> None:
    # a packed line parses as no field at all, so the blocker reads as absent
    # — which is the value for "not blocked", the healthiest state there is
    workspace.write_state(
        row("AAA"), metadata="- Blocked on: `operator` · Owner: `PM`\n"
    )
    _, findings = workspace.run_doctor()
    packed = [f for f in findings if f["check"] == "blocked-on"]
    assert len(packed) == 1
    assert packed[0]["severity"] == "warning"
    assert "does not parse as a single-value metadata field" in packed[0]["message"]
    assert packed[0]["fix"]

    # positive control on the same workspace: well-formed, the check is silent
    workspace.write_state(row("AAA"), metadata="- Blocked on: `operator`\n")
    _, findings = workspace.run_doctor()
    assert "blocked-on" not in Workspace.checks(findings)


def test_both_migration_paths_into_blocked_on_are_detected(
    workspace: Workspace,
) -> None:
    # legacy: the pre-split single field
    workspace.write_state(row("AAA"), lifecycle="blocked")
    _, findings = workspace.run_doctor()
    legacy = [f for f in findings if f["check"] == "lifecycle-vocabulary"]
    assert len(legacy) == 1
    assert legacy[0]["severity"] == "info"
    assert "`Blocked on:" in legacy[0]["message"]

    # live: the field this contract retires, offered its migration map
    workspace.write_state(row("AAA"), metadata="- Motion: `waiting: operator`\n")
    _, findings = workspace.run_doctor()
    live = [f for f in findings if f["check"] == "motion-vocabulary"]
    assert len(live) == 1
    assert live[0]["severity"] == "info"
    assert "`waiting: X` → `Blocked on: X`" in live[0]["message"]

    # keyed on the raw line, not the parsed value: a packed line parses as no
    # field, and a value-keyed probe would offer it nothing
    (workspace.work_dir / "state.md").write_text(
        "# Engineering work\n\n- Work ID: `demo`\n"
        "- Phase: `working` · Motion: `idle 14d`\n"
        "\n## Tasks\n\n" + HEADER + row("AAA"),
        encoding="utf-8",
    )
    _, findings = workspace.run_doctor()
    assert "motion-vocabulary" in Workspace.checks(findings)


def test_last_progress_column_and_journal_backing_are_required(
    workspace: Workspace,
) -> None:
    workspace.write_state(row("AAA"))
    write_journal(workspace, status_line("2026-07-30", "working"))
    write_overview(
        workspace.root,
        "# Engineering overview\n\n## Streams\n\n"
        "| Work ID | Phase | Headline |\n| --- | --- | --- |\n"
        "| demo | working | Demo. |\n",
    )
    _, findings = run_engineering_root(workspace.root)
    missing = [f for f in findings if f["check"] == "last-progress"]
    assert len(missing) == 1
    assert "no `Last progress` column" in missing[0]["message"]

    write_overview(
        workspace.root,
        "# Engineering overview\n\n## Streams\n\n"
        + overview_row(progress="2026-08-06 (0d)"),
    )
    _, findings = run_engineering_root(workspace.root)
    drift = [f for f in findings if f["check"] == "last-progress"]
    assert len(drift) == 1
    assert "does not match the journal evidence dated 2026-07-30" in drift[0]["message"]


def test_last_progress_rejects_a_value_that_is_not_a_date(
    workspace: Workspace,
) -> None:
    workspace.write_state(row("AAA"))
    write_journal(workspace, status_line("2026-07-30", "working"))
    write_overview(
        workspace.root,
        "# Engineering overview\n\n## Streams\n\n" + overview_row(progress="recent"),
    )
    _, findings = run_engineering_root(workspace.root)
    assert any(
        finding["check"] == "last-progress" and "carries no date" in finding["message"]
        for finding in findings
    )


def test_a_backfilled_journal_tail_is_not_progress(workspace: Workspace) -> None:
    workspace.write_state(row("AAA"), lifecycle="working")
    write_journal(
        workspace,
        status_line("2026-07-20", "working"),
        status_line("2026-08-06", "initialized"),
    )
    _, findings = workspace.run_doctor()
    freshness = [f for f in findings if f["check"] == "journal-freshness"]
    assert len(freshness) == 1
    assert "a phase the stream has already left" in freshness[0]["message"]


def test_a_stub_journal_older_than_state_is_reported(workspace: Workspace) -> None:
    workspace.write_state(
        row("AAA", "✓", "done", evidence="Merged."),
        metadata="- Merge evidence: `PR #42 merged 2026-07-28`\n",
        lifecycle="completed",
    )
    write_journal(workspace, status_line("2026-07-27", "reviewing"))
    _, findings = workspace.run_doctor()
    freshness = [f for f in findings if f["check"] == "journal-freshness"]
    assert len(freshness) == 1
    assert "the journal is a stub" in freshness[0]["message"]
    assert "(from state.md)" in freshness[0]["fix"]


def test_an_unmarked_state_fallback_is_a_finding(workspace: Workspace) -> None:
    workspace.write_state(
        row("AAA", "✓", "done", evidence="Merged."),
        metadata="- Merge evidence: `PR #42 merged 2026-07-28`\n",
        lifecycle="completed",
    )
    write_journal(workspace, status_line("2026-07-27", "reviewing"))
    write_overview(
        workspace.root,
        "# Engineering overview\n\n## Streams\n\n"
        + overview_row(phase="completed", progress="2026-07-28 (9d)"),
    )
    _, findings = run_engineering_root(workspace.root)
    unmarked = [f for f in findings if f["check"] == "last-progress"]
    assert len(unmarked) == 1
    assert "does not say so" in unmarked[0]["message"]

    write_overview(
        workspace.root,
        "# Engineering overview\n\n## Streams\n\n"
        + overview_row(phase="completed", progress="2026-07-28 (from state.md)"),
    )
    _, findings = run_engineering_root(workspace.root)
    assert "last-progress" not in Workspace.checks(findings)


def test_a_segmented_journal_is_followed_to_its_newest_segment(
    workspace: Workspace,
) -> None:
    workspace.write_state(row("AAA"))
    write_journal(workspace, status_line("2026-08-06", "working"))
    write_journal(
        workspace, status_line("2026-08-04", "working"), name="07-journal-late.md"
    )
    _, findings = workspace.run_doctor()
    segments = [f for f in findings if f["check"] == "journal-segments"]
    assert len(segments) == 1
    assert "07-journal-late.md ends at 2026-08-04" in segments[0]["message"]
    assert "false freshness" in segments[0]["message"]

    write_overview(
        workspace.root,
        "# Engineering overview\n\n## Streams\n\n"
        + overview_row(progress="2026-08-06 (0d)"),
    )
    _, findings = run_engineering_root(workspace.root)
    assert any(
        finding["check"] == "last-progress" and "2026-08-04" in finding["message"]
        for finding in findings
    )


def test_location_must_be_absolute_or_a_dash(workspace: Workspace) -> None:
    workspace.write_state(row("AAA"))
    write_journal(workspace, status_line("2026-07-30", "working"))
    write_overview(
        workspace.root,
        "# Engineering overview\n\n## Streams\n\n"
        + overview_row(progress="2026-07-30 (7d)", location="../trees/demo"),
    )
    _, findings = run_engineering_root(workspace.root)
    location = [f for f in findings if f["check"] == "location"]
    assert len(location) == 1
    assert location[0]["severity"] == "warning"
    assert "neither an absolute path nor `-`" in location[0]["message"]


def test_an_inferred_location_is_an_error(workspace: Workspace) -> None:
    workspace.write_state(row("AAA"))
    write_journal(workspace, status_line("2026-07-30", "working"))
    write_overview(
        workspace.root,
        "# Engineering overview\n\n## Streams\n\n"
        + overview_row(
            progress="2026-07-30 (7d)", location="/Users/dev/tree ⚠ inferred"
        ),
    )
    code, findings = run_engineering_root(workspace.root)
    inferred = [f for f in findings if f["check"] == "location"]
    assert len(inferred) == 1
    assert inferred[0]["severity"] == "error"
    assert "manufactures a fact" in inferred[0]["message"]


def test_a_recorded_dash_location_is_honest(workspace: Workspace) -> None:
    workspace.write_state(row("AAA"))
    write_journal(workspace, status_line("2026-07-30", "working"))
    write_overview(
        workspace.root,
        "# Engineering overview\n\n## Streams\n\n"
        + overview_row(progress="2026-07-30 (7d)", location="-"),
    )
    _, findings = run_engineering_root(workspace.root)
    assert "location" not in Workspace.checks(findings)


def test_next_action_budget_reports_the_offender_size(workspace: Workspace) -> None:
    workspace.write_state(row("AAA"))
    write_journal(workspace, status_line("2026-07-30", "working"))
    write_overview(
        workspace.root,
        "# Engineering overview\n\n## Streams\n\n"
        + overview_row(progress="2026-07-30 (7d)", next_action="x" * 260),
    )
    _, findings = run_engineering_root(workspace.root)
    budget = [f for f in findings if f["check"] == "overview-budget"]
    assert len(budget) == 1
    assert "260 chars, over the 200-char budget by 60" in budget[0]["message"]


def test_a_completed_stream_past_the_window_must_leave_works(
    workspace: Workspace,
) -> None:
    workspace.write_state(
        row("AAA", "✓", "done", evidence="Merged."),
        metadata="- Merge evidence: `PR #42 merged`\n",
        lifecycle="completed",
    )
    stale = time.strftime("%Y-%m-%d", time.localtime(time.time() - 9 * 86400))
    write_journal(workspace, status_line(stale, "completed"))
    _, findings = workspace.run_doctor()
    retention = [f for f in findings if f["check"] == "retention"]
    assert len(retention) == 1
    assert "past the 3-day window" in retention[0]["message"]
    assert (
        "Move works/<work-id>/ to .state/archive/<work-id>/ first, then drop "
        "the overview row" in retention[0]["fix"]
    )


def test_a_completed_stream_inside_the_window_is_left_alone(
    workspace: Workspace,
) -> None:
    workspace.write_state(
        row("AAA", "✓", "done", evidence="Merged."),
        metadata="- Merge evidence: `PR #42 merged`\n",
        lifecycle="completed",
    )
    recent = time.strftime("%Y-%m-%d", time.localtime(time.time() - 86400))
    write_journal(workspace, status_line(recent, "completed"))
    _, findings = workspace.run_doctor()
    assert "retention" not in Workspace.checks(findings)


@pytest.mark.parametrize(
    ("work_id", "problem"),
    [
        ("20260727-feat-trading-venue-routing-v5cfxb", "carries a date prefix"),
        ("feat-trading-venue-routing", "carries a type prefix"),
        ("markets-and-symbols-v5cfxb", "random suffix"),
        ("a-work-id-that-runs-past-the-thirty-two-byte-bound", "over the 32-byte bound"),
        ("Markets_And_Symbols", "not a plain lowercase-hyphen slug"),
    ],
)
def test_non_conforming_work_ids_are_reported_never_renamed(
    tmp_path: Path, work_id: str, problem: str
) -> None:
    work_dir = tmp_path / ".state" / "works" / work_id
    (work_dir / "state").mkdir(parents=True)
    (work_dir / "goal.md").write_text(
        "# Charter\n\n- Charter: `approved`\n", encoding="utf-8"
    )
    (work_dir / "state.md").write_text(
        f"# Engineering work\n\n- Work ID: `{work_id}`\n"
        "- Lifecycle status: `working`\n",
        encoding="utf-8",
    )
    code, findings = run_engineering_root(tmp_path)
    naming = [f for f in findings if f["check"] == "work-id-naming"]
    assert len(naming) == 1
    assert naming[0]["severity"] == "info"
    assert problem in naming[0]["message"]
    assert "never renamed" in naming[0]["message"]


def test_a_conforming_work_id_is_silent(workspace: Workspace) -> None:
    workspace.write_state(row("AAA"))
    _, findings = workspace.run_doctor()
    assert "work-id-naming" not in Workspace.checks(findings)


def test_a_charter_without_provenance_is_drift_and_a_missing_one_is_a_defect(
    workspace: Workspace,
) -> None:
    workspace.write_state(row("AAA"))
    workspace.write_charter("reconstructed")
    _, findings = workspace.run_doctor()
    assert "charter-provenance" not in Workspace.checks(findings)

    # An absent field is unmeasured, which is not the declared value `absent`.
    (workspace.work_dir / "goal.md").write_text(
        "# Charter\n\n- Charter revision: `1`\n", encoding="utf-8"
    )
    _, findings = workspace.run_doctor()
    drift = [f for f in findings if f["check"] == "charter-provenance"]
    assert len(drift) == 1
    assert drift[0]["severity"] == "warning"
    assert "approved | reconstructed | absent" in drift[0]["message"]

    workspace.write_charter("-")
    code, findings = workspace.run_doctor("--strict")
    absent = [f for f in findings if f["check"] == "charter-provenance"]
    assert code == 1
    assert len(absent) == 1
    assert absent[0]["severity"] == "error"
    assert "no goal.md" in absent[0]["message"]
    assert "reconstructed" in absent[0]["fix"]


def test_an_unknown_charter_provenance_value_is_reported(
    workspace: Workspace,
) -> None:
    workspace.write_state(row("AAA"))
    workspace.write_charter("assumed")
    _, findings = workspace.run_doctor()
    unknown = [f for f in findings if f["check"] == "charter-provenance"]
    assert len(unknown) == 1
    assert unknown[0]["severity"] == "warning"


def test_a_completed_stream_may_not_hold_unowned_debt(workspace: Workspace) -> None:
    workspace.write_state(
        row("AAA", "✓", "done", evidence="Merged."),
        metadata="- Merge evidence: `PR #42 merged`\n",
        lifecycle="completed",
    )
    receipt = (
        "\n## Completion receipt\n\n"
        "- Merge evidence: PR #42 merged.\n"
        "- Outlives me:\n"
        "  - `U1` unresolved coverage gap. owner: -\n"
        "  - `U3` deferred backfill. owner: Raj\n"
    )
    state_path = workspace.work_dir / "state.md"
    state_path.write_text(
        state_path.read_text(encoding="utf-8") + receipt, encoding="utf-8"
    )
    code, findings = workspace.run_doctor("--strict")
    debt = [f for f in findings if f["check"] == "outlives-me"]
    assert code == 1
    assert len(debt) == 1
    assert debt[0]["severity"] == "error"
    assert "`U1`" in debt[0]["message"]
    assert ".state/backlog.md" in debt[0]["fix"]


def test_owned_debt_and_live_streams_do_not_report(workspace: Workspace) -> None:
    receipt = (
        "\n## Completion receipt\n\n"
        "- Merge evidence: PR #42 merged.\n"
        "- Outlives me:\n"
        "  - `U3` deferred backfill. owner: Raj\n"
    )
    workspace.write_state(
        row("AAA", "✓", "done", evidence="Merged."),
        metadata="- Merge evidence: `PR #42 merged`\n",
        lifecycle="completed",
    )
    state_path = workspace.work_dir / "state.md"
    state_path.write_text(
        state_path.read_text(encoding="utf-8") + receipt, encoding="utf-8"
    )
    _, findings = workspace.run_doctor()
    assert "outlives-me" not in Workspace.checks(findings)

    workspace.write_state(row("AAA"), lifecycle="working")
    state_path.write_text(
        state_path.read_text(encoding="utf-8")
        + "\n## Completion receipt\n\n- Outlives me: `U1` gap. owner: -\n",
        encoding="utf-8",
    )
    _, findings = workspace.run_doctor()
    assert "outlives-me" not in Workspace.checks(findings)


def test_legacy_unowned_debt_outside_a_receipt_is_still_found(
    workspace: Workspace,
) -> None:
    workspace.write_state(
        row("AAA", "✓", "done", evidence="Merged."),
        metadata="- Merge evidence: `PR #42 merged`\n"
        "- Note: three deferred follow-ups, owned by nobody yet\n",
        lifecycle="completed",
    )
    _, findings = workspace.run_doctor()
    debt = [f for f in findings if f["check"] == "outlives-me"]
    assert len(debt) == 1
    assert "deferred follow-ups" in debt[0]["message"]


def test_completed_without_merge_evidence_is_an_error(workspace: Workspace) -> None:
    workspace.write_state(
        row("AAA", "✓", "done", evidence="Landed as 4f9a2b1."),
        lifecycle="completed",
    )
    code, findings = workspace.run_doctor("--strict")
    evidence = [f for f in findings if f["check"] == "merge-evidence"]
    assert code == 1
    assert len(evidence) == 1
    assert evidence[0]["severity"] == "error"
    assert "a bare commit hash is not merge evidence" in evidence[0]["message"]
    assert "reviewing" in evidence[0]["fix"]


@pytest.mark.parametrize(
    "evidence",
    ["Merged in PR #42.", "Branch observed merged into main.", "See /pull/42."],
)
def test_recorded_merge_evidence_satisfies_completed(
    workspace: Workspace, evidence: str
) -> None:
    workspace.write_state(
        row("AAA", "✓", "done", evidence=evidence), lifecycle="completed"
    )
    _, findings = workspace.run_doctor()
    assert "merge-evidence" not in Workspace.checks(findings)


def test_charter_absent_severity_is_conditioned_on_phase(
    workspace: Workspace,
) -> None:
    # Nothing is built against a charter at `planned`, so the honest,
    # measured value `absent` is not yet a risk there.
    workspace.write_state(row("AAA"), lifecycle="planned")
    workspace.write_charter("absent")
    _, findings = workspace.run_doctor()
    unstarted = [f for f in findings if f["check"] == "charter-provenance"]
    assert len(unstarted) == 1
    assert unstarted[0]["severity"] == "info"

    for phase in ("working", "reviewing"):
        workspace.write_state(row("AAA"), lifecycle=phase)
        _, findings = workspace.run_doctor()
        in_flight = [f for f in findings if f["check"] == "charter-provenance"]
        assert len(in_flight) == 1, phase
        assert in_flight[0]["severity"] == "warning", phase
        assert "no recorded success criteria" in in_flight[0]["message"]


def test_a_completed_stream_waiting_on_a_blocker_holds_its_place(
    workspace: Workspace,
) -> None:
    # archive/ is resolver-skipped, so archiving a stream with an open
    # question would drop that question out of the overview.
    workspace.write_state(
        row("AAA", "✓", "done", evidence="Merged."),
        metadata="- Merge evidence: `PR #42 merged`\n"
        "- Blocked on: `an operator ruling on D4`\n",
        lifecycle="completed",
    )
    stale = time.strftime("%Y-%m-%d", time.localtime(time.time() - 9 * 86400))
    write_journal(workspace, status_line(stale, "completed"))
    _, findings = workspace.run_doctor()
    held = [f for f in findings if f["check"] == "retention"]
    assert len(held) == 1
    assert held[0]["severity"] == "info"
    assert "an operator ruling on D4" in held[0]["message"]
    assert "9d ago" in held[0]["message"]
    assert "Awaiting you" in held[0]["message"]


def test_a_completed_stream_with_no_named_blocker_past_the_window_warns(
    workspace: Workspace,
) -> None:
    # `unknown` names no question, so archiving drops nothing out of Awaiting
    # you: the hold is not legitimate and the ordinary retention warning
    # stands. Its staleness is `blocked-on`'s to report, not retention's.
    for metadata in ("", "- Blocked on: `unknown`\n"):
        workspace.write_state(
            row("AAA", "✓", "done", evidence="Merged."),
            metadata="- Merge evidence: `PR #42 merged`\n" + metadata,
            lifecycle="completed",
        )
        stale = time.strftime("%Y-%m-%d", time.localtime(time.time() - 9 * 86400))
        write_journal(workspace, status_line(stale, "completed"))
        _, findings = workspace.run_doctor()
        overdue = [f for f in findings if f["check"] == "retention"]
        assert len(overdue) == 1, metadata
        assert overdue[0]["severity"] == "warning", metadata
        assert "past the 3-day window" in overdue[0]["message"], metadata


def test_an_unparseable_phase_is_reported_not_silently_skipped(
    workspace: Workspace,
) -> None:
    # Two fields packed onto one line satisfy every eye and no parser: every
    # phase-gated check then skips the stream and reports a clean zero.
    (workspace.work_dir / "state.md").write_text(
        "# Engineering work\n\n"
        "- Work ID: `demo`\n"
        "- Phase: `completed` · Blocked on: `an operator ruling`\n"
        "\n## Tasks\n\n" + HEADER + row("AAA"),
        encoding="utf-8",
    )
    _, findings = workspace.run_doctor()
    unreadable = [f for f in findings if f["check"] == "state-metadata"]
    assert len(unreadable) == 1
    assert unreadable[0]["severity"] == "warning"
    assert "does not parse as a single-value metadata field" in unreadable[0]["message"]
    assert "reports a clean zero" in unreadable[0]["message"]
    # The false clear the packed line produced, named in the finding.
    # `blocked-on` stays on this list: its own raw probe is line-anchored, so
    # a packed line whose first key is `Phase` is invisible to it and only
    # `state-metadata` can report the false clear
    for silenced in ("retention", "merge-evidence", "blocked-on", "outlives-me"):
        assert silenced in unreadable[0]["message"]
        assert silenced not in Workspace.checks(findings)


def test_an_absent_phase_field_reads_differently_from_an_unparseable_one(
    workspace: Workspace,
) -> None:
    (workspace.work_dir / "state.md").write_text(
        "# Engineering work\n\n- Work ID: `demo`\n\n## Tasks\n\n"
        + HEADER
        + row("AAA"),
        encoding="utf-8",
    )
    _, findings = workspace.run_doctor()
    absent = [f for f in findings if f["check"] == "state-metadata"]
    assert len(absent) == 1
    assert absent[0]["severity"] == "warning"
    assert "neither `Phase` nor `Lifecycle status`" in absent[0]["message"]


def test_a_readable_phase_reports_nothing(workspace: Workspace) -> None:
    workspace.write_state(row("AAA"), metadata="- Blocked on: `an operator`\n")
    _, findings = workspace.run_doctor()
    assert "state-metadata" not in Workspace.checks(findings)

    (workspace.work_dir / "state.md").write_text(
        "# Engineering work\n\n- Work ID: `demo`\n- Phase: `working`\n"
        "- Blocked on: `an operator`\n\n## Tasks\n\n" + HEADER + row("AAA"),
        encoding="utf-8",
    )
    _, findings = workspace.run_doctor()
    assert "state-metadata" not in Workspace.checks(findings)


# --- the skill's migration table is keyed by doctor `check` ids, and a typo
# --- there offers a repair for a finding that is never emitted.

DOCTOR_SKILL = ESSENTIAL / "skills/doctor/SKILL.md"
# `report.<severity>(work, "<check>", …)` is the only way a finding is emitted.
EMITTED_CHECK = re.compile(
    r'report\.(?:info|warning|error)\(\s*[^,()]+,\s*"([a-z0-9][a-z0-9-]*)"'
)
MIGRATION_TABLE_HEADING = "## Structure migration"
TABLE_KEY_CELL = re.compile(r"^\|\s*`([a-z0-9-]+)`")
TABLE_DELIMITER = re.compile(r"^\|\s*-{3,}")


def migration_table_check_ids(skill_text: str) -> set[str]:
    """Return the `check` ids keying the Structure migration table's rows.

    The header cell is itself `` `check` ``, and the literal word appears all
    over the doctor — so a header left in passes for the wrong reason. Rows
    are taken only after the header and its delimiter.
    """
    section = skill_text.split(MIGRATION_TABLE_HEADING, 1)[-1].splitlines()
    rows: list[str] = []
    seen_delimiter = False
    for line in section:
        # `|---|---|` and `| --- | --- |` are the same table; keying the gate on
        # one spelling makes cosmetic reformatting silently empty the row set,
        # and an empty row set is the clean zero this extractor must not report
        if TABLE_DELIMITER.match(line):
            seen_delimiter = True
            continue
        if not line.startswith("|"):
            if rows:
                break
            continue
        if seen_delimiter:
            rows.append(line)
    return {found.group(1) for line in rows if (found := TABLE_KEY_CELL.match(line))}


def unemittable_check_ids(skill_text: str, doctor_text: str) -> set[str]:
    """Return the table's ids that no doctor `report.*` call can ever emit."""
    return migration_table_check_ids(skill_text) - set(
        EMITTED_CHECK.findall(doctor_text)
    )


def test_every_migration_offer_answers_a_check_the_doctor_emits() -> None:
    skill_text = DOCTOR_SKILL.read_text(encoding="utf-8")
    ids = migration_table_check_ids(skill_text)
    # a zero from an extractor that found no rows is the same green as a
    # correct table, so the rows are asserted found before the ids are judged
    assert len(ids) > 1
    assert "check" not in ids, "the header row was read as an offer"
    assert not unemittable_check_ids(skill_text, DOCTOR_SOURCE)


def test_the_migration_table_gate_catches_an_id_no_check_emits() -> None:
    # positive control: without it, an extractor returning nothing passes
    fabricated = (
        f"{MIGRATION_TABLE_HEADING}\n\n"
        "| `check` | Offer |\n"
        "| --- | --- |\n"
        "| `retention` | A real one. |\n"
        "| `no-such-check` | An offer for a finding nobody emits. |\n"
    )
    assert migration_table_check_ids(fabricated) == {"retention", "no-such-check"}
    assert unemittable_check_ids(fabricated, DOCTOR_SOURCE) == {"no-such-check"}
