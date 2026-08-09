"""Pure interaction discovery from an agent-browser snapshot.

Given an accessibility-tree snapshot, produce a deduplicated plan of
interactive elements to exercise. Cross-origin links are partitioned:
known social hosts are dropped silently, everything else becomes a
candidate for out-of-crawl review.
"""

from __future__ import annotations

import hashlib
import re
import urllib.parse
from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence

from audit_cli.types import InteractionCandidate, InteractionPlan

INTERACTIVE_ROLES: frozenset[str] = frozenset(
    {
        "button",
        "checkbox",
        "combobox",
        "link",
        "menu",
        "menubar",
        "menuitem",
        "menuitemcheckbox",
        "menuitemradio",
        "option",
        "radio",
        "searchbox",
        "slider",
        "spinbutton",
        "switch",
        "tab",
        "textbox",
        "treeitem",
    }
)

SOCIAL_HOST_DENYLIST: frozenset[str] = frozenset(
    {
        "x.com",
        "twitter.com",
        "instagram.com",
        "facebook.com",
        "linkedin.com",
        "youtube.com",
        "tiktok.com",
        "github.com",
        "reddit.com",
        "pinterest.com",
        "threads.net",
        "mastodon.social",
        "discord.gg",
        "t.me",
    }
)

FRAMEWORK_OVERLAY_NAMES: frozenset[str] = frozenset(
    {
        "open next.js dev tools",
        "close next.js dev tools",
    }
)

_REF_UID_RE = re.compile(r"^e(\d+)$")


@dataclass(frozen=True)
class DiscoverOptions:
    """Options controlling interaction discovery.

    Setting ``all_pages=True`` retains ``link`` role in the candidate plan so
    that link-style toggles (menus, accordions implemented as ``<a>``) are
    exercised. When false, links are only accumulated as crawl targets.
    """

    all_pages: bool = False
    same_origin_host: str | None = None


def discover_interactions(
    snapshot: Mapping[str, object],
    options: DiscoverOptions | None = None,
) -> InteractionPlan:
    """Return a deduplicated interaction plan built from an AX snapshot.

    ``snapshot`` must be a dict with at least a ``nodes`` list (agent-browser
    ``snapshot -i`` JSON shape). Each node is expected to expose ``uid``,
    ``role``, ``name``, optional ``expanded``, optional ``url``, and
    optional ``ancestors`` (a sequence of role/name pairs).
    """
    opts = options or DiscoverOptions()
    nodes = _coerce_nodes(snapshot.get("nodes"))
    if not nodes:
        nodes = _coerce_nodes(snapshot.get("refs"))

    seen_fingerprints: set[str] = set()
    candidates: list[InteractionCandidate] = []
    cross_origin: list[str] = []
    dropped_social: list[str] = []

    for node in nodes:
        role = str(node.get("role", "")).lower()
        if role not in INTERACTIVE_ROLES:
            continue
        if _is_framework_overlay_control(node):
            continue

        url_value = node.get("url")
        if role == "link" and isinstance(url_value, str) and url_value:
            bucket = _classify_link(url_value, opts.same_origin_host)
            if bucket == "social":
                dropped_social.append(url_value)
                continue
            if bucket == "cross-origin":
                cross_origin.append(url_value)
                if not opts.all_pages:
                    continue
            if bucket == "same-origin" and not opts.all_pages:
                continue
        elif role == "link" and not opts.all_pages:
            # Live ``snapshot`` payloads may omit URL detail from ``refs``.
            # Keep link-role elements out of the interaction crawl unless
            # ``all_pages`` explicitly asks us to exercise link-style toggles.
            continue

        uid_raw = node.get("uid")
        if not isinstance(uid_raw, int):
            continue

        name = str(node.get("name", ""))
        expanded_raw = node.get("expanded")
        expanded: bool | None = expanded_raw if isinstance(expanded_raw, bool) else None
        ancestors = _coerce_ancestors(node.get("ancestors"))

        fingerprint = _fingerprint(role, name, expanded, ancestors)
        if fingerprint in seen_fingerprints:
            continue
        seen_fingerprints.add(fingerprint)

        candidates.append(
            InteractionCandidate(
                uid=uid_raw,
                role=role,
                name=name,
                fingerprint=fingerprint,
                expanded=expanded,
            )
        )

    return InteractionPlan(
        candidates=tuple(candidates),
        cross_origin_candidates=tuple(dict.fromkeys(cross_origin)),
        dropped_social=tuple(dict.fromkeys(dropped_social)),
    )


