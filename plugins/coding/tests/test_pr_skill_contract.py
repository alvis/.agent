import json
import os
import shutil
import subprocess
from pathlib import Path

PLUGIN = Path(__file__).resolve().parents[1]
WRITE_PR = PLUGIN / "skills" / "pr"


def test_authoring_binds_all_deterministic_inputs_and_publication_output() -> None:
    skill = (WRITE_PR / "references" / "create-update.md").read_text()

    assert "`git hash-object -t tree /dev/null`" in skill
    assert "head's `TITLE` and `BODY`" in skill
    assert "base/empty-tree OID" in skill
    assert "template, thresholds, and placeholder map" in skill
    assert "`BREAKING CHANGE:` footers" in skill


def test_canonical_template_carries_section_authoring_guidance() -> None:
    template = (WRITE_PR / "templates" / "pr.md").read_text()

    assert "what problem it solves and why" in template
    assert "design patterns" in template
    assert "anything a reader would reasonably expect here" in template
    assert "RFCs, specs, and discussions" in template


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
    assert "For a suffix restack, `PR_BASE_01` is the unselected predecessor" in normalized
    assert "keep it unchanged for a retry only while" in normalized
    assert "discovery restart or base-map change recomputes it" in normalized


def test_reviewer_evidence_binds_to_the_complete_review_surface() -> None:
    skill = (WRITE_PR / "references" / "create-update.md").read_text()
    template = (WRITE_PR / "templates" / "pr.md").read_text()

    assert "capture an existing PR's `headRefOid` and" in skill
    assert "`baseRefOid`" in skill
    assert "only where the head or base OID changed" in skill
    assert "head/base OID pairs" in template
    assert "no-op publication preserves evidence" in template
    assert "unchanged pair" in template
    assert "standard-owned" in template
    assert "<base-oid>" in template


