import json
import os
import re
import subprocess
from pathlib import Path

import pytest

PLUGIN = Path(__file__).resolve().parents[1]
VERIFIER = PLUGIN / "skills" / "pr" / "scripts" / "verify-black-zone-authorization.sh"
HEAD_OID = "a" * 40
BASE_OID = "b" * 40


def authorization_body(
    *,
    head_oid: str = HEAD_OID,
    base_oid: str = BASE_OID,
    rationale: str = (
        "The marketplace projections and source manifests are indivisible because "
        "they encode one revision; otherwise consumers observe a mixed contract."
    ),
) -> str:
    return (
        "Black-zone authorization\n"
        f"Head OID: `{head_oid}`\n"
        f"Base OID: `{base_oid}`\n"
        "Authorization: I authorize this one-off black-zone publication.\n"
        f"Indivisibility: {rationale}"
    )


def issue_comment(
    *,
    body: str | None = None,
    association: str = "OWNER",
    user_type: str = "User",
    comment_id: int = 42,
    node_id: str = "IC_kwDOExample",
) -> dict[str, object]:
    return {
        "author_association": association,
        "body": body or authorization_body(),
        "id": comment_id,
        "html_url": "https://github.example/octo/repo/issues/17#issuecomment-42",
        "node_id": node_id,
        "user": {"login": "repository-owner", "type": user_type},
    }


@pytest.fixture
def fake_gh(tmp_path: Path) -> tuple[Path, Path]:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    invocation_log = tmp_path / "gh-invocations"
    gh = bin_dir / "gh"
    gh.write_text(
        "#!/usr/bin/env bash\n"
        "set -u\n"
        'printf \'%s\\0\' "$@" >> "$FAKE_GH_INVOCATIONS"\n'
        "printf '\\n' >> \"$FAKE_GH_INVOCATIONS\"\n"
        'if [ "${FAKE_GH_EXIT:-0}" -ne 0 ]; then\n'
        "  printf 'simulated GitHub failure\\n' >&2\n"
        '  exit "$FAKE_GH_EXIT"\n'
        "fi\n"
        'case "$*" in\n'
        '  *"repos/octo/repo/pulls/17"*) printf \'%s\\n\' "$FAKE_GH_PULL" ;;\n'
        '  *"repos/octo/repo/issues/17/comments?per_page=100"*) '
        "printf '%s\\n' \"$FAKE_GH_COMMENTS\" ;;\n"
        "  *) printf 'unexpected gh invocation: %s\\n' \"$*\" >&2; exit 91 ;;\n"
        "esac\n"
    )
    gh.chmod(0o755)
    return bin_dir, invocation_log


def run_verifier(
    fake_gh: tuple[Path, Path],
    comments: list[dict[str, object]],
    *,
    gh_exit: int = 0,
    live_head_oid: str = HEAD_OID,
    live_base_oid: str = BASE_OID,
) -> subprocess.CompletedProcess[str]:
    bin_dir, invocation_log = fake_gh
    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}{os.pathsep}{env['PATH']}"
    env["FAKE_GH_COMMENTS"] = json.dumps([comments])
    env["FAKE_GH_PULL"] = json.dumps(
        {"head": {"sha": live_head_oid}, "base": {"sha": live_base_oid}}
    )
    env["FAKE_GH_EXIT"] = str(gh_exit)
    env["FAKE_GH_INVOCATIONS"] = str(invocation_log)
    return subprocess.run(
        [
            "bash",
            str(VERIFIER),
            "github.example",
            "octo/repo",
            "17",
            HEAD_OID,
            BASE_OID,
        ],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )


def test_owner_comment_authorizes_the_exact_revision(
    fake_gh: tuple[Path, Path],
) -> None:
    completed = run_verifier(fake_gh, [issue_comment()])

    assert completed.returncode == 0
    assert json.loads(completed.stdout) == {
        "comment_url": "https://github.example/octo/repo/issues/17#issuecomment-42",
        "comment_id": 42,
        "comment_node_id": "IC_kwDOExample",
        "author_login": "repository-owner",
        "head_oid": HEAD_OID,
        "base_oid": BASE_OID,
        "authorization_body": authorization_body(),
        "rationale": {
            "subject": "The marketplace projections and source manifests are indivisible",
            "coupling": "they encode one revision",
            "consequence": "consumers observe a mixed contract.",
        },
    }
    invocations = fake_gh[1].read_bytes().replace(b"\0", b" ").decode()
    assert "api --hostname github.example repos/octo/repo/pulls/17" in invocations
    assert "--paginate" in invocations
    assert "--slurp" in invocations
    assert "repos/octo/repo/issues/17/comments?per_page=100" in invocations


