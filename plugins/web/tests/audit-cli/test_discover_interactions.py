"""Verify fingerprint dedup + cross-origin classification for interactions."""

import json
from pathlib import Path

from audit_cli.discover.interactions import (
    DiscoverOptions,
    discover_hover_targets,
    discover_interactions,
)

_FIXTURE_DIR = Path(__file__).parent / "fixtures"


def _load(name: str) -> dict[str, object]:
    payload = json.loads((_FIXTURE_DIR / name).read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return payload


def test_ten_identical_buttons_dedup_to_single_candidate() -> None:
    snapshot = _load("ax_snapshot_dup_buttons.json")
    plan = discover_interactions(snapshot)
    assert [
        (candidate.role, candidate.name) for candidate in plan.candidates
    ] == [("button", "Add to cart")]


def test_social_link_is_dropped_silently() -> None:
    snapshot = _load("ax_snapshot_with_social.json")
    plan = discover_interactions(snapshot)
    assert "https://x.com/acme" in plan.dropped_social
    assert all(candidate.role != "link" for candidate in plan.candidates)


def test_non_denylist_cross_origin_becomes_candidate() -> None:
    snapshot = _load("ax_snapshot_with_social.json")
    plan = discover_interactions(snapshot)
    assert "https://partner.com/login" in plan.cross_origin_candidates


def test_all_pages_mode_retains_link_role() -> None:
    snapshot = _load("ax_snapshot_with_social.json")
    plan = discover_interactions(snapshot, DiscoverOptions(all_pages=True))
    link_candidates = [c for c in plan.candidates if c.role == "link"]
    assert any(c.name == "Partner portal" for c in link_candidates)
    assert all(c.name != "Follow on X" for c in link_candidates)


def test_refs_snapshot_shape_discovers_button_candidates() -> None:
    snapshot = {
        "refs": {
            "e17": {"name": "Open menu", "role": "button"},
            "e18": {"name": "Overview", "role": "link"},
        },
        "snapshot": "- button \"Open menu\" [ref=e17]\\n- link \"Overview\" [ref=e18]",
    }

    plan = discover_interactions(snapshot)

    assert [
        (candidate.uid, candidate.role, candidate.name)
        for candidate in plan.candidates
    ] == [(17, "button", "Open menu")]


def test_refs_snapshot_shape_discovers_hover_targets() -> None:
    snapshot = {
        "refs": {
            "e17": {"name": "Open menu", "role": "button"},
            "e18": {"name": "Overview", "role": "link"},
        },
        "snapshot": "- button \"Open menu\" [ref=e17]\\n- link \"Overview\" [ref=e18]",
    }

    targets = discover_hover_targets(snapshot)

    assert targets == (17, 18)


def test_root_shell_same_origin_links_do_not_count_without_all_pages() -> None:
    snapshot = {
        "refs": {
            "e4": {"name": "Open navigation menu", "role": "button"},
            "e5": {
                "name": "Overview",
                "role": "link",
                "url": "http://127.0.0.1:3200/",
            },
            "e6": {
                "name": "Company",
                "role": "link",
                "url": "http://127.0.0.1:3200/about",
            },
            "e7": {
                "name": "Careers",
                "role": "link",
                "url": "http://127.0.0.1:3200/careers",
            },
        }
    }

    plan = discover_interactions(
        snapshot,
        DiscoverOptions(all_pages=False, same_origin_host="127.0.0.1:3200"),
    )

    assert [
        (candidate.role, candidate.name) for candidate in plan.candidates
    ] == [("button", "Open navigation menu")]


def test_next_dev_overlay_button_is_ignored() -> None:
    snapshot = {
        "refs": {
            "e4": {"name": "Open navigation menu", "role": "button"},
            "e35": {"name": "Open Next.js Dev Tools", "role": "button"},
        }
    }

    plan = discover_interactions(snapshot)

    assert [
        (candidate.uid, candidate.name) for candidate in plan.candidates
    ] == [(4, "Open navigation menu")]


def test_next_dev_overlay_button_is_ignored_for_hover_targets() -> None:
    snapshot = {
        "refs": {
            "e4": {"name": "Open navigation menu", "role": "button"},
            "e35": {"name": "Open Next.js Dev Tools", "role": "button"},
        }
    }

    targets = discover_hover_targets(snapshot)

    assert targets == (4,)
