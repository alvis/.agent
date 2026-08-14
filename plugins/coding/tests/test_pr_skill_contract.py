import json
import os
import re
import runpy
import shutil
import subprocess
from itertools import pairwise
from pathlib import Path

import pytest

PLUGIN = Path(__file__).resolve().parents[1]
WRITE_PR = PLUGIN / "skills" / "pr"
PR_SKILL = WRITE_PR / "SKILL.md"
SIZE_THRESHOLDS = WRITE_PR / "assets" / "size-thresholds.json"
CLASSIFIER = WRITE_PR / "scripts" / "classify-pr-size.py"
MESSAGE_SCANNER = WRITE_PR / "scripts" / "scan-pr-message.py"
LABEL_LISTER = WRITE_PR / "scripts" / "list-repository-labels.sh"
COMMIT_SKILL = PLUGIN / "skills" / "commit" / "SKILL.md"
COMMIT_DIRECTIONS = (
    PLUGIN / "skills" / "commit" / "references" / "conventional-commits.md"
)
PARTIAL_TO_BRANCH = (
    PLUGIN / "skills" / "commit" / "references" / "workflow-partial-to-branch.md"
)
CORRECT_MERGED = (
    PLUGIN / "skills" / "commit" / "references" / "workflow-correct-merged.md"
)
CREATE_UPDATE = WRITE_PR / "references" / "create-update.md"
VERIFY_CI_PARITY = WRITE_PR / "references" / "verify-ci-parity.md"
STACKED_PRS = WRITE_PR / "references" / "stacked-prs.md"
REVIEW_WORKFLOW = WRITE_PR / "references" / "review-workflow.md"
MERGE_WORKFLOW = WRITE_PR / "references" / "merge.md"
GIT_STANDARD = PLUGIN / "standards" / "git"
MESSAGE_TEMPLATE = WRITE_PR / "templates" / "message.md"
INLINE_REVIEW_TEMPLATE = WRITE_PR / "templates" / "inline-review.md"
OVERALL_REVIEW_TEMPLATE = WRITE_PR / "templates" / "overall-review.md"
GIT_RULE_FILES = {
    "GIT-PR-02.md",
    "GIT-PR-SIZE-01.md",
    "GIT-PR-SIZE-02.md",
    "GIT-PR-SIZE-03.md",
    "GIT-PR-SIZE-04.md",
    "GIT-PR-STACK-04.md",
    "GIT-PR-TYPE-02.md",
    "GIT-PR-TYPE-03.md",
    "GIT-PR-TYPE-04.md",
    "GIT-PR-TYPE-05.md",
}


def _fenced_block_containing(markdown: str, token: str) -> str:
    blocks = re.findall(r"```(?:bash|text)\n(.*?)```", markdown, re.DOTALL)
    matches = [block for block in blocks if token in block]
    assert len(matches) == 1
    return matches[0]


def _run_shell_contract(block: str, environment: dict[str, str]) -> dict[str, str]:
    completed = _run_shell_contract_result(block, environment)
    completed.check_returncode()
    return dict(line.split("=", 1) for line in completed.stdout.splitlines())


def _run_shell_contract_result(
    block: str, environment: dict[str, str]
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash"],
        input=block,
        env={**os.environ, **environment},
        check=False,
        capture_output=True,
        text=True,
    )


def _assert_target_gate_precedes_push(workflow: str) -> None:
    lines = [line.strip() for line in workflow.splitlines()]
    target_definitions = {
        name: [
            index
            for index, line in enumerate(lines)
            if re.match(rf"^{name}=", line)
        ]
        for name in ("TARGET_SHA", "TARGET_BASE")
    }
    gates = [
        index
        for index, line in enumerate(lines)
        if line.startswith("coding:pr verify ")
    ]
    pushes = [
        index
        for index, line in enumerate(lines)
        if line.startswith("jj git push --bookmark")
    ]

    assert len(gates) == 1
    assert pushes
    gate = gates[0]
    assert all(positions and max(positions) < gate for positions in target_definitions.values())
    assert gate < min(pushes)

    invocation = lines[gate]
    assert re.search(r'--target "\$TARGET_SHA"(?:\s|$)', invocation)
    assert re.search(r'--base "\$TARGET_BASE"(?:\s|$)', invocation)


def _assert_links_stay_within_skill(path: Path, skill_root: Path) -> None:
    for target in re.findall(r"\[[^]]+\]\(([^)]+)\)", path.read_text()):
        if "://" in target or target.startswith("#"):
            continue
        resolved = (path.parent / target.split("#", 1)[0]).resolve()
        assert resolved.is_relative_to(skill_root.resolve())
        assert resolved.exists()


def test_authoring_binds_all_deterministic_inputs_and_publication_output() -> None:
    skill = (WRITE_PR / "references" / "create-update.md").read_text()

    assert "`git hash-object -t tree /dev/null`" in skill
    assert "head's `TITLE` and `BODY`" in skill
    assert "base/empty-tree OID" in skill
    assert "template, thresholds, and placeholder map" in skill
    assert "`BREAKING CHANGE:` footers" in skill


def test_canonical_message_template_carries_section_authoring_guidance() -> None:
    template = MESSAGE_TEMPLATE.read_text()

    assert "\n📌\n" in template
    assert "## 🎯 Goal" in template
    assert "## ✅ Requirements" in template
    assert "observable behavior" in template
    assert "generic gates" in template
    headings = [line for line in template.splitlines() if line.startswith("## ")]
    assert all(not heading[3].isascii() for heading in headings)
    required_headings = {
        heading for heading in headings if not heading.endswith("[ Optional ]")
    }
    optional_headings = [
        heading for heading in headings if heading not in required_headings
    ]

    assert required_headings == {
        "## 🎯 Goal",
        "## ✅ Requirements",
        "## 🧵 Context",
        "## 🧪 Verification",
    }
    assert all(heading.endswith("[ Optional ]") for heading in optional_headings)
    assert "what problem it solves and why" in template
    assert "design patterns" in template
    assert "anything a reader would reasonably expect here" in template
    assert "RFCs, specs, and discussions" in template


def test_version_control_policy_separates_standard_direction_and_templates() -> None:
    commit_direction = COMMIT_SKILL.read_text()
    author_direction = CREATE_UPDATE.read_text()
    stack_direction = STACKED_PRS.read_text()
    review_direction = REVIEW_WORKFLOW.read_text()
    merge_direction = MERGE_WORKFLOW.read_text()
    standard_meta = (GIT_STANDARD / "meta.md").read_text()
    standard_scan = (GIT_STANDARD / "scan.md").read_text()
    inline_review = INLINE_REVIEW_TEMPLATE.read_text()

    assert (GIT_STANDARD / "write.md").is_file()
    assert (GIT_STANDARD / "rules" / "GIT-PR-02.md").is_file()
    assert (GIT_STANDARD / "rules" / "GIT-PR-SIZE-04.md").is_file()
    assert MESSAGE_SCANNER.is_file()
    assert not (WRITE_PR / "templates" / "pr.md").exists()
    assert not (PLUGIN / "directions" / "version-control.md").exists()
    assert {path.name for path in (GIT_STANDARD / "rules").glob("*.md")} == (
        GIT_RULE_FILES
    )
    assert "## Commit and branch directions" in commit_direction
    assert "## Pull-request directions" in author_direction
    assert "## Stack directions" in stack_direction
    assert "## Review directions" in review_direction
    assert "## Merge directions" in merge_direction
    direction_documents = (
        commit_direction,
        author_direction,
        stack_direction,
        review_direction,
        merge_direction,
    )
    assert all("size-thresholds.json" not in content for content in direction_documents)
    for phrase in (
        "at most 15 files",
        "500 authored net LOC",
        "≤ 15 files",
        "≤ 30 files",
        "≤ 60 files",
        "> 60 files",
        "≤ 500 authored",
        "≤ 1200 authored",
        "≤ 2000 authored",
        "> 2000 authored",
    ):
        assert all(phrase not in content for content in direction_documents)
    assert "Run the classifier only after binding" in author_direction
    assert "After rendering and before emission or publication" in author_direction
    assert "Each violation is an issue that" in standard_meta
    assert "scan-pr-message.py" in standard_scan
    assert "classify-pr-size.py" in author_direction
    assert "scan-pr-message.py" in author_direction
    assert "message.md" in author_direction
    assert "inline-review.md" in review_direction
    assert "**{{marker}} {{title}}** — {{body}}" in inline_review
    assert "This file alone owns the posted markup" in inline_review


def test_pr_review_covers_intent_standards_reuse_and_minimality() -> None:
    workflow = (WRITE_PR / "references" / "review-workflow.md").read_text()
    checklist = (WRITE_PR / "references" / "review-checklist.md").read_text()
    template = (WRITE_PR / "templates" / "overall-review.md").read_text()

    assert "Does the PR message state the contract?" not in checklist
    assert "Does it really work as intended?" in checklist
    assert "Does it follow every applicable standard?" in checklist
    assert "Can anything be removed without changing the result?" in checklist
    assert "code, content, tests, helpers, types, fixtures" in checklist
    for standard in (
        "`universal/`",
        "`file-structure/`",
        "`testing/`",
        "`documentation/`",
    ):
        assert standard in workflow
    assert "### 🎯 Goal and Requirements" in template
    assert "{{pr_message_verdict}}" not in template
    assert "{{intent_behavior_verdict}}" in template
    assert "{{reuse_verdict}}" in template
    assert "{{minimality_verdict}}" in template
    assert "PR message and intent" not in template
    assert "scan-pr-message.py" not in workflow
    assert "message scanner" not in checklist


def test_pr_authoring_normalizes_canonical_commit_body_headings() -> None:
    create_update = (WRITE_PR / "references" / "create-update.md").read_text()

    assert "strip its leading emoji token" in create_update
    assert "trailing `[ Optional ]` suffix" in create_update
    assert "canonical template headings and their plain aliases" in create_update


def test_pr_review_template_uses_section_and_zone_emojis() -> None:
    template = (WRITE_PR / "templates" / "overall-review.md").read_text()
    rendered = template.split("```markdown", 1)[1].split("```", 1)[0]
    headings = [line for line in rendered.splitlines() if line.startswith("### ")]

    assert rendered.startswith("\n📌\n\n{{zone_emoji}} Reviewed `{{head_sha_short}}`")
    assert all(not heading[4].isascii() for heading in headings)
    assert "`🟢` green" in template
    assert "`🟡` yellow" in template
    assert "`🔴` red" in template
    assert "`⚫` black" in template


def test_new_stack_authors_against_existing_commit_oids() -> None:
    skill = (WRITE_PR / "references" / "create-update.md").read_text()

    assert "`AUTHOR_BASE_OID`" in skill
    assert "change/commit OID" in skill
    assert "New-stack bookmarks do not yet exist" in skill
    assert '--base "$PR_BASE"' in skill


def test_batch_root_base_is_bound_after_base_resolution_before_both_pushes() -> None:
    workflow = (WRITE_PR / "references" / "create-update.md").read_text()
    normalized = " ".join(workflow.split())

    base_resolution = workflow.index("If the immediate predecessor is selected")
    root_binding = workflow.index("ROOT_BASE=$PR_BASE_01")
    restacks = [
        index
        for index in range(len(workflow))
        if workflow.startswith("scripts/restack.sh", index)
    ]
    assert len(restacks) == 2
    assert base_resolution < root_binding < restacks[0] < restacks[1]
    assert "first selected affected head's exact base" in normalized
    assert (
        "For a suffix restack, `PR_BASE_01` is the unselected predecessor" in normalized
    )
    assert "keep it unchanged for a retry only while" in normalized
    assert "discovery restart or base-map change recomputes it" in normalized