def test_authorization_returns_the_live_mutated_body_and_rationale(
    fake_gh: tuple[Path, Path],
) -> None:
    stale_body = authorization_body(
        rationale=(
            "The stale source and projection are indivisible because they share an old "
            "revision; otherwise stale consumers see a mixed contract."
        )
    )
    live_body = authorization_body(
        rationale=(
            "The current source and projection are indivisible because they share the "
            "live revision; otherwise current consumers see a mixed contract."
        )
    )

    completed = run_verifier(
        fake_gh,
        [
            issue_comment(
                body=stale_body.replace(HEAD_OID, "c" * 40),
                comment_id=41,
                node_id="IC_kwDOStale",
            ),
            issue_comment(body=live_body),
        ],
    )

    assert completed.returncode == 0
    receipt = json.loads(completed.stdout)
    assert receipt["authorization_body"] == live_body
    assert receipt["rationale"] == {
        "subject": "The current source and projection are indivisible",
        "coupling": "they share the live revision",
        "consequence": "current consumers see a mixed contract.",
    }
    assert stale_body not in completed.stdout


@pytest.mark.parametrize(
    ("field", "value"),
    [
        pytest.param("id", None, id="missing-comment-id"),
        pytest.param("node_id", "", id="missing-comment-node-id"),
    ],
)
def test_authorization_receipt_requires_stable_comment_identifiers(
    fake_gh: tuple[Path, Path],
    field: str,
    value: object,
) -> None:
    comment = issue_comment()
    comment[field] = value

    completed = run_verifier(fake_gh, [comment])

    assert completed.returncode != 0
    assert completed.stdout == ""


@pytest.mark.parametrize(
    ("comments", "gh_exit"),
    [
        pytest.param([], 0, id="missing-or-deleted-comment"),
        pytest.param([issue_comment(association="MEMBER")], 0, id="member"),
        pytest.param([issue_comment(association="NONE")], 0, id="author"),
        pytest.param([issue_comment(user_type="Bot")], 0, id="bot"),
        pytest.param(
            [issue_comment(body=authorization_body(head_oid="c" * 40))],
            0,
            id="stale-comment-head",
        ),
        pytest.param(
            [issue_comment(body=authorization_body(base_oid="d" * 40))],
            0,
            id="stale-comment-base",
        ),
        pytest.param(
            [issue_comment(body=authorization_body(rationale="Needed."))],
            0,
            id="generic-rationale",
        ),
        pytest.param([issue_comment()], 42, id="github-api-failure"),
    ],
)
def test_authorization_fails_closed(
    fake_gh: tuple[Path, Path],
    comments: list[dict[str, object]],
    gh_exit: int,
) -> None:
    completed = run_verifier(fake_gh, comments, gh_exit=gh_exit)

    assert completed.returncode != 0
    assert completed.stdout == ""


def test_authorization_requires_an_explicit_one_off_grant(
    fake_gh: tuple[Path, Path],
) -> None:
    body = authorization_body().replace(
        "I authorize this one-off black-zone publication.",
        "I reviewed this black-zone publication.",
    )

    completed = run_verifier(fake_gh, [issue_comment(body=body)])

    assert completed.returncode != 0


@pytest.mark.parametrize(
    ("target_line", "extra_line"),
    [
        pytest.param(
            f"Head OID: `{HEAD_OID}`",
            f"Head OID: `{HEAD_OID}`",
            id="duplicate-head",
        ),
        pytest.param(
            f"Head OID: `{HEAD_OID}`",
            f"Head OID: `{'c' * 40}`",
            id="contradictory-head",
        ),
        pytest.param(
            f"Base OID: `{BASE_OID}`",
            f"Base OID: `{BASE_OID}`",
            id="duplicate-base",
        ),
        pytest.param(
            f"Base OID: `{BASE_OID}`",
            f"Base OID: `{'d' * 40}`",
            id="contradictory-base",
        ),
        pytest.param(
            "Authorization: I authorize this one-off black-zone publication.",
            "Authorization: I authorize this one-off black-zone publication.",
            id="duplicate-authorization",
        ),
        pytest.param(
            "Authorization: I authorize this one-off black-zone publication.",
            "Authorization: I revoke this one-off black-zone publication.",
            id="contradictory-authorization",
        ),
        pytest.param(
            "Indivisibility:",
            "Indivisibility: The files are indivisible because they share state; "
            "otherwise the build fails.",
            id="duplicate-indivisibility",
        ),
        pytest.param(
            "Indivisibility:",
            "Indivisibility: These files can be safely split.",
            id="contradictory-indivisibility",
        ),
    ],
)
def test_authorization_rejects_duplicate_or_contradictory_contract_lines(
    fake_gh: tuple[Path, Path],
    target_line: str,
    extra_line: str,
) -> None:
    lines = authorization_body().splitlines()
    insertion = next(
        index for index, line in enumerate(lines) if line.startswith(target_line)
    )
    lines.insert(insertion + 1, extra_line)

    completed = run_verifier(
        fake_gh,
        [issue_comment(body="\n".join(lines))],
    )

    assert completed.returncode != 0


