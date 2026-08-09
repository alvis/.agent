"""Fetch sitemap.xml and robots.txt over stdlib urllib.

Returns host-filtered URL lists. Network errors are swallowed into empty
lists so the crawler can proceed with source-derived routes alone.
"""

from __future__ import annotations

import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass

_SITEMAP_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
_USER_AGENT = "audit-cli/0.1 (+https://github.com/anthropic)"
_TIMEOUT_SECONDS = 8.0


@dataclass(frozen=True)
class SitemapResult:
    """Outcome of a sitemap/robots discovery attempt."""

    urls: tuple[str, ...]
    sitemaps_tried: tuple[str, ...]
    errors: tuple[str, ...]


def fetch_sitemap_urls(base_url: str) -> SitemapResult:
    """Fetch same-host URLs from sitemap.xml plus any sitemaps in robots.txt."""
    base_host = _host_of(base_url)
    if not base_host:
        return SitemapResult(urls=(), sitemaps_tried=(), errors=("invalid base URL",))

    sitemap_candidates = _collect_sitemap_candidates(base_url)
    urls: list[str] = []
    errors: list[str] = []
    tried: list[str] = []

    for sm_url in sitemap_candidates:
        tried.append(sm_url)
        body = _fetch_text(sm_url)
        if body is None:
            continue
        try:
            root = ET.fromstring(body)
        except ET.ParseError as exc:
            errors.append(f"parse error at {sm_url}: {exc}")
            continue

        for loc in root.findall(".//sm:url/sm:loc", _SITEMAP_NS):
            if loc.text and _host_of(loc.text) == base_host:
                urls.append(loc.text.strip())
        for loc in root.findall(".//sm:sitemap/sm:loc", _SITEMAP_NS):
            if loc.text and loc.text not in tried:
                nested = _fetch_text(loc.text.strip())
                if nested is None:
                    continue
                try:
                    nested_root = ET.fromstring(nested)
                except ET.ParseError as exc:
                    errors.append(f"parse error at {loc.text}: {exc}")
                    continue
                for inner in nested_root.findall(".//sm:url/sm:loc", _SITEMAP_NS):
                    if inner.text and _host_of(inner.text) == base_host:
                        urls.append(inner.text.strip())

    deduped = tuple(dict.fromkeys(urls))
    return SitemapResult(urls=deduped, sitemaps_tried=tuple(tried), errors=tuple(errors))


def _collect_sitemap_candidates(base_url: str) -> list[str]:
    parsed = urllib.parse.urlparse(base_url)
    root_url = f"{parsed.scheme}://{parsed.netloc}"
    candidates: list[str] = [f"{root_url}/sitemap.xml"]

    robots = _fetch_text(f"{root_url}/robots.txt")
    if robots:
        for line in robots.splitlines():
            lowered = line.strip().lower()
            if lowered.startswith("sitemap:"):
                value = line.split(":", 1)[1].strip()
                if value and value not in candidates:
                    candidates.append(value)
    return candidates


def _fetch_text(url: str) -> str | None:
    request = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            data: bytes = response.read()
            charset = response.headers.get_content_charset() or "utf-8"
            return data.decode(charset, errors="replace")
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError):
        return None


def _host_of(url: str) -> str:
    try:
        return urllib.parse.urlparse(url).netloc.lower()
    except ValueError:
        return ""