def test_reviewer_evidence_binds_to_the_complete_review_surface() -> None:
    skill = (WRITE_PR / "references" / "create-update.md").read_text()
    template = MESSAGE_TEMPLATE.read_text()

    assert "capture an existing PR's `headRefOid` and" in skill
    assert "`baseRefOid`" in skill
    assert "only where the head or base OID changed" in skill
    assert "head/base OID pairs" in template
    assert "no-op publication preserves evidence" in template
    assert "unchanged pair" in template
    assert "standard-owned" in template
    assert "<base-oid>" in template
    assert '--head-oid "$HEAD_OID"' in skill
    assert '--base-oid "$BASE_OID"' in skill
    assert "--allow-pending-reviewers" in skill
    review = REVIEW_WORKFLOW.read_text()
    assert '--base "$BASE_OID" --head "$HEAD_OID"' in review
    assert "scan-pr-message.py" not in review


def test_pr_title_regex_and_ready_transition_preserve_directions() -> None:
    workflow = CREATE_UPDATE.read_text()

    assert r"(\([\w./-]+\))?!?: .+" in workflow
    assert r"(?:,\s*[\w./-]+)?" not in workflow
    assert "Leave draft only after CI passes" in workflow
    assert "author self-reviews the diff" in workflow
    assert "every lower stack PR has merged or is" in workflow


def test_review_ledger_retains_raw_finding_fields_for_recovery() -> None:
    checklist = (WRITE_PR / "references" / "review-checklist.md").read_text()
    publishing = (WRITE_PR / "references" / "review-publishing.md").read_text()

    assert "title: <concise raw title" in checklist
    assert "body: <raw explanatory body" in checklist
    assert "authoritative raw finding" in checklist
    assert "raw finding's `title` and `body`" in publishing


def test_rereview_body_reports_only_changed_previous_verdicts() -> None:
    template = OVERALL_REVIEW_TEMPLATE.read_text()
    workflow = REVIEW_WORKFLOW.read_text()
    publishing = (WRITE_PR / "references" / "review-publishing.md").read_text()

    assert "### 🔄 Previous reports" in template
    assert "### ✅ Previous" not in template
    assert "immediately preceding review" in template
    assert "Omit unchanged" in template
    assert "Compare the latest verdict" in workflow
    assert "review-to-review" in workflow
    assert "Omit the section when no prior issue changed verdict" in publishing
    assert "links the original report" in publishing


def test_inline_thread_replies_and_resolution_have_distinct_owners() -> None:
    workflow = REVIEW_WORKFLOW.read_text()
    publishing = (WRITE_PR / "references" / "review-publishing.md").read_text()
    loop = (WRITE_PR / "references" / "review-loop.md").read_text()

    assert "must not resolve the thread" in loop
    assert "reply to the comments whose" in loop
    assert "fixes are now present. Do not resolve those threads" in loop
    assert "If no reply records the published work" in workflow
    assert "if such a reply already exists, do not post another" in workflow
    assert "resolveReviewThread" in workflow
    assert "Never resolve a thread whose concern still applies" in workflow
    assert "post a concise confirmation reply only if no" in publishing
    assert "never duplicate an existing implementation reply" in publishing


def test_commit_message_directions_preserve_the_retired_standard_contract() -> None:
    directions = COMMIT_DIRECTIONS.read_text()

    assert "repository's commit policy explicitly permits it" in directions
    assert "canonical regex permits one scope" in directions
    assert "this is a hard limit" in directions
    assert "never substitute `Fixes` or `Resolves`" in directions


def test_merged_skill_resolves_bundled_helpers_for_resource_lifetimes() -> None:
    router = (WRITE_PR / "SKILL.md").read_text()
    create_update = (WRITE_PR / "references" / "create-update.md").read_text()
    merge = (WRITE_PR / "references" / "merge.md").read_text()
    review_extraction = (WRITE_PR / "references" / "review-extraction.md").read_text()
    review = (WRITE_PR / "references" / "review-workflow.md").read_text()

    assert "set `CODING_PR_SKILL_DIR` to the absolute directory" in router
    helper_consumers = {
        "scripts/preflight-jj-range-push.sh": (merge,),
        "scripts/temp-tree.sh": (VERIFY_CI_PARITY.read_text(), review_extraction, review),
        "scripts/review-scan.sh": (review,),
        "scripts/scan-pr-message.py": (create_update,),
    }
    for helper, consumers in helper_consumers.items():
        assert (WRITE_PR / helper).is_file()
        assert all(helper in consumer for consumer in consumers)
    assert "cleanup() {" not in create_update


def test_review_scan_self_resolves_and_propagates_helper_failure(
    tmp_path: Path,
) -> None:
    plugin = tmp_path / "plugin"
    helper = plugin / "skills" / "pr" / "scripts" / "review-scan.sh"
    helper.parent.mkdir(parents=True)
    shutil.copyfile(WRITE_PR / "scripts" / "review-scan.sh", helper)
    scripts = plugin / "scripts"
    scripts.mkdir()
    marker = tmp_path / "review-scan-argv"
    pyrun = scripts / "pyrun.sh"
    pyrun.write_text(
        "#!/usr/bin/env bash\n"
        'expected="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)'
        '/scan_potential_violations.py"\n'
        '[ "$1" = "$expected" ] || exit 98\n'
        'printf "%s\\n" "$@" > "$REVIEW_SCAN_MARKER"\n'
        "exit 99\n"
    )
    pyrun.chmod(0o755)
    scanner = scripts / "scan_potential_violations.py"
    scanner.write_text("")
    other_cwd = tmp_path / "elsewhere"
    other_cwd.mkdir()
    env = os.environ.copy()
    env.pop("CLAUDE_PLUGIN_ROOT", None)
    env.pop("CLAUDE_SKILL_DIR", None)
    env["REVIEW_SCAN_MARKER"] = str(marker)

    completed = subprocess.run(
        ["bash", str(helper), "--area=security", "target path.py"],
        cwd=other_cwd,
        env=env,
        check=False,
    )

    assert completed.returncode == 99
    assert marker.read_text().splitlines() == [
        str(scanner),
        "--area=security",
        "target path.py",
    ]


def test_review_uses_canonical_verification_section_name() -> None:
    review = (WRITE_PR / "references" / "review-workflow.md").read_text()

    assert "Every zone requires Summary" in review
    assert "`## 🎯 Goal`" in review
    assert "`## ✅ Requirements`" in review
    assert "`## 🧵 Context`" in review
    assert "`## 🧪 Verification`" in review
    assert "Summary, Checklist" not in review


def test_correct_merged_monitoring_stays_read_only() -> None:
    workflow = (
        WRITE_PR.parent / "commit" / "references" / "workflow-correct-merged.md"
    ).read_text()
    followups = workflow.split("## Mandatory follow-ups", 1)[1]

    assert "read-only `gh pr checks`" in followups
    assert "`coding:pr update`" not in followups


def test_owned_trees_bind_outputs_and_keep_cleanup_in_parent() -> None:
    create_update = VERIFY_CI_PARITY.read_text()
    extraction = (WRITE_PR / "references" / "review-extraction.md").read_text()
    helper = (WRITE_PR / "scripts" / "temp-tree.sh").read_text()

    tree_setup = _fenced_block_containing(create_update, "open-git")
    tree_json = tree_setup.index("TREE_JSON=")
    lease_binding = tree_setup.index("TREE_LEASE=")
    tree_binding = tree_setup.index("TEST_WORKTREE=")
    revision_check = tree_setup.index('git -C "$TEST_WORKTREE" rev-parse HEAD')
    assert tree_json < lease_binding < tree_binding < revision_check
    assert tree_setup.count("TREE_LEASE") == 1
    assert tree_setup.count("TEST_WORKTREE") == 2
    assert create_update.index(tree_setup) < create_update.index("<report>")
    report = create_update.split("<report>", 1)[1].split("</report>", 1)[0]
    assert not re.search(r"(?im)^\s*(?:cleanup|lease)\w*\s*:", report)
    assert (
        'open-clone "https://$HOST/$OWNER/$REPO" "$PR_NUMBER" "$HEAD_OID"' in extraction
    )
    assert "signal trap protects construction only" in extraction
    assert 'workspace="pr-tree-$(basename "$lease")"' in helper
    assert "workspace add --name" in helper
    assert 'workspace forget "$workspace"' in helper