@pytest.mark.parametrize("mutation", ["reordered", "extra-line"])
def test_authorization_requires_exactly_five_ordered_lines(
    fake_gh: tuple[Path, Path],
    mutation: str,
) -> None:
    lines = authorization_body().splitlines()
    if mutation == "reordered":
        lines[1], lines[2] = lines[2], lines[1]
    else:
        lines.append("Additional approval prose.")

    completed = run_verifier(
        fake_gh,
        [issue_comment(body="\n".join(lines))],
    )

    assert completed.returncode != 0


@pytest.mark.parametrize(
    "rationale",
    [
        "These files need to land together because they are related.",
        "These files need to land together; otherwise it would be inconvenient.",
        "This change is too large to split because it touches many files; otherwise review takes longer.",
    ],
)
def test_authorization_requires_coupling_and_consequence_rationale_grammar(
    fake_gh: tuple[Path, Path],
    rationale: str,
) -> None:
    completed = run_verifier(
        fake_gh,
        [issue_comment(body=authorization_body(rationale=rationale))],
    )

    assert completed.returncode != 0


@pytest.mark.parametrize(
    ("live_head_oid", "live_base_oid"),
    [
        pytest.param("c" * 40, BASE_OID, id="remote-head-drift"),
        pytest.param(HEAD_OID, "d" * 40, id="remote-base-drift"),
    ],
)
def test_authorization_fails_when_the_live_pr_revision_drifted(
    fake_gh: tuple[Path, Path],
    live_head_oid: str,
    live_base_oid: str,
) -> None:
    completed = run_verifier(
        fake_gh,
        [issue_comment()],
        live_head_oid=live_head_oid,
        live_base_oid=live_base_oid,
    )

    assert completed.returncode != 0
    assert completed.stdout == ""


def test_black_zone_draft_publication_does_not_require_prior_authorization() -> None:
    workflow = (
        PLUGIN / "skills" / "pr" / "references" / "create-update.md"
    ).read_text()
    review_loop = (
        PLUGIN / "skills" / "pr" / "references" / "review-loop.md"
    ).read_text()
    verifier = "scripts/verify-black-zone-authorization.sh"
    normalized_workflow = " ".join(workflow.split())

    assert verifier not in workflow
    assert verifier not in review_loop
    assert "as a draft without prior authorization" in normalized_workflow
    assert "review approval remains blocked" in workflow
    assert "never posts that comment" in workflow
    assert (
        "never creates or edits an exception/configuration file" in normalized_workflow
    )
    assert "dispatch review without a prior authorization receipt" in " ".join(
        review_loop.lower().split()
    )
    assert "unauthorized black zone" not in review_loop
    review_step = workflow.index("### 4. Converge review comments unless skipped")
    authorization_wait = workflow.index(
        "action: await_owner_authorization", review_step
    )
    ci_step = workflow.index("### 5. Schedule and consume the initial poll")
    assert review_step < authorization_wait < ci_step
    assert "enter step 5" in workflow[authorization_wait:ci_step]
    authorization_segment = " ".join(workflow[authorization_wait:ci_step].split())
    assert "complete `authorization_required` list" in authorization_segment
    assert "each PR URL and exact head/base OIDs" in authorization_segment

    normalized_review_loop = " ".join(review_loop.split())
    assert "every blocked PR surface" in normalized_review_loop
    assert "`pr_url`, `head_oid`, and `base_oid`" in normalized_review_loop

    size_rule = (
        PLUGIN / "standards" / "git" / "rules" / "GIT-PR-SIZE-04.md"
    ).read_text()
    normalized_rule = " ".join(size_rule.split())
    assert "Review approval blocks until" in normalized_rule
    assert "caps that event at `COMMENT`" in normalized_rule


def test_black_authorization_is_verified_fail_closed_at_review_approval() -> None:
    review = (
        PLUGIN / "skills" / "pr" / "references" / "review-workflow.md"
    ).read_text()
    normalized_review = " ".join(review.split())
    verifier = "scripts/verify-black-zone-authorization.sh"

    assert review.count(verifier) == 1
    approval_gate = review.index(verifier)
    approval_section = review.rindex("For a black-zone surface", 0, approval_gate)
    payload_build = review.index("Build the body", approval_gate)
    submit = review.index(
        '"repos/$OWNER/$REPO/pulls/$PR_NUMBER/reviews"', payload_build
    )
    assert approval_gate < payload_build < submit
    approval_contract = review[approval_section:payload_build]
    normalized_contract = " ".join(approval_contract.split())
    assert "substantive verdict is `APPROVE`" in normalized_contract
    assert "exact full head/base OIDs" in normalized_contract
    assert "human `OWNER`" in normalized_contract
    assert "missing, malformed, deleted, or mutated comment" in normalized_contract
    assert "cap the event at `COMMENT`" in normalized_contract
    assert "`REQUEST_CHANGES` remains publishable" in normalized_contract
    assert "each PR surface from its own head/base diff" in normalized_review
    assert "every black entry in `PR_SURFACES`" in normalized_review
    assert (
        "current entry's `PR_NUMBER`, `HEAD_OID`, and `BASE_OID`" in normalized_review
    )


