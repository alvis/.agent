# GIT-PR-SIZE-04: Black Zone PR Size

## Severity

warning

## Intent

A black-zone PR changes **> 60 files** OR **> 2000 LOC**. The lint reports the concise canonical finding below and publication blocks until the PR is split or a justified project threshold override moves it below black.

## Fix

Report this finding once; do not auto-post a canned PR comment:

```text
Black-zone PR: split the review surface or record a justified project threshold override.
```

If splitting is genuinely impossible, apply the project-local threshold escape;
the canonical PR template owns the indivisibility rationale in the body.

```toml
# standard-overrides.toml
[git.pr.thresholds]
files_red   = 80
loc_red     = 2800
```

### Why this matters

- Reviewer recall drops sharply past ~60 files; bugs hide in the long tail of the diff.
- A flag-only approach respects engineering judgment for legitimate atomic changes while making oversize the conscious exception, not the default.
- Project-local overrides keep the rule honest for repos where larger PRs are normal (monorepo-wide upgrades, vendor drops).

## Edge Cases

- A black PR that is 95 % `GIT-PR-TYPE-05` generated files (e.g. SDK regeneration) is the canonical justified override; the human-authored diff still must fit in red or below.
- A black PR opened for "speed of review" contradicts the rule — speed is exactly what the zone threshold protects.
- Override only the smallest necessary band; do not raise green thresholds to mask habitual oversize work.

## Related

GIT-PR-SIZE-02, GIT-PR-SIZE-03, GIT-PR-TYPE-02, GIT-PR-TYPE-03, GIT-PR-TYPE-04, GIT-PR-TYPE-05, GIT-PR-STACK-05