def test_git_tree_lease_opens_and_closes(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    subprocess.run(
        ["git", "init", "--quiet", "--initial-branch=main", str(repo)],
        check=True,
    )
    subprocess.run(["git", "-C", str(repo), "config", "user.name", "Test"], check=True)
    subprocess.run(
        ["git", "-C", str(repo), "config", "user.email", "test@example.com"],
        check=True,
    )
    (repo / "tracked").write_text("one\n")
    subprocess.run(["git", "-C", str(repo), "add", "tracked"], check=True)
    subprocess.run(
        ["git", "-C", str(repo), "commit", "--quiet", "--no-gpg-sign", "-m", "base"],
        check=True,
    )
    head = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    helper = WRITE_PR / "scripts" / "temp-tree.sh"
    opened = subprocess.run(
        ["bash", str(helper), "open-git", str(repo), head],
        check=True,
        capture_output=True,
        text=True,
    )
    lease = json.loads(opened.stdout)
    tree = Path(lease["tree"])
    assert tree.is_dir()
    assert (
        subprocess.run(
            ["git", "-C", str(tree), "rev-parse", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        == head
    )
    subprocess.run(["bash", str(helper), "close", lease["lease"]], check=True)
    assert not Path(lease["lease"]).exists()


def test_restack_requires_explicit_root_base_and_reports_partial_progress() -> None:
    workflow = (WRITE_PR / "references" / "create-update.md").read_text()
    helper = (WRITE_PR / "scripts" / "restack.sh").read_text()

    assert '--base "$ROOT_BASE"' in workflow
    assert "for a suffix restack this is its unselected" in workflow
    assert "forge operations are not transactional" in workflow
    assert "missing-base" in helper
    assert "duplicate-bookmark" in helper
    assert "multiple-open" in helper
    assert "closed-head" in helper
    assert "nonlinear" in helper
    assert "vcs_is_ancestor" in helper
    assert "previous_base=$root_base" in helper
    discovery = helper.index("if ! state=$(gh pr list")
    ancestry = helper.index('if [ "$state" != MERGED ]')
    assert discovery < ancestry
    post_verify = helper.split('[ "$remote_sha" = "$expected_sha" ]', 1)[1]
    assert post_verify.index("restacked[") < post_verify.index('gh pr edit "$bookmark"')


@pytest.mark.parametrize(
    ("push_repository", "expected_head"),
    (("octo/widgets", "octo:fix/labels"), ("fork-owner/widgets", "fork-owner:fix/labels")),
    ids=("same-repository", "fork"),
)
def test_pr_create_qualifies_head_with_selected_push_remote_owner(
    tmp_path: Path, push_repository: str, expected_head: str
) -> None:
    workflow = CREATE_UPDATE.read_text()
    binding = workflow.split("#### Bind the push remote", 1)[1]
    binding = binding.split("```bash\n", 1)[1].split("\n```", 1)[0]
    creation = workflow.split("When the head has no open PR", 1)[1]
    creation = creation.split("```bash\n", 1)[1].split("\n```", 1)[0]
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    argument_log = tmp_path / "pr-create-arguments"
    git = fake_bin / "git"
    git.write_text(
        "#!/usr/bin/env bash\n"
        'if [ "$1 $2" = "branch --show-current" ]; then\n'
        "  printf 'fix/labels\\n'\n"
        'elif [ "$1 $2 $3 $4 $5" = "remote get-url --push -- push" ]; then\n'
        "  printf 'https://github.example/push/widgets.git\\n'\n"
        "else\n"
        "  exit 1\n"
        "fi\n"
    )
    git.chmod(0o755)
    gh = fake_bin / "gh"
    gh.write_text(
        "#!/usr/bin/env bash\n"
        'if [ "$#" -eq 7 ] &&\n'
        '  [ "$*" = "repo view https://github.example/push/widgets.git '
        '--json nameWithOwner --jq .nameWithOwner" ]; then\n'
        "  printf '%s\\n' \"$PUSH_REPOSITORY\"\n"
        'elif [ "$1 $2" = "pr create" ]; then\n'
        "  printf '%s\\n' \"$@\" >\"$ARGUMENT_LOG\"\n"
        "  printf 'https://github.example/octo/widgets/pull/41\\n'\n"
        "else\n"
        "  exit 1\n"
        "fi\n"
    )
    gh.chmod(0o755)
    environment = os.environ | {
        "PATH": f"{fake_bin}:{os.environ['PATH']}",
        "ARGUMENT_LOG": str(argument_log),
        "PUSH_REPOSITORY": push_repository,
    }

    subprocess.run(
        [
            "bash",
            "-c",
            (
                "set -euo pipefail\n"
                "CALLER_REMOTE=push\n"
                "HOST=github.example\n"
                "REPOSITORY=octo/widgets\n"
                'TITLE="fix: preserve labels"\n'
                'BODY="body"\n'
                "PR_BASE=main\n"
                "BOOKMARK=fix/labels\n"
                f"{binding}\n"
                f"{creation}"
            ),
        ],
        check=True,
        env=environment,
    )

    arguments = argument_log.read_text().splitlines()
    assert arguments[arguments.index("--head") + 1] == expected_head


def test_stack_publication_and_inspection_have_no_implicit_origin() -> None:
    create_update = (WRITE_PR / "references" / "create-update.md").read_text()
    stacked = (WRITE_PR / "references" / "stacked-prs.md").read_text()

    for reference in (create_update, stacked):
        assert "main@origin" not in reference
        assert "@origin" not in reference
        assert "origin/" not in reference
    assert "selected `ROOT_BASE`/`DESTINATION`" in create_update
    assert "at authoritative `$REMOTE`" in create_update
    assert "create-update.md#bind-the-push-remote" in stacked
    assert '"$REMOTE"/<destination>' in stacked
    assert "<parent>@$REMOTE" in stacked


def test_partial_to_branch_does_not_dispatch_pr_mutations() -> None:
    workflow = PARTIAL_TO_BRANCH.read_text()
    normalized_workflow = " ".join(workflow.split())
    mutation_dispatches = re.findall(
        r"(?<!do not )\b(?:invoke|run|execute|call|dispatch|hand off to)\s+`?/?"
        r"(coding:pr (?:create|update))\b",
        workflow,
        re.IGNORECASE,
    )

    assert mutation_dispatches == []
    assert "return the exact synchronized `<target>` bookmark" in normalized_workflow
    assert "Do not mutate a PR or dispatch another action" in normalized_workflow
    assert "caller must separately authorize the matching" in normalized_workflow
    assert "`coding:pr create` or `coding:pr update` action" in normalized_workflow


def test_reviewer_receives_the_pinned_mission_capsule() -> None:
    review = (WRITE_PR / "references" / "review-workflow.md").read_text()

    assert "bounded mission capsule" not in review
    assert "`PR_SURFACES` array" in review
    assert "one clean `REVIEW_DIR` at the top head" in review
    assert "reviews the complete stack diff against the bottom base" in review
    assert "holistically" in review
    assert "one holistic map" in review
    assert "A stack never receives a second lease" in review


def test_ci_parity_target_selection_covers_the_selected_surface() -> None:
    workflow = CREATE_UPDATE.read_text()
    selector = _fenced_block_containing(workflow, "SELECTED_STACK_JSON")

    standalone = _run_shell_contract(
        selector,
        {
            "SELECTED_STACK_JSON": json.dumps(
                [{"head": "standalone-head", "base": "standalone-base"}]
            ),
        },
    )
    stack = _run_shell_contract(
        selector,
        {
            "SELECTED_STACK_JSON": json.dumps(
                [
                    {"head": "bottom-head", "base": "stack-root-base"},
                    {"head": "middle-head", "base": "bottom-head"},
                    {"head": "stack-tip", "base": "middle-head"},
                ]
            ),
        },
    )

    assert standalone == {
        "TARGET_KIND": "standalone",
        "TARGET_SHA": "standalone-head",
        "TARGET_BASE": "standalone-base",
    }
    assert stack == {
        "TARGET_KIND": "stack-tip",
        "TARGET_SHA": "stack-tip",
        "TARGET_BASE": "stack-root-base",
    }


def test_ci_parity_workflow_selection_ignores_unevaluated_filters() -> None:
    contract = VERIFY_CI_PARITY.read_text()
    selector = _fenced_block_containing(contract, "CI_PARITY_WORKFLOW_DECISION")

    for filter_values in ("all-match", "base-miss", "type-miss", "paths-miss"):
        included = _run_shell_contract(
            selector,
            {
                "HAS_PULL_REQUEST_TRIGGER": "1",
                "UNEVALUATED_FILTER_FIXTURE": filter_values,
            },
        )
        assert included == {
            "CI_PARITY_WORKFLOW_DECISION": "include",
            "CI_PARITY_APPLICABILITY_MODE": "conservative_pull_request",
            "CI_PARITY_UNEVALUATED_FILTERS": "base_ref,event_type,paths",
        }

    excluded = _run_shell_contract(selector, {"HAS_PULL_REQUEST_TRIGGER": "0"})
    assert excluded == {
        "CI_PARITY_WORKFLOW_DECISION": "exclude",
        "CI_PARITY_APPLICABILITY_MODE": "not_applicable",
        "CI_PARITY_UNEVALUATED_FILTERS": "",
    }


def test_all_ci_parity_callers_use_the_public_verify_action() -> None:
    create_update = CREATE_UPDATE.read_text()
    invocation = _fenced_block_containing(create_update, "coding:pr verify ")

    assert invocation.strip() == (
        'coding:pr verify --target "$TARGET_SHA" --base "$TARGET_BASE" '
        '--kind "$TARGET_KIND"'
    )
    _assert_target_gate_precedes_push(PARTIAL_TO_BRANCH.read_text())
    _assert_target_gate_precedes_push(CORRECT_MERGED.read_text())


def test_ci_parity_missing_secret_gate_is_exact_and_fail_closed() -> None:
    contract = VERIFY_CI_PARITY.read_text()
    gate = _fenced_block_containing(contract, "CI_PARITY_SECRET_GATE")
    target = "target-sha"
    missing = "API_TOKEN,SIGNING_KEY"

    runnable = _run_shell_contract(
        gate,
        {"TARGET_SHA": target, "MISSING_SECRET_NAMES": ""},
    )
    assert runnable == {
        "CI_PARITY_SECRET_GATE": "run_local",
        "CI_PARITY_OVERALL": "pending_local_run",
    }

    blocked_cases = (
        {},
        {
            "MISSING_SECRET_APPROVED": "true",
            "MISSING_SECRET_APPROVAL_SHA": "other-sha",
            "MISSING_SECRET_APPROVAL_NAMES": missing,
        },
        {
            "MISSING_SECRET_APPROVED": "true",
            "MISSING_SECRET_APPROVAL_SHA": target,
            "MISSING_SECRET_APPROVAL_NAMES": "API_TOKEN",
        },
    )
    for approval in blocked_cases:
        blocked = _run_shell_contract_result(
            gate,
            {
                "TARGET_SHA": target,
                "MISSING_SECRET_NAMES": missing,
                **approval,
            },
        )
        assert blocked.returncode == 42
        assert blocked.stdout.splitlines() == [
            "CI_PARITY_SECRET_GATE=stop_before_push",
            "CI_PARITY_OVERALL=blocked",
        ]

    approved = _run_shell_contract(
        gate,
        {
            "TARGET_SHA": target,
            "MISSING_SECRET_NAMES": missing,
            "MISSING_SECRET_APPROVED": "true",
            "MISSING_SECRET_APPROVAL_SHA": target,
            "MISSING_SECRET_APPROVAL_NAMES": missing,
        },
    )
    assert approved == {
        "CI_PARITY_SECRET_GATE": "approved_without_local_run",
        "CI_PARITY_OVERALL": "approved_without_local_run",
    }


def test_ci_parity_consumers_require_exact_sha_and_sorted_secret_names() -> None:
    for consumer in (CREATE_UPDATE, PARTIAL_TO_BRANCH, CORRECT_MERGED):
        contract = " ".join(consumer.read_text().split())

        assert "its `sha` equals the exact `TARGET_SHA`" in contract
        assert (
            "its `names` equal the verifier's exact lexically sorted "
            "missing-secret names"
        ) in contract
        assert "A SHA-only approval or any name/order mismatch" in contract


def test_ci_parity_receipt_consumers_accept_only_the_exact_local_run() -> None:
    command_results = [
        {
            "command": "uvx pytest",
            "kind": "test",
            "ref": "target-sha",
            "source": ".github/workflows/ci.yml:test",
            "status": 0,
        },
        {
            "command": "uvx ruff check",
            "kind": "lint",
            "ref": "target-sha",
            "source": ".github/workflows/ci.yml:lint",
            "status": 0,
        },
    ]
    receipt = {
        "applicability_mode": "conservative_pull_request",
        "missing_secret_approval": {"approved": False, "names": [], "sha": None},
        "overall": "pass",
        "target": {
            "base": "target-base",
            "kind": "standalone",
            "sha": "target-sha",
        },
        "workflow_command_results": command_results,
    }
    environment = {
        "CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON": "[]",
        "CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON": json.dumps(
            command_results
        ),
        "CI_PARITY_RECEIPT_JSON": json.dumps(receipt),
        "TARGET_BASE": "target-base",
        "TARGET_KIND": "standalone",
        "TARGET_SHA": "target-sha",
    }

    for consumer in (CREATE_UPDATE, PARTIAL_TO_BRANCH, CORRECT_MERGED):
        gate = _fenced_block_containing(
            consumer.read_text(), "CI_PARITY_RECEIPT_GATE"
        )
        assert _run_shell_contract(gate, environment) == {
            "CI_PARITY_RECEIPT_GATE": "accepted"
        }


def test_ci_parity_receipt_consumers_reject_a_changed_base() -> None:
    command_results = [
        {
            "command": "uvx pytest",
            "kind": "test",
            "ref": "target-sha",
            "source": ".github/workflows/ci.yml:test",
            "status": 0,
        }
    ]
    receipt = {
        "applicability_mode": "conservative_pull_request",
        "missing_secret_approval": {"approved": False, "names": [], "sha": None},
        "overall": "pass",
        "target": {
            "base": "stale-base",
            "kind": "standalone",
            "sha": "target-sha",
        },
        "workflow_command_results": command_results,
    }
    environment = {
        "CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON": "[]",
        "CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON": json.dumps(
            command_results
        ),
        "CI_PARITY_RECEIPT_JSON": json.dumps(receipt),
        "TARGET_BASE": "target-base",
        "TARGET_KIND": "standalone",
        "TARGET_SHA": "target-sha",
    }

    for consumer in (CREATE_UPDATE, PARTIAL_TO_BRANCH, CORRECT_MERGED):
        gate = _fenced_block_containing(
            consumer.read_text(), "CI_PARITY_RECEIPT_GATE"
        )
        rejected = _run_shell_contract_result(gate, environment)
        assert rejected.returncode == 42
        assert rejected.stdout == ""


def test_ci_parity_receipt_consumers_reject_missing_secret_name_mismatch() -> None:
    command_results = [
        {
            "command": "uvx pytest",
            "kind": "test",
            "ref": "target-sha",
            "source": ".github/workflows/ci.yml:test",
            "status": "not_run_missing_secret",
        }
    ]
    receipt = {
        "applicability_mode": "conservative_pull_request",
        "missing_secret_approval": {
            "approved": True,
            "names": ["API_TOKEN"],
            "sha": "target-sha",
        },
        "overall": "approved_without_local_run",
        "target": {
            "base": "target-base",
            "kind": "standalone",
            "sha": "target-sha",
        },
        "workflow_command_results": command_results,
    }
    environment = {
        "CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON": json.dumps(
            ["API_TOKEN", "SIGNING_KEY"]
        ),
        "CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON": json.dumps(
            command_results
        ),
        "CI_PARITY_RECEIPT_JSON": json.dumps(receipt),
        "TARGET_BASE": "target-base",
        "TARGET_KIND": "standalone",
        "TARGET_SHA": "target-sha",
    }

    for consumer in (CREATE_UPDATE, PARTIAL_TO_BRANCH, CORRECT_MERGED):
        gate = _fenced_block_containing(
            consumer.read_text(), "CI_PARITY_RECEIPT_GATE"
        )
        rejected = _run_shell_contract_result(gate, environment)
        assert rejected.returncode == 42
        assert rejected.stdout == ""


def test_ci_parity_pass_receipt_rejects_nonempty_expected_secret_names() -> None:
    command_results = [
        {
            "command": "uvx pytest",
            "kind": "test",
            "ref": "target-sha",
            "source": ".github/workflows/ci.yml:test",
            "status": 0,
        }
    ]
    receipt = {
        "applicability_mode": "conservative_pull_request",
        "missing_secret_approval": {"approved": False, "names": [], "sha": None},
        "overall": "pass",
        "target": {
            "base": "target-base",
            "kind": "standalone",
            "sha": "target-sha",
        },
        "workflow_command_results": command_results,
    }
    environment = {
        "CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON": '["API_TOKEN"]',
        "CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON": json.dumps(
            command_results
        ),
        "CI_PARITY_RECEIPT_JSON": json.dumps(receipt),
        "TARGET_BASE": "target-base",
        "TARGET_KIND": "standalone",
        "TARGET_SHA": "target-sha",
    }

    for consumer in (CREATE_UPDATE, PARTIAL_TO_BRANCH, CORRECT_MERGED):
        gate = _fenced_block_containing(
            consumer.read_text(), "CI_PARITY_RECEIPT_GATE"
        )
        rejected = _run_shell_contract_result(gate, environment)
        assert rejected.returncode == 42
        assert rejected.stdout == ""


def test_ci_parity_receipt_consumers_reject_raw_sha_name_approval() -> None:
    raw_approval = {
        "missing_secret_approval": {
            "approved": True,
            "names": ["API_TOKEN"],
            "sha": "target-sha",
        }
    }
    environment = {
        "CI_PARITY_EXPECTED_MISSING_SECRET_NAMES_JSON": '["API_TOKEN"]',
        "CI_PARITY_EXPECTED_WORKFLOW_COMMAND_RESULTS_JSON": "[]",
        "CI_PARITY_RECEIPT_JSON": json.dumps(raw_approval),
        "TARGET_BASE": "target-base",
        "TARGET_KIND": "standalone",
        "TARGET_SHA": "target-sha",
    }

    for consumer in (CREATE_UPDATE, PARTIAL_TO_BRANCH, CORRECT_MERGED):
        gate = _fenced_block_containing(
            consumer.read_text(), "CI_PARITY_RECEIPT_GATE"
        )
        rejected = _run_shell_contract_result(gate, environment)
        assert rejected.returncode == 42
        assert rejected.stdout == ""


def test_direct_sync_base_selection_and_gate_order_are_fail_closed() -> None:
    partial = PARTIAL_TO_BRANCH.read_text()
    correct_merged = CORRECT_MERGED.read_text()
    selector = _fenced_block_containing(partial, 'case "$REMOTE_TARGET_SHA"')

    remote_only = _run_shell_contract(
        selector,
        {
            "LOCAL_TARGET_SHA": "",
            "REMOTE_TARGET_SHA": "existing-remote",
            "TARGET_CREATION_BASE": "existing-remote",
        },
    )
    local_only = _run_shell_contract(
        selector,
        {
            "LOCAL_TARGET_SHA": "local-target",
            "REMOTE_TARGET_SHA": "",
            "TARGET_CREATION_BASE": "local-target",
        },
    )
    synchronized = _run_shell_contract(
        selector,
        {
            "LOCAL_TARGET_SHA": "shared-target",
            "REMOTE_TARGET_SHA": "shared-target",
            "TARGET_CREATION_BASE": "shared-target",
        },
    )
    new = _run_shell_contract(
        selector,
        {
            "LOCAL_TARGET_SHA": "",
            "REMOTE_TARGET_SHA": "",
            "TARGET_CREATION_BASE": "creation-base",
        },
    )

    assert remote_only == {
        "TARGET_ROUTE": "remote-only",
        "TARGET_BASE": "existing-remote",
    }
    assert local_only == {
        "TARGET_ROUTE": "local-only",
        "TARGET_BASE": "local-target",
    }
    assert synchronized == {
        "TARGET_ROUTE": "synchronized",
        "TARGET_BASE": "shared-target",
    }
    assert new == {"TARGET_ROUTE": "new-target", "TARGET_BASE": "creation-base"}

    correct_selector = _fenced_block_containing(
        correct_merged, "TARGET_BASE=$(jj log"
    ).replace("<affected-bookmark>", "target")
    correct = _run_shell_contract(
        """jj() {
  case " $* " in
    *" target@origin "*) printf 'remote-base' ;;
    *" target "*) printf 'rewritten-head' ;;
    *) return 2 ;;
  esac
}
"""
        + correct_selector
        + "printf 'TARGET_SHA=%s\\nTARGET_BASE=%s\\n' \"$TARGET_SHA\" \"$TARGET_BASE\"\n",
        {},
    )
    assert correct == {
        "TARGET_SHA": "rewritten-head",
        "TARGET_BASE": "remote-base",
    }

    _assert_target_gate_precedes_push(partial)
    _assert_target_gate_precedes_push(correct_merged)


def test_remote_only_partial_target_creates_moves_and_pushes_exact_bookmark() -> None:
    partial = PARTIAL_TO_BRANCH.read_text()
    classification = _fenced_block_containing(partial, 'case "$REMOTE_TARGET_SHA"')
    bookmark_operation = _fenced_block_containing(
        partial, "jj bookmark create <target>"
    )
    scoped_push = _fenced_block_containing(
        partial, "jj git push --bookmark <target>"
    )
    executable_contract = (
        """JJ_CALL_COUNT=0
jj() {
  JJ_CALL_COUNT=$((JJ_CALL_COUNT + 1))
  printf 'JJ_%s=%s\n' "$JJ_CALL_COUNT" "$*"
}
"""
        + classification
        + bookmark_operation.replace("<target>", "target").replace(
            "<new-change-id>", "new-change"
        )
        + scoped_push.replace("<target>", "target")
    )

    result = _run_shell_contract(
        executable_contract,
        {
            "LOCAL_TARGET_SHA": "",
            "REMOTE_TARGET_SHA": "remote-target",
            "TARGET_CREATION_BASE": "remote-target",
        },
    )

    assert result == {
        "TARGET_ROUTE": "remote-only",
        "TARGET_BASE": "remote-target",
        "JJ_1": "bookmark create target --revision remote-target",
        "JJ_2": "bookmark move target --to new-change",
        "JJ_3": "git push --bookmark target",
    }


@pytest.mark.parametrize("target_sha", ("shared-target", "f" * 40))
def test_synchronized_partial_target_reuses_moves_and_pushes_bookmark(
    target_sha: str,
) -> None:
    partial = PARTIAL_TO_BRANCH.read_text()
    classification = _fenced_block_containing(partial, 'case "$REMOTE_TARGET_SHA"')
    bookmark_operation = _fenced_block_containing(
        partial, "jj bookmark create <target>"
    )
    scoped_push = _fenced_block_containing(
        partial, "jj git push --bookmark <target>"
    )
    executable_contract = (
        """JJ_CALL_COUNT=0
jj() {
  JJ_CALL_COUNT=$((JJ_CALL_COUNT + 1))
  printf 'JJ_%s=%s\n' "$JJ_CALL_COUNT" "$*"
}
"""
        + classification
        + bookmark_operation.replace("<target>", "target").replace(
            "<new-change-id>", "new-change"
        )
        + scoped_push.replace("<target>", "target")
    )

    result = _run_shell_contract(
        executable_contract,
        {
            "LOCAL_TARGET_SHA": target_sha,
            "REMOTE_TARGET_SHA": target_sha,
            "TARGET_CREATION_BASE": target_sha,
        },
    )

    assert result == {
        "TARGET_ROUTE": "synchronized",
        "TARGET_BASE": target_sha,
        "JJ_1": "bookmark move target --to new-change",
        "JJ_2": "git push --bookmark target",
    }


@pytest.mark.parametrize(
    ("local_target_sha", "remote_target_sha"),
    (("local-target", "remote-target"), ("remote-target", "local-target")),
)
def test_divergent_local_and_remote_partial_target_fails_before_mutation(
    local_target_sha: str, remote_target_sha: str,
) -> None:
    partial = PARTIAL_TO_BRANCH.read_text()
    classification = _fenced_block_containing(partial, 'case "$REMOTE_TARGET_SHA"')

    rejected = _run_shell_contract_result(
        classification,
        {
            "LOCAL_TARGET_SHA": local_target_sha,
            "REMOTE_TARGET_SHA": remote_target_sha,
            "TARGET_CREATION_BASE": remote_target_sha,
        },
    )

    assert rejected.returncode != 0
    assert rejected.stdout == ""
    assert "local and remote target bookmarks diverge" in rejected.stderr
    assert partial.index(classification) < partial.index("### 1. Surface the hunk plan")


@pytest.mark.parametrize("target_kind", ("remote", "local-only"))
def test_existing_partial_target_rejects_divergent_head_before_mutation(
    tmp_path: Path, target_kind: str,
) -> None:
    repo = tmp_path / "repo"
    subprocess.run(
        ["git", "init", "--quiet", "--initial-branch=main", str(repo)],
        check=True,
    )
    subprocess.run(["git", "-C", str(repo), "config", "user.name", "Test"], check=True)
    subprocess.run(
        ["git", "-C", str(repo), "config", "user.email", "test@example.com"],
        check=True,
    )
    subprocess.run(
        [
            "git",
            "-C",
            str(repo),
            "commit",
            "--quiet",
            "--allow-empty",
            "--no-gpg-sign",
            "-m",
            "base",
        ],
        check=True,
    )
    base = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    subprocess.run(
        [
            "git",
            "-C",
            str(repo),
            "commit",
            "--quiet",
            "--allow-empty",
            "--no-gpg-sign",
            "-m",
            "fetched target",
        ],
        check=True,
    )
    fetched_target = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    subprocess.run(
        ["git", "-C", str(repo), "switch", "--quiet", "--detach", base],
        check=True,
    )
    subprocess.run(
        [
            "git",
            "-C",
            str(repo),
            "commit",
            "--quiet",
            "--allow-empty",
            "--no-gpg-sign",
            "-m",
            "divergent head",
        ],
        check=True,
    )
    divergent_head = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    merge_base = subprocess.run(
        ["git", "-C", str(repo), "merge-base", fetched_target, divergent_head],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    assert merge_base == base

    partial = PARTIAL_TO_BRANCH.read_text()
    selector = _fenced_block_containing(partial, 'case "$REMOTE_TARGET_SHA"')

    target_environment = {
        "remote": {
            "REMOTE_TARGET_SHA": fetched_target,
            "LOCAL_TARGET_SHA": "",
        },
        "local-only": {
            "REMOTE_TARGET_SHA": "",
            "LOCAL_TARGET_SHA": fetched_target,
        },
    }[target_kind]

    rejected = _run_shell_contract_result(
        selector,
        {
            "TARGET_CREATION_BASE": divergent_head,
            **target_environment,
        },
    )

    assert rejected.returncode != 0
    assert rejected.stdout == ""
    expected_error = {
        "remote": "must equal fetched target",
        "local-only": "must equal local target",
    }[target_kind]
    assert expected_error in rejected.stderr
    assert partial.index(selector) < partial.index("### 1. Surface the hunk plan")


def test_changed_commit_references_are_portable() -> None:
    commit_root = COMMIT_SKILL.parent
    for path in (COMMIT_SKILL, PARTIAL_TO_BRANCH, CORRECT_MERGED):
        _assert_links_stay_within_skill(path, commit_root)


def test_ci_parity_reference_is_routed_and_portable() -> None:
    routed_references = {
        (WRITE_PR / target.split("#", 1)[0]).resolve()
        for target in re.findall(r"\[[^]]+\]\(([^)]+)\)", PR_SKILL.read_text())
        if "://" not in target and not target.startswith("#")
    }

    assert VERIFY_CI_PARITY.resolve() in routed_references
    _assert_links_stay_within_skill(PR_SKILL, WRITE_PR)
    _assert_links_stay_within_skill(VERIFY_CI_PARITY, WRITE_PR)


def test_pr_metadata_stays_internal_and_template_owns_rationale() -> None:
    workflow = (WRITE_PR / "references" / "create-update.md").read_text()
    template = MESSAGE_TEMPLATE.read_text()
    size_rule = (GIT_STANDARD / "rules" / "GIT-PR-SIZE-03.md").read_text()

    assert "specific indivisibility prose" in workflow
    assert "## 📐 Why This Size [ Optional ]" in template
    assert "reviewer-time estimates" in template
    assert "Keep size counts, zone metadata" in size_rule
    assert "size counts, zone metadata" in workflow
    assert "## 🧪 Verification" in template


def test_black_zone_requires_complete_body_and_live_authorization_receipt() -> None:
    create_update = (WRITE_PR / "references" / "create-update.md").read_text()
    review = (WRITE_PR / "references" / "review-workflow.md").read_text()
    publishing = (WRITE_PR / "references" / "review-publishing.md").read_text()
    checklist = (WRITE_PR / "references" / "review-checklist.md").read_text()
    size_rule = (GIT_STANDARD / "rules" / "GIT-PR-SIZE-04.md").read_text()

    assert "requires specific `## ⚠️ Risk`," in create_update
    assert "yellow/red/black" in create_update
    assert "`## ⚠️ Risk`" in review
    assert "`## 🧭 Test Plan`" in review
    assert "`## 📐 Why This Size`" in review
    for contract in (review, publishing):
        assert "`comment_url`" in contract
        assert "`authorization_body`" in contract
        assert "`rationale`" in contract
        assert "sole semantic authorization-review input" in contract
    assert "earlier fetched comment or body" in checklist
    assert "uses only that receipt's `authorization_body`" in " ".join(
        size_rule.split()
    )


def test_repository_label_inventory_is_complete_and_deterministic(
    tmp_path: Path,
) -> None:
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    call_log = tmp_path / "gh-args"
    gh = fake_bin / "gh"
    gh.write_text(
        "#!/usr/bin/env bash\n"
        'printf \'%s\\n\' "$@" >"$GH_CALL_LOG"\n'
        'printf \'%s\\n\' \'[[{"name":"zeta","description":"later"},'
        '{"name":"Alpha","description":"first","color":"ffffff"}],'
        '[{"name":"beta","description":"second"},'
        '{"name":"zeta","description":null}]]\'\n'
    )
    gh.chmod(0o755)
    environment = os.environ | {
        "PATH": f"{fake_bin}:{os.environ['PATH']}",
        "GH_CALL_LOG": str(call_log),
    }

    first = subprocess.run(
        ["bash", str(LABEL_LISTER), "github example", "octo/widgets repository"],
        check=True,
        capture_output=True,
        text=True,
        env=environment,
    )
    assert json.loads(first.stdout) == [
        {"name": "Alpha", "description": "first"},
        {"name": "beta", "description": "second"},
        {"name": "zeta", "description": None},
        {"name": "zeta", "description": "later"},
    ]
    assert call_log.read_text().splitlines() == [
        "api",
        "--hostname",
        "github example",
        "--paginate",
        "--slurp",
        "repos/octo/widgets repository/labels?per_page=100",
    ]


def test_repository_label_inventory_propagates_api_errors(tmp_path: Path) -> None:
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    gh = fake_bin / "gh"
    gh.write_text("#!/usr/bin/env bash\nprintf 'label lookup failed\\n' >&2\nexit 42\n")
    gh.chmod(0o755)
    environment = os.environ | {
        "PATH": f"{fake_bin}:{os.environ['PATH']}",
    }

    completed = subprocess.run(
        ["bash", str(LABEL_LISTER), "github.example", "octo/widgets"],
        check=False,
        capture_output=True,
        text=True,
        env=environment,
    )

    assert completed.returncode == 42
    assert completed.stdout == ""
    assert completed.stderr == "label lookup failed\n"


@pytest.mark.parametrize(
    (
        "operation_marker",
        "operation_setup",
        "selected_labels",
        "expected_commands",
        "expected_payload",
    ),
    [
        (
            "When the head has no open PR",
            "",
            '["api,breaking", "docs"]',
            ["pr create", "pr view", "api --method"],
            {"labels": ["api,breaking", "docs"]},
        ),
        (
            "When the head has one open PR",
            'PR="https://github.example/octo/widgets/pull/41"',
            '["api,breaking"]',
            ["pr edit", "pr ready", "pr view", "api --method"],
            {"labels": ["api,breaking"]},
        ),
        ("When the head has no open PR", "", "[]", ["pr create"], None),
    ],
    ids=("create", "update", "no-labels"),
)
def test_pr_label_attachment_preserves_exact_names(
    tmp_path: Path,
    operation_marker: str,
    operation_setup: str,
    selected_labels: str,
    expected_commands: list[str],
    expected_payload: dict[str, list[str]] | None,
) -> None:
    workflow = CREATE_UPDATE.read_text()
    preflight = workflow.split("#### Validate selected repository labels", 1)[1]
    preflight = preflight.split("```bash\n", 1)[1].split("\n```", 1)[0]
    operation = workflow.split(operation_marker, 1)[1]
    operation = operation.split("```bash\n", 1)[1].split("\n```", 1)[0]
    attachment = workflow.split("#### Attach selected repository labels", 1)[1]
    attachment = attachment.split("```bash\n", 1)[1].split("\n```", 1)[0]
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    command_log = tmp_path / "gh-commands"
    api_log = tmp_path / "gh-api-args"
    input_log = tmp_path / "gh-input"
    gh = fake_bin / "gh"
    gh.write_text(
        "#!/usr/bin/env bash\n"
        'printf \'%s %s\\n\' "$1" "${2:-}" >>"$GH_COMMAND_LOG"\n'
        'if [ "$1 $2" = "pr create" ]; then\n'
        '  [[ " $* " == *" --repo github.example/octo/widgets "* ]] || exit 1\n'
        "  printf '%s\\n' 'https://github.example/octo/widgets/pull/41'\n"
        'elif [ "$1 $2" = "pr view" ]; then\n'
        "  printf '41\\n'\n"
        'elif [ "$1" = api ]; then\n'
        '  printf \'%s\\n\' "$@" >"$GH_API_LOG"\n'
        '  cat >"$GH_INPUT_LOG"\n'
        "fi\n"
    )
    gh.chmod(0o755)
    environment = os.environ | {
        "PATH": f"{fake_bin}:{os.environ['PATH']}",
        "GH_COMMAND_LOG": str(command_log),
        "GH_API_LOG": str(api_log),
        "GH_INPUT_LOG": str(input_log),
        "REPOSITORY_LABELS": '[{"name":"api,breaking"},{"name":"docs"}]',
    }

    subprocess.run(
        [
            "bash",
            "-c",
            "\n".join(
                (
                    "set -euo pipefail",
                    "HOST=github.example",
                    "REPOSITORY=octo/widgets",
                    'TITLE="fix: preserve labels"',
                    'BODY="body"',
                    "PR_BASE=main",
                    "BOOKMARK=fix/labels",
                    "PUSH_OWNER=octo",
                    f"SELECTED_LABELS='{selected_labels}'",
                    operation_setup,
                    preflight,
                    operation,
                    attachment,
                )
            ),
        ],
        check=True,
        env=environment,
    )

    assert command_log.read_text().splitlines() == expected_commands
    if expected_payload is None:
        assert not api_log.exists()
        assert not input_log.exists()
        return
    assert api_log.read_text().splitlines() == [
        "api",
        "--method",
        "POST",
        "--hostname",
        "github.example",
        "repos/octo/widgets/issues/41/labels",
        "--input",
        "-",
    ]
    assert json.loads(input_log.read_text()) == expected_payload


@pytest.mark.parametrize(
    "selected_labels",
    ("{", '{"name":"docs"}', '["docs", null]', '["unknown"]'),
    ids=("malformed", "object", "non-string-member", "unknown"),
)
def test_invalid_selected_labels_stop_before_publication_mutation(
    tmp_path: Path, selected_labels: str
) -> None:
    workflow = CREATE_UPDATE.read_text()
    preflight = workflow.split("#### Validate selected repository labels", 1)[1]
    preflight = preflight.split("```bash\n", 1)[1].split("\n```", 1)[0]
    mutation_log = tmp_path / "mutations"
    environment = os.environ | {
        "MUTATION_LOG": str(mutation_log),
        "REPOSITORY_LABELS": '[{"name":"docs"}]',
        "SELECTED_LABELS": selected_labels,
    }

    completed = subprocess.run(
        [
            "bash",
            "-c",
            "\n".join(
                (
                    "set -euo pipefail",
                    "git() { printf 'mutation\\n' >>\"$MUTATION_LOG\"; }",
                    "jj() { printf 'mutation\\n' >>\"$MUTATION_LOG\"; }",
                    "gh() { printf 'mutation\\n' >>\"$MUTATION_LOG\"; }",
                    preflight,
                    "git push origin HEAD",
                    "jj git push",
                    "gh pr create",
                    "gh pr edit 41",
                    "gh api --method POST repos/octo/widgets/issues/41/labels",
                )
            ),
        ],
        check=False,
        capture_output=True,
        text=True,
        env=environment,
    )

    assert completed.returncode != 0
    assert not mutation_log.exists()


def test_generated_files_section_is_conditional_and_emoji_named() -> None:
    workflow = (WRITE_PR / "references" / "create-update.md").read_text()
    template = MESSAGE_TEMPLATE.read_text()

    assert "## 🏭 Generated Files [ Optional ]" in template
    assert "whenever any generated files exist" in template
    assert "`{{generated_files_body}}`" in workflow


def test_pr_size_thresholds_have_one_machine_readable_home_and_matching_docs() -> None:
    thresholds = json.loads(SIZE_THRESHOLDS.read_text())

    assert thresholds["schema_version"] == 1
    assert set(thresholds["metrics"]) == {
        "files_changed",
        "authored_net_loc",
        "required_reviewers",
    }
    for metric in thresholds["metrics"].values():
        assert isinstance(metric["unit"], str) and metric["unit"]
        assert isinstance(metric["reason"], str) and metric["reason"]

    zones = thresholds["zones"]
    assert [zone["name"] for zone in zones] == ["green", "yellow", "red"]
    assert all(
        set(zone)
        == {
            "name",
            "max_files_changed",
            "max_authored_net_loc",
            "required_reviewers",
        }
        for zone in zones
    )
    assert all(
        earlier["max_files_changed"] < later["max_files_changed"]
        and earlier["max_authored_net_loc"] < later["max_authored_net_loc"]
        and earlier["required_reviewers"] <= later["required_reviewers"]
        for earlier, later in pairwise(zones)
    )
    assert [zone["required_reviewers"] for zone in zones] == [0, 1, 2]

    presentations = {
        GIT_STANDARD / "rules" / "GIT-PR-SIZE-01.md": {"green"},
        GIT_STANDARD / "rules" / "GIT-PR-SIZE-02.md": {"yellow"},
        GIT_STANDARD / "rules" / "GIT-PR-SIZE-03.md": {"red"},
        GIT_STANDARD / "rules" / "GIT-PR-SIZE-04.md": {"black"},
    }
    discovered_presentations = {
        path
        for path in (
            *GIT_STANDARD.rglob("*.md"),
            *(WRITE_PR / "references").rglob("*.md"),
        )
        if "files" in path.read_text().lower()
        and "authored" in path.read_text().lower()
        and any(
            f"{zone['max_files_changed']} files" in path.read_text() for zone in zones
        )
        and any(
            f"{zone['max_authored_net_loc']} authored" in path.read_text()
            for zone in zones
        )
    }
    assert discovered_presentations == set(presentations)

    limits_by_zone = {zone["name"]: zone for zone in zones}
    black_limits = zones[-1]
    for path, presented_zones in presentations.items():
        content = path.read_text().replace(",", "").replace("**", "")
        for zone_name in presented_zones:
            limits = limits_by_zone.get(zone_name, black_limits)
            operator = ">" if zone_name == "black" else "≤"
            if "| Zone" in content:
                row = next(
                    line
                    for line in content.splitlines()
                    if line.lower().startswith(f"| {zone_name}")
                )
                assert f"{operator} {limits['max_files_changed']}" in row
                assert f"{operator} {limits['max_authored_net_loc']}" in row
            else:
                assert f"{operator} {limits['max_files_changed']} files" in content
                assert (
                    f"{operator} {limits['max_authored_net_loc']} authored" in content
                )


def test_classifier_uses_limits_from_a_controlled_asset(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    subprocess.run(
        ["git", "init", "--quiet", "--initial-branch=main", str(repo)], check=True
    )
    subprocess.run(
        ["git", "-C", str(repo), "config", "user.email", "test@example.com"],
        check=True,
    )
    subprocess.run(["git", "-C", str(repo), "config", "user.name", "Test"], check=True)
    (repo / "README.md").write_text("base\n")
    subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
    subprocess.run(
        [
            "git",
            "-C",
            str(repo),
            "commit",
            "--quiet",
            "--no-gpg-sign",
            "-m",
            "base",
        ],
        check=True,
    )
    base = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    (repo / "app.py").write_text("one\ntwo\n")
    subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
    subprocess.run(
        [
            "git",
            "-C",
            str(repo),
            "commit",
            "--quiet",
            "--no-gpg-sign",
            "-m",
            "head",
        ],
        check=True,
    )
    head = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    controlled_asset = tmp_path / "thresholds.json"
    thresholds = json.loads(SIZE_THRESHOLDS.read_text())
    for zone, maximum in zip(thresholds["zones"], (1, 2, 3), strict=True):
        zone["max_files_changed"] = maximum
        zone["max_authored_net_loc"] = maximum
    controlled_asset.write_text(json.dumps(thresholds))
    namespace = runpy.run_path(str(CLASSIFIER), run_name="controlled_classifier")
    classifier = namespace["classify"]
    classifier.__globals__["SIZE_THRESHOLDS"] = controlled_asset

    result = classifier(repo, base, head)

    assert result["files_changed"] == 1
    assert result["net_loc"] == 2
    assert result["zone"] == "yellow"


@pytest.mark.parametrize(
    ("zone_index", "field", "invalid_value"),
    [
        (0, "max_files_changed", True),
        (0, "max_authored_net_loc", True),
        (0, "max_files_changed", 0),
        (0, "max_authored_net_loc", 0),
        (0, "max_files_changed", -1),
        (0, "max_authored_net_loc", -1),
        (0, "required_reviewers", True),
        (0, "required_reviewers", -1),
        (1, "max_files_changed", 15),
        (1, "max_authored_net_loc", 500),
        (1, "required_reviewers", -1),
    ],
)
def test_classifier_rejects_invalid_threshold_limits(
    tmp_path: Path, zone_index: int, field: str, invalid_value: object
) -> None:
    thresholds = json.loads(SIZE_THRESHOLDS.read_text())
    thresholds["zones"][zone_index][field] = invalid_value
    malformed_asset = tmp_path / "thresholds.json"
    malformed_asset.write_text(json.dumps(thresholds))
    namespace = runpy.run_path(str(CLASSIFIER), run_name="malformed_classifier")
    load_zone_limits = namespace["load_zone_limits"]
    load_zone_limits.__globals__["SIZE_THRESHOLDS"] = malformed_asset

    with pytest.raises((TypeError, ValueError)):
        load_zone_limits()


def test_repo_local_templates_enforce_conditional_evidence_before_emission() -> None:
    workflow = (WRITE_PR / "references" / "create-update.md").read_text()
    local_template_gate = workflow.split(
        "<IMPORTANT>A repo-local template is emitted verbatim", 1
    )[1].split("When no repo-local template exists", 1)[0]

    assert "every predicate" in local_template_gate
    assert "archetype-required, and diff-required" in local_template_gate
    assert (
        "never inserts category, label, title, or body metadata" in local_template_gate
    )
    assert "exact `## 🏭 Generated Files` heading" in local_template_gate
    assert "generated path or" in local_template_gate
    assert "its source or generator" in local_template_gate
    assert "path-free summary is generic" in local_template_gate


def test_repo_templates_validate_zone_evidence_before_verbatim_emission() -> None:
    workflow = (WRITE_PR / "references" / "create-update.md").read_text()

    assert "apply step 6's evidence" in workflow
    assert "predicates to the content" in workflow
    assert "A heading's presence alone never passes" in workflow
    assert "specific indivisibility prose" in workflow


def test_github_stack_reference_tracks_current_upstream_contract() -> None:
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()

    assert (
        "github.com/github/gh-stack/blob/main/skills/gh-stack/SKILL.md" in github_stacks
    )
    assert "https://gh.io/stacks" in github_stacks
    assert "https://docs.jj-vcs.dev/latest/bookmarks/" in github_stacks
    assert "https://docs.jj-vcs.dev/latest/git-experts/" in github_stacks
    assert "`jj git push --help`" in github_stacks
    assert "pinned" not in github_stacks.lower()
    assert "14fc42ed9b6c376a53b2f999f138d3bd26dac546" not in github_stacks


def test_github_stack_update_has_conditional_history_routes() -> None:
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()
    update = github_stacks.split("## Update and synchronize", 1)[1].split(
        "## Restructure or remove grouping", 1
    )[0]
    jj_route = update.split("### jj-colocated repositories", 1)[1].split(
        "### Plain Git repositories", 1
    )[0]
    git_route = update.split("### Plain Git repositories", 1)[1]

    assert "`coding:commit`" in jj_route
    assert "automatic" in jj_route
    assert "affected-unmerged-bookmark batch" in jj_route
    for forbidden in (
        "gh stack rebase",
        "gh stack sync",
        "gh stack push",
        "gh stack submit",
    ):
        assert forbidden not in jj_route
    for command in ("gh stack rebase", "gh stack sync", "gh stack push"):
        assert command in git_route


def test_github_stack_actions_attempt_the_command_before_optional_installation() -> (
    None
):
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()

    direct_attempt = github_stacks.index(
        "Attempt the requested command or API call directly"
    )
    missing_extension = github_stacks.index("reports that the extension is missing")
    approval = github_stacks.index("ask before running")
    install = github_stacks.index("gh extension install github/gh-stack")
    assert direct_attempt < missing_extension < approval < install
    assert "Never install implicitly" in github_stacks
    assert "Do not run `gh auth status`" in github_stacks


def test_pr_router_loads_github_stack_contract_for_every_stack_request() -> None:
    router = (WRITE_PR / "SKILL.md").read_text()

    assert "/coding:pr stack list" in router
    assert (
        "/coding:pr stack checkout "
        "<stack-number-or-pr-number-or-pr-url-or-local-branch>"
    ) in router
    assert "references/github-stacks.md" in router
    assert (
        "For every request to create, inspect, update, restructure, publish" in router
    )
    assert "GitHub PR stack" in router


def test_pr_router_nests_stack_list_and_checkout_subactions() -> None:
    router = (WRITE_PR / "SKILL.md").read_text()
    routing = router.split("## Routing", 1)[1]
    stack_parent = routing.index("\n- `stack`")
    merge_route = routing.index("\n- `merge`", stack_parent)
    stack_route = routing[stack_parent:merge_route]

    assert "\n  - `list`" in stack_route
    assert "\n  - `checkout" in stack_route
    assert "\n- `stack list`" not in routing
    assert "\n- `stack checkout`" not in routing


def test_pr_router_usage_exposes_remote_and_merge_destination_inputs() -> None:
    router = (WRITE_PR / "SKILL.md").read_text()

    assert (
        "/coding:pr create [<commit-ref>] [--branch-prefix <name>] [--remote <name>]"
        in router
    )
    assert (
        "/coding:pr update [<pr-number-or-url> | <commit-ref>] [--branch-prefix <name>] [--remote <name>]"
        in router
    )
    assert (
        "[--method=rebase|squash|merge] [--remote <name>] [--destination <branch>] [--force]"
        in router
    )


def test_generic_stack_contract_delegates_github_listing_without_restatement() -> None:
    stacked = (WRITE_PR / "references" / "stacked-prs.md").read_text()
    normalized = " ".join(stacked.split())

    assert (
        "Load [github-stacks.md](github-stacks.md) for every GitHub PR-stack request"
        in normalized
    )
    assert "including discovery" in normalized
    assert "sole owner of GitHub stack inventory behavior" in normalized
    assert "paginated GitHub REST endpoint" not in normalized
    assert "GET /repos/{owner}/{repo}/stacks" not in normalized


def test_github_stack_listing_uses_only_the_paginated_rest_inventory() -> None:
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()
    list_section = github_stacks.split("## List or check out", 1)[1].split(
        "## Create, extend, and publish", 1
    )[0]
    normalized = " ".join(list_section.split())
    forbidden_cli = "gh stack " + "list"

    assert forbidden_cli not in github_stacks
    assert "unconditionally inventory" in normalized
    assert "GET /repos/{owner}/{repo}/stacks" in github_stacks
    assert "gh api --paginate --slurp" in list_section
    assert '"repos/$REPOSITORY/stacks?per_page=100"' in list_section
    assert "fully merged and closed stacks" in github_stacks
    assert "number," in list_section
    assert "url," in list_section
    assert "base: .base.ref" in list_section
    assert "open," in list_section
    assert "pullRequests: [.pull_requests[]" in list_section
    assert "headSha: .head.sha" in github_stacks
    assert "Do not run `gh auth status`" in github_stacks


def test_github_stack_checkout_separates_human_choice_from_agent_selection() -> None:
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()
    checkout_section = github_stacks.split("## List or check out", 1)[1].split(
        "## Create, extend, and publish", 1
    )[0]
    normalized = " ".join(github_stacks.lower().split())
    normalized_checkout = " ".join(checkout_section.lower().split())

    assert "bare `gh stack checkout`" in normalized
    assert "human-only interactive chooser" in normalized
    assert "checks out the chosen local or remote stack" in normalized
    assert "not a non-mutating inventory operation" in normalized
    assert "require the caller's stack number, pr number, pr url" in normalized
    assert 'gh stack checkout "$STACK_SELECTOR" || exit $?' in github_stacks
    assert "gh stack view --json || exit $?" in github_stacks
    assert "numeric stack number first" in normalized
    assert "pr url" in normalized
    assert "local-only branch" in normalized
    assert "fetch" in normalized
    assert "multiple remotes" in normalized
    assert "it cannot force replacement" in normalized
    assert "report the conflict" in normalized
    assert "only with explicit approval" in normalized
    assert "gh stack unstack --local || exit $?" in normalized
    assert "exits 3" not in normalized_checkout
    assert "prints both chains" not in normalized_checkout


def test_github_stack_checkout_guards_local_mutations_with_a_clean_worktree() -> None:
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()
    checkout_section = github_stacks.split("## List or check out", 1)[1].split(
        "## Create, extend, and publish", 1
    )[0]

    status_check = checkout_section.index("git status --porcelain")
    clean_check = checkout_section.index('test -z "$WORKTREE_STATUS"', status_check)
    rejection = checkout_section.index("refusing stack checkout", clean_check)
    initial_checkout = checkout_section.index(
        'gh stack checkout "$STACK_SELECTOR"', rejection
    )
    approval = checkout_section.index("Only with explicit approval", initial_checkout)
    repeated_guard = checkout_section.index(
        "rerun the clean-worktree guard above", approval
    )
    local_unstack = checkout_section.index("gh stack unstack --local", repeated_guard)
    retried_checkout = checkout_section.index(
        'gh stack checkout "$STACK_SELECTOR"', local_unstack
    )

    assert status_check < clean_check < rejection < initial_checkout
    assert approval < repeated_guard < local_unstack < retried_checkout


def test_github_stack_reference_maps_every_supported_operator() -> None:
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()
    direct_commands = (
        "gh stack init",
        "gh stack add",
        "gh stack link",
        "gh stack checkout",
        "gh stack view --json",
        "gh stack rebase",
        "gh stack sync",
        "gh stack push",
        "gh stack submit",
        "gh stack modify",
        "gh stack unstack",
        "gh stack merge",
    )

    assert all(command in github_stacks for command in direct_commands)
    assert (
        "`gh stack up [n]`, `down [n]`, `top`, `bottom`, and `trunk`" in github_stacks
    )


def test_github_stack_audit_contract_matches_current_mutation_semantics() -> None:
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()
    normalized = " ".join(github_stacks.split())

    assert "It is non-atomic: a later branch push or PR update can fail" in normalized
    assert "pushes all active branches atomically" in normalized
    assert "`push` and `submit` are non-atomic" in normalized
    assert 'gh stack merge "$STACK_OR_PR_NUMBER" --yes \\' in github_stacks
    assert '--merge-method "$MERGE_METHOD" || exit $?' in github_stacks
    assert "merged, merging, or queued PRs" in normalized
    assert "PRs with auto-merge enabled" in normalized
    assert "leaves local tracking unchanged" in normalized


def test_github_stack_failures_report_actual_errors_and_verify_the_owned_scope() -> (
    None
):
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()
    normalized = " ".join(github_stacks.split())

    assert "preserve stderr" in github_stacks
    assert "report the command and unchanged or partial state" in github_stacks
    assert "operational failures, not preconditions" in normalized
    assert "After every locally tracked mutation" in normalized
    assert "use `gh stack view --json`" in normalized
    assert "For `link`, remote unstack, and regrouping" in normalized
    assert "paginated Stacks REST projection" in normalized
    assert "verify every PR with `gh pr view`" in normalized
    assert "`view --json` cannot verify state that has no local tracking" in normalized
    assert "Do not trust exit status alone" in github_stacks
    assert "separately use `gh pr view` to verify remote head" in normalized


def test_github_stack_mutation_snippets_guard_every_dependency_boundary() -> None:
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()
    normalized = " ".join(github_stacks.split())
    bash_blocks = [
        fenced.split("\n```", 1)[0] for fenced in github_stacks.split("```bash\n")[1:]
    ]
    sequential_mutations: list[list[str]] = []
    for block in bash_blocks:
        commands: list[str] = []
        command_parts: list[str] = []
        for line in block.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            command_parts.append(stripped.removesuffix("\\").rstrip())
            if not stripped.endswith("\\"):
                commands.append(" ".join(command_parts))
                command_parts = []
        if len(commands) > 1 and any("gh stack " in command for command in commands):
            sequential_mutations.append(commands)

    assert sequential_mutations
    assert all(
        command.endswith("|| exit $?")
        for commands in sequential_mutations
        for command in commands
    )
    assert "Stop and verify the intended remote unstack" in normalized
    assert "through the paginated Stacks REST projection and `gh pr view`" in normalized
    assert "Only after that verification succeeds" in normalized


def test_github_stack_snippets_stop_before_consuming_failed_commands() -> None:
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()
    discovery_command = github_stacks.index("REPOSITORY=$(gh repo view")
    discovery_start = github_stacks.rfind("```bash", 0, discovery_command)
    discovery_end = github_stacks.index("```", discovery_command)
    discovery = github_stacks[discovery_start:discovery_end]
    checkout_command = github_stacks.index('gh stack checkout "$STACK_SELECTOR"')
    checkout_start = github_stacks.rfind("```bash", 0, checkout_command)
    checkout_end = github_stacks.index("```", checkout_command)
    checkout = github_stacks[checkout_start:checkout_end]

    assert "mktemp" not in discovery
    assert "trap " not in discovery
    assert "rm " not in discovery
    assert discovery.count("\njq ") == 1
    repo_command = discovery.index("REPOSITORY=$(gh repo view")
    repo_guard = discovery.index(") || exit $?", repo_command)
    api_command = discovery.index("STACKS_JSON=$(gh api --paginate --slurp")
    api_guard = discovery.index(") || exit $?", api_command)
    parsing = discovery.index("jq '[.[][]")
    parsing_guard = discovery.index('<<<"$STACKS_JSON" || exit $?', parsing)
    assert repo_command < repo_guard < api_command < api_guard < parsing < parsing_guard

    checkout_command = checkout.index('gh stack checkout "$STACK_SELECTOR" || exit $?')
    branch_verification = checkout.index("git branch --show-current || exit $?")
    stack_verification = checkout.index("gh stack view --json || exit $?")
    assert checkout_command < branch_verification < stack_verification


def test_github_stack_jj_route_uses_functional_colocation_proof() -> None:
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()
    normalized = " ".join(github_stacks.split())

    assert "`git rev-parse HEAD`" in normalized
    assert "`jj log -r @- --no-graph -T 'commit_id'`" in normalized
    assert "equals" in normalized
    assert "presence of `.jj`" not in normalized


def test_github_stack_jj_route_leaves_history_mutation_to_commit() -> None:
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()
    jj_route = github_stacks.split("### jj-colocated repositories", 1)[1].split(
        "### Plain Git repositories", 1
    )[0]
    normalized = " ".join(jj_route.split())

    assert "`coding:commit`" in normalized
    assert "automatic descendant rebase" in normalized
    assert "bookmark movement" in normalized
    for forbidden in (
        "gh stack rebase",
        "gh stack sync",
        "gh stack push",
        "gh stack submit",
    ):
        assert forbidden not in jj_route


def test_github_stack_jj_publication_is_one_explicit_remote_push() -> None:
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()
    jj_route = github_stacks.split("### jj-colocated repositories", 1)[1].split(
        "### Plain Git repositories", 1
    )[0]
    assert jj_route.count('jj git push --remote "$REMOTE"') == 1
    assert jj_route.count("--bookmark") >= 2
    assert "--remote" in jj_route
    assert "--all" not in jj_route
    jj_publication = jj_route.split("Publish all and only", 1)[1].split(
        "`gh stack link`", 1
    )[0]
    assert "atomic" not in jj_publication.lower()


def test_github_stack_jj_publication_verifies_every_remote_surface() -> None:
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()
    jj_route = github_stacks.split("### jj-colocated repositories", 1)[1].split(
        "### Plain Git repositories", 1
    )[0]
    normalized = " ".join(jj_route.split())

    assert "every remote head" in normalized
    assert "every PR base" in normalized
    assert "grouping" in normalized
    assert "preserve stderr" in normalized
    assert "partial state" in normalized


def test_github_stack_link_is_an_additive_bridge_for_jj() -> None:
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()
    jj_route = github_stacks.split("### jj-colocated repositories", 1)[1].split(
        "### Plain Git repositories", 1
    )[0]
    normalized = " ".join(jj_route.split())

    assert "conditional" in normalized
    assert "additive" in normalized
    assert "no local tracking" in normalized
    assert "creation, grouping, base repair, or membership" in normalized
    assert "not routine history publication" in normalized
    assert "new stack requires at least two branch or PR selectors" in normalized
    assert "pass its stack number first" in normalized
    assert "at least one branch or PR selector" in normalized
    assert "never removes members" in normalized


def test_github_stack_plain_git_keeps_native_history_operators() -> None:
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()
    git_route = github_stacks.split("### Plain Git repositories", 1)[1]

    for command in (
        "gh stack init",
        "gh stack add",
        "gh stack rebase",
        "gh stack push",
        "gh stack submit",
        "gh stack sync",
    ):
        assert command in git_route


def test_jj_merge_publishes_only_remaining_affected_bookmarks_once() -> None:
    merge = (WRITE_PR / "references" / "merge.md").read_text()
    helper = (WRITE_PR / "scripts" / "preflight-jj-range-push.sh").read_text()
    normalized = " ".join(merge.split())

    assert merge.count("scripts/preflight-jj-range-push.sh") == 1
    assert "scripts/test-jj-range-push.sh" in merge
    assert helper.count('git push --remote "$remote"') == 1
    assert merge.count('jj rebase -s "$child_root"') == 1
    assert 'jj rebase -s "$child_root" --onto <new-parent-ref>' in merge
    assert 'jj rebase -s "$child_root" -d' not in merge
    assert '--revision "$push_revset"' in helper
    assert "--bookmark" not in helper
    assert "--all" not in merge + helper
    assert "jj bookmark set" not in merge
    assert 'push_revset="${first_commit}::${last_commit}"' in helper
    assert "resolve_endpoint first" in helper
    assert "resolve_endpoint last" in helper
    assert "empty $position endpoint" in helper
    assert "ambiguous $position endpoint" in helper
    assert '"$first_commit & ::$last_commit"' in helper
    assert "fail 'boundaries are not linear'" in helper
    assert helper.count('--at-operation "$operation_id"') == 5
    bookmark_preflight = helper.index("bookmark list")
    tag_preflight = helper.index("tag list")
    push_command = helper.index('git push --remote "$remote"')
    assert bookmark_preflight < tag_preflight < push_command
    assert 'actual_bookmarks" = "$expected_bookmarks' in helper
    assert "fail 'unexpected bookmarks'" in helper
    assert "fail 'selected tags'" in helper
    assert "automatically rebases every descendant" in normalized
    assert "moves their bookmarks" in normalized
    assert "all and only remaining affected bookmarks" in normalized
    assert "jj does not iterate links" in normalized.lower()


def test_merge_uses_functional_jj_colocation_proof() -> None:
    merge = (WRITE_PR / "references" / "merge.md").read_text()

    assert "jj root" not in merge
    assert "command -v jj" in merge
    assert "git rev-parse HEAD" in merge
    assert "jj log -r @- --no-graph -T 'commit_id'" in merge
    assert '[ "$GIT_HEAD" = "$JJ_HEAD" ]' in merge
    assert "fully supported Git route" in merge
    assert "git status --short" in merge
    assert "git worktree list" in merge


def test_merge_binds_remote_and_destination_before_inspection() -> None:
    merge = (WRITE_PR / "references" / "merge.md").read_text()

    remote_gate = merge.index("create-update.md#bind-the-push-remote")
    destination_binding = merge.index("DESTINATION=${CALLER_DESTINATION:-}")
    first_inspection = merge.index('jj log -r "$DESTINATION@$REMOTE..@"')
    assert remote_gate < first_inspection
    assert destination_binding < first_inspection
    assert "sole owner of remote" in merge
    assert "GITHUB_REMOTES" not in merge
    assert "git remote get-url" not in merge
    assert 'jj git fetch --remote "$REMOTE"' in merge
    assert 'git fetch -- "$REMOTE"' in merge
    for hard_coded in (
        "main@origin",
        "origin/main",
        "git fetch origin",
        "git push --force-with-lease origin",
    ):
        assert hard_coded not in merge


def test_stack_contract_preserves_merge_induced_topology_ownership() -> None:
    stacked = (WRITE_PR / "references" / "stacked-prs.md").read_text()
    normalized = " ".join(stacked.split())

    assert "edit- and fix-induced rewrites" in normalized
    assert "Merge-induced descendant topology changes remain owned by" in normalized
    assert "`coding:pr merge`" in normalized


def test_review_resolves_canonical_coordinates_before_api_calls() -> None:
    workflow = (WRITE_PR / "references" / "review-workflow.md").read_text()
    publishing = (WRITE_PR / "references" / "review-publishing.md").read_text()
    loop = (WRITE_PR / "references" / "review-loop.md").read_text()

    assert "scripts/resolve-pr.sh" in workflow
    assert "scripts/resolve-pr.sh" in loop
    assert "baseRefName,baseRefOid" in workflow
    assert "$PR_NUMBER" in workflow
    assert "$PR_NUMBER" in publishing
    assert "pulls/$PR/" not in workflow
    assert "pulls/$PR/" not in publishing
    for content in (workflow, publishing, loop):
        assert 'gh api "repos/' not in content
        assert "gh api graphql -F" not in content
        assert "gh api --method" not in content
    assert '--hostname "$HOST"' in workflow
    assert '--hostname "$HOST"' in publishing
    assert '--hostname "$HOST"' in loop


def test_resolver_accepts_canonical_enterprise_url(tmp_path: Path) -> None:
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    gh = fake_bin / "gh"
    gh.write_text('#!/usr/bin/env bash\nprintf "%s\\n" "$PR_METADATA"\n')
    gh.chmod(0o755)
    metadata = {
        "number": 42,
        "url": "https://github.example.test/octo/repo/pull/42",
    }
    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}:{env['PATH']}"
    env["PR_METADATA"] = json.dumps(metadata)
    resolved = subprocess.run(
        [
            "bash",
            str(WRITE_PR / "scripts" / "resolve-pr.sh"),
            "42",
            "--repo",
            "octo/repo",
        ],
        check=True,
        capture_output=True,
        text=True,
        env=env,
    )
    payload = json.loads(resolved.stdout)
    assert payload["host"] == "github.example.test"
    assert payload["owner"] == "octo"
    assert payload["repo"] == "repo"
    assert payload["number"] == 42


def test_review_fetches_and_verifies_pinned_head_and_base_objects() -> None:
    extraction = (WRITE_PR / "references" / "review-extraction.md").read_text()
    workflow = (WRITE_PR / "references" / "review-workflow.md").read_text()

    assert 'fetch origin "pull/$PR_NUMBER/head"' in extraction
    assert 'fetch origin "$BASE_OID"' in extraction
    assert 'cat-file -e "$HEAD_OID^{commit}"' in extraction
    assert 'cat-file -e "$BASE_OID^{commit}"' in extraction
    assert "if either object is unavailable" in extraction
    load = workflow.index("load [review-extraction.md]")
    reuse = workflow.index("Search for a candidate")
    assert load < reuse
    assert "before inspecting reuse candidates" in workflow


def test_review_provisions_distinct_ledger_and_payload_paths() -> None:
    workflow = (WRITE_PR / "references" / "review-workflow.md").read_text()
    publishing = (WRITE_PR / "references" / "review-publishing.md").read_text()

    assert 'REVIEW_LEDGER="$REVIEW_ARTIFACT_DIR/ledger.json"' in workflow
    assert 'REVIEW_PAYLOAD="$REVIEW_ARTIFACT_DIR/payload.json"' in workflow
    assert '--input "$REVIEW_PAYLOAD"' in workflow
    assert '--input "$REVIEW_PAYLOAD"' in publishing
    assert "reviewer may write only those two files" in workflow


def test_stack_review_uses_one_tip_and_rechecks_every_surface() -> None:
    workflow = (WRITE_PR / "references" / "review-workflow.md").read_text()
    loop = (WRITE_PR / "references" / "review-loop.md").read_text()
    publishing = (WRITE_PR / "references" / "review-publishing.md").read_text()

    assert "one clean `REVIEW_DIR` at the top head" in workflow
    assert "reviews the complete stack diff against the bottom base" in workflow
    assert "PR_SURFACES" in workflow
    assert "baseRefName" in workflow
    assert "baseRefOid" in workflow
    assert "for every `PR_SURFACES` entry" in workflow
    assert "one holistic" in loop
    assert "checkout or lease per PR" in loop
    assert "re-reads and compares those three" in publishing


def test_adr_skill_references_follow_the_injected_essential_root() -> None:
    document = (WRITE_PR.parent / "document" / "SKILL.md").read_text()
    plugins = WRITE_PR.parent.parent.parent
    doctor = (plugins / "essential" / "skills" / "doctor" / "SKILL.md").read_text()
    plan = (plugins / "specification" / "skills" / "plan-code" / "SKILL.md").read_text()

    for skill in (document, doctor, plan):
        assert "${ESSENTIAL_ROOT}/references/adr.md" in skill
        assert "plugins/essential/references/adr.md" not in skill
    assert "${ESSENTIAL_ROOT}/templates/docs/adr.template.md" in document


def test_convergence_dispatch_is_already_the_dedicated_reviewer() -> None:
    router = (WRITE_PR / "SKILL.md").read_text()
    loop = (WRITE_PR / "references" / "review-loop.md").read_text()
    workflow = (WRITE_PR / "references" / "review-workflow.md").read_text()

    assert "preprovisioned stack capsule" in router
    assert "fresh critic" in loop
    assert "do not invoke another" in loop
    assert "router or delegate" in loop
    assert "already the" in workflow
    assert "dedicated reviewer" in workflow


def test_review_tracks_unanchored_findings_until_convergence() -> None:
    loop = (WRITE_PR / "references" / "review-loop.md").read_text()
    workflow = (WRITE_PR / "references" / "review-workflow.md").read_text()

    assert "findings with no inline anchor" in loop
    assert "evidence OID" in loop
    assert "still_applies`, `fixed`, or `does_not_apply" in loop
    assert "null-anchor finding" in workflow
    assert "anchored or unanchored" in workflow


def test_dedicated_reviewer_reads_discussion_after_tree_provisioning() -> None:
    workflow = (WRITE_PR / "references" / "review-workflow.md").read_text()

    assert workflow.index("### Locate or create the review tree") < workflow.index(
        "### Read the existing discussion"
    )
    assert (
        "dedicated reviewer performs this phase after the parent has located or"
        in workflow
    )
    assert "created and verified `REVIEW_DIR`" in workflow


def test_batch_review_returns_and_cleans_every_stack_ledger() -> None:
    loop = (WRITE_PR / "references" / "review-loop.md").read_text()

    assert "distinct artifact" in loop
    assert "directory for each stack" in loop
    assert "stack-to-ledger-path map" in loop
    assert "missing, duplicate, or cross-stack path" in loop
    assert "same\nper-stack cleanup" in loop


def test_red_ci_routes_to_repair_without_spending_review_retry() -> None:
    loop = (WRITE_PR / "references" / "review-loop.md").read_text()
    create_update = (WRITE_PR / "references" / "create-update.md").read_text()

    assert "`action: repair_ci_then_review`" in loop
    assert "retry count unchanged" in loop
    assert "`action: repair_ci_then_review`" in create_update
    assert "Never retry a review against unchanged red-CI" in create_update
    assert "evidence." in create_update