def test_affected_contract_uses_canonical_cross_plugin_references() -> None:
    repository = PLUGIN.parents[1]
    affected_contracts = [
        *(
            PLUGIN / "skills" / "pr" / "references" / name
            for name in (
                "create-update.md",
                "review-checklist.md",
                "review-loop.md",
                "review-publishing.md",
                "review-workflow.md",
                "stacked-prs.md",
            )
        ),
        PLUGIN / "standards" / "git" / "meta.md",
        PLUGIN / "standards" / "git" / "scan.md",
        PLUGIN / "standards" / "git" / "write.md",
        *(PLUGIN / "standards" / "git" / "rules").glob("*.md"),
        PLUGIN / "skills" / "pr" / "templates" / "message.md",
        PLUGIN / "skills" / "pr" / "templates" / "inline-review.md",
        repository / "plugins" / "governance" / "references" / "context-catalog.md",
        repository
        / "plugins"
        / "governance"
        / "skills"
        / "create-agent"
        / "templates"
        / "agent.md",
    ]
    plugin_names = {
        "backend",
        "coding",
        "essential",
        "governance",
        "production",
        "react",
        "specification",
        "web",
    }
    repo_rooted = re.compile(rf"plugins/(?P<plugin>{'|'.join(sorted(plugin_names))})/")
    bare_plugin_path = re.compile(
        rf"(?<![:/])\b(?P<plugin>{'|'.join(sorted(plugin_names))})/"
        r"(?:agents|directions|hooks|references|scripts|skills|standards|templates)/"
    )
    relative_link = re.compile(r"\]\((?P<target>\.\.?/[^)#\s]+)\)")
    failures = []

    for path in affected_contracts:
        owner = path.relative_to(repository / "plugins").parts[0]
        content = path.read_text()
        for pattern in (repo_rooted, bare_plugin_path):
            for match in pattern.finditer(content):
                if match.group("plugin") != owner:
                    failures.append(f"{path}: {match.group(0)}")
        for match in relative_link.finditer(content):
            target = (path.parent / match.group("target")).resolve()
            try:
                target_plugin = target.relative_to(repository / "plugins").parts[0]
            except ValueError:
                continue
            if target_plugin != owner:
                failures.append(f"{path}: {match.group('target')}")

    assert failures == []
    context_catalog_path = (
        repository / "plugins" / "governance" / "references" / "context-catalog.md"
    )
    agent_template_path = (
        repository
        / "plugins"
        / "governance"
        / "skills"
        / "create-agent"
        / "templates"
        / "agent.md"
    )
    context_catalog = context_catalog_path.read_text()
    agent_template = agent_template_path.read_text()
    create_update = affected_contracts[0].read_text()
    review_loop = affected_contracts[2].read_text()
    assert "coding:standards/git/" in context_catalog
    assert "## Pull-request directions" in create_update
    assert "essential:templates/memory.md" in context_catalog
    assert "essential:templates/memory.md" in agent_template
    assert "governance:standards/delegation/" in create_update
    assert "governance:standards/delegation/" in review_loop


def test_repository_files_cannot_reclassify_fixed_pr_size_zones() -> None:
    pr_skill = PLUGIN / "skills" / "pr"
    policy_paths = [
        PLUGIN / "standards" / "git" / "meta.md",
        PLUGIN / "standards" / "git" / "scan.md",
        PLUGIN / "standards" / "git" / "write.md",
        *(PLUGIN / "standards" / "git" / "rules").glob("GIT-PR-SIZE-*.md"),
        pr_skill / "references" / "create-update.md",
        pr_skill / "references" / "review-workflow.md",
        pr_skill / "references" / "review-loop.md",
        pr_skill / "references" / "stacked-prs.md",
    ]
    policy = "\n".join(path.read_text() for path in policy_paths)
    normalized_policy = " ".join(policy.split())
    retired_override_name = "standard-" + "overrides"

    assert retired_override_name not in policy
    assert "≤ 60 files" in policy
    assert "≤ 2000 authored net LOC" in policy
    assert "> 60 files" in policy
    assert "> 2000 authored net LOC" in policy
    assert (
        "repository configuration cannot change these thresholds" in normalized_policy
    )
