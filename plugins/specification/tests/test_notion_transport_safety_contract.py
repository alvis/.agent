import hashlib
import itertools
import json
import os
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path
from typing import cast

import pytest

PLUGIN = Path(__file__).resolve().parents[1]
SKILLS = PLUGIN / "skills"
TRANSPORT_PROFILE_VALIDATOR = (
    SKILLS / "sync-notion/scripts/validate-transport-profile.py"
)
TRANSPORT_METADATA_CHECK = SKILLS / "sync-notion/scripts/validate-transport-metadata.sh"
type Validator = Callable[[bytes], tuple[subprocess.CompletedProcess[str], bytes]]


def make_profile(root: Path) -> tuple[Path, dict[str, object]]:
    executable = root / "notion-sync"
    executable.write_bytes(b"#!/bin/sh\nexit 0\n")
    executable.chmod(0o700)
    executable_hash = hashlib.sha256(executable.read_bytes()).hexdigest()
    version_hash = hashlib.sha256(b"notion-sync 1.2.3\n").hexdigest()
    help_hash = hashlib.sha256(
        b"pull --recursive --json\nsearch --json\ncreate --json --create-if-absent\n"
        b"push --json --expected-revision\n"
    ).hexdigest()
    capability_vectors = {
        "recursive_pull": ["pull", "--recursive", "--json"],
        "search": ["search", "--json"],
        "create": ["create", "--json"],
        "push": ["push", "--json"],
        "conditional_update": ["push", "--json", "--expected-revision"],
        "conditional_create": ["create", "--json", "--create-if-absent"],
    }
    output_contracts = {
        "recursive_pull": "notion-page-tree-json-v1",
        "search": "notion-search-json-v1",
        "create": "notion-created-page-json-v1",
        "push": "notion-page-write-json-v1",
        "conditional_update": "notion-page-write-json-v1",
        "conditional_create": "notion-created-page-json-v1",
    }
    evidence = {
        "binary_sha256": executable_hash,
        "version": "1.2.3",
        "help_stdout_sha256": help_hash,
        "capability_vectors": capability_vectors,
        "output_contracts": output_contracts,
        "results": {
            "recursive_pull": "pass",
            "search": "pass",
            "create": "pass",
            "push": "pass",
            "conditional_update": "pass",
            "conditional_create": "pass",
        },
        "tested_at": "2026-07-20T12:00:00Z",
    }
    evidence_bytes = json.dumps(
        evidence,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    profile: dict[str, object] = {
        "schema": "notion-sync-transport-profile/v1",
        "name": "product-specs",
        "installation": {
            "source": "team-artifact",
            "package": "notion-sync",
            "version": "1.2.3",
            "executable": str(executable),
            "sha256": executable_hash,
        },
        "probes": {
            "version_argv": ["--version"],
            "version_stdout_sha256": version_hash,
            "help_argv": ["--help"],
            "help_stdout_sha256": help_hash,
        },
        "capabilities": {
            "recursive_pull": {
                "command": "pull",
                "flags": ["--recursive", "--json"],
                "output_contract": "notion-page-tree-json-v1",
            },
            "search": {
                "command": "search",
                "flags": ["--json"],
                "output_contract": "notion-search-json-v1",
            },
            "create": {
                "command": "create",
                "flags": ["--json"],
                "output_contract": "notion-created-page-json-v1",
            },
            "push": {
                "command": "push",
                "flags": ["--json"],
                "output_contract": "notion-page-write-json-v1",
            },
            "conditional_update": {
                "support": "supported",
                "command": "push",
                "flags": ["--expected-revision"],
                "output_contract": "notion-page-write-json-v1",
            },
            "conditional_create": {
                "support": "supported",
                "command": "create",
                "flags": ["--create-if-absent"],
                "output_contract": "notion-created-page-json-v1",
            },
        },
        "conformance": {
            "schema": "notion-sync-conformance/v1",
            "evidence": evidence,
            "evidence_sha256": hashlib.sha256(evidence_bytes).hexdigest(),
        },
    }
    profile_path = root / "transport-profile.json"
    profile_path.write_text(json.dumps(profile), encoding="utf-8")
    profile_path.chmod(0o600)
    return profile_path, profile


def test_bundled_validator_emits_exact_profile_byte_digest_without_token(
    tmp_path: Path,
) -> None:
    root = tmp_path.resolve()
    profile_path, _ = make_profile(root)
    environment = dict(os.environ)
    environment["NOTION_TOKEN"] = "should-never-appear"
    result = subprocess.run(
        [sys.executable, str(TRANSPORT_PROFILE_VALIDATOR), str(profile_path)],
        check=False,
        capture_output=True,
        text=True,
        env=environment,
    )

    assert result.returncode == 0, result.stderr
    report = json.loads(result.stdout)
    assert report["status"] == "profile_structure_verified"
    assert report["profile_file"] == str(profile_path)
    assert (
        report["profile_file_sha256"]
        == hashlib.sha256(profile_path.read_bytes()).hexdigest()
    )
    assert "should-never-appear" not in result.stdout + result.stderr


def test_bundled_validator_help_is_functional() -> None:
    result = subprocess.run(
        [sys.executable, str(TRANSPORT_PROFILE_VALIDATOR), "--help"],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert "<absolute-profile-file>" in result.stdout
    assert "--print-template" in result.stdout
    assert result.stderr == ""


def test_bundled_validator_emits_secret_free_unverified_template(
    tmp_path: Path,
) -> None:
    environment = dict(os.environ)
    environment["NOTION_TOKEN"] = "should-never-appear"
    result = subprocess.run(
        [sys.executable, str(TRANSPORT_PROFILE_VALIDATOR), "--print-template"],
        check=False,
        capture_output=True,
        text=True,
        env=environment,
    )

    assert result.returncode == 0, result.stderr
    template = json.loads(result.stdout)
    assert template["status"] == "unverified_template"
    assert template["profile"]["schema"] == "notion-sync-transport-profile/v1"
    assert (
        template["profile"]["capabilities"]["conditional_update"]["support"]
        == "unavailable"
    )
    assert (
        template["profile"]["capabilities"]["conditional_create"]["support"]
        == "unavailable"
    )
    assert "NOTION_TOKEN" not in result.stdout
    assert "should-never-appear" not in result.stdout + result.stderr

    profile_path = tmp_path.resolve() / "template-profile.json"
    profile_path.write_text(json.dumps(template["profile"]), encoding="utf-8")
    profile_path.chmod(0o600)
    validation = subprocess.run(
        [sys.executable, str(TRANSPORT_PROFILE_VALIDATOR), str(profile_path)],
        check=False,
        capture_output=True,
        text=True,
    )
    assert validation.returncode == 2
    refusal = json.loads(validation.stderr)
    assert refusal["status"] == "transport_unverified"
    assert "placeholder" in refusal["error"]


def test_bundled_validator_rejects_noncanonical_conformance_digest(
    tmp_path: Path,
) -> None:
    root = tmp_path.resolve()
    profile_path, profile = make_profile(root)
    conformance = cast(dict[str, object], profile["conformance"])
    conformance["evidence_sha256"] = "0" * 64
    profile_path.write_text(json.dumps(profile), encoding="utf-8")
    profile_path.chmod(0o600)
    result = subprocess.run(
        [sys.executable, str(TRANSPORT_PROFILE_VALIDATOR), str(profile_path)],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 2
    refusal = json.loads(result.stderr)
    assert refusal["status"] == "transport_unverified"
    assert "conformance evidence SHA-256 mismatch" in refusal["error"]


def test_bundled_validator_rejects_reused_evidence_for_changed_vector(
    tmp_path: Path,
) -> None:
    root = tmp_path.resolve()
    profile_path, profile = make_profile(root)
    capabilities = cast(dict[str, object], profile["capabilities"])
    push = cast(dict[str, object], capabilities["push"])
    push["flags"] = ["--json", "--force"]
    profile_path.write_text(json.dumps(profile), encoding="utf-8")
    profile_path.chmod(0o600)
    result = subprocess.run(
        [sys.executable, str(TRANSPORT_PROFILE_VALIDATOR), str(profile_path)],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 2
    refusal = json.loads(result.stderr)
    assert "conformance push vector does not match capabilities" in refusal["error"]


def test_conditional_create_is_independent_from_conditional_update(
    tmp_path: Path,
) -> None:
    root = tmp_path.resolve()
    profile_path, profile = make_profile(root)
    capabilities = cast(dict[str, object], profile["capabilities"])
    conditional_create = cast(dict[str, object], capabilities["conditional_create"])
    conditional_create.update(
        {
            "support": "unavailable",
            "command": None,
            "flags": [],
            "output_contract": None,
        }
    )
    conformance = cast(dict[str, object], profile["conformance"])
    evidence = cast(dict[str, object], conformance["evidence"])
    capability_vectors = cast(dict[str, object], evidence["capability_vectors"])
    output_contracts = cast(dict[str, object], evidence["output_contracts"])
    results = cast(dict[str, object], evidence["results"])
    capability_vectors["conditional_create"] = []
    output_contracts["conditional_create"] = "unavailable"
    results["conditional_create"] = "unavailable"
    evidence_bytes = json.dumps(
        evidence,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    conformance["evidence_sha256"] = hashlib.sha256(evidence_bytes).hexdigest()
    profile_path.write_text(json.dumps(profile), encoding="utf-8")
    profile_path.chmod(0o600)
    result = subprocess.run(
        [sys.executable, str(TRANSPORT_PROFILE_VALIDATOR), str(profile_path)],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    report = json.loads(result.stdout)
    assert report["capabilities"]["conditional_update"]["support"] == "supported"
    assert report["capabilities"]["conditional_create"]["support"] == "unavailable"


_transport_file_counter = itertools.count()


@pytest.fixture
def run_validator(tmp_path: Path) -> Validator:
    def _run(content: bytes) -> tuple[subprocess.CompletedProcess[str], bytes]:
        # a fresh file per invocation mirrors the one-directory-per-call
        # isolation the original tempfile-based helper provided
        path = tmp_path / f"page-{next(_transport_file_counter)}.mdc"
        path.write_bytes(content)
        result = subprocess.run(
            ["bash", str(TRANSPORT_METADATA_CHECK), str(path)],
            check=False,
            capture_output=True,
            text=True,
        )
        return result, path.read_bytes()

    return _run


def test_validator_reports_existing_revision_without_mutating_bytes(
    run_validator: Validator,
) -> None:
    original = (
        b"---\n"
        b"title: Contract\n"
        b"last_edited_time: 2026-07-20T10:30:00.000Z\n"
        b"ref: 01234567-89ab-cdef-0123-456789abcdef\n"
        b"---\n"
        b"# Contract\n"
    )
    result, final = run_validator(original)

    assert result.returncode == 0, result.stderr
    assert final == original
    assert "transport_last_edited_time=2026-07-20T10:30:00.000Z" in result.stdout


def test_validator_allows_unsynced_absence_without_inserting_field(
    run_validator: Validator,
) -> None:
    original = b"---\ntitle: New child\nparent: parent-ref\n---\n# New child\n"
    result, final = run_validator(original)

    assert result.returncode == 0, result.stderr
    assert final == original
    assert "transport_last_edited_time=<absent>" in result.stdout


def test_validator_rejects_duplicate_revision_without_mutating_bytes(
    run_validator: Validator,
) -> None:
    original = (
        b"---\nlast_edited_time: first\nlast_edited_time: second\n---\n# Duplicate\n"
    )
    result, final = run_validator(original)

    assert result.returncode != 0
    assert final == original
    assert "malformed, duplicate" in result.stderr


def test_validator_reports_identity_and_detects_a_changed_ref(
    run_validator: Validator,
) -> None:
    before = (
        b"---\n"
        b"ref: 01234567-89ab-cdef-0123-456789abcdef\n"
        b"parent: fedcba98-7654-3210-fedc-ba9876543210\n"
        b"last_edited_time: 2026-07-20T10:30:00.000Z\n"
        b"---\n# Contract\n"
    )
    after = before.replace(
        b"ref: 01234567-89ab-cdef-0123-456789abcdef",
        b"ref: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    )

    before_result, _ = run_validator(before)
    after_result, _ = run_validator(after)

    assert before_result.returncode == 0, before_result.stderr
    assert after_result.returncode == 0, after_result.stderr
    assert "transport_ref=01234567-89ab-cdef-0123-456789abcdef" in before_result.stdout
    assert (
        "transport_parent=fedcba98-7654-3210-fedc-ba9876543210" in before_result.stdout
    )
    assert before_result.stdout != after_result.stdout


@pytest.mark.parametrize(
    "original",
    (
        pytest.param(
            b"---\nref: first\nref: second\n---\n# Duplicate\n", id="duplicate-ref"
        ),
        pytest.param(
            b"---\ntitle: No identity\n---\n# Missing\n", id="missing-identity"
        ),
    ),
)
def test_validator_rejects_duplicate_or_missing_identity(
    run_validator: Validator, original: bytes
) -> None:
    result, final = run_validator(original)
    assert result.returncode != 0
    assert final == original
    assert "transport identity metadata" in result.stderr


def test_validator_rejects_non_exact_delimiter_and_symlink_input(
    run_validator: Validator, tmp_path: Path
) -> None:
    non_exact = b"---\nref: stable-ref\n---   \n# Contract\n"
    result, final = run_validator(non_exact)
    assert result.returncode != 0
    assert final == non_exact

    target = tmp_path / "target.mdc"
    target.write_bytes(b"---\nref: stable-ref\n---\n# Contract\n")
    alias = tmp_path / "alias.mdc"
    alias.symlink_to(target)
    result = subprocess.run(
        ["bash", str(TRANSPORT_METADATA_CHECK), str(alias)],
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "regular non-symlink" in result.stderr


def test_body_author_is_bound_through_specification_calls() -> None:
    moved_skill = SKILLS / "mdc"
    required_mdc_files = (
        moved_skill / "SKILL.md",
        moved_skill / "references/closing-markers.md",
        moved_skill / "references/editing-rules.md",
        moved_skill / "references/examples.md",
        moved_skill / "references/syntax.md",
    )
    for path in required_mdc_files:
        assert path.is_file(), path
    assert TRANSPORT_METADATA_CHECK.is_file()

    contracts = (
        PLUGIN / "README.md",
        PLUGIN / "agents/specification-expert/base.md",
        SKILLS / "spec-code/SKILL.md",
        SKILLS / "implement-code/SKILL.md",
        SKILLS / "sync-spec/SKILL.md",
        SKILLS / "sync-notion/SKILL.md",
    )
    stale_invocation = "Skill(" + "mdc)"
    for contract in contracts:
        text = contract.read_text(encoding="utf-8")
        assert "--body-author=<plugin:skill>" in text, contract
        assert stale_invocation not in text, contract

    assert "--body-author=specification:mdc" in (
        PLUGIN / "README.md"
    ).read_text(encoding="utf-8")
    assert "--body-author=specification:mdc" in (
        PLUGIN / "agents/specification-expert/base.md"
    ).read_text(encoding="utf-8")
    assert "--body-author=specification:mdc" in (
        moved_skill / "SKILL.md"
    ).read_text(encoding="utf-8")

    sync_notion = (SKILLS / "sync-notion/SKILL.md").read_text(encoding="utf-8")
    assert "next_action: select_body_author" in sync_notion
    assert "Never infer a default" in sync_notion

    provenance = json.loads(
        (SKILLS / "spec-code/assets/provenance.template.json").read_text(
            encoding="utf-8"
        )
    )
    assert provenance["body_author"] == {
        "capability_id": "<plugin>:<skill>",
        "selection_source": "<explicit_argument|delegated_caller>",
    }


def test_specification_contracts_do_not_bypass_profile_or_property_policy() -> None:
    agent = (PLUGIN / "agents/specification-expert/base.md").read_text(encoding="utf-8")
    direct_transport_tokens = (
        "Bash: " + "notion-sync",
        "--follow-" + "children",
        "--depth-" + "children",
        "--depth-" + "database",
        "--depth-" + "link",
    )
    for token in direct_transport_tokens:
        assert token not in agent
    assert "specification:sync-notion" in agent
    assert "selected transport profile alone" in agent
    assert ("conformance-validated " + "diff") not in agent
    assert "conformance-validated\n  `recursive_pull` vector" in agent

    document_mode = (SKILLS / "spec-code/references/document-mode.md").read_text(
        encoding="utf-8"
    )
    assert ('Status = "' + 'Implemented"') not in document_mode
    assert ('Status = "' + 'Drafting"') not in document_mode
    assert "explicit destination-owned mapping" in document_mode

    database_resolution = (
        SKILLS / "sync-notion/references/database-resolution.md"
    ).read_text(encoding="utf-8")
    status_matching = "match by group + " + "keyword regex"
    assert status_matching not in database_resolution
    assert "destination-owned mapping" in " ".join(database_resolution.split())

    concurrent_edit = (
        SKILLS / "sync-spec/references/concurrent-edit-matrix.md"
    ).read_text(encoding="utf-8")
    assert ("pinned `notion-sync` " + "version") not in concurrent_edit
    assert "independently prove `conditional_update`" in " ".join(
        concurrent_edit.split()
    )