def test_merged_skill_resolves_bundled_helpers_for_resource_lifetimes() -> None:
    router = (WRITE_PR / "SKILL.md").read_text()
    create_update = (WRITE_PR / "references" / "create-update.md").read_text()
    merge = (WRITE_PR / "references" / "merge.md").read_text()
    review_extraction = (
        WRITE_PR / "references" / "review-extraction.md"
    ).read_text()
    review = (WRITE_PR / "references" / "review-workflow.md").read_text()

    assert "set `CODING_PR_SKILL_DIR` to the absolute directory" in router
    helper_consumers = {
        "scripts/preflight-jj-range-push.sh": (merge,),
        "scripts/temp-tree.sh": (create_update, review_extraction, review),
        "scripts/review-scan.sh": (review,),
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

    assert "Summary, Verification" in review
    assert "Summary, Checklist" not in review


def test_correct_merged_monitoring_stays_read_only() -> None:
    workflow = (
        WRITE_PR.parent
        / "commit"
        / "references"
        / "workflow-correct-merged.md"
    ).read_text()
    followups = workflow.split("## Mandatory follow-ups", 1)[1]

    assert "read-only `gh pr checks`" in followups
    assert "`coding:pr update`" not in followups


def test_owned_trees_bind_outputs_and_keep_cleanup_in_parent() -> None:
    create_update = (WRITE_PR / "references" / "create-update.md").read_text()
    extraction = (WRITE_PR / "references" / "review-extraction.md").read_text()
    helper = (WRITE_PR / "scripts" / "temp-tree.sh").read_text()

    assert "TEST_WORKTREE=$(jq -er .tree" in create_update
    assert "context-owning parent passes only" in create_update
    assert "neither removes the worktree nor closes or reports on the parent-owned" in create_update
    assert "After consuming each batch report" in create_update
    assert "never transfers cleanup ownership" in create_update
    assert (
        'open-clone "https://$HOST/$OWNER/$REPO" "$PR_NUMBER" "$HEAD_OID"'
        in extraction
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
    assert subprocess.run(
        ["git", "-C", str(tree), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip() == head
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
    post_verify = helper.split(
        '[ "$remote_sha" = "$expected_sha" ]', 1
    )[1]
    assert post_verify.index("restacked[") < post_verify.index('gh pr edit "$bookmark"')


def test_create_update_binds_remote_before_publication_and_reuses_it() -> None:
    workflow = (WRITE_PR / "references" / "create-update.md").read_text()
    normalized = " ".join(workflow.split())

    binding = workflow.index("REMOTE=${CALLER_REMOTE:-}")
    first_restack = workflow.index("scripts/restack.sh")
    assert binding < first_restack
    assert 'git remote get-url --push -- "$REMOTE"' in workflow
    assert 'git remote get-url --push -- "$CANDIDATE"' in workflow
    assert "sole remote whose push URL resolves through GitHub" in normalized
    assert "Record `REMOTE`" in workflow
    assert 'jj git fetch --remote "$REMOTE"' in workflow
    assert 'git fetch -- "$REMOTE"' in workflow


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


def test_rewrites_route_unpublished_stacks_to_create() -> None:
    references = [
        WRITE_PR.parent / "commit" / "references" / "workflow-edit.md",
        WRITE_PR.parent / "commit" / "references" / "workflow-reorder.md",
        WRITE_PR.parent / "commit" / "references" / "workflow-retrospective.md",
    ]

    for reference in references:
        workflow = reference.read_text()
        assert "`coding:pr create` when none has one" in workflow
        assert "`coding:pr update` against the lowest open head" in workflow


def test_reviewer_receives_the_pinned_mission_capsule() -> None:
    review = (WRITE_PR / "references" / "review-workflow.md").read_text()

    assert "bounded mission capsule" not in review
    assert "`PR_SURFACES` array" in review
    assert "one clean `REVIEW_DIR` at the top head" in review
    assert "reviews the complete stack diff against the bottom base" in review
    assert "holistically" in review
    assert "one holistic map" in review
    assert "A stack never receives a second lease" in review


def test_stacked_local_checks_are_batched_and_cleanup_every_lease() -> None:
    workflow = (WRITE_PR / "references" / "create-update.md").read_text()

    assert "batches of at most ten" in workflow
    assert "one fresh small-model" in workflow
    assert "retain every returned lease/tree" in workflow
    assert "closes only a completed batch's leases" in workflow
    assert "retains" in workflow
    assert "undispatched batches" in workflow
    assert "recreate the affected" in workflow
    assert "neither removes the worktree nor closes or reports on" in workflow
    report = workflow.split("<report>", 1)[1].split("</report>", 1)[0]
    assert "temporary_worktree_cleanup" not in report


def test_pr_metadata_stays_internal_and_template_owns_rationale() -> None:
    workflow = (WRITE_PR / "references" / "create-update.md").read_text()
    template = (WRITE_PR / "templates" / "pr.md").read_text()
    standard = (
        PLUGIN
        / "standards"
        / "git"
        / "rules"
        / "GIT-PR-SIZE-03.md"
    ).read_text()

    assert "specific indivisibility prose" in workflow
    assert "## Why this size" in template
    assert "reviewer-time estimates" in template
    assert "reviewer-time estimate" not in standard
    assert "size counts, zone metadata" in workflow
    assert "## 🧪 Verification" in template


def test_black_zone_requires_complete_body_and_live_authorization_receipt() -> None:
    create_update = (WRITE_PR / "references" / "create-update.md").read_text()
    review = (WRITE_PR / "references" / "review-workflow.md").read_text()
    publishing = (WRITE_PR / "references" / "review-publishing.md").read_text()
    checklist = (WRITE_PR / "references" / "review-checklist.md").read_text()
    rule = (PLUGIN / "standards" / "git" / "rules" / "GIT-PR-SIZE-04.md").read_text()

    assert (
        "requires specific `## Risk`, `## Test plan`, and `## Why this size`"
        in create_update
    )
    assert "yellow/red/black" in create_update
    assert "Risk, Test plan, Why this size" in review
    for contract in (review, publishing):
        assert "`comment_url`" in contract
        assert "`authorization_body`" in contract
        assert "`rationale`" in contract
        assert "sole semantic authorization-review input" in contract
    assert "earlier fetched comment or body" in checklist
    assert "earlier fetched comment or" in rule


def test_archetype_is_a_preflighted_label_not_pr_content() -> None:
    workflow = (WRITE_PR / "references" / "create-update.md").read_text()
    template = (WRITE_PR / "templates" / "pr.md").read_text()

    assert "Preflight the repository labels before any push" in workflow
    assert "never create or silently substitute a label" in workflow
    assert "exactly one archetype label remains" in workflow
    assert '--label "$ARCHETYPE"' in workflow
    assert 'PR=$(gh pr create' in workflow
    assert '--remove-label "$label"' in workflow
    assert 'gh pr view "$PR" --json labels' in workflow
    assert 'EXPECTED_ARCHETYPES=$(jq -cn --arg label "$ARCHETYPE"' in workflow
    assert 'test "$ACTUAL_ARCHETYPES" = "$EXPECTED_ARCHETYPES"' in workflow
    assert workflow.index("ARCHETYPE_LABELS='[") < workflow.index('PR=$(gh pr create')
    assert "The label is never rendered in the title or" in template
    assert "## Category" not in template


def test_generated_files_section_is_conditional_and_emoji_named() -> None:
    workflow = (WRITE_PR / "references" / "create-update.md").read_text()
    template = (WRITE_PR / "templates" / "pr.md").read_text()

    assert "## 🏭 Generated Files" in template
    assert "whenever any generated files exist" in template
    assert "`{{generated_files_body}}`" in workflow


def test_repo_local_templates_enforce_conditional_evidence_before_emission() -> None:
    workflow = (WRITE_PR / "references" / "create-update.md").read_text()
    local_template_gate = workflow.split(
        "<IMPORTANT>A repo-local template is emitted verbatim", 1
    )[1].split("When no repo-local template exists", 1)[0]

    assert "every predicate" in local_template_gate
    assert "archetype-required, and diff-required" in local_template_gate
    assert "never inserts category, label, title, or body metadata" in local_template_gate
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

    assert "github.com/github/gh-stack/blob/main/skills/gh-stack/SKILL.md" in github_stacks
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
    for forbidden in ("gh stack rebase", "gh stack sync", "gh stack push", "gh stack submit"):
        assert forbidden not in jj_route
    for command in ("gh stack rebase", "gh stack sync", "gh stack push"):
        assert command in git_route


def test_github_stack_actions_attempt_the_command_before_optional_installation() -> None:
    github_stacks = (WRITE_PR / "references" / "github-stacks.md").read_text()

    direct_attempt = github_stacks.index("Attempt the requested command or API call directly")
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
    assert "For every request to create, inspect, update, restructure, publish" in router
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

    assert "/coding:pr create [<commit-ref>] [--branch-prefix <name>] [--remote <name>]" in router
    assert "/coding:pr update [<pr-number-or-url> | <commit-ref>] [--branch-prefix <name>] [--remote <name>]" in router
    assert "[--method=rebase|squash|merge] [--remote <name>] [--destination <branch>] [--force]" in router


def test_generic_stack_contract_delegates_github_listing_without_restatement() -> None:
    stacked = (WRITE_PR / "references" / "stacked-prs.md").read_text()
    normalized = " ".join(stacked.split())

    assert "Load [github-stacks.md](github-stacks.md) for every GitHub PR-stack request" in normalized
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
    assert 'GET /repos/{owner}/{repo}/stacks' in github_stacks
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
    assert "`gh stack up [n]`, `down [n]`, `top`, `bottom`, and `trunk`" in github_stacks


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


def test_github_stack_failures_report_actual_errors_and_verify_the_owned_scope() -> None:
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
        fenced.split("\n```", 1)[0]
        for fenced in github_stacks.split("```bash\n")[1:]
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

    checkout_command = checkout.index(
        'gh stack checkout "$STACK_SELECTOR" || exit $?'
    )
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

    assert merge.count('scripts/preflight-jj-range-push.sh') == 1
    assert 'scripts/test-jj-range-push.sh' in merge
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
    bookmark_preflight = helper.index('bookmark list')
    tag_preflight = helper.index('tag list')
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
    assert "dedicated reviewer performs this phase after the parent has located or" in workflow
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