def discover_hover_targets(snapshot: Mapping[str, object]) -> tuple[int, ...]:
    """Return AX uids to exercise with hover feedback checks.

    Source-of-truth is the snapshot's interactive nodes: agent-browser
    does not tag DOM elements with uids, so the union with
    ``cursor: pointer`` / ``onclick`` DOM elements cannot round-trip
    through ``driver.evaluate`` without an external uid bridge. Snapshot
    roles cover the common cases (buttons, links, tabs) that carry
    real ``:hover`` feedback in practice.
    """
    nodes = _coerce_nodes(snapshot.get("nodes"))
    if not nodes:
        nodes = _coerce_nodes(snapshot.get("refs"))
    seen: set[int] = set()
    ordered: list[int] = []
    for node in nodes:
        role = str(node.get("role", "")).lower()
        if role not in INTERACTIVE_ROLES:
            continue
        if _is_framework_overlay_control(node):
            continue
        uid_raw = node.get("uid")
        if not isinstance(uid_raw, int) or uid_raw in seen:
            continue
        seen.add(uid_raw)
        ordered.append(uid_raw)
    return tuple(ordered)


def _coerce_nodes(value: object) -> Sequence[Mapping[str, object]]:
    if isinstance(value, list):
        out: list[Mapping[str, object]] = []
        for item in value:
            if isinstance(item, dict):
                out.append(item)
        return out
    if isinstance(value, dict):
        out = []
        for ref, item in value.items():
            if not isinstance(item, dict):
                continue
            uid = _uid_from_ref(ref)
            if uid is None:
                continue
            out.append({"uid": uid, **item})
        return out
    return ()


def _uid_from_ref(ref: object) -> int | None:
    if not isinstance(ref, str):
        return None
    match = _REF_UID_RE.match(ref.strip())
    if not match:
        return None
    return int(match.group(1))


def _coerce_ancestors(value: object) -> tuple[tuple[str, str], ...]:
    if not isinstance(value, list):
        return ()
    out: list[tuple[str, str]] = []
    for item in value:
        if isinstance(item, dict):
            role = str(item.get("role", ""))
            name = str(item.get("name", ""))
            out.append((role, name))
        elif isinstance(item, (list, tuple)) and len(item) >= 2:
            out.append((str(item[0]), str(item[1])))
    return tuple(out)


def _fingerprint(
    role: str,
    name: str,
    expanded: bool | None,
    ancestors: Iterable[tuple[str, str]],
) -> str:
    payload = "|".join(
        [
            role.strip().lower(),
            name.strip().lower(),
            "exp=" + ("1" if expanded else "0" if expanded is False else "-"),
            ">".join(f"{r}:{n}" for r, n in ancestors),
        ]
    )
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def _classify_link(url: str, same_origin_host: str | None) -> str:
    parsed = urllib.parse.urlparse(url)
    host = parsed.netloc.lower()
    if not host:
        return "same-origin"
    if _is_social_host(host):
        return "social"
    if same_origin_host and host == same_origin_host.lower():
        return "same-origin"
    return "cross-origin"


def _is_social_host(host: str) -> bool:
    host = host.lstrip("www.")
    for denied in SOCIAL_HOST_DENYLIST:
        if host == denied or host.endswith("." + denied):
            return True
    return False


def _is_framework_overlay_control(node: Mapping[str, object]) -> bool:
    role = str(node.get("role", "")).strip().lower()
    name = str(node.get("name", "")).strip().lower()
    return role == "button" and name in FRAMEWORK_OVERLAY_NAMES
