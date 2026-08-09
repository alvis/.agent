"""Breadth-first crawl queue with URL normalization and origin filtering."""

from __future__ import annotations

import urllib.parse
from dataclasses import dataclass, field


@dataclass
class CrawlQueue:
    """Same-origin BFS queue with URL normalization.

    Cross-origin URLs are surfaced via ``cross_origin`` so callers can
    either present them as candidates for out-of-crawl review or enqueue
    them when ``--all-pages`` is on. Interaction fingerprints visited
    during the crawl are tracked separately so no element is exercised
    twice across pages.
    """

    origin: str
    _queue: list[str] = field(default_factory=list)
    _visited: set[str] = field(default_factory=set)
    _interactions: set[str] = field(default_factory=set)
    cross_origin: list[str] = field(default_factory=list)

    def enqueue(self, url: str) -> bool:
        """Add a URL if it is same-origin and not yet visited."""
        normalized = normalize_url(url)
        if not normalized:
            return False
        if not self._is_same_origin(normalized):
            if normalized not in self.cross_origin:
                self.cross_origin.append(normalized)
            return False
        if normalized in self._visited or normalized in self._queue:
            return False
        self._queue.append(normalized)
        return True

    def enqueue_many(self, urls: list[str]) -> int:
        """Enqueue each URL, returning how many were accepted."""
        accepted = 0
        for url in urls:
            if self.enqueue(url):
                accepted += 1
        return accepted

    def pop(self) -> str | None:
        """Remove and return the next URL, or ``None`` if drained."""
        if not self._queue:
            return None
        url = self._queue.pop(0)
        self._visited.add(url)
        return url

    def has_pending(self) -> bool:
        """Return True while the queue still has unvisited URLs."""
        return bool(self._queue)

    def register_interaction(self, fingerprint: str) -> bool:
        """Mark a fingerprint as exercised; return False if already seen."""
        if fingerprint in self._interactions:
            return False
        self._interactions.add(fingerprint)
        return True

    def visited(self) -> frozenset[str]:
        """Return an immutable view of visited URLs."""
        return frozenset(self._visited)

    def _is_same_origin(self, url: str) -> bool:
        parsed = urllib.parse.urlparse(url)
        origin_parsed = urllib.parse.urlparse(self.origin)
        return (
            parsed.scheme.lower() == origin_parsed.scheme.lower()
            and parsed.netloc.lower() == origin_parsed.netloc.lower()
        )


def normalize_url(url: str) -> str:
    """Return a canonical URL (no fragment, no trailing slash except root)."""
    if not url:
        return ""
    parsed = urllib.parse.urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return ""
    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    query = parsed.query
    rebuilt = urllib.parse.urlunparse(
        (parsed.scheme.lower(), parsed.netloc.lower(), path, "", query, "")
    )
    return rebuilt
