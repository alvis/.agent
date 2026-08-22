import itertools
import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

ESSENTIAL = Path(__file__).resolve().parents[1]
REPOSITORY = ESSENTIAL.parents[1]
CHECKER = ESSENTIAL / "scripts/check-markdown-size"
RESOLVER = ESSENTIAL / "scripts/resolve-state-workspace"
# pin macOS's system bash 3.2 rather than resolving the shebang against PATH,
# so its incident guards (e.g. an empty array expanding to "unbound variable"
# under `set -u`) stay exercised even when a newer Homebrew bash is on PATH
SYSTEM_BASH = "/bin/bash"
SESSION_START = ESSENTIAL / "hooks/scripts/session-start"
SUBAGENT_START = ESSENTIAL / "hooks/scripts/subagent-start"


# markdown size checker


class CheckerHarness:
    """A scratch tree with a state directory and a call-counting fake wc."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.state_dir = root / ".state"
        self.state_dir.mkdir()
        self.log = root / "wc.log"
        fake_bin = root / "bin"
        fake_bin.mkdir()
        fake_wc = fake_bin / "wc"
        fake_wc.write_text(
            '#!/bin/sh\nprintf \'call\\n\' >>"$WC_LOG"\nexec /usr/bin/wc "$@"\n',
            encoding="utf-8",
        )
        fake_wc.chmod(0o755)
        self.env = os.environ.copy()
        self.env["PATH"] = f"{fake_bin}:{self.env['PATH']}"
        self.env["WC_LOG"] = str(self.log)

    def write_bytes(self, name: str, size: int) -> Path:
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"x" * size)
        return path

    def run_checker(
        self, *paths: Path | str
    ) -> tuple[subprocess.CompletedProcess[str], dict]:
        completed = subprocess.run(
            [
                str(CHECKER),
                "--state-dir",
                str(self.state_dir),
                *(str(path) for path in paths),
            ],
            text=True,
            capture_output=True,
            check=False,
            env=self.env,
        )
        return completed, json.loads(completed.stdout)

    def calls(self) -> int:
        return len(self.log.read_text().splitlines()) if self.log.exists() else 0


@pytest.fixture
def checker(tmp_path: Path) -> CheckerHarness:
    return CheckerHarness(tmp_path)


def test_keeps_fifteen_kib_and_boundary_file_in_one_pass(
    checker: CheckerHarness,
) -> None:
    first = checker.write_bytes(".state/works/eng-421/fifteen kib.md", 15 * 1024)
    second = checker.write_bytes(".state/works/eng-421/boundary.md", 16_384)

    completed, payload = checker.run_checker(first, second)

    assert completed.returncode == 0, completed.stderr
    assert payload["status"] == "pass"
    assert payload["checked"] == 2
    assert payload["oversized"] == []
    assert checker.calls() == 1


def test_returns_every_oversized_file_together_after_one_wc(
    checker: CheckerHarness,
) -> None:
    first = checker.write_bytes(".state/works/eng-421/one.md", 16_385)
    second = checker.write_bytes(".state/works/eng-421/dir with spaces/two.md", 20_000)
    valid = checker.write_bytes(".state/works/eng-421/valid.md", 12_289)

    completed, payload = checker.run_checker(first, second, valid)

    assert completed.returncode == 1, completed.stderr
    assert payload["status"] == "split_required"
    assert {entry["path"]: entry["bytes"] for entry in payload["oversized"]} == {
        str(first): 16_385,
        str(second): 20_000,
    }
    assert checker.calls() == 1


def test_deduplicates_and_excludes_working_and_external_markdown(
    checker: CheckerHarness,
) -> None:
    measured = checker.write_bytes(".state/works/eng-421/normal.md", 100)
    working = checker.write_bytes(".state/works/eng-421/state/working.md", 30_000)
    durable = checker.write_bytes("docs/specs/payments/README.md", 30_000)
    plugin_source = checker.write_bytes("plugins/example/SKILL.md", 30_000)

    completed, payload = checker.run_checker(
        measured, measured, working, durable, plugin_source
    )

    assert completed.returncode == 0, completed.stderr
    assert payload["checked"] == 1
    assert sorted(payload["excluded"]) == sorted(
        [str(working), str(durable), str(plugin_source)]
    )
    assert checker.calls() == 1


def test_all_excluded_is_a_pass_without_wc(checker: CheckerHarness) -> None:
    working = checker.write_bytes(".state/works/eng-421/state/working.md", 30_000)
    durable = checker.write_bytes("docs/architecture/large.md", 30_000)

    completed, payload = checker.run_checker(working, durable)

    assert completed.returncode == 0, completed.stderr
    assert payload["status"] == "pass"
    assert payload["checked"] == 0
    assert checker.calls() == 0


def test_canonical_boundary_excludes_traversal_symlink_and_other_root(
    checker: CheckerHarness,
) -> None:
    checker.write_bytes("docs/outside.md", 20_000)
    linked_outside = checker.write_bytes("docs/linked-outside.md", 20_000)
    traversal = checker.state_dir / ".." / "docs" / "outside.md"
    symlink = checker.state_dir / "works/eng-421/linked.md"
    symlink.parent.mkdir(parents=True)
    symlink.symlink_to(linked_outside)
    other = checker.write_bytes("other/.state/works/eng-9/other.md", 20_000)

    completed, payload = checker.run_checker(traversal, symlink, other)

    assert completed.returncode == 0, completed.stderr
    assert payload["status"] == "pass"
    assert payload["checked"] == 0
    assert sorted(payload["excluded"]) == sorted(
        [str(traversal), str(symlink), str(other)]
    )
    assert checker.calls() == 0


def test_invalid_and_missing_inputs_are_distinct_from_split(
    checker: CheckerHarness,
) -> None:
    not_markdown = checker.write_bytes(".state/works/eng-421/data.mdc", 10)
    cases = (
        (),
        ("relative.md",),
        (checker.root / "missing.md",),
        (not_markdown,),
    )
    for paths in cases:
        completed, payload = checker.run_checker(*paths)
        assert completed.returncode == 2, paths
        assert payload["status"] == "invalid", paths
    assert checker.calls() == 0

    completed = subprocess.run(
        [str(CHECKER), str(checker.root / "missing.md")],
        text=True,
        capture_output=True,
        check=False,
        env=checker.env,
    )
    assert completed.returncode == 2
    assert json.loads(completed.stdout)["status"] == "invalid"


# workspace resolver


def run_resolver(
    path: Path,
    work_id: str | None = None,
    *,
    bootstrap: bool = False,
    environment_work_id: str | None = None,
    extra_environment: dict[str, str] | None = None,
) -> tuple[subprocess.CompletedProcess[str], dict]:
    command = [SYSTEM_BASH, str(RESOLVER), "--path", str(path)]
    if work_id is not None:
        command.extend(("--work-id", work_id))
    if bootstrap:
        command.append("--bootstrap")
    environment = os.environ.copy()
    environment.pop("STATE_WORK_ID", None)
    if environment_work_id is not None:
        environment["STATE_WORK_ID"] = environment_work_id
    if extra_environment:
        environment.update(extra_environment)
    completed = subprocess.run(
        command,
        text=True,
        capture_output=True,
        check=False,
        env=environment,
    )
    return completed, json.loads(completed.stdout)


def git(*args: str, cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-c", "commit.gpgSign=false", *args],
        cwd=cwd,
        text=True,
        capture_output=True,
        check=True,
    )


def initialize_git(root: Path, *, ignored: bool = True) -> None:
    root.mkdir()
    git("init", "-q", cwd=root)
    git("symbolic-ref", "HEAD", "refs/heads/main", cwd=root)
    git("config", "user.email", "test@example.com", cwd=root)
    git("config", "user.name", "Test", cwd=root)
    if ignored:
        (root / ".gitignore").write_text(".state/\n", encoding="utf-8")


def commit_initial(root: Path) -> None:
    (root / "readme.md").write_text("test\n", encoding="utf-8")
    paths = ["readme.md"]
    if (root / ".gitignore").exists():
        paths.append(".gitignore")
    git("add", *paths, cwd=root)
    git("commit", "-qm", "initial", cwd=root)


def test_suggests_but_does_not_invent_new_work_from_git_branch(
    tmp_path: Path,
) -> None:
    root = tmp_path / "main workspace"
    linked = tmp_path / "linked workspace"
    initialize_git(root)
    commit_initial(root)
    git("worktree", "add", "-q", "-b", "feat/refunds", str(linked), cwd=root)

    completed, payload = run_resolver(linked)

    assert completed.returncode == 4, completed.stderr
    assert payload["status"] == "work_id_required"
    assert payload["vcs"] == "git"
    assert payload["repo_root"] == str(linked.resolve())
    assert payload["durable_root"] == str(linked.resolve())
    assert payload["default_workspace"] == str(root.resolve())
    assert payload["active_workspace"] == str(linked.resolve())
    assert payload["state_root"] == str(root.resolve())
    assert payload["workspace_label"] == "feat/refunds"
    # the suggestion is what the branch names, not the whole label slugged,
    # so bootstrapping it produces an ID this same branch resolves to
    assert payload["suggested_work_id"] == "refunds"
    assert payload["existing_work_ids"] == []
    assert "work_dir" not in payload

    # existing streams come from the default source tree, the only tree that
    # carries .state/, never from the secondary worktree
    for work_id in ("refunds", "other-work"):
        (root / ".state/works" / work_id).mkdir(parents=True)
    completed, payload = run_resolver(linked)

    assert completed.returncode == 0, completed.stderr
    assert payload["work_id"] == "refunds"
    assert payload["work_id_source"] == "git_branch"
    assert payload["work_dir"] == str(root.resolve() / ".state/works/refunds")


def test_single_pr_and_stacked_branches_resolve_to_their_stream(
    tmp_path: Path,
) -> None:
    root = tmp_path / "stacked"
    initialize_git(root)
    commit_initial(root)
    (root / ".state/works/work-id-naming").mkdir(parents=True)
    (root / ".state/works/unrelated-work").mkdir(parents=True)

    # a stream that is one PR is the branch alone; a stream split into a stack
    # or sub-tasks is numbered beneath it. Both select it without asking.
    for branch in (
        "feat/work-id-naming",
        "feat/work-id-naming/01-resolver",
        "feat/work-id-naming/02-contract",
        "fix/work-id-naming",  # the type describes the branch, not the identity
    ):
        git("checkout", "-q", "--orphan", branch, cwd=root)
        completed, payload = run_resolver(root)

        assert completed.returncode == 0, completed.stderr
        assert payload["work_id"] == "work-id-naming", branch
        assert payload["work_id_source"] == "git_branch", branch

    # a longer name that merely begins like the stream is its own topic, and
    # a single-digit ordinal is not the documented shape; neither resolves,
    # and two candidates leave nothing to fall back to
    for branch in (
        "feat/work-id-naming-rewrite",  # its own topic, not this stream
        "feat/work-id-naming/3-late",  # ordinals are exactly two digits
        "feat/work-id-naming/00-prep",  # and run 01-99, so 00 is not a slice
        "feat/work-id-naming/123-late",  # three digits is not the shape either
        "feature/work-id-naming",  # `feature` is not a conventional type
        "work-id-naming",  # a bare branch is not a branch shape
        "feat/work_id_naming",  # matched as written, never slugged
    ):
        git("checkout", "-q", "--orphan", branch, cwd=root)
        completed, payload = run_resolver(root)

        assert completed.returncode == 4, completed.stderr
        assert payload["status"] == "work_id_required", branch


def test_length_is_a_convention_while_shape_is_a_requirement(
    tmp_path: Path,
) -> None:
    root = tmp_path / "bounded"
    initialize_git(root)
    commit_initial(root)
    legacy = "legacy-" + "x" * 34
    (root / ".state/works" / legacy).mkdir(parents=True)

    # a stream created before the bound existed keeps its name, and the
    # workflows that resume it forward that exact ID back
    completed, payload = run_resolver(root, legacy)

    assert completed.returncode == 0, completed.stderr
    assert payload["work_id"] == legacy

    # its conforming branch resumes it too — matching an existing stream
    # never applies a minting rule
    git("checkout", "-q", "-b", f"feat/{legacy}", cwd=root)
    completed, payload = run_resolver(root)

    assert completed.returncode == 0, completed.stderr
    assert payload["work_id"] == legacy
    assert payload["work_id_source"] == "git_branch"

    # the bound is a convention, so naming a longer stream deliberately is
    # honoured even when nothing of that name exists yet
    minted = "brand-new-" + "y" * 31
    completed, payload = run_resolver(root, minted)

    assert completed.returncode == 0, completed.stderr
    assert payload["work_id"] == minted

    # the shape is not a convention: a name outside the grammar does not
    # survive the trip through a path and a branch, so minting one is refused
    completed, payload = run_resolver(root, "foo--bar")

    assert completed.returncode == 2
    assert "single-hyphen" in payload["error"]

    # nor is the path-component limit: resolving a name the bootstrap that
    # must follow cannot create would only move the failure one step later
    completed, payload = run_resolver(root, "a" * 256)

    assert completed.returncode == 2
    assert "path component" in payload["error"]


def test_a_parked_stream_still_owns_its_name(tmp_path: Path) -> None:
    root = tmp_path / "parked"
    initialize_git(root)
    commit_initial(root)
    (root / ".state/archive/refunds").mkdir(parents=True)
    (root / ".state/works/unrelated-work").mkdir(parents=True)

    # minting beside it would leave two streams with one identity and no way
    # to tell which one unparks
    completed, payload = run_resolver(root, "refunds")

    assert completed.returncode == 2
    assert "parked stream" in payload["error"]

    # nor is it offered, so the PM cannot accept it by reflex
    git("checkout", "-q", "-b", "feat/refunds", cwd=root)
    completed, payload = run_resolver(root)

    assert completed.returncode == 4, completed.stderr
    assert payload["suggested_work_id"] is None


def test_a_label_that_folds_to_nothing_still_blocks_the_sole_fallback(
    tmp_path: Path,
) -> None:
    root = tmp_path / "unfoldable"
    initialize_git(root)
    commit_initial(root)
    (root / ".state/works/unrelated-work").mkdir(parents=True)
    git("checkout", "-q", "-b", "\u5f71\u5e2b\u55ce", cwd=root)

    completed, payload = run_resolver(root)

    assert completed.returncode == 4, completed.stderr
    assert payload["status"] == "work_id_required"


@pytest.mark.parametrize("segment", ("z" * 33, "foo--bar"))
def test_a_segment_outside_the_naming_contract_is_never_suggested(
    segment: str, tmp_path: Path
) -> None:
    root = tmp_path / f"uncanonical-{len(segment)}"
    initialize_git(root)
    commit_initial(root)
    (root / ".state/works/unrelated-work").mkdir(parents=True)
    git("checkout", "-q", "-b", f"feat/{segment}", cwd=root)

    completed, payload = run_resolver(root)

    # a proposal is this contract speaking, so it stays inside the contract:
    # over the byte convention, or outside the grammar bootstrap refuses
    assert completed.returncode == 4, completed.stderr
    assert payload["suggested_work_id"] is None


def test_feature_branch_does_not_select_a_mismatched_sole_work_id(
    tmp_path: Path,
) -> None:
    root = tmp_path / "main workspace"
    linked = tmp_path / "linked workspace"
    initialize_git(root)
    commit_initial(root)
    git("worktree", "add", "-q", "-b", "feature/refunds", str(linked), cwd=root)
    (root / ".state/works/unrelated-work").mkdir(parents=True)

    completed, payload = run_resolver(linked)

    assert completed.returncode == 4, completed.stderr
    assert payload["status"] == "work_id_required"
    # the label is meaningful enough to block the sole-existing fallback, but
    # not a shape this contract defines, so it suggests nothing to accept
    assert payload["suggested_work_id"] is None
    assert payload["existing_work_ids"] == ["unrelated-work"]


def test_explicit_then_environment_then_existing_selection_order(
    tmp_path: Path,
) -> None:
    root = tmp_path / "selection"
    initialize_git(root)
    (root / ".state/works/existing").mkdir(parents=True)

    completed, payload = run_resolver(
        root, "explicit", environment_work_id="environment"
    )
    assert completed.returncode == 0, completed.stderr
    assert payload["work_id"] == "explicit"
    assert payload["work_id_source"] == "argument"

    completed, payload = run_resolver(root, environment_work_id="environment")
    assert completed.returncode == 0, completed.stderr
    assert payload["work_id"] == "environment"
    assert payload["work_id_source"] == "environment"

    completed, payload = run_resolver(root)
    assert completed.returncode == 0, completed.stderr
    assert payload["work_id"] == "existing"
    assert payload["work_id_source"] == "sole_existing"


def test_accepts_spaced_and_equals_option_forms(tmp_path: Path) -> None:
    root = tmp_path / "option forms"
    initialize_git(root)

    spaced, spaced_payload = run_resolver(root, "eng-421-spaced")
    equals = subprocess.run(
        [
            SYSTEM_BASH,
            str(RESOLVER),
            f"--path={root}",
            "--work-id=eng-421-equals",
        ],
        text=True,
        capture_output=True,
        check=False,
    )
    equals_payload = json.loads(equals.stdout)

    assert spaced.returncode == 0, spaced.stderr
    assert spaced_payload["work_id"] == "eng-421-spaced"
    assert equals.returncode == 0, equals.stderr
    assert equals_payload["work_id"] == "eng-421-equals"
    assert equals_payload["work_id_source"] == "argument"

    help_result = subprocess.run(
        [SYSTEM_BASH, str(RESOLVER), "--help"],
        text=True,
        capture_output=True,
        check=False,
    )
    assert help_result.returncode == 0
    assert "--work-id=<id>" in help_result.stderr
    assert "--path=<path>" in help_result.stderr
    assert "--bootstrap" in help_result.stderr


def test_pm_bootstrap_creates_only_missing_entrypoints(tmp_path: Path) -> None:
    root = tmp_path / "bootstrap"
    initialize_git(root)
    work_id = "eng-421-bootstrap"

    resolved, resolved_payload = run_resolver(root, work_id)
    work_dir = Path(resolved_payload["work_dir"])

    assert resolved.returncode == 0, resolved.stderr
    assert not resolved_payload["bootstrap_requested"]
    assert resolved_payload["bootstrap_created"] == []
    assert not work_dir.exists()

    created, created_payload = run_resolver(root, work_id, bootstrap=True)

    goal = work_dir / "goal.md"
    working = work_dir / "state/working.md"
    state = work_dir / "state.md"
    journal = work_dir / "state/journal.md"
    assert created.returncode == 0, created.stderr
    assert created_payload["bootstrap_requested"]
    assert created_payload["bootstrap_created"] == [
        str(goal),
        str(working),
        str(state),
        str(journal),
    ]
    assert created_payload["bootstrap_existing"] == []

    custom_working = "# Preserved owner state\n\nDo not replace me.\n"
    working.write_text(custom_working, encoding="utf-8")
    state.unlink()

    repaired, repaired_payload = run_resolver(root, work_id, bootstrap=True)

    assert repaired.returncode == 0, repaired.stderr
    assert repaired_payload["bootstrap_created"] == [str(state)]
    assert repaired_payload["bootstrap_existing"] == [
        str(goal),
        str(working),
        str(journal),
    ]
    assert working.read_text(encoding="utf-8") == custom_working
    assert state.is_file()


def test_bootstrap_writes_the_current_state_vocabulary(tmp_path: Path) -> None:
    root = tmp_path / "bootstrap vocabulary"
    initialize_git(root)
    work_id = "bootstrap-vocabulary"

    created, payload = run_resolver(root, work_id, bootstrap=True)
    assert created.returncode == 0, created.stderr
    work_dir = Path(payload["work_dir"])

    state = (work_dir / "state.md").read_text(encoding="utf-8")
    # a newborn stream is not blocked, and absence is how that is recorded:
    # writing any `Blocked on:` value here would invent a blocker
    assert "- Phase: `planned`\n" in state
    assert "Blocked on" not in state
    # `Motion` is retired entirely — `running` was never durably true and a
    # typed `idle <N>d` is a stored projection of `Last progress`
    assert "Motion" not in state
    # one key per line, never packed: a reader anchored at one key per line
    # takes the packed form as neither field, and every phase-gated check on
    # this stream then reads a confident zero
    assert " · " not in state
    assert "Lifecycle status" not in state

    goal = (work_dir / "goal.md").read_text(encoding="utf-8")
    # a bootstrap has had no operator conversation, so any other value would
    # claim a provenance the criteria below it do not have
    assert "- Charter: `absent`" in goal

    # the birth path cannot mint the vocabulary the contract retired, or every
    # stream created after this upgrade is born needing migration
    for retired in ("initialized", "`active`", "`blocked`", "retiring", "motion"):
        for name in ("goal.md", "state.md", "state/working.md", "state/journal.md"):
            assert retired not in (work_dir / name).read_text(encoding="utf-8"), name


def test_bootstrap_cannot_bypass_identity_or_ignore_gates(tmp_path: Path) -> None:
    root = tmp_path / "bootstrap gates"
    initialize_git(root, ignored=False)

    identity = subprocess.run(
        [SYSTEM_BASH, str(RESOLVER), "--path", str(root), "--bootstrap"],
        text=True,
        capture_output=True,
        check=False,
    )
    identity_payload = json.loads(identity.stdout)
    assert identity.returncode == 4
    assert identity_payload["status"] == "work_id_required"
    assert not (root / ".state").exists()

    ignored, ignored_payload = run_resolver(root, "eng-421-gated", bootstrap=True)
    assert ignored.returncode == 3
    assert ignored_payload["status"] == "requires_ignore"
    assert not (root / ".state").exists()


def test_bootstrap_rejects_symlinked_work_root_without_external_writes(
    tmp_path: Path,
) -> None:
    root = tmp_path / "bootstrap symlink"
    outside = tmp_path / "outside"
    initialize_git(root)
    outside.mkdir()
    (root / ".state").mkdir()
    (root / ".state/works").symlink_to(outside, target_is_directory=True)

    completed, payload = run_resolver(root, "eng-421-symlink", bootstrap=True)

    assert completed.returncode == 2
    assert payload["status"] == "invalid"
    assert "must not be a symlink" in payload["error"]
    assert list(outside.iterdir()) == []


def test_normal_resolution_rejects_symlinked_work_root_explicit_and_auto(
    tmp_path: Path,
) -> None:
    root = tmp_path / "normal symlink"
    outside = tmp_path / "outside"
    initialize_git(root)
    (outside / "eng-421-symlink").mkdir(parents=True)
    (root / ".state").mkdir()
    (root / ".state/works").symlink_to(outside, target_is_directory=True)

    explicit, explicit_payload = run_resolver(root, "eng-421-symlink")
    automatic, automatic_payload = run_resolver(root)

    for completed, payload in (
        (explicit, explicit_payload),
        (automatic, automatic_payload),
    ):
        assert completed.returncode == 2
        assert payload["status"] == "invalid"
        assert "must not be a symlink" in payload["error"]


def test_normal_and_bootstrap_resolution_reject_symlinked_entrypoint(
    tmp_path: Path,
) -> None:
    root = tmp_path / "entrypoint symlink"
    outside = tmp_path / "outside-state.md"
    initialize_git(root)
    work_dir = root / ".state/works/eng-421-symlink"
    work_dir.mkdir(parents=True)
    outside.write_text("outside must remain unchanged\n", encoding="utf-8")
    (work_dir / "state.md").symlink_to(outside)

    automatic, automatic_payload = run_resolver(root)
    bootstrap, bootstrap_payload = run_resolver(root, "eng-421-symlink", bootstrap=True)

    for completed, payload in (
        (automatic, automatic_payload),
        (bootstrap, bootstrap_payload),
    ):
        assert completed.returncode == 2
        assert payload["status"] == "invalid"
        assert "entrypoint must not be a symlink" in payload["error"]
    assert outside.read_text(encoding="utf-8") == "outside must remain unchanged\n"


def test_the_collision_list_covers_archived_ids_without_resolving_them(
    tmp_path: Path,
) -> None:
    """An archived ID is spoken for, but it is not a live stream.

    `archive/` is the only thing holding a retired name against reuse, so a
    collision list built from `works/` alone reports a name as free that is
    not. Folding the two into one list is the opposite failure — a parked
    stream then resolves as live — so this pins both halves at once.
    """
    root = tmp_path / "collision"
    initialize_git(root)
    commit_initial(root)
    # two live streams, so the sole_existing shortcut cannot fire and the
    # ambiguous response — the one that carries the collision list — is reached
    for work_id in ("live-work", "other-work"):
        (root / ".state/works" / work_id).mkdir(parents=True)
    (root / ".state/archive/parked-work").mkdir(parents=True)

    completed, payload = run_resolver(root)

    assert completed.returncode == 4
    assert payload["existing_work_ids"] == ["live-work", "other-work", "parked-work"]

    # ...and the archived one still does not resolve as a live stream
    git("checkout", "-q", "-b", "feat/parked-work", cwd=root)
    completed, payload = run_resolver(root)
    assert completed.returncode == 4, completed.stderr
    assert payload["status"] == "work_id_required"
    assert not payload["suggested_work_id"]


def test_returns_structured_ambiguity_and_uses_workspace_match(
    tmp_path: Path,
) -> None:
    root = tmp_path / "main"
    linked = tmp_path / "linked"
    initialize_git(root)
    commit_initial(root)
    for work_id in ("eng-42", "eng-99"):
        (root / ".state/works" / work_id).mkdir(parents=True)

    completed, payload = run_resolver(root)

    assert completed.returncode == 4
    assert payload["status"] == "work_id_required"
    assert payload["existing_work_ids"] == ["eng-42", "eng-99"]
    assert payload["workspace_label"] == "main"

    # a bare one-segment Git branch is not a documented branch shape, so it
    # names nothing even when a stream happens to share its name
    git("worktree", "add", "-q", "-b", "eng-42", str(linked), cwd=root)
    for work_id in ("eng-42", "eng-99"):
        (linked / ".state/works" / work_id).mkdir(parents=True)
    completed, payload = run_resolver(linked)

    assert completed.returncode == 4, completed.stderr
    assert payload["status"] == "work_id_required"

    git("checkout", "-q", "-b", "feat/eng-42", cwd=linked)
    completed, payload = run_resolver(linked)

    assert completed.returncode == 0, completed.stderr
    assert payload["work_id"] == "eng-42"
    assert payload["work_id_source"] == "git_branch"


def test_generic_workspace_without_existing_work_requires_selection(
    tmp_path: Path,
) -> None:
    root = tmp_path / "main"
    initialize_git(root)

    completed, payload = run_resolver(root)

    assert completed.returncode == 4
    assert payload["status"] == "work_id_required"
    assert payload["existing_work_ids"] == []
    assert payload["suggested_work_id"] is None


def test_work_id_required_carries_the_grammar_not_just_existing_names(
    tmp_path: Path,
) -> None:
    root = tmp_path / "main"
    initialize_git(root)
    commit_initial(root)
    # every stream on disk here was minted under none of the current rules,
    # which is the real starting condition: a reader with only this list in
    # front of it infers the format from it and mints a 29th name like them
    legacy = ("20260727-feat-refunds-v5cfxb", "20260721-fix-ingest-a54yx4")
    for work_id in legacy:
        (root / ".state/works" / work_id).mkdir(parents=True)

    completed, payload = run_resolver(root)

    assert completed.returncode == 4
    assert payload["status"] == "work_id_required"
    # the list is a collision check, and says so in its own name
    assert payload["existing_work_ids"] == sorted(legacy)
    assert "candidate_work_ids" not in payload
    assert "collision" in payload["error"]
    assert "not examples of the format" in payload["error"]
    # the format arrives with the response, so nobody has to read it off the
    # names above — including the three shapes those names demonstrate
    grammar = payload["work_id_grammar"]
    assert "^[a-z0-9]+(-[a-z0-9]+)*$" in grammar
    for anti_pattern in ("no date prefix", "no type prefix", "no random suffix"):
        assert anti_pattern in grammar
    # and the pointer resolves, so the full rule is one read away
    naming = Path(payload["naming_reference"])
    assert naming == ESSENTIAL / "references/naming.md"
    assert naming.is_file()


def test_requires_pm_ignore_bootstrap_after_selection(tmp_path: Path) -> None:
    root = tmp_path / "missing ignore"
    initialize_git(root, ignored=False)

    completed, payload = run_resolver(root, "eng-421-test")

    assert completed.returncode == 3
    assert payload["status"] == "requires_ignore"
    assert payload["ignore_file"] == str(root.resolve() / ".gitignore")
    assert "PM must add .state/" in payload["error"]

    (root / ".gitignore").write_text(".state/\n", encoding="utf-8")
    completed, payload = run_resolver(root, "eng-421-test")

    assert completed.returncode == 0, completed.stderr
    assert payload["status"] == "resolved"
    assert payload["state_ignored"]


def test_rejects_later_ignore_negation(tmp_path: Path) -> None:
    root = tmp_path / "negated ignore"
    initialize_git(root, ignored=False)
    (root / ".gitignore").write_text(".state/\n!.state/\n", encoding="utf-8")

    completed, payload = run_resolver(root, "eng-421-test")

    assert completed.returncode == 3
    assert payload["status"] == "requires_ignore"
    assert payload["ignore_file"] == str(root.resolve() / ".gitignore")


def test_secondary_worktree_ignore_does_not_satisfy_the_default_tree_gate(
    tmp_path: Path,
) -> None:
    root = tmp_path / "main"
    linked = tmp_path / "linked"
    initialize_git(root, ignored=False)
    commit_initial(root)
    git("worktree", "add", "-q", "-b", "linked", str(linked), cwd=root)
    (linked / ".gitignore").write_text(".state/\n", encoding="utf-8")

    completed, payload = run_resolver(linked, "eng-421-test")

    # .state/ lives only in the default source tree, so it is that
    # tree's .gitignore the gate reads, not the active worktree's
    assert completed.returncode == 3, completed.stderr
    assert payload["status"] == "requires_ignore"
    assert payload["state_root"] == str(root.resolve())
    assert payload["ignore_file"] == str(root.resolve() / ".gitignore")
    assert "notion_dir" not in payload


def test_default_tree_ignore_covers_work_from_a_secondary_worktree(
    tmp_path: Path,
) -> None:
    root = tmp_path / "main"
    linked = tmp_path / "linked"
    initialize_git(root)
    commit_initial(root)
    git("worktree", "add", "-q", "-b", "linked", str(linked), cwd=root)

    completed, payload = run_resolver(linked, "eng-421-test")

    assert completed.returncode == 0, completed.stderr
    assert payload["status"] == "resolved"
    assert payload["state_ignored"]
    assert payload["state_root"] == str(root.resolve())
    assert payload["active_workspace"] == str(linked.resolve())
    assert payload["durable_root"] == str(linked.resolve())
    assert payload["work_dir"] == str(root.resolve() / ".state/works/eng-421-test")


def test_state_root_falls_back_to_a_sole_workspace(tmp_path: Path) -> None:
    root = tmp_path / "main"
    initialize_git(root)
    commit_initial(root)

    completed, payload = run_resolver(root, "eng-421-test")

    # with no linked worktrees the sole workspace is its own state root
    assert completed.returncode == 0, completed.stderr
    assert payload["status"] == "resolved"
    assert payload["state_root"] == str(root.resolve())
    assert payload["active_workspace"] == payload["state_root"]


def test_refuses_invalid_work_ids_and_non_repository(tmp_path: Path) -> None:
    for work_id in ("UPPER", "bad/path", "-leading"):
        completed, payload = run_resolver(tmp_path, work_id)
        assert completed.returncode == 2, work_id
        assert payload["status"] == "invalid", work_id

    completed, payload = run_resolver(tmp_path, "valid-id")
    assert completed.returncode == 2
    assert payload["status"] == "invalid"
    assert "not inside" in payload["error"]

    completed, payload = run_resolver(tmp_path, environment_work_id="INVALID")
    assert completed.returncode == 2
    assert "environment" in payload["error"]


def test_resolves_pure_jj_workspace_with_fake_cli(tmp_path: Path) -> None:
    default = tmp_path / "jj default"
    secondary = tmp_path / "jj secondary"
    git_dir = tmp_path / "backing.git"
    fake_bin = tmp_path / "bin"
    default.mkdir()
    secondary.mkdir()
    fake_bin.mkdir()
    git("init", "--bare", "-q", str(git_dir), cwd=tmp_path)
    (default / ".gitignore").write_text(".state/\n", encoding="utf-8")
    (default / ".state/works/secondary").mkdir(parents=True)
    fake_jj = fake_bin / "jj"
    fake_jj.write_text(
        "#!/bin/sh\n"
        '[ "$1" = --ignore-working-copy ] && shift\n'
        'case "$1:$2" in\n'
        "  root:) printf '%s\\n' \"$JJ_ACTIVE_ROOT\" ;;\n"
        "  git:root) printf '%s\\n' \"$JJ_GIT_DIR\" ;;\n"
        "  workspace:list) printf 'default\\nsecondary\\n' ;;\n"
        "  workspace:root)\n"
        '    if [ "${3:-}" = --name ] && [ "${4:-}" = default ]; then\n'
        "      printf '%s\\n' \"$JJ_DEFAULT_ROOT\"\n"
        '    elif [ "${3:-}" = --name ] && [ "${4:-}" = secondary ]; then\n'
        "      printf '%s\\n' \"$JJ_ACTIVE_ROOT\"\n"
        "    else\n"
        "      printf '%s\\n' \"$JJ_ACTIVE_ROOT\"\n"
        "    fi ;;\n"
        "  *) exit 1 ;;\n"
        "esac\n",
        encoding="utf-8",
    )
    fake_jj.chmod(0o755)
    environment = {
        "PATH": f"{fake_bin}:{os.environ['PATH']}",
        "JJ_ACTIVE_ROOT": str(secondary),
        "JJ_DEFAULT_ROOT": str(default),
        "JJ_GIT_DIR": str(git_dir),
    }

    completed, payload = run_resolver(secondary, extra_environment=environment)

    assert completed.returncode == 0, completed.stderr
    assert payload["vcs"] == "jj"
    assert payload["default_workspace"] == str(default.resolve())
    assert payload["active_workspace"] == str(secondary.resolve())
    assert payload["state_root"] == str(default.resolve())
    assert payload["work_id"] == "secondary"
    assert payload["work_id_source"] == "jj_workspace"
    assert payload["work_dir"] == str(default.resolve() / ".state/works/secondary")


@pytest.mark.skipif(not shutil.which("jj"), reason="jj is unavailable")
def test_resolves_default_and_secondary_jj_workspaces(tmp_path: Path) -> None:
    root = tmp_path / "jj default"
    secondary = tmp_path / "jj secondary"
    subprocess.run(
        ["jj", "git", "init", "--colocate", str(root)],
        text=True,
        capture_output=True,
        check=True,
    )
    (root / ".gitignore").write_text(".state/\n", encoding="utf-8")
    subprocess.run(
        ["jj", "workspace", "add", "--name", "secondary", str(secondary)],
        cwd=root,
        text=True,
        capture_output=True,
        check=True,
    )
    (root / ".state/works/secondary").mkdir(parents=True)

    completed, payload = run_resolver(secondary)

    assert completed.returncode == 0, completed.stderr
    assert payload["vcs"] == "jj"
    assert payload["default_workspace"] == str(root.resolve())
    assert payload["active_workspace"] == str(secondary.resolve())
    assert payload["durable_root"] == str(secondary.resolve())
    assert payload["repo_root"] == str(secondary.resolve())
    assert payload["state_root"] == str(root.resolve())
    assert payload["work_id"] == "secondary"
    assert payload["work_id_source"] == "jj_workspace"
    assert payload["work_dir"] == str(root.resolve() / ".state/works/secondary")
    assert payload["ignore_file"] == str(root.resolve() / ".gitignore")
    assert payload["state_ignored"]


@pytest.mark.skipif(not shutil.which("jj"), reason="jj is unavailable")
def test_allows_jj_repository_without_registered_default(tmp_path: Path) -> None:
    root = tmp_path / "jj primary"
    subprocess.run(
        ["jj", "git", "init", "--colocate", str(root)],
        text=True,
        capture_output=True,
        check=True,
    )
    subprocess.run(
        ["jj", "workspace", "rename", "primary"],
        cwd=root,
        text=True,
        capture_output=True,
        check=True,
    )
    (root / ".gitignore").write_text(".state/\n", encoding="utf-8")
    (root / ".state/works/primary").mkdir(parents=True)

    completed, payload = run_resolver(root)

    assert completed.returncode == 0, completed.stderr
    assert payload["status"] == "resolved"
    assert payload["default_workspace"] is None
    assert payload["work_id"] == "primary"


# repository ignore contract


def test_state_transport_and_work_state_are_ignored(tmp_path: Path) -> None:
    root = tmp_path / "ignore-contract"
    root.mkdir()
    subprocess.run(
        ["git", "init", "-q"], cwd=root, text=True, capture_output=True, check=True
    )
    shutil.copyfile(REPOSITORY / ".gitignore", root / ".gitignore")
    paths = (
        ".state/notion/example.mdc",
        ".state/works/test/state.md",
    )
    completed = subprocess.run(
        ["git", "check-ignore", "--no-index", *paths],
        cwd=root,
        text=True,
        capture_output=True,
        check=False,
    )

    assert completed.returncode == 0, completed.stderr
    assert completed.stdout.splitlines() == list(paths)


# context hook contract


@pytest.fixture
def context_root(tmp_path: Path) -> Path:
    root = tmp_path / "context fixture"
    root.mkdir()
    subprocess.run(
        ["git", "init", "-q"], cwd=root, text=True, capture_output=True, check=True
    )
    subprocess.run(
        ["git", "symbolic-ref", "HEAD", "refs/heads/main"],
        cwd=root,
        text=True,
        capture_output=True,
        check=True,
    )
    (root / ".gitignore").write_text(".state/\n", encoding="utf-8")
    for relative in (
        "README.md",
        "CONTEXT.md",
        ".state/works/eng-42/state/working.md",
        ".state/works/eng-42/state.md",
        "docs/README.md",
        "docs/architecture/README.md",
        "docs/architecture/runtime-boundaries.md",
        "docs/design/README.md",
        "docs/design/system.md",
        "docs/design/checkout-flow.md",
        "docs/specs/README.md",
        "docs/specs/accounts/README.md",
        "docs/specs/accounts/session.md",
    ):
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.touch()
    return root


def run_hook(root: Path, executable: Path, input_text: str = "") -> str:
    environment = os.environ.copy()
    environment.pop("STATE_WORK_ID", None)
    completed = subprocess.run(
        [str(executable)],
        cwd=root,
        input=input_text,
        text=True,
        capture_output=True,
        check=False,
        env=environment,
    )
    assert completed.returncode == 0, completed.stderr
    payload = json.loads(completed.stdout)
    return payload["hookSpecificOutput"]["additionalContext"]


def assert_context_contract(context: str) -> None:
    assert "\\n" not in context
    assert "CONTEXT.md" not in context
    expected = (
        ".state/works/eng-42/state/working.md",
        ".state/works/eng-42/state.md",
        "docs/README.md",
        "docs/architecture/README.md",
        "docs/design/README.md",
        "docs/specs/README.md",
    )
    for path in expected:
        assert path in context
    for first, second in itertools.pairwise(expected):
        assert context.index(first) < context.index(second)
    for detail in (
        "docs/architecture/runtime-boundaries.md",
        "docs/design/system.md",
        "docs/design/checkout-flow.md",
        "docs/specs/accounts/README.md",
        "docs/specs/accounts/session.md",
    ):
        assert detail not in context


def test_session_start_injects_ordered_state_entrypoints(
    context_root: Path,
) -> None:
    context = run_hook(context_root, SESSION_START, '{"source":"startup"}\n')
    assert_context_contract(context)


def test_subagent_start_omits_repository_and_work_catalogs(
    context_root: Path,
) -> None:
    context = run_hook(context_root, SUBAGENT_START)
    assert "**Working directory**" in context
    assert "Standards:" in context
    assert "## Target Repo Documents" not in context
    for path in (
        "README.md",
        ".state/works/eng-42/state/working.md",
        ".state/works/eng-42/state.md",
        "docs/README.md",
    ):
        assert path not in context


def test_context_root_discovery_supports_pure_jj_subdirectories(
    tmp_path: Path,
) -> None:
    jj_root = tmp_path / "pure jj"
    subdirectory = jj_root / "nested/project"
    fake_bin = tmp_path / "fake-bin"
    subdirectory.mkdir(parents=True)
    fake_bin.mkdir()
    fake_jj = fake_bin / "jj"
    fake_jj.write_text(
        "#!/bin/sh\n"
        '[ "$1" = --ignore-working-copy ] && shift\n'
        '[ "$1" = root ] || exit 1\n'
        "printf '%s\\n' \"$JJ_ACTIVE_ROOT\"\n",
        encoding="utf-8",
    )
    fake_jj.chmod(0o755)
    environment = os.environ.copy()
    environment["PATH"] = f"{fake_bin}:{environment['PATH']}"
    environment["JJ_ACTIVE_ROOT"] = str(jj_root)
    completed = subprocess.run(
        [
            "bash",
            "-c",
            f'source "{ESSENTIAL / "hooks/scripts/context.sh"}"; get_repo_root',
        ],
        cwd=subdirectory,
        text=True,
        capture_output=True,
        check=False,
        env=environment,
    )

    assert completed.returncode == 0, completed.stderr
    assert completed.stdout.strip() == str(jj_root)
